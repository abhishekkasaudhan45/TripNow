// backend/tests/realityEngine.test.js

const {
  isValidCoordinate,
  haversineDistanceKm,
  evaluateDayRoute,
} = require("../services/realityEngine/distanceEngine");

const {
  evaluateDayTime,
  evaluateTripTime,
  SLOT_CAPACITIES_MINUTES,
} = require("../services/realityEngine/timeEngine");

const {
  parseCostString,
  parseNumericBudget,
  evaluateTripBudget,
} = require("../services/realityEngine/budgetEngine");

const { evaluateTripPace } = require("../services/realityEngine/paceEngine");

const {
  getStatusTier,
  calculateOverallScore,
  sortAndDedupeIssues,
} = require("../services/realityEngine/scoringEngine");

const { evaluateTripReality } = require("../services/realityEngine");

describe("Reality Engine - Distance Engine (Haversine)", () => {
  it("validates coordinates correctly", () => {
    expect(isValidCoordinate({ lat: 15.49, lng: 73.82 })).toBe(true);
    expect(isValidCoordinate({ lat: -90, lng: 180 })).toBe(true);
    expect(isValidCoordinate({ lat: 91, lng: 73.82 })).toBe(false);
    expect(isValidCoordinate({ lat: 15.49, lng: -181 })).toBe(false);
    expect(isValidCoordinate(null)).toBe(false);
    expect(isValidCoordinate({ lat: "15.49", lng: 73.82 })).toBe(false);
    expect(isValidCoordinate({ lat: NaN, lng: 73.82 })).toBe(false);
  });

  it("calculates 0 km for identical coordinates", () => {
    const point = { lat: 15.4909, lng: 73.8278 };
    expect(haversineDistanceKm(point, point)).toBe(0);
  });

  it("calculates accurate distance between known benchmark points (Panaji to Margao)", () => {
    const panaji = { lat: 15.4909, lng: 73.8278 };
    const margao = { lat: 15.2832, lng: 73.9862 };
    const dist = haversineDistanceKm(panaji, margao);
    // Panaji to Margao is ~28-34 km direct
    expect(dist).toBeGreaterThan(25);
    expect(dist).toBeLessThan(35);
  });

  it("returns null when either coordinate is invalid", () => {
    const valid = { lat: 15.49, lng: 73.82 };
    expect(haversineDistanceKm(valid, null)).toBeNull();
    expect(haversineDistanceKm(null, valid)).toBeNull();
    expect(haversineDistanceKm({ lat: 100, lng: 50 }, valid)).toBeNull();
  });

  it("handles day route with missing coordinates gracefully (Stage A)", () => {
    const day = {
      day: 1,
      activities: [
        { id: "a1", title: "Beach", location: null },
        { id: "a2", title: "Fort", location: null },
      ],
    };
    const res = evaluateDayRoute(day);
    expect(res.hasCoordinates).toBe(false);
    expect(res.legs.length).toBe(1);
    expect(res.legs[0].unresolved).toBe(true);
    expect(res.anomalies.length).toBe(0);
  });

  it("detects teleportation anomaly when adjacent activities exceed 40 km", () => {
    const day = {
      day: 1,
      activities: [
        { id: "a1", title: "North Goa", location: { lat: 15.7, lng: 73.7 }, locked: true },
        { id: "a2", title: "South Goa Extreme", location: { lat: 14.9, lng: 74.1 }, locked: false },
      ],
    };
    const res = evaluateDayRoute(day);
    expect(res.hasCoordinates).toBe(true);
    expect(res.totalDistanceKm).toBeGreaterThan(40);
    expect(res.anomalies.length).toBe(1);
    expect(res.anomalies[0].type).toBe("teleportation_risk");
    expect(res.anomalies[0].isLocked).toBe(true);
  });
});

describe("Reality Engine - Time Engine", () => {
  it("evaluates a standard 3-activity day within slot windows", () => {
    const day = {
      day: 1,
      activities: [
        { id: "a1", period: "morning", durationMinutes: 120, title: "Museum" },
        { id: "a2", period: "afternoon", durationMinutes: 150, title: "Garden" },
        { id: "a3", period: "evening", durationMinutes: 90, title: "Dinner" },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.totalActiveMinutes).toBe(360);
    expect(res.issues.length).toBe(0);
  });

  it("flags slot overrun when activity duration exceeds slot window", () => {
    const day = {
      day: 1,
      activities: [
        { id: "a1", period: "morning", durationMinutes: 300, title: "Trek", locked: true },
      ],
    };
    const res = evaluateDayTime(day);
    expect(res.issues.length).toBe(1);
    expect(res.issues[0].type).toBe("slot_overrun");
    expect(res.issues[0].severity).toBe("high");
    expect(res.issues[0].isLocked).toBe(true);
  });

  it("flags daily overload when total active minutes exceed 540 min", () => {
    const day = {
      day: 2,
      activities: [
        { id: "a1", period: "morning", durationMinutes: 240, title: "A" },
        { id: "a2", period: "afternoon", durationMinutes: 240, title: "B" },
        { id: "a3", period: "evening", durationMinutes: 180, title: "C" },
      ],
    };
    const res = evaluateDayTime(day);
    // 240 + 240 + 180 = 660 min
    expect(res.totalActiveMinutes).toBe(660);
    expect(res.issues.some((i) => i.type === "daily_overload")).toBe(true);
  });

  it("calculates trip-level time subscore with penalty deductions", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", period: "morning", durationMinutes: 120, title: "A" },
          { id: "a2", period: "afternoon", durationMinutes: 120, title: "B" },
        ],
      },
      {
        day: 2,
        activities: [
          { id: "a3", period: "morning", durationMinutes: 300, title: "Overrun Trek" },
        ],
      },
    ];
    const res = evaluateTripTime(days);
    expect(res.subScore).toBeLessThan(100);
    expect(res.avgDailyActiveMinutes).toBe(Math.round((240 + 300) / 2));
  });
});

describe("Reality Engine - Budget Engine", () => {
  it("parses diverse cost string formats accurately", () => {
    expect(parseCostString("Free")).toEqual({ amount: 0, isFree: true, isRange: false, isUnspecified: false, raw: "Free" });
    expect(parseCostString("₹0")).toEqual({ amount: 0, isFree: true, isRange: false, isUnspecified: false, raw: "₹0" });
    expect(parseCostString("₹500")).toEqual({ amount: 500, isFree: false, isRange: false, isUnspecified: false, raw: "₹500" });
    expect(parseCostString("250 INR")).toEqual({ amount: 250, isFree: false, isRange: false, isUnspecified: false, raw: "250 INR" });
    expect(parseCostString("$25")).toEqual({ amount: 25, isFree: false, isRange: false, isUnspecified: false, raw: "$25" });
    expect(parseCostString("₹100 - ₹200")).toEqual({ amount: 150, isFree: false, isRange: true, isUnspecified: false, raw: "₹100 - ₹200" });
    expect(parseCostString("Moderate").isUnspecified).toBe(true);
    expect(parseCostString(null).isUnspecified).toBe(true);
  });

  it("scores budget surplus with a perfect 100", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", cost: "₹200" },
          { id: "a2", cost: "Free" },
        ],
      },
    ];
    const res = evaluateTripBudget({
      days,
      rawBudget: "25000",
    });
    expect(res.subScore).toBe(100);
    expect(res.overBudget).toBe(false);
    expect(res.totalKnownActivityCost).toBe(200);
  });

  it("penalizes budget overruns and flags issues", () => {
    const days = [
      {
        day: 1,
        activities: [
          { id: "a1", cost: "₹15,000" },
          { id: "a2", cost: "₹10,000" },
        ],
      },
    ];
    const res = evaluateTripBudget({
      days,
      rawBudget: "20000", // allocated activity cap ~8,000
    });
    expect(res.overBudget).toBe(true);
    expect(res.subScore).toBeLessThan(50);
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues[0].type).toBe("budget_overrun");
  });
});

describe("Reality Engine - Pace Engine", () => {
  it("classifies relaxed trip correctly", () => {
    const days = [
      { activities: [{ id: "a1" }, { id: "a2" }] },
    ];
    const res = evaluateTripPace(days, 240); // 4 hours
    expect(res.paceCategory).toBe("Relaxed");
    expect(res.subScore).toBe(92);
  });

  it("classifies balanced trip correctly", () => {
    const days = [
      { activities: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] },
    ];
    const res = evaluateTripPace(days, 360); // 6 hours
    expect(res.paceCategory).toBe("Balanced");
    expect(res.subScore).toBe(98);
  });

  it("classifies busy trip correctly", () => {
    const days = [
      { activities: [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }] },
    ];
    const res = evaluateTripPace(days, 480); // 8 hours
    expect(res.paceCategory).toBe("Busy");
    expect(res.subScore).toBe(75);
    expect(res.issues.length).toBe(1);
  });

  it("classifies very busy trip and flags exhaustion risk", () => {
    const days = [
      { activities: [{ id: "a1" }, { id: "a2" }, { id: "a3" }] },
    ];
    const res = evaluateTripPace(days, 600); // 10 hours
    expect(res.paceCategory).toBe("Very Busy");
    expect(res.subScore).toBe(45);
    expect(res.issues[0].type).toBe("pace_exhaustion");
  });
});

describe("Reality Engine - Scoring & Orchestrator Integration", () => {
  const sampleTrip = {
    budget: "25000",
    aiPlan: {
      destination: "Goa",
      days: [
        {
          day: 1,
          title: "Historic Old Goa",
          morning: "Basilica of Bom Jesus",
          afternoon: "Archaeological Museum",
          evening: "Sunset Cruise",
          activities: [
            {
              id: "d1-morning-01",
              period: "morning",
              title: "Basilica of Bom Jesus",
              durationMinutes: 120,
              cost: "₹100",
              locked: true,
            },
            {
              id: "d1-afternoon-01",
              period: "afternoon",
              title: "Archaeological Museum",
              durationMinutes: 150,
              cost: "₹200",
              locked: false,
            },
            {
              id: "d1-evening-01",
              period: "evening",
              title: "Sunset Cruise",
              durationMinutes: 120,
              cost: "₹500",
              locked: false,
            },
          ],
        },
      ],
      budgetBreakdown: {
        total: "₹25,000",
        activities: "₹5,000",
      },
    },
  };

  it("produces deterministic reproducible score for sample trip", () => {
    const report1 = evaluateTripReality(sampleTrip);
    const report2 = evaluateTripReality(sampleTrip);

    expect(report1.score).toBe(report2.score);
    expect(report1.status).toBe(report2.status);
    expect(report1.subScores).toEqual(report2.subScores);
    expect(report1.score).toBeGreaterThanOrEqual(75);
    expect(report1.metrics.lockedActivityCount).toBe(1);
    expect(report1.metrics.paceCategory).toBe("Balanced");
  });

  it("gracefully reports routeEfficiency as null in Stage A when geodata is missing", () => {
    const report = evaluateTripReality(sampleTrip);
    expect(report.subScores.routeEfficiency).toBeNull();
    expect(report.metrics.hasFullCoordinates).toBe(false);
  });

  it("status tiers map strictly to PRD/TRD color and label specifications", () => {
    expect(getStatusTier(95).status).toBe("Excellent");
    expect(getStatusTier(82).status).toBe("Good");
    expect(getStatusTier(68).status).toBe("Needs Attention");
    expect(getStatusTier(45).status).toBe("Risky");
    expect(getStatusTier(20).status).toBe("Critical");
  });
});

describe("Reality Engine - Phase 3 Hardening Verification", () => {
  const { sortAndDedupeIssues } = require("../services/realityEngine/scoringEngine");

  describe("1. Currency Safety", () => {
    it("never silently treats '$25' as 25 INR in an INR budget trip", () => {
      const parsed = parseCostString("$25", "INR");
      expect(parsed.currencyMismatch).toBe(true);
      expect(parsed.amount).toBeNull();
      expect(parsed.isUnspecified).toBe(true);
    });

    it("excludes mismatched currency activities from totalKnownActivityCost and flags an issue", () => {
      const days = [
        {
          day: 1,
          activities: [
            { id: "act-inr", cost: "₹500" },
            { id: "act-usd", cost: "$50" }, // Mixed currency!
          ],
        },
      ];
      const res = evaluateTripBudget({
        days,
        rawBudget: "₹25,000",
      });

      // Total must include ONLY the ₹500, NOT 500 + 50
      expect(res.totalKnownActivityCost).toBe(500);
      expect(res.currencyMismatchCount).toBe(1);
      const mismatchIssue = res.issues.find((i) => i.type === "currency_mismatch");
      expect(mismatchIssue).toBeDefined();
      expect(mismatchIssue.message).toContain("differs from the trip budget currency");
    });

    it("properly computes when budget and activities share a non-INR currency (e.g. USD)", () => {
      const days = [
        {
          day: 1,
          activities: [
            { id: "act-1", cost: "$50" },
            { id: "act-2", cost: "$100" },
          ],
        },
      ];
      const res = evaluateTripBudget({
        days,
        rawBudget: "$2,000",
        budgetBreakdown: { activities: "$500" },
      });

      expect(res.baseCurrency).toBe("USD");
      expect(res.currencySymbol).toBe("$");
      expect(res.totalKnownActivityCost).toBe(150);
      expect(res.currencyMismatchCount).toBe(0);
      expect(res.subScore).toBe(100);
    });
  });

  describe("2. Budget Precedence", () => {
    it("prefers Booking.budget over aiPlan.budgetBreakdown.total", () => {
      const days = [{ day: 1, activities: [{ id: "a1", cost: "₹1,000" }] }];
      const res = evaluateTripBudget({
        days,
        rawBudget: "₹50,000",
        budgetBreakdown: { total: "₹30,000" },
      });
      expect(res.budgetCeiling).toBe(50000);
    });

    it("prefers aiPlan.budgetBreakdown.activities over 40% fallback", () => {
      const days = [{ day: 1, activities: [{ id: "a1", cost: "₹5,000" }] }];
      // budgetCeiling = 100000. 40% would be 40000.
      // But activities cap is explicitly 6000. 5000 / 6000 = 83.3% capacity -> score 100
      const res = evaluateTripBudget({
        days,
        rawBudget: "₹100,000",
        budgetBreakdown: { activities: "₹6,000" },
      });
      expect(res.subScore).toBe(100);
    });

    it("falls back to 40% of budget ceiling when budgetBreakdown.activities is absent", () => {
      const days = [{ day: 1, activities: [{ id: "a1", cost: "₹45,000" }] }];
      // budgetCeiling = 100000. 40% cap = 40000. 45000 / 40000 = 112.5% -> over budget!
      const res = evaluateTripBudget({
        days,
        rawBudget: "₹100,000",
      });
      expect(res.overBudget).toBe(true);
      expect(res.subScore).toBeLessThan(80);
    });
  });

  describe("3. Data Confidence Metadata", () => {
    it("exposes data confidence metrics accurately in reality report", () => {
      const report = evaluateTripReality({
        budget: "₹20,000",
        aiPlan: {
          days: [
            {
              day: 1,
              activities: [
                { id: "a1", durationMinutes: 90, cost: "₹200" },
                { id: "a2", cost: "Moderate" }, // Inferred duration (120) & unspecified cost
              ],
            },
          ],
        },
      });

      expect(report.metrics.confidence).toBeDefined();
      expect(report.metrics.confidence.costCoverageRatio).toBe(0.5); // 1 out of 2 known
      expect(report.metrics.confidence.inferredDurationsCount).toBe(1);
      expect(report.metrics.confidence.hasExactCoordinates).toBe(false);
      expect(report.metrics.confidence.budgetSource).toBe("booking");
      expect(report.metrics.confidence.baseCurrency).toBe("INR");
    });
  });

  describe("4. Reproducibility & Deterministic Tie-Breaking", () => {
    it("sorts issues deterministically regardless of insertion order", () => {
      const issuesOrderA = [
        { id: "iss-2", severity: "medium", day: 2, message: "Medium day 2" },
        { id: "iss-1", severity: "medium", day: 1, message: "Medium day 1" },
        { id: "iss-0", severity: "high", day: 1, message: "High day 1" },
      ];

      const issuesOrderB = [
        { id: "iss-1", severity: "medium", day: 1, message: "Medium day 1" },
        { id: "iss-0", severity: "high", day: 1, message: "High day 1" },
        { id: "iss-2", severity: "medium", day: 2, message: "Medium day 2" },
      ];

      const sortedA = sortAndDedupeIssues(issuesOrderA);
      const sortedB = sortAndDedupeIssues(issuesOrderB);

      expect(sortedA).toEqual(sortedB);
      expect(sortedA[0].id).toBe("iss-0"); // high first
      expect(sortedA[1].id).toBe("iss-1"); // day 1 before day 2
      expect(sortedA[2].id).toBe("iss-2");
    });
  });
});
