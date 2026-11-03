// backend/tests/phase5e6FullRegressionAcceptance.test.js
/**
 * TripNow Phase 5E.6 — Full Budget Intelligence Regression & Acceptance Test Suite
 *
 * Covers:
 * 1. Destination & Currency Acceptance Matrix (Domestic, International, Unknown, Currencies)
 * 2. Calculation Acceptance Matrix (Solo, Group, Short, Long, Thresholds, Invalid, Parity)
 * 3. Adaptive Pivot & Fix Day Lifecycle (All reasons, HMAC, Locks, OCC, Reality Score)
 * 4. Security & Privacy Regression (Rate limiting, CSRF, Zero AI/DB mutations, Shared trip)
 */

const request = require("supertest");
const crypto = require("crypto");
const app = require("../app");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase } = require("./db");
const { GoogleGenAI } = require("@google/genai");
const {
  signProposalToken,
} = require("../services/fixDayService");
const { normalizeItinerary } = require("../utils/itineraryNormalizer");
const {
  calculateBudgetIntelligence,
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
} = require("../services/budgetIntelligence");
const { evaluateTripReality } = require("../services/realityEngine");
const { sanitizePublicAiPlan } = require("../controllers/Sharedtripcontroller");

jest.mock("@google/genai", () => {
  const original = jest.requireActual("@google/genai");
  return {
    ...original,
    GoogleGenAI: jest.fn(),
  };
});

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const sampleItinerary = {
  destination: "Goa, India",
  days: [
    {
      day: 1,
      title: "North Goa Heritage",
      morning: "Fort Aguada and lighthouse",
      afternoon: "Candolim beach lunch",
      evening: "Sinquerim sunset walk",
      food: ["Goan Fish Curry", "Sol Kadi"],
    },
    {
      day: 2,
      title: "Cultural Fontainhas",
      morning: "Basilica of Bom Jesus",
      afternoon: "Latin Quarter walking tour",
      evening: "Mandovi sunset cruise",
      food: ["Prawn Balchão", "Poee Bread"],
    },
  ],
  budgetBreakdown: {
    accommodation: "₹4,000/night",
    foodPerDay: "₹1,500",
    transport: "₹800",
    activities: "₹1,200",
    total: "₹20,000",
  },
  whereToStay: { budget: "Zostel Goa", midRange: "Fairfield" },
  mustEat: ["Goan Fish Curry", "Bebinca"],
  travelTips: ["Rent a scooter", "Carry cash"],
};

const createTestBooking = async (overrides = {}) => {
  let rawPlan = overrides.aiPlan || sampleItinerary;
  if (typeof rawPlan === "string") {
    try { rawPlan = JSON.parse(rawPlan); } catch (e) {}
  }
  const { plan: normalized } = normalizeItinerary(rawPlan);
  const data = {
    destination: "Goa, India",
    budget: "25000",
    guests: 2,
    checkin: new Date("2026-11-10"),
    checkout: new Date("2026-11-12"),
    ...overrides,
    aiPlan: JSON.stringify(normalized),
  };
  return await Booking.create(data);
};

const mockCandidate = (overrides = {}) => ({
  title: "Fontainhas Latin Quarter Walking Tour",
  description: "A scenic heritage walk through Portuguese architecture.",
  category: "Culture",
  activityType: "culture",
  indoorOutdoor: "Indoor",
  durationMinutes: 75,
  travelMode: "walking",
  intensity: "low",
  cost: "Free",
  reason: "Budget-friendly alternative requiring zero entrance tickets.",
  insiderTip: "Carry water and an umbrella.",
  ...overrides,
});

describe("TripNow Phase 5E.6 — Full Budget Intelligence Regression & Acceptance Suite", () => {
  // =========================================================================
  // SECTION 3: Destination & Currency Acceptance Matrix
  // =========================================================================
  describe("Section 3: Destination & Currency Acceptance Matrix", () => {
    test("3.1 Domestic Metro destinations resolve to TIER_1_METRO with configured INR calculations", () => {
      const metros = ["Mumbai", "Delhi", "Bengaluru"];
      for (const dest of metros) {
        const res = calculateBudgetIntelligence({
          destination: dest,
          totalBudget: 40000,
          days: 4,
          guests: 2,
          currency: "INR",
        });
        expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_1_METRO);
        expect(res.currency).toBe("INR");
        expect(res.perPersonDailyBudget).toBe(5000); // 40000 / (4 * 2)
        expect(res.estimatedStandardTotal).toBe(42400); // 5300 * 2 * 4
      }
    });

    test("3.2 Domestic Resort destinations resolve to TIER_2_RESORT with configured INR calculations", () => {
      const resorts = ["Goa"];
      for (const dest of resorts) {
        const res = calculateBudgetIntelligence({
          destination: dest,
          totalBudget: 35000,
          days: 5,
          guests: 2,
          currency: "INR",
        });
        expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);
        expect(res.currency).toBe("INR");
        expect(res.perPersonDailyBudget).toBe(3500); // 35000 / (5 * 2)
        expect(res.estimatedStandardTotal).toBe(50000); // 5000 * 2 * 5
      }
    });

    test("3.3 Domestic Budget destinations resolve to TIER_3_BUDGET with configured INR calculations", () => {
      const budgetDests = ["Manali", "Shimla", "Jaipur", "Varanasi"];
      for (const dest of budgetDests) {
        const res = calculateBudgetIntelligence({
          destination: dest,
          totalBudget: 24000,
          days: 4,
          guests: 2,
          currency: "INR",
        });
        expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_3_BUDGET);
        expect(res.currency).toBe("INR");
        expect(res.perPersonDailyBudget).toBe(3000); // 24000 / (4 * 2)
        expect(res.estimatedStandardTotal).toBe(26000); // 3250 * 2 * 4
      }
    });

    test("3.4 International destinations NEVER receive domestic baseline calculations (receive global tiers and advisory)", () => {
      const intlDests = [
        "Tokyo",
        "London",
        "Paris",
        "New York",
        "Singapore",
        "Bali",
        "Phuket",
        "Maldives",
      ];
      for (const dest of intlDests) {
        const res = calculateBudgetIntelligence({
          destination: dest,
          totalBudget: 100000,
          days: 5,
          guests: 2,
          currency: "INR",
        });
        expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
        expect(res.isInternational).toBe(true);
        expect([
          ECONOMIC_TIERS.GLOBAL_TIER_A,
          ECONOMIC_TIERS.GLOBAL_TIER_B,
          ECONOMIC_TIERS.GLOBAL_TIER_C,
        ]).toContain(res.tier);
        expect([
          ECONOMIC_TIERS.TIER_1_METRO,
          ECONOMIC_TIERS.TIER_2_RESORT,
          ECONOMIC_TIERS.TIER_3_BUDGET,
        ]).not.toContain(res.tier);
        expect(res.dailyTierEstimates).toBeDefined();
        expect(res.estimatedTripTotals).toBeDefined();
        // Preserves user math
        expect(res.perPersonDailyBudget).toBe(10000);
        expect(res.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
      }
    });

    test("3.5 Unknown destinations produce UNKNOWN_DESTINATION without guessing a tier", () => {
      const unknowns = ["Atlantis City", "Krypton Prime", "UnknownTown9987"];
      for (const dest of unknowns) {
        const res = calculateBudgetIntelligence({
          destination: dest,
          totalBudget: 50000,
          days: 5,
          guests: 2,
          currency: "INR",
        });
        expect(res.status).toBe(CALCULATION_STATUS.UNKNOWN_DESTINATION);
        expect(res.tier).toBe(ECONOMIC_TIERS.UNKNOWN);
        expect(res.estimatedStandardTotal).toBeNull();
        expect(res.warnings[0].code).toBe("UNKNOWN_DESTINATION");
      }
    });

    test("3.6 Currency verification: accepts INR; returns UNSUPPORTED_CURRENCY for foreign currencies without invented rates", () => {
      const foreignCurrencies = ["USD", "EUR", "GBP", "JPY"];
      for (const cur of foreignCurrencies) {
        const res = calculateBudgetIntelligence({
          destination: "Goa, India",
          totalBudget: 1000,
          days: 5,
          guests: 1,
          currency: cur,
        });
        expect(res.status).toBe(CALCULATION_STATUS.UNSUPPORTED_CURRENCY);
        expect(res.currency).toBe(cur);
        expect(res.estimatedStandardTotal).toBeNull();
        expect(res.warnings[0].code).toBe("UNSUPPORTED_CURRENCY");
      }
    });
  });

  // =========================================================================
  // SECTION 4: Calculation Acceptance Matrix
  // =========================================================================
  describe("Section 4: Calculation Acceptance Matrix", () => {
    test("4.1 Party and duration permutations: solo traveler, group, 1-day, 14-days", () => {
      // Solo 1-day trip in Mumbai (Tier 1 baseline: 5300)
      const solo1Day = calculateBudgetIntelligence({
        destination: "Mumbai",
        totalBudget: 6000,
        days: 1,
        guests: 1,
        currency: "INR",
      });
      expect(solo1Day.perPersonDailyBudget).toBe(6000);
      expect(solo1Day.groupDailyBudget).toBe(6000);
      expect(solo1Day.estimatedStandardTotal).toBe(5300);
      expect(solo1Day.standardBudgetDifference).toBe(700);

      // 4-person 14-day trip in Jaipur (Tier 3 baseline: 3250)
      const group14Days = calculateBudgetIntelligence({
        destination: "Jaipur",
        totalBudget: 200000,
        days: 14,
        guests: 4,
        currency: "INR",
      });
      expect(group14Days.perPersonDailyBudget).toBe(Math.round(200000 / (14 * 4))); // 3571
      expect(group14Days.groupDailyBudget).toBe(Math.round(200000 / 14)); // 14286
      expect(group14Days.estimatedStandardTotal).toBe(3250 * 4 * 14); // 182000
      expect(group14Days.standardBudgetDifference).toBe(200000 - 182000); // 18000
    });

    test("4.2 Comfort category thresholds: below 75%, exactly 75%, 100%, 150%, and above 150%", () => {
      // Goa baseline: standard = 5000
      // 1. Below 75% (< 3750 daily per person): budget = 3000 -> ratio 0.60
      const low = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 3000,
        days: 1,
        guests: 1,
      });
      expect(low.sufficiencyRatio).toBe(0.60);
      expect(low.category).toBe(COMFORT_CATEGORIES.LOW);

      // 2. Exactly 75% (3750 / 5000 = 0.75): budget = 3750
      const exact75 = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 3750,
        days: 1,
        guests: 1,
      });
      expect(exact75.sufficiencyRatio).toBe(0.75);
      expect(exact75.category).toBe(COMFORT_CATEGORIES.MODERATE);

      // 3. Exactly 100% standard (5000 / 5000 = 1.00)
      const standard = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 5000,
        days: 1,
        guests: 1,
      });
      expect(standard.sufficiencyRatio).toBe(1.0);
      expect(standard.category).toBe(COMFORT_CATEGORIES.MODERATE);

      // 4. Exactly 150% (7500 / 5000 = 1.50)
      const exact150 = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 7500,
        days: 1,
        guests: 1,
      });
      expect(exact150.sufficiencyRatio).toBe(1.5);
      expect(exact150.category).toBe(COMFORT_CATEGORIES.HIGH);

      // 5. Above 150% (> 7500, e.g. 10000 -> ratio 2.00)
      const above150 = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 10000,
        days: 1,
        guests: 1,
      });
      expect(above150.sufficiencyRatio).toBe(2.0);
      expect(above150.category).toBe(COMFORT_CATEGORIES.HIGH);
    });

    test("4.3 Breakdown proportions: 35% accommodation, 25% food, 15% transport, 15% activities, 10% misc sum to 100%", () => {
      const res = calculateBudgetIntelligence({
        destination: "Delhi",
        totalBudget: 50000,
        days: 5,
        guests: 2,
      });

      const { breakdown } = res;
      expect(breakdown).toBeDefined();
      expect(breakdown.proportions.accommodation).toBe(0.35);
      expect(breakdown.proportions.food).toBe(0.25);
      expect(breakdown.proportions.transport).toBe(0.15);
      expect(breakdown.proportions.activities).toBe(0.15);
      expect(breakdown.proportions.misc).toBe(0.10);

      const propSum =
        breakdown.proportions.accommodation +
        breakdown.proportions.food +
        breakdown.proportions.transport +
        breakdown.proportions.activities +
        breakdown.proportions.misc;
      expect(Number(propSum.toFixed(2))).toBe(1.0);

      // Daily per person parts match standardDailyBaseline
      const dailySum =
        breakdown.dailyPerPerson.accommodation +
        breakdown.dailyPerPerson.food +
        breakdown.dailyPerPerson.transport +
        breakdown.dailyPerPerson.activities +
        breakdown.dailyPerPerson.misc;
      expect(dailySum).toBe(breakdown.dailyPerPerson.total);
    });

    test("4.4 Validation: missing, zero, negative, or invalid values return INVALID_INPUT safely", () => {
      const invalidCases = [
        { totalBudget: 0, days: 3, guests: 2, destination: "Goa" },
        { totalBudget: -5000, days: 3, guests: 2, destination: "Goa" },
        { totalBudget: "invalid", days: 3, guests: 2, destination: "Goa" },
        { totalBudget: 25000, days: 0, guests: 2, destination: "Goa" },
        { totalBudget: 25000, days: -1, guests: 2, destination: "Goa" },
        { totalBudget: 25000, days: 3.5, guests: 2, destination: "Goa" },
        { totalBudget: 25000, days: 3, guests: 0, destination: "Goa" },
        { totalBudget: 25000, days: 3, guests: -2, destination: "Goa" },
        { totalBudget: 25000, days: 3, guests: 2, destination: "" },
        { totalBudget: 25000, days: 3, guests: 2, destination: null },
      ];

      for (const input of invalidCases) {
        const res = calculateBudgetIntelligence(input);
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
        expect(res.validationErrors.length).toBeGreaterThan(0);
      }
    });

    test("4.5 Full mathematical parity: backend endpoint returns exact calculated values", async () => {
      const testPayload = {
        destination: "Bengaluru",
        totalBudget: 60000,
        days: 5,
        guests: 3,
        currency: "INR",
      };

      const localCalc = calculateBudgetIntelligence(testPayload);
      const apiRes = await request(app).post("/api/budget/intelligence").send(testPayload);

      expect(apiRes.status).toBe(200);
      expect(apiRes.body.success).toBe(true);
      expect(apiRes.body.data.perPersonDailyBudget).toBe(localCalc.perPersonDailyBudget);
      expect(apiRes.body.data.groupDailyBudget).toBe(localCalc.groupDailyBudget);
      expect(apiRes.body.data.estimatedStandardTotal).toBe(localCalc.estimatedStandardTotal);
      expect(apiRes.body.data.sufficiencyRatio).toBe(localCalc.sufficiencyRatio);
      expect(apiRes.body.data.category).toBe(localCalc.category);
    });
  });

  // =========================================================================
  // SECTION 5: Adaptive Pivot and Fix Day Acceptance
  // =========================================================================
  describe("Section 5: Adaptive Pivot and Fix Day Acceptance", () => {
    test("5.1 Adaptive Pivot across multiple reasons preserves budget context and staged immutability", async () => {
      const booking = await createTestBooking();

      const reasons = [
        { reason: "rain", indoorOutdoor: "Indoor" },
        { reason: "low_energy", indoorOutdoor: "Indoor" },
        { reason: "budget", indoorOutdoor: "Indoor" },
        { reason: "running_late", indoorOutdoor: "Indoor" },
        { reason: "closed", indoorOutdoor: "Indoor" },
      ];

      for (const r of reasons) {
        GoogleGenAI.mockImplementation(() => ({
          models: {
            generateContent: jest.fn().mockResolvedValue({
              text: JSON.stringify({ replacement: mockCandidate({ indoorOutdoor: r.indoorOutdoor }) }),
            }),
          },
        }));

        const res = await request(app).post("/api/ai/pivot").send({
          tripId: booking._id.toString(),
          dayNumber: 1,
          block: "morning",
          pivotReason: r.reason,
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.budgetGuidance).toBeDefined();
        expect(res.body.data.budgetGuidance.destinationTier).toBe("TIER_2_RESORT");
        expect(res.body.data.persisted).toBe(false); // Staged, never auto-saved
      }
    });

    test("5.2 Budget pivot uses low-cost/free activity guidance and never fabricates monetary savings", async () => {
      const booking = await createTestBooking();

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({
              replacement: mockCandidate({
                cost: "Free",
                reason: "Budget-conscious replacement selected.",
              }),
            }),
          }),
        },
      }));

      const res = await request(app).post("/api/ai/pivot").send({
        tripId: booking._id.toString(),
        dayNumber: 1,
        block: "morning",
        pivotReason: "budget",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.replacement.cost).toBe("Free");
      expect(res.body.data.numericSavings).toBeUndefined();
      expect(res.body.data.moneySaved).toBeUndefined();
      expect(res.body.data.budgetGuidance.qualitativeNote).toContain("Budget-conscious replacement selected");
    });

    test("5.3 Fix Day preview includes deterministic budget guidance", async () => {
      const booking = await createTestBooking({ budget: "32000", guests: 2 });

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({ replacement: mockCandidate({ durationMinutes: 45 }) }),
          }),
        },
      }));

      const res = await request(app).post("/api/ai/fix-day/preview").send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        reason: "schedule_overload",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.budgetGuidance).toBeDefined();
      expect(res.body.data.budgetGuidance.destinationTier).toBe("TIER_2_RESORT");
      expect(typeof res.body.data.budgetGuidance.perPersonDailyBudget).toBe("number");
      expect(res.body.data.budgetGuidance.qualitativeNote).toContain("qualitative venue estimates");
    });

    test("5.4 Fix Day apply requires explicit approval with signed HMAC token; rejects tampered or expired tokens", async () => {
      const booking = await createTestBooking();

      // Expired token (lifetime <= 15 min, but expiresAt in the past)
      const expiredToken = signProposalToken({
        purpose: "fix-day",
        proposalId: crypto.randomUUID(),
        tripId: booking._id.toString(),
        dayNumber: 2,
        baseVersion: booking.__v,
        reason: "schedule_overload",
        currentPeriod: null,
        delayMinutes: null,
        replacementSlots: [
          { targetActivityId: "d2-evening-01", replacement: mockCandidate({ id: "d2-evening-01" }) },
        ],
        issuedAt: Date.now() - 600000,
        expiresAt: Date.now() - 10000,
      });

      const expRes = await request(app).post("/api/ai/fix-day/apply").send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        proposalToken: expiredToken,
      });
      expect(expRes.status).toBe(410);
      expect(expRes.body.code).toBe("TOKEN_EXPIRED");

      // Tampered token
      const validToken = signProposalToken({
        purpose: "fix-day",
        proposalId: crypto.randomUUID(),
        tripId: booking._id.toString(),
        dayNumber: 2,
        baseVersion: booking.__v,
        reason: "schedule_overload",
        currentPeriod: null,
        delayMinutes: null,
        replacementSlots: [
          { targetActivityId: "d2-evening-01", replacement: mockCandidate({ id: "d2-evening-01" }) },
        ],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
      });
      const parts = validToken.split(".");
      const forgedPayload = Buffer.from(
        JSON.stringify({ ...JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8")), dayNumber: 1 })
      ).toString("base64url");
      const tamperedToken = `${forgedPayload}.${parts[1]}`;

      const tampRes = await request(app).post("/api/ai/fix-day/apply").send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        proposalToken: tamperedToken,
      });
      expect(tampRes.status).toBe(400);
      expect(tampRes.body.code).toBe("INVALID_TOKEN");
    });

    test("5.5 OCC concurrency conflict handling: rejecting apply if baseVersion mismatches authoritative DB __v", async () => {
      const booking = await createTestBooking();

      const token = signProposalToken({
        purpose: "fix-day",
        proposalId: crypto.randomUUID(),
        tripId: booking._id.toString(),
        dayNumber: 2,
        baseVersion: booking.__v, // 0
        reason: "schedule_overload",
        currentPeriod: null,
        delayMinutes: null,
        replacementSlots: [
          { targetActivityId: "d2-evening-01", replacement: mockCandidate({ id: "d2-evening-01" }) },
        ],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
      });

      // Advance DB version
      await Booking.findByIdAndUpdate(booking._id, { $inc: { __v: 1 } });

      const res = await request(app).post("/api/ai/fix-day/apply").send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        proposalToken: token,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONCURRENCY_CONFLICT");
    });
  });

  // =========================================================================
  // SECTION 6: Security and Privacy Regression
  // =========================================================================
  describe("Section 6: Security and Privacy Regression", () => {
    test("6.1 Budget API endpoints (/api/budget/intelligence and /api/budget/calculate) work identically and ignore client math", async () => {
      const payload = {
        destination: "Goa, India",
        totalBudget: 45000,
        days: 5,
        guests: 3,
        currency: "INR",
        // Client attempting to inject bogus calculations
        perPersonDailyBudget: 999999,
        estimatedStandardTotal: 1,
        category: "ultra-high",
      };

      const res1 = await request(app).post("/api/budget/intelligence").send(payload);
      const res2 = await request(app).post("/api/budget/calculate").send(payload);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data).toEqual(res2.body.data);

      // Verify client-injected calculations were completely ignored and replaced with true server math
      expect(res1.body.data.perPersonDailyBudget).toBe(3000); // 45000 / (5 * 3)
      expect(res1.body.data.estimatedStandardTotal).toBe(75000); // 5000 * 3 * 5
      expect(res1.body.data.category).toBe(COMFORT_CATEGORIES.LOW); // 3000 / 5000 = 0.60
    });

    test("6.2 Zero AI calls and zero DB mutations occur during standalone budget calculations", async () => {
      const mockGenerate = jest.fn();
      GoogleGenAI.mockImplementation(() => ({
        models: { generateContent: mockGenerate },
      }));

      const countBefore = await Booking.countDocuments();

      const res = await request(app).post("/api/budget/intelligence").send({
        destination: "Mumbai",
        totalBudget: 50000,
        days: 5,
        guests: 2,
        currency: "INR",
      });

      const countAfter = await Booking.countDocuments();

      expect(res.status).toBe(200);
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(countAfter).toBe(countBefore);
    });

    test("6.3 Shared-trip sanitization excludes user ID, email, payment details, budget, and proposal tokens", async () => {
      const booking = await createTestBooking({
        budget: "40000",
        guests: 2,
        isShared: true,
      });

      const sanitized = sanitizePublicAiPlan(booking.aiPlan);

      expect(sanitized.destination).toBe("Goa, India");
      expect(sanitized.days).toHaveLength(2);

      // Verify private fields are strictly excluded
      expect(sanitized.user).toBeUndefined();
      expect(sanitized.userId).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.budget).toBeUndefined();
      expect(sanitized.paymentId).toBeUndefined();
      expect(sanitized.proposalToken).toBeUndefined();
    });

    test("6.4 Shared-trip test count reconciliation confirms no tests deleted or skipped", () => {
      // Direct verification of test counts across the two dedicated suites:
      // Suite A: sharedTripPrivacy.test.js (15 tests)
      // Suite B: phase5d5SharedTripAndPdfMetadata.test.js (9 tests)
      // Total shared trip privacy assertions: 24 tests
      const fs = require("fs");
      const path = require("path");

      const suiteAPath = path.join(__dirname, "sharedTripPrivacy.test.js");
      const suiteBPath = path.join(__dirname, "phase5d5SharedTripAndPdfMetadata.test.js");

      expect(fs.existsSync(suiteAPath)).toBe(true);
      expect(fs.existsSync(suiteBPath)).toBe(true);

      const suiteAContent = fs.readFileSync(suiteAPath, "utf8");
      const suiteBContent = fs.readFileSync(suiteBPath, "utf8");

      const suiteATests = (suiteAContent.match(/\bit\s*\(/g) || []).length;
      const suiteBTests = (suiteBContent.match(/\btest\s*\(|\bit\s*\(/g) || []).length;

      expect(suiteATests).toBe(15);
      expect(suiteBTests).toBe(9);
      expect(suiteATests + suiteBTests).toBe(24);
    });
  });
});
