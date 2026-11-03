// backend/tests/realityPhase5f3LogisticsConfidence.test.js

const {
  evaluateDayTime,
  evaluateTripTime,
  SLOT_CAPACITIES_MINUTES,
  TRANSIT_BUFFER_MINUTES,
} = require("../services/realityEngine/timeEngine");

const { evaluateTripPace } = require("../services/realityEngine/paceEngine");
const { evaluateTripReality } = require("../services/realityEngine");

describe("Phase 5F.3 — Duration Confidence & Inferred Duration Handling", () => {
  it("treats an explicit 120-minute activity as confirmed without confidence dampening", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 120, durationInferred: false, title: "Museum Tour" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.inferredDurationCount).toBe(0);
    expect(res.totalActiveMinutes).toBe(120);
    expect(res.issues.length).toBe(0);
  });

  it("treats an unannotated activity as inferred 120 minutes with inferredDurationCount tracking", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", title: "Unannotated Stroll" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.inferredDurationCount).toBe(1);
    expect(res.totalActiveMinutes).toBe(120);
    expect(res.issues.length).toBe(0);
  });

  it("dampens slot overrun severity when majority of activities in slot are inferred", () => {
    // 3 activities without explicit duration = 3 x 120m = 360m in 240m slot (120m overrun)
    // Confirmed overrun would be high severity (-15). Confidence dampens to medium (-8).
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", title: "Stop A" }, // inferred 120m
        { id: "act-2", period: "morning", title: "Stop B" }, // inferred 120m
        { id: "act-3", period: "morning", title: "Stop C" }, // inferred 120m
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.inferredDurationCount).toBe(3);
    expect(res.totalActiveMinutes).toBe(360);

    const slotIssue = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotIssue).toBeDefined();
    expect(slotIssue.severity).toBe("medium"); // Dampened from high to medium
    expect(slotIssue.confidence).toBe("inferred");
    expect(slotIssue.durationInferred).toBe(true);
    expect(slotIssue.message).toContain("Estimated schedule (durations inferred)");
  });

  it("applies full confirmed severity when majority of activities in slot have explicit durations", () => {
    // 2 explicit activities (150m + 150m = 300m) + 1 inferred (120m) = 420m in 240m slot
    // Inferred ratio: 1/3 <= 0.5 -> Confirmed overload!
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 150, title: "Explicit Hike" },
        { id: "act-2", period: "morning", durationMinutes: 150, title: "Explicit Dive" },
        { id: "act-3", period: "morning", title: "Quick Stop" }, // inferred 120m
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.inferredDurationCount).toBe(1);
    expect(res.totalActiveMinutes).toBe(420);

    const slotIssue = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotIssue).toBeDefined();
    expect(slotIssue.severity).toBe("high"); // Confirmed high severity
    expect(slotIssue.confidence).toBe("confirmed");
    expect(slotIssue.durationInferred).toBe(false);
  });

  it("handles missing duration in a legacy itinerary gracefully without false high-penalty daily overload", () => {
    // 5 activities without explicit duration in a day -> 5 x 120m = 600m (>540m)
    // 100% inferred -> dampened to low severity (advisory) instead of punitive medium/high
    const day = {
      day: 1,
      activities: [
        { id: "a1", period: "morning", title: "A1" },
        { id: "a2", period: "morning", title: "A2" },
        { id: "a3", period: "afternoon", title: "A3" },
        { id: "a4", period: "afternoon", title: "A4" },
        { id: "a5", period: "evening", title: "A5" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.inferredDurationCount).toBe(5);

    const dailyOverload = res.issues.find((i) => i.type === "daily_overload");
    expect(dailyOverload).toBeDefined();
    expect(dailyOverload.severity).toBe("low"); // Dampened to low for 100% inferred day
    expect(dailyOverload.confidence).toBe("inferred");
    expect(dailyOverload.message).toContain("durations inferred");
  });

  it("safely handles invalid, zero, and negative duration values without NaN", () => {
    const day = {
      day: 1,
      activities: [
        { id: "a1", period: "morning", durationMinutes: 0, title: "Zero Min" },
        { id: "a2", period: "morning", durationMinutes: -45, title: "Negative Min" },
        { id: "a3", period: "morning", durationMinutes: "NaN", title: "String NaN" },
      ],
    };
    const res = evaluateDayTime(day);
    // a1: 0 (explicit), a2: 0 (explicit clamped), a3: 120 (fallback)
    expect(res.totalActiveMinutes).toBe(120);
    expect(res.inferredDurationCount).toBe(1);
    expect(Number.isNaN(res.totalActiveMinutes)).toBe(false);
  });
});

describe("Phase 5F.3 — Flight & Ferry Transition Buffer Evaluation", () => {
  it("passes cleanly for a flight with sufficient timing context in a dedicated slot", () => {
    const day = {
      day: 1,
      activities: [
        {
          id: "flt-1",
          period: "morning",
          travelMode: "flight",
          durationMinutes: 120,
          title: "Flight to Goa (DEL -> GOI)",
        },
      ],
    };
    const res = evaluateDayTime(day);
    const transitIssues = res.issues.filter((i) => i.type === "transit_buffer_deficit");
    expect(transitIssues.length).toBe(0);
  });

  it("flags transit buffer deficit when a flight is scheduled alongside other activities with insufficient buffer", () => {
    // Morning slot: 240m capacity
    // Act 1: 60m museum visit
    // Act 2: 120m flight
    // Total slot duration = 180m <= 240m (NO slot overrun!).
    // Remaining buffer = 60m. But flight requires 120m buffer -> Deficit = 60m!
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 60, title: "Quick Museum Visit" },
        { id: "flt-1", period: "morning", durationMinutes: 120, travelMode: "flight", title: "Flight to Mumbai" },
      ],
    };
    const res = evaluateDayTime(day);

    // Confirm no slot overrun
    const slotOverrun = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotOverrun).toBeUndefined();

    // Confirm transit buffer deficit is flagged
    const transitIssue = res.issues.find((i) => i.type === "transit_buffer_deficit");
    expect(transitIssue).toBeDefined();
    expect(transitIssue.severity).toBe("medium"); // Deficit 60m >= 60m
    expect(transitIssue.travelMode).toBe("flight");
    expect(transitIssue.message).toContain("only 60m buffer remaining");
    expect(transitIssue.message).toContain("120m buffer recommended");
  });

  it("passes cleanly for a ferry with sufficient timing context in a dedicated slot", () => {
    const day = {
      day: 1,
      activities: [
        {
          id: "ferry-1",
          period: "morning",
          travelMode: "ferry",
          durationMinutes: 90,
          title: "Mandovi River Ferry",
        },
      ],
    };
    const res = evaluateDayTime(day);
    const transitIssues = res.issues.filter((i) => i.type === "transit_buffer_deficit");
    expect(transitIssues.length).toBe(0);
  });

  it("flags transit buffer deficit when a ferry has tight remaining buffer in a shared slot", () => {
    // Evening slot: 180m capacity
    // Act 1: 120m seaside dinner
    // Act 2: 60m ferry crossing
    // Total slot duration = 180m (fits exactly). Remaining buffer = 0m.
    // Ferry requires 60m buffer -> Deficit = 60m!
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "evening", durationMinutes: 120, title: "Seaside Dinner" },
        { id: "ferry-1", period: "evening", durationMinutes: 60, travelMode: "ferry", title: "Night Ferry" },
      ],
    };
    const res = evaluateDayTime(day);

    const slotOverrun = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotOverrun).toBeUndefined();

    const transitIssue = res.issues.find((i) => i.type === "transit_buffer_deficit");
    expect(transitIssue).toBeDefined();
    expect(transitIssue.severity).toBe("medium");
    expect(transitIssue.travelMode).toBe("ferry");
    expect(transitIssue.message).toContain("60m buffer recommended");
  });

  it("prevents duplicate punitive deductions when slot is already overloaded by duration", () => {
    // Morning slot (240m): 150m trek + 150m flight = 300m (>240m)
    // Slot overrun is already flagged as high/medium severity.
    // The transit buffer issue must be marked advisory low (0 deduction) to prevent double counting.
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 150, title: "Morning Trek" },
        { id: "flt-1", period: "morning", durationMinutes: 150, travelMode: "flight", title: "Departing Flight" },
      ],
    };
    const res = evaluateDayTime(day);

    const slotOverrun = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotOverrun).toBeDefined();

    const transitIssue = res.issues.find((i) => i.type === "transit_buffer_deficit");
    expect(transitIssue).toBeDefined();
    expect(transitIssue.severity).toBe("low"); // Advisory only; 0 deduction
    expect(transitIssue.duplicatePrevented).toBe(true);
  });

  it("safely skips transit buffer evaluation when flight lacks valid period context", () => {
    const day = {
      day: 1,
      activities: [
        { id: "flt-1", period: null, travelMode: "flight", durationMinutes: 120, title: "Unscheduled Flight" },
      ],
    };
    const res = evaluateDayTime(day);
    const transitIssues = res.issues.filter((i) => i.type === "transit_buffer_deficit");
    expect(transitIssues.length).toBe(0);
  });

  it("ignores non-flight and non-ferry travel modes during transition buffer check", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 60, travelMode: "walking", title: "Walk" },
        { id: "act-2", period: "morning", durationMinutes: 120, travelMode: "public_transport", title: "Metro Ride" },
      ],
    };
    const res = evaluateDayTime(day);
    const transitIssues = res.issues.filter((i) => i.type === "transit_buffer_deficit");
    expect(transitIssues.length).toBe(0);
  });

  it("processes legacy string-only activities cleanly without false transit buffer warnings", () => {
    const legacyTrip = {
      budget: "25000",
      aiPlan: {
        destination: "Varanasi",
        days: [
          {
            day: 1,
            morning: "Morning boat ride on the Ganges",
            afternoon: "Kashi Vishwanath Temple and old alleyways",
            evening: "Ganga Aarti ceremony at Dashashwamedh Ghat",
          },
        ],
      },
    };

    const report = evaluateTripReality(legacyTrip);
    const transitIssues = report.issues.filter((i) => i.type === "transit_buffer_deficit");
    expect(transitIssues.length).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(75);
  });
});

describe("Phase 5F.3 — Orchestrator Confidence Metrics & Decoupling", () => {
  it("exposes durationCoverageRatio accurately in report metrics", () => {
    const trip = {
      budget: "30000",
      aiPlan: {
        destination: "Goa",
        days: [
          {
            day: 1,
            activities: [
              { id: "a1", period: "morning", durationMinutes: 90, title: "Explicit 1" },
              { id: "a2", period: "afternoon", durationMinutes: 120, title: "Explicit 2" },
              { id: "a3", period: "evening", title: "Inferred 1" }, // missing duration
            ],
          },
        ],
      },
    };

    const report = evaluateTripReality(trip);
    expect(report.metrics.confidence).toBeDefined();
    expect(report.metrics.confidence.inferredDurationsCount).toBe(1);
    // 2 explicit out of 3 total = 2/3 = 0.67
    expect(report.metrics.confidence.durationCoverageRatio).toBe(0.67);
  });

  it("preserves complete decoupling from Phase 5E Budget Intelligence", () => {
    const tripTier1 = {
      budget: "50000",
      aiPlan: {
        destination: "Bengaluru", // Phase 5E Tier 1 Metro
        days: [
          {
            day: 1,
            activities: [
              { id: "a1", period: "morning", durationMinutes: 60, title: "Botanical Garden" },
              { id: "flt", period: "morning", durationMinutes: 120, travelMode: "flight", title: "Flight" },
            ],
          },
        ],
      },
    };

    const tripTier4 = {
      budget: "50000",
      aiPlan: {
        destination: "Rishikesh", // Phase 5E Tier 3 Budget
        days: [
          {
            day: 1,
            activities: [
              { id: "a1", period: "morning", durationMinutes: 60, title: "Botanical Garden" },
              { id: "flt", period: "morning", durationMinutes: 120, travelMode: "flight", title: "Flight" },
            ],
          },
        ],
      },
    };

    const reportTier1 = evaluateTripReality(tripTier1);
    const reportTier4 = evaluateTripReality(tripTier4);

    expect(reportTier1.score).toBe(reportTier4.score);
    expect(reportTier1.subScores.timeFeasibility).toBe(reportTier4.subScores.timeFeasibility);
  });
});

