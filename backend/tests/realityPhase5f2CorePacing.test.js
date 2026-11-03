// backend/tests/realityPhase5f2CorePacing.test.js

const {
  evaluateDayTime,
  evaluateTripTime,
  SLOT_CAPACITIES_MINUTES,
} = require("../services/realityEngine/timeEngine");

const {
  calculateBasePaceScore,
  evaluateTripPace,
} = require("../services/realityEngine/paceEngine");

const { evaluateTripReality } = require("../services/realityEngine");

describe("Phase 5F.2 — Slot-Level Cumulative Duration Saturation (timeEngine)", () => {
  it("required regression case: detects three 90m activities in a 240m slot as a 30m overload", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 90, title: "Breakfast & Market" },
        { id: "act-2", period: "morning", durationMinutes: 90, title: "Temple Visit" },
        { id: "act-3", period: "morning", durationMinutes: 90, title: "Art Gallery" },
      ],
    };

    const res = evaluateDayTime(day);

    expect(res.totalActiveMinutes).toBe(270);
    expect(res.issues.length).toBe(1);

    const issue = res.issues[0];
    expect(issue.id).toBe("iss-time-slot-overrun-1-morning");
    expect(issue.type).toBe("slot_overrun");
    expect(issue.period).toBe("morning");
    expect(issue.severity).toBe("medium"); // 30m overrun < 60m threshold
    expect(issue.activityIds).toEqual(["act-1", "act-2", "act-3"]);
    expect(issue.message).toContain("270m across 3 activities");
    expect(issue.message).toContain("exceeds slot capacity (240m) by 30 minutes");
  });

  it("produces zero slot overrun for an exactly full slot capacity (240m in 240m slot)", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 120, title: "A" },
        { id: "act-2", period: "morning", durationMinutes: 120, title: "B" },
      ],
    };
    const res = evaluateDayTime(day);
    const slotOverruns = res.issues.filter((i) => i.type === "slot_overrun");
    expect(slotOverruns.length).toBe(0);
  });

  it("produces zero slot overrun for one minute below capacity (239m in 240m slot)", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 120, title: "A" },
        { id: "act-2", period: "morning", durationMinutes: 119, title: "B" },
      ],
    };
    const res = evaluateDayTime(day);
    const slotOverruns = res.issues.filter((i) => i.type === "slot_overrun");
    expect(slotOverruns.length).toBe(0);
  });

  it("flags slot overrun for one minute above capacity (241m in 240m slot)", () => {
    const day = {
      day: 1,
      activities: [
        { id: "act-1", period: "morning", durationMinutes: 120, title: "A" },
        { id: "act-2", period: "morning", durationMinutes: 121, title: "B" },
      ],
    };
    const res = evaluateDayTime(day);
    const slotOverruns = res.issues.filter((i) => i.type === "slot_overrun");
    expect(slotOverruns.length).toBe(1);
    expect(slotOverruns[0].severity).toBe("medium");
    expect(slotOverruns[0].message).toContain("by 1 minutes");
  });

  it("evaluates multiple overloaded slots on the same day independently without double counting", () => {
    const day = {
      day: 1,
      activities: [
        // Morning: 3 x 90m = 270m in 240m (over by 30m -> medium)
        { id: "m1", period: "morning", durationMinutes: 90, title: "M1" },
        { id: "m2", period: "morning", durationMinutes: 90, title: "M2" },
        { id: "m3", period: "morning", durationMinutes: 90, title: "M3" },
        // Afternoon: 2 x 150m = 300m in 240m (over by 60m -> high)
        { id: "a1", period: "afternoon", durationMinutes: 150, title: "A1" },
        { id: "a2", period: "afternoon", durationMinutes: 150, title: "A2" },
        // Evening: 1 x 90m in 180m (fits comfortably)
        { id: "e1", period: "evening", durationMinutes: 90, title: "E1" },
      ],
    };
    const res = evaluateDayTime(day);
    const slotOverruns = res.issues.filter((i) => i.type === "slot_overrun");
    expect(slotOverruns.length).toBe(2);

    const morningOverrun = slotOverruns.find((i) => i.period === "morning");
    const afternoonOverrun = slotOverruns.find((i) => i.period === "afternoon");

    expect(morningOverrun.severity).toBe("medium");
    expect(afternoonOverrun.severity).toBe("high");
  });

  it("handles empty slots safely without generating false issues", () => {
    const day = {
      day: 1,
      activities: [
        { id: "m1", period: "morning", durationMinutes: 120, title: "M1" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.issues.length).toBe(0);
    expect(res.totalActiveMinutes).toBe(120);
  });

  it("handles missing duration metadata safely by using canonical fallback", () => {
    const day = {
      day: 1,
      activities: [
        { id: "m1", period: "morning", title: "M1" }, // missing -> 120m
        { id: "m2", period: "morning", title: "M2" }, // missing -> 120m
        { id: "m3", period: "morning", title: "M3" }, // missing -> 120m
      ],
    };
    const res = evaluateDayTime(day);
    // 3 x 120m = 360m in 240m slot -> over by 120m -> high severity
    expect(res.inferredDurationCount).toBe(3);
    expect(res.totalActiveMinutes).toBe(360);
    const slotOverrun = res.issues.find((i) => i.type === "slot_overrun");
    expect(slotOverrun).toBeDefined();
    // Phase 5F.3: Confidence dampening safely treats unannotated estimated overrun as medium rather than confirmed high
    expect(slotOverrun.severity).toBe("medium");
    expect(slotOverrun.confidence).toBe("inferred");
  });

  it("handles boundary 0-minute and negative durations safely", () => {
    const day = {
      day: 1,
      activities: [
        { id: "m1", period: "morning", durationMinutes: 0, title: "Quick Check" },
        { id: "m2", period: "morning", durationMinutes: -30, title: "Invalid Duration" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.totalActiveMinutes).toBe(0);
    expect(res.issues.length).toBe(0);
  });
});

describe("Phase 5F.2 — Single-Day Peak Overload Detection (paceEngine)", () => {
  it("flags a 5-day trip with four 3-hour days and one 11-hour marathon day", () => {
    const days = [
      { day: 1, activities: [{ id: "d1-1", durationMinutes: 90 }, { id: "d1-2", durationMinutes: 90 }] }, // 180m
      { day: 2, activities: [{ id: "d2-1", durationMinutes: 90 }, { id: "d2-2", durationMinutes: 90 }] }, // 180m
      { day: 3, activities: [{ id: "d3-1", durationMinutes: 90 }, { id: "d3-2", durationMinutes: 90 }] }, // 180m
      { day: 4, activities: [{ id: "d4-1", durationMinutes: 90 }, { id: "d4-2", durationMinutes: 90 }] }, // 180m
      {
        day: 5,
        activities: [
          { id: "d5-1", durationMinutes: 240 },
          { id: "d5-2", durationMinutes: 240 },
          { id: "d5-3", durationMinutes: 180 },
        ], // 660m (11 hours)
      },
    ];

    const totalActive = 4 * 180 + 660; // 1380m
    const avgDaily = Math.round(totalActive / 5); // 276m (~4.6h)

    const res = evaluateTripPace(days, avgDaily);

    // Trip average is moderate (276m <= 420m -> Balanced)
    expect(res.paceCategory).toBe("Balanced");

    // But Day 5 peak overload is caught!
    const peakIssue = res.issues.find((i) => i.type === "pace_peak_overload");
    expect(peakIssue).toBeDefined();
    expect(peakIssue.day).toBe(5);
    expect(peakIssue.severity).toBe("medium"); // 660 is <= 660
    expect(peakIssue.message).toContain("Day 5 active duration (660m / 11.0h)");

    // Sub-score reflects peak penalty (base score 98 - 6 = 92)
    expect(res.subScore).toBeLessThanOrEqual(92);
  });

  it("does not penalize a consistently moderate itinerary with multiple active days", () => {
    const days = [
      { day: 1, activities: [{ id: "a1", durationMinutes: 120 }, { id: "a2", durationMinutes: 120 }, { id: "a3", durationMinutes: 120 }] },
      { day: 2, activities: [{ id: "a4", durationMinutes: 120 }, { id: "a5", durationMinutes: 120 }, { id: "a6", durationMinutes: 120 }] },
      { day: 3, activities: [{ id: "a7", durationMinutes: 120 }, { id: "a8", durationMinutes: 120 }, { id: "a9", durationMinutes: 120 }] },
    ];
    // Each day is 360m (6 hours) -> well within the 540m limit
    const res = evaluateTripPace(days, 360);
    expect(res.paceCategory).toBe("Balanced");
    expect(res.subScore).toBe(98);
    const peakIssues = res.issues.filter((i) => i.type === "pace_peak_overload");
    expect(peakIssues.length).toBe(0);
  });

  it("produces identical aggregate subscore when days are reordered", () => {
    const dayLight = { activities: [{ id: "a1", durationMinutes: 90 }, { id: "a2", durationMinutes: 90 }] };
    const dayHeavy = { activities: [{ id: "h1", durationMinutes: 240 }, { id: "h2", durationMinutes: 240 }, { id: "h3", durationMinutes: 200 }] };

    const orderA = [{ ...dayLight, day: 1 }, { ...dayLight, day: 2 }, { ...dayHeavy, day: 3 }];
    const orderB = [{ ...dayHeavy, day: 1 }, { ...dayLight, day: 2 }, { ...dayLight, day: 3 }];

    const avg = Math.round((180 + 180 + 680) / 3);
    const resA = evaluateTripPace(orderA, avg);
    const resB = evaluateTripPace(orderB, avg);

    expect(resA.subScore).toBe(resB.subScore);
    expect(resA.paceCategory).toBe(resB.paceCategory);
  });

  it("never treats missing durations as confirmed zero-minute activities", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1" }, // missing duration
          { id: "a2" }, // missing duration
          { id: "a3" }, // missing duration
        ],
      },
    ];
    // With 3 missing activities, day duration is 360m (3 * 120m), not 0m
    const res = evaluateTripPace(days, 360);
    expect(res.avgActivitiesPerDay).toBe(3);
    expect(res.subScore).toBe(98);
  });
});

describe("Phase 5F.2 — Deterministic Pacing Curve & Inversion Correction (paceEngine)", () => {
  it("scores relaxed but feasible itinerary at top tier without legacy inversion penalty", () => {
    const days = [
      { day: 1, activities: [{ id: "a1", durationMinutes: 120 }, { id: "a2", durationMinutes: 120 }] },
    ];
    // 240 min/day (4 hours), 2 stops/day
    const res = evaluateTripPace(days, 240);
    expect(res.paceCategory).toBe("Relaxed");
    expect(res.subScore).toBeGreaterThanOrEqual(98);
    expect(res.issues.length).toBe(0);
  });

  it("scores balanced and feasible itinerary at 98", () => {
    const days = [
      { day: 1, activities: [{ id: "a1", durationMinutes: 120 }, { id: "a2", durationMinutes: 120 }, { id: "a3", durationMinutes: 120 }] },
    ];
    // 360 min/day (6 hours), 3 stops/day
    const res = evaluateTripPace(days, 360);
    expect(res.paceCategory).toBe("Balanced");
    expect(res.subScore).toBe(98);
    expect(res.issues.length).toBe(0);
  });

  it("scores demanding but feasible itinerary appropriately in Busy band", () => {
    const days = [
      { day: 1, activities: [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }] },
    ];
    // 480 min/day (8 hours), 4 stops/day
    const res = evaluateTripPace(days, 480);
    expect(res.paceCategory).toBe("Busy");
    expect(res.subScore).toBe(75);
    expect(res.issues.some((i) => i.type === "pace_intense")).toBe(true);
  });

  it("scores overloaded itinerary appropriately in Very Busy band", () => {
    const days = [
      { day: 1, activities: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] },
    ];
    // 600 min/day (10 hours)
    const res = evaluateTripPace(days, 600);
    expect(res.paceCategory).toBe("Very Busy");
    expect(res.subScore).toBe(45);
    expect(res.issues.some((i) => i.type === "pace_exhaustion")).toBe(true);
  });

  it("produces deterministic identical outputs across repeated invocations", () => {
    const days = [
      { day: 1, activities: [{ id: "a1", durationMinutes: 120 }, { id: "a2", durationMinutes: 150 }] },
    ];
    const run1 = evaluateTripPace(days, 270);
    const run2 = evaluateTripPace(days, 270);
    expect(run1).toEqual(run2);
  });
});

describe("Phase 5F.2 — Consecutive High-Intensity Fatigue Evaluation (paceEngine)", () => {
  it("does not penalize a single high-intensity activity", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", intensity: "high", title: "Morning Surf" },
          { id: "a2", period: "afternoon", intensity: "moderate", title: "Spice Plantation" },
          { id: "a3", period: "evening", intensity: "low", title: "Seaside Dinner" },
        ],
      },
    ];
    const res = evaluateTripPace(days, 360);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(0);
  });

  it("flags 2 consecutive high-intensity activities with medium severity penalty", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", intensity: "high", title: "Morning Surf" },
          { id: "a2", period: "afternoon", intensity: "high", title: "Rock Climbing" },
          { id: "a3", period: "evening", intensity: "low", title: "Seaside Dinner" },
        ],
      },
    ];
    const res = evaluateTripPace(days, 360);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(1);
    expect(fatigueIssues[0].severity).toBe("medium");
    expect(fatigueIssues[0].activityIds).toEqual(["a1", "a2"]);
    expect(fatigueIssues[0].message).toContain("2 consecutive high-intensity activities");
    // Base 98 - 6 = 92
    expect(res.subScore).toBe(92);
  });

  it("flags 3 consecutive high-intensity activities with high severity penalty", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", intensity: "high", title: "Morning Surf" },
          { id: "a2", period: "afternoon", intensity: "high", title: "Rock Climbing" },
          { id: "a3", period: "evening", intensity: "high", title: "Nightclub Crawl" },
        ],
      },
    ];
    const res = evaluateTripPace(days, 360);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(1);
    expect(fatigueIssues[0].severity).toBe("high");
    expect(fatigueIssues[0].activityIds).toEqual(["a1", "a2", "a3"]);
    expect(fatigueIssues[0].message).toContain("3 consecutive high-intensity activities");
    // Base 98 - 12 = 86
    expect(res.subScore).toBe(86);
  });

  it("clears fatigue streak when high-intensity activities are separated by low-intensity recovery", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", intensity: "high", title: "Morning Surf" },
          { id: "a2", period: "afternoon", intensity: "low", title: "Spa & Massage" }, // Recovery buffer
          { id: "a3", period: "evening", intensity: "high", title: "Nightclub Crawl" },
        ],
      },
    ];
    const res = evaluateTripPace(days, 360);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(0);
    expect(res.subScore).toBe(98);
  });

  it("evaluates intensity fatigue per day so separate days do not create consecutive streaks", () => {
    const days = [
      {
        day: 1,
        activities: [{ id: "d1-e1", period: "evening", intensity: "high", title: "Late Concert" }],
      },
      {
        day: 2,
        activities: [{ id: "d2-m1", period: "morning", intensity: "high", title: "Mountain Trek" }],
      },
    ];
    const res = evaluateTripPace(days, 240);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(0);
  });

  it("treats missing intensity metadata as unknown without triggering fatigue", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", intensity: "high", title: "Surf" },
          { id: "a2", period: "afternoon", intensity: null, title: "Mystery Activity" }, // Missing intensity
          { id: "a3", period: "evening", intensity: "high", title: "Club" },
        ],
      },
    ];
    const res = evaluateTripPace(days, 360);
    const fatigueIssues = res.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(0);
  });

  it("processes legacy string-only activities cleanly without false fatigue penalties", () => {
    const legacyTrip = {
      budget: "20000",
      aiPlan: {
        destination: "Jaipur",
        days: [
          {
            day: 1,
            morning: "Amber Fort exploration",
            afternoon: "City Palace and Jantar Mantar",
            evening: "Chokhi Dhani cultural village and dinner",
          },
        ],
      },
    };

    const report = evaluateTripReality(legacyTrip);
    const fatigueIssues = report.issues.filter((i) => i.type === "intensity_fatigue");
    expect(fatigueIssues.length).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(75);
  });
});

describe("Phase 5F.2 — Orchestrator Integration & Budget Decoupling", () => {
  it("integrates cumulative slot overruns and intensity fatigue into overall reality score", () => {
    const stressfulTrip = {
      budget: "30000",
      aiPlan: {
        destination: "Goa",
        days: [
          {
            day: 1,
            title: "Action Packed Day",
            activities: [
              // 3 x 90m in morning = 270m in 240m slot (cumulative overrun)
              { id: "a1", period: "morning", durationMinutes: 90, intensity: "high", title: "Trek A" },
              { id: "a2", period: "morning", durationMinutes: 90, intensity: "high", title: "Trek B" },
              { id: "a3", period: "morning", durationMinutes: 90, intensity: "high", title: "Trek C" },
              // Afternoon high intensity
              { id: "a4", period: "afternoon", durationMinutes: 120, intensity: "low", title: "Relax" },
            ],
          },
        ],
      },
    };

    const report = evaluateTripReality(stressfulTrip);

    // Verify time issue is present
    const timeSlotIssue = report.issues.find((i) => i.type === "slot_overrun");
    expect(timeSlotIssue).toBeDefined();

    // Verify fatigue issue is present
    const fatigueIssue = report.issues.find((i) => i.type === "intensity_fatigue");
    expect(fatigueIssue).toBeDefined();

    // Verify overall score reflects deductions
    expect(report.subScores.timeFeasibility).toBeLessThan(100);
    expect(report.subScores.activityLoad).toBeLessThan(100);
  });

  it("maintains complete decoupling from Phase 5E Budget Intelligence", () => {
    // Reality score evaluates activity feasibility independent of destination economic baseline
    const tripA = {
      budget: "25000",
      aiPlan: {
        destination: "Mumbai", // Tier 1 Metro in Phase 5E
        days: [{ day: 1, activities: [{ id: "a1", cost: "Free", durationMinutes: 120 }] }],
      },
    };
    const tripB = {
      budget: "25000",
      aiPlan: {
        destination: "Hampi", // Tier 3 Budget in Phase 5E
        days: [{ day: 1, activities: [{ id: "a1", cost: "Free", durationMinutes: 120 }] }],
      },
    };

    const reportA = evaluateTripReality(tripA);
    const reportB = evaluateTripReality(tripB);

    // Identical itinerary feasibility yields identical score regardless of destination tier
    expect(reportA.score).toBe(reportB.score);
    expect(reportA.subScores.timeFeasibility).toBe(reportB.subScores.timeFeasibility);
    expect(reportA.subScores.activityLoad).toBe(reportB.subScores.activityLoad);
  });
});

