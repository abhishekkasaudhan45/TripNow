// backend/tests/budgetPhase1GlobalTiers.test.js
const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./db");
const {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  GLOBAL_TIER_CONFIG,
  GLOBAL_ESTIMATE_DISCLOSURE,
  resolveDestinationTier,
  calculateBudgetIntelligence,
  getBaselineForTier,
} = require("../services/budgetIntelligence");

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

describe("TripNow Phase 1 — Three-Tier International Budget Intelligence Backend", () => {
  // =========================================================================
  // 1. Destination Resolution Precedence & Canonical Cases
  // =========================================================================
  describe("1. Deterministic Destination Resolution & Precedence", () => {
    const requiredCases = [
      { input: "Nepal", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A, scope: "Tier A Country" },
      { input: "Kathmandu", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A, scope: "Tier A City" },
      { input: "Thailand", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A, scope: "Tier A Country" },
      { input: "Indonesia", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A, scope: "Tier A Country" },
      { input: "Bali", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, scope: "Tier B Resort (overrides Indonesia)" },
      { input: "Dubai", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, scope: "Tier B City" },
      { input: "Abu Dhabi", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, scope: "Tier B City" },
      { input: "Singapore", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, scope: "Tier B City" },
      { input: "Paris", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C City" },
      { input: "France", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C Country" },
      { input: "London", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C City" },
      { input: "UK", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C Country" },
      { input: "Tokyo", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C City" },
      { input: "Japan", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C Country" },
      { input: "Europe", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, scope: "Tier C Region" },
    ];

    test.each(requiredCases)(
      "resolves $input to $expectedTier ($scope)",
      ({ input, expectedTier }) => {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(expectedTier);
        expect(res.isInternational).toBe(true);
        expect(res.isKnown).toBe(true);
      }
    );

    it("verifies Bali resolves to Tier B even when entered as 'Bali, Indonesia'", () => {
      const res = resolveDestinationTier("Bali, Indonesia");
      expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_B);
      expect(res.canonicalName).toBe("Bali");
      expect(res.isInternational).toBe(true);
    });

    it("handles case-insensitivity and whitespace normalization for international destinations", () => {
      const variants = [
        "  tokyo  ",
        "TOKYO",
        "ToKyO",
        "\t\n tokyo \r ",
        "  pArIs  ",
        "   DUBAI   ",
        " bAli ",
      ];
      for (const v of variants) {
        const res = resolveDestinationTier(v);
        expect([ECONOMIC_TIERS.GLOBAL_TIER_B, ECONOMIC_TIERS.GLOBAL_TIER_C]).toContain(res.tier);
        expect(res.isInternational).toBe(true);
        expect(res.isKnown).toBe(true);
      }
    });

    it("preserves domestic destinations without misclassifying them as international", () => {
      const domesticList = [
        { input: "Goa", tier: ECONOMIC_TIERS.TIER_2_RESORT },
        { input: "Mumbai", tier: ECONOMIC_TIERS.TIER_1_METRO },
        { input: "Delhi", tier: ECONOMIC_TIERS.TIER_1_METRO },
        { input: "Manali", tier: ECONOMIC_TIERS.TIER_3_BUDGET },
        { input: "Jaipur", tier: ECONOMIC_TIERS.TIER_3_BUDGET },
        { input: "Kochi", tier: ECONOMIC_TIERS.TIER_3_BUDGET },
        { input: "Agra", tier: ECONOMIC_TIERS.TIER_3_BUDGET },
        { input: "Varanasi", tier: ECONOMIC_TIERS.TIER_3_BUDGET },
      ];

      for (const { input, tier } of domesticList) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(tier);
        expect(res.isInternational).toBe(false);
        expect(res.isKnown).toBe(true);
      }
    });

    it("resolves unlisted international destinations to GLOBAL_TIER_B with isUnlistedInternational: true", () => {
      const unlistedDestinations = [
        "Brazil",
        "Iceland",
        "South Africa",
        "Kenya",
        "New Zealand",
        "international holiday",
      ];

      for (const dest of unlistedDestinations) {
        const res = resolveDestinationTier(dest);
        expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_B);
        expect(res.isInternational).toBe(true);
        expect(res.isUnlistedInternational).toBe(true);
      }
    });

    it("resolves truly unknown or ambiguous destinations to UNKNOWN", () => {
      const unknownQueries = [
        "Atlantis Deep City",
        "Wonderland Forest",
        "RandomNonExistentPlace123",
      ];

      for (const query of unknownQueries) {
        const res = resolveDestinationTier(query);
        expect(res.tier).toBe(ECONOMIC_TIERS.UNKNOWN);
        expect(res.isKnown).toBe(false);
        expect(res.isInternational).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. Three Daily Estimates & Total Trip Estimates
  // =========================================================================
  describe("2. Three Daily Estimates (Low, Mid, High) and Total Calculations", () => {
    it("verifies configured low, mid, and high values in GLOBAL_TIER_CONFIG and baseline matrix", () => {
      // Tier A
      const tierA = getBaselineForTier(ECONOMIC_TIERS.GLOBAL_TIER_A, "INR");
      expect(tierA.budget).toBe(3500);   // Low
      expect(tierA.standard).toBe(5500); // Mid
      expect(tierA.premium).toBe(11000); // High

      // Tier B
      const tierB = getBaselineForTier(ECONOMIC_TIERS.GLOBAL_TIER_B, "INR");
      expect(tierB.budget).toBe(7500);   // Low
      expect(tierB.standard).toBe(12000);// Mid
      expect(tierB.premium).toBe(22000); // High

      // Tier C
      const tierC = getBaselineForTier(ECONOMIC_TIERS.GLOBAL_TIER_C, "INR");
      expect(tierC.budget).toBe(14000);  // Low
      expect(tierC.standard).toBe(22000);// Mid
      expect(tierC.premium).toBe(40000); // High
    });

    it("calculates accurate low/mid/high trip totals for GLOBAL_TIER_A (Nepal: 2 travelers, 4 days)", () => {
      // 2 travelers * 4 days = 8 person-days
      // Low total: 3500 * 8 = 28,000
      // Mid total: 5500 * 8 = 44,000
      // High total: 11000 * 8 = 88,000
      const res = calculateBudgetIntelligence({
        totalBudget: 44000,
        days: 4,
        guests: 2,
        destination: "Nepal",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_A);
      expect(res.dailyTierEstimates).toEqual({ low: 3500, mid: 5500, high: 11000 });
      expect(res.estimatedTripTotals).toEqual({ low: 28000, mid: 44000, high: 88000 });
      expect(res.perPersonDailyBudget).toBe(5500);
      expect(res.dailyAvailablePerPerson).toBe(5500);
      expect(res.estimatedStandardTotal).toBe(44000);
      expect(res.sufficiencyRatio).toBe(1.0);
      expect(res.category).toBe(COMFORT_CATEGORIES.MODERATE);
    });

    it("calculates accurate low/mid/high trip totals for GLOBAL_TIER_B (Dubai: 3 travelers, 5 days)", () => {
      // 3 travelers * 5 days = 15 person-days
      // Low total: 7500 * 15 = 112,500
      // Mid total: 12000 * 15 = 180,000
      // High total: 22000 * 15 = 330,000
      const res = calculateBudgetIntelligence({
        totalBudget: 180000,
        days: 5,
        guests: 3,
        destination: "Dubai",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_B);
      expect(res.dailyTierEstimates).toEqual({ low: 7500, mid: 12000, high: 22000 });
      expect(res.estimatedTripTotals).toEqual({ low: 112500, mid: 180000, high: 330000 });
      expect(res.perPersonDailyBudget).toBe(12000);
      expect(res.dailyAvailablePerPerson).toBe(12000);
      expect(res.sufficiencyRatio).toBe(1.0);
    });

    it("calculates accurate low/mid/high trip totals for GLOBAL_TIER_C (Tokyo: 1 traveler, 3 days)", () => {
      // 1 traveler * 3 days = 3 person-days
      // Low total: 14000 * 3 = 42,000
      // Mid total: 22000 * 3 = 66,000
      // High total: 40000 * 3 = 120,000
      const res = calculateBudgetIntelligence({
        totalBudget: 66000,
        days: 3,
        guests: 1,
        destination: "Tokyo",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_C);
      expect(res.dailyTierEstimates).toEqual({ low: 14000, mid: 22000, high: 40000 });
      expect(res.estimatedTripTotals).toEqual({ low: 42000, mid: 66000, high: 120000 });
      expect(res.perPersonDailyBudget).toBe(22000);
      expect(res.dailyAvailablePerPerson).toBe(22000);
      expect(res.sufficiencyRatio).toBe(1.0);
    });

    it("attaches GLOBAL_ESTIMATE_ADVISORY warning to all international estimates", () => {
      const res = calculateBudgetIntelligence({
        totalBudget: 50000,
        days: 3,
        guests: 1,
        destination: "Paris",
        currency: "INR",
      });

      expect(res.isInternational).toBe(true);
      const adv = res.warnings.find((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY");
      expect(adv).toBeDefined();
      expect(adv.severity).toBe("info");
      expect(adv.message).toBe(GLOBAL_ESTIMATE_DISCLOSURE);
    });

    it("assigns status GLOBAL_ESTIMATE_ADVISORY to unlisted international destinations", () => {
      const res = calculateBudgetIntelligence({
        totalBudget: 60000,
        days: 3,
        guests: 2,
        destination: "Brazil",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.GLOBAL_ESTIMATE_ADVISORY);
      expect(res.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_B);
      expect(res.warnings.some((w) => w.code === "UNLISTED_INTERNATIONAL_PROVISIONAL")).toBe(true);
    });
  });

  // =========================================================================
  // 3. Validation, Safety Guards & Domestic Isolation
  // =========================================================================
  describe("3. Validation & Domestic Safety Invariants", () => {
    it("rejects zero or negative travelers with INVALID_INPUT", () => {
      for (const g of [0, -1, -5]) {
        const res = calculateBudgetIntelligence({
          totalBudget: 50000,
          days: 3,
          guests: g,
          destination: "Dubai",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
      }
    });

    it("rejects zero, negative, or decimal duration with INVALID_INPUT", () => {
      for (const d of [0, -2, 3.5, 4.2]) {
        const res = calculateBudgetIntelligence({
          totalBudget: 50000,
          days: d,
          guests: 2,
          destination: "Paris",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
      }
    });

    it("rejects non-positive budget with INVALID_INPUT", () => {
      for (const b of [0, -100, ""]) {
        const res = calculateBudgetIntelligence({
          totalBudget: b,
          days: 3,
          guests: 2,
          destination: "Tokyo",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
      }
    });

    it("rejects foreign currencies with UNSUPPORTED_CURRENCY", () => {
      const res = calculateBudgetIntelligence({
        totalBudget: 2000,
        days: 4,
        guests: 2,
        destination: "Tokyo",
        currency: "USD",
      });
      expect(res.status).toBe(CALCULATION_STATUS.UNSUPPORTED_CURRENCY);
      expect(res.warnings.some((w) => w.code === "UNSUPPORTED_CURRENCY")).toBe(true);
    });

    it("preserves exact domestic calculation numbers without alteration", () => {
      const domesticGoa = calculateBudgetIntelligence({
        totalBudget: 30000,
        days: 3,
        guests: 2,
        destination: "Goa",
        currency: "INR",
      });

      expect(domesticGoa.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(domesticGoa.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);
      expect(domesticGoa.perPersonDailyBudget).toBe(5000);
      expect(domesticGoa.estimatedStandardTotal).toBe(30000); // 5000 * 2 * 3
      expect(domesticGoa.sufficiencyRatio).toBe(1.0);
      expect(domesticGoa.isInternational).toBe(false);
      expect(domesticGoa.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(false);
    });
  });

  // =========================================================================
  // 4. End-to-End API Route Integration (POST /api/budget/intelligence)
  // =========================================================================
  describe("4. API Endpoint Integration (POST /api/budget/intelligence)", () => {
    it("computes accurate global tier data via API for Tokyo (Tier C)", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 110000,
          days: 5,
          guests: 1,
          destination: "Tokyo",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.tier).toBe("GLOBAL_TIER_C");
      expect(data.dailyTierEstimates).toEqual({ low: 14000, mid: 22000, high: 40000 });
      expect(data.estimatedTripTotals).toEqual({ low: 70000, mid: 110000, high: 200000 });
      expect(data.sufficiencyRatio).toBe(1.0);
      expect(data.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
    });

    it("computes accurate global tier data via API for Bali (Tier B)", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 96000,
          days: 4,
          guests: 2,
          destination: "Bali",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.tier).toBe("GLOBAL_TIER_B");
      expect(data.dailyTierEstimates).toEqual({ low: 7500, mid: 12000, high: 22000 });
      expect(data.estimatedTripTotals).toEqual({ low: 60000, mid: 96000, high: 176000 });
      expect(data.sufficiencyRatio).toBe(1.0);
    });

    it("computes accurate global tier data via API for Thailand (Tier A)", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 44000,
          days: 4,
          guests: 2,
          destination: "Thailand",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.tier).toBe("GLOBAL_TIER_A");
      expect(data.dailyTierEstimates).toEqual({ low: 3500, mid: 5500, high: 11000 });
      expect(data.estimatedTripTotals).toEqual({ low: 28000, mid: 44000, high: 88000 });
      expect(data.sufficiencyRatio).toBe(1.0);
    });

    it("returns GLOBAL_ESTIMATE_ADVISORY status via API for unlisted international destination", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 60000,
          days: 3,
          guests: 2,
          destination: "Iceland",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.status).toBe("GLOBAL_ESTIMATE_ADVISORY");
      expect(data.tier).toBe("GLOBAL_TIER_B");
      expect(data.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
    });
  });
});

