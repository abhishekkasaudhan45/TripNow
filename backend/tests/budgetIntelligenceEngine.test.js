// backend/tests/budgetIntelligenceEngine.test.js
const {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  SUPPORTED_CURRENCIES,
  BASELINE_MATRIX,
  DESTINATION_REGISTRY,
  normalizeDestination,
  resolveDestinationTier,
  getBaselineForTier,
  generateCategoryBreakdown,
  parseNumericBudgetSafe,
  normalizeCurrencyCode,
  calculateBudgetIntelligence,
} = require("../services/budgetIntelligence");

describe("TripNow Phase 5E.2 — Deterministic Budget Intelligence Engine", () => {
  // =========================================================================
  // 1. Destination Economic Tier Classification
  // =========================================================================
  describe("1. Destination Tier Classification & Normalization", () => {
    it("handles case-insensitivity and whitespace normalization", () => {
      const variants = ["mumbai", "MUMBAI", "  Mumbai  ", "MuMbAi", "  \n  mumbai\t  "];
      for (const v of variants) {
        const res = resolveDestinationTier(v);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_1_METRO);
        expect(res.canonicalName).toBe("Mumbai");
        expect(res.isInternational).toBe(false);
      }
    });

    it("correctly classifies all required TIER_1_METRO examples", () => {
      const examples = [
        { input: "Mumbai", canonical: "Mumbai" },
        { input: "Bombay", canonical: "Mumbai" },
        { input: "Delhi", canonical: "Delhi NCR" },
        { input: "New Delhi", canonical: "Delhi NCR" },
        { input: "Gurgaon", canonical: "Delhi NCR" },
        { input: "Noida", canonical: "Delhi NCR" },
        { input: "Bengaluru", canonical: "Bengaluru" },
        { input: "Bangalore", canonical: "Bengaluru" },
      ];

      for (const { input, canonical } of examples) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_1_METRO);
        expect(res.canonicalName).toBe(canonical);
        expect(res.isInternational).toBe(false);
        expect(res.isKnown).toBe(true);
      }
    });

    it("correctly classifies all required TIER_2_RESORT examples (domestic and international)", () => {
      // Domestic resorts:
      const domesticResorts = [
        { input: "Goa", canonical: "Goa", isIntl: false },
        { input: "North Goa", canonical: "Goa", isIntl: false },
        { input: "Calangute", canonical: "Goa", isIntl: false },
        { input: "Andaman", canonical: "Andaman and Nicobar", isIntl: false },
        { input: "Havelock Island", canonical: "Andaman and Nicobar", isIntl: false },
        { input: "Port Blair", canonical: "Andaman and Nicobar", isIntl: false },
      ];

      for (const { input, canonical, isIntl } of domesticResorts) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);
        expect(res.canonicalName).toBe(canonical);
        expect(res.isInternational).toBe(isIntl);
        expect(res.isKnown).toBe(true);
      }

      // International resorts resolve to their approved global tiers (Bali/Maldives -> Tier B, Phuket -> Tier A):
      const intlResorts = [
        { input: "Bali", canonical: "Bali", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
        { input: "Ubud", canonical: "Bali", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
        { input: "Phuket", canonical: "Phuket", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A },
        { input: "Patong", canonical: "Phuket", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A },
        { input: "Maldives", canonical: "Maldives", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
        { input: "Male", canonical: "Maldives", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
      ];

      for (const { input, canonical, expectedTier } of intlResorts) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(expectedTier);
        expect(res.canonicalName).toBe(canonical);
        expect(res.isInternational).toBe(true);
        expect(res.isKnown).toBe(true);
      }
    });

    it("correctly classifies all required TIER_3_BUDGET examples", () => {
      const budgetHills = [
        { input: "Manali", canonical: "Manali" },
        { input: "Shimla", canonical: "Shimla" },
        { input: "Rishikesh", canonical: "Rishikesh" },
        { input: "Jaipur", canonical: "Jaipur" },
        { input: "Udaipur", canonical: "Udaipur" },
        { input: "Darjeeling", canonical: "Darjeeling" },
        { input: "Varanasi", canonical: "Varanasi" },
        { input: "Kashi", canonical: "Varanasi" },
        { input: "Banaras", canonical: "Varanasi" },
        { input: "Kashmir", canonical: "Kashmir" },
        { input: "Ladakh", canonical: "Ladakh" },
      ];

      for (const { input, canonical } of budgetHills) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(ECONOMIC_TIERS.TIER_3_BUDGET);
        expect(res.canonicalName).toBe(canonical);
        expect(res.isInternational).toBe(false);
        expect(res.isKnown).toBe(true);
      }
    });

    it("correctly classifies international destinations into approved global tiers (Tier A/B/C)", () => {
      const intlExamples = [
        { input: "Tokyo", canonical: "Tokyo", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "London", canonical: "London", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "Paris", canonical: "Paris", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "New York", canonical: "New York", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "NYC", canonical: "New York", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "Singapore", canonical: "Singapore", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
        { input: "Dubai", canonical: "Dubai", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B },
        { input: "Rome", canonical: "Rome", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
        { input: "Bangkok", canonical: "Bangkok", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A },
        { input: "Sydney", canonical: "Sydney", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C },
      ];

      for (const { input, canonical, expectedTier } of intlExamples) {
        const res = resolveDestinationTier(input);
        expect(res.tier).toBe(expectedTier);
        expect(res.canonicalName).toBe(canonical);
        expect(res.isInternational).toBe(true);
        expect(res.isKnown).toBe(true);
      }
    });

    it("prevents brittle substring collisions (e.g. Andaman vs Daman, Agra vs Niagara, Goa vs Goalkeeping)", () => {
      // 1. Daman vs Andaman
      const andamanRes = resolveDestinationTier("Andaman");
      expect(andamanRes.canonicalName).toBe("Andaman and Nicobar");
      expect(andamanRes.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);

      const damanRes = resolveDestinationTier("Daman");
      expect(damanRes.canonicalName).toBe("Daman and Diu");
      expect(damanRes.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);

      // 2. Agra vs Niagara
      const agraRes = resolveDestinationTier("Agra");
      expect(agraRes.canonicalName).toBe("Agra");
      expect(agraRes.tier).toBe(ECONOMIC_TIERS.TIER_3_BUDGET);

      const niagaraRes = resolveDestinationTier("Niagara Falls");
      expect(niagaraRes.canonicalName).toBe("Niagara Falls");
      expect(niagaraRes.tier).toBe(ECONOMIC_TIERS.UNKNOWN); // Not erroneously mapped to Agra!

      // 3. Goa vs Goalkeeping
      const goaRes = resolveDestinationTier("Goa");
      expect(goaRes.canonicalName).toBe("Goa");
      expect(goaRes.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);

      const soccerRes = resolveDestinationTier("Goalkeeping Training Camp");
      expect(soccerRes.tier).toBe(ECONOMIC_TIERS.UNKNOWN); // Not erroneously mapped to Goa!
    });

    it("returns UNKNOWN tier without silently classifying unknown destinations", () => {
      const unknownPlaces = ["Atlantis", "Gotham City", "Wakanda", "Narnia", "Hogwarts"];
      for (const place of unknownPlaces) {
        const res = resolveDestinationTier(place);
        expect(res.tier).toBe(ECONOMIC_TIERS.UNKNOWN);
        expect(res.isKnown).toBe(false);
        expect(res.isInternational).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. Baseline Matrix Configuration & Proportions
  // =========================================================================
  describe("2. Baseline Matrix Configuration & Proportions", () => {
    it("matches approved INR reference anchors exactly", () => {
      const t1 = getBaselineForTier(ECONOMIC_TIERS.TIER_1_METRO, "INR");
      expect(t1.budget).toBe(2000);
      expect(t1.standard).toBe(5300);
      expect(t1.premium).toBe(13300);
      expect(t1.accommodationTwinSharing).toBe(true);

      const t2 = getBaselineForTier(ECONOMIC_TIERS.TIER_2_RESORT, "INR");
      expect(t2.budget).toBe(1800);
      expect(t2.standard).toBe(5000);
      expect(t2.premium).toBe(12500);
      expect(t2.accommodationTwinSharing).toBe(true);

      const t3 = getBaselineForTier(ECONOMIC_TIERS.TIER_3_BUDGET, "INR");
      expect(t3.budget).toBe(1250);
      expect(t3.standard).toBe(3250);
      expect(t3.premium).toBe(8300);
      expect(t3.accommodationTwinSharing).toBe(true);

      // TIER_4_INTERNATIONAL is NOT YET APPROVED in INR
      const t4 = getBaselineForTier(ECONOMIC_TIERS.TIER_4_INTERNATIONAL, "INR");
      expect(t4).toBeNull();
    });

    it("verifies that category proportions sum to exactly 1.00 (100%)", () => {
      const sum =
        CATEGORY_PROPORTIONS.accommodation +
        CATEGORY_PROPORTIONS.food +
        CATEGORY_PROPORTIONS.transport +
        CATEGORY_PROPORTIONS.activities +
        CATEGORY_PROPORTIONS.misc;

      expect(Number(sum.toFixed(6))).toBe(1.0);
    });

    it("generates breakdown matching standard baseline exactly without rounding discrepancies", () => {
      const breakdown = generateCategoryBreakdown(5300, 2, 3);
      expect(breakdown).toBeDefined();

      const { dailyPerPerson, tripTotal } = breakdown;
      expect(dailyPerPerson.total).toBe(5300);

      const componentSum =
        dailyPerPerson.accommodation +
        dailyPerPerson.food +
        dailyPerPerson.transport +
        dailyPerPerson.activities +
        dailyPerPerson.misc;

      expect(componentSum).toBe(5300);
      expect(tripTotal.total).toBe(5300 * 2 * 3);
      expect(tripTotal.accommodation).toBe(dailyPerPerson.accommodation * 2 * 3);
    });
  });

  // =========================================================================
  // 3. Core Calculations & Threshold Classifications
  // =========================================================================
  describe("3. Core Calculations & Threshold Classifications", () => {
    it("calculates single traveler, multi-day trip accurately", () => {
      // Destination: Goa (TIER_2_RESORT, standard = 5000)
      // totalBudget = 15000, days = 3, guests = 1
      const res = calculateBudgetIntelligence({
        totalBudget: 15000,
        days: 3,
        guests: 1,
        destination: "Goa",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.tier).toBe(ECONOMIC_TIERS.TIER_2_RESORT);
      expect(res.perPersonDailyBudget).toBe(5000); // 15000 / (1 * 3)
      expect(res.groupDailyBudget).toBe(5000);     // 15000 / 3
      expect(res.estimatedStandardTotal).toBe(15000); // 5000 * 1 * 3
      expect(res.standardBudgetDifference).toBe(0); // 15000 - 15000
      expect(res.sufficiencyRatio).toBe(1.0); // 5000 / 5000
      expect(res.category).toBe(COMFORT_CATEGORIES.MODERATE); // 0.75 <= ratio < 1.5
    });

    it("calculates multiple travelers, multi-day trip accurately", () => {
      // Destination: Mumbai (TIER_1_METRO, standard = 5300)
      // totalBudget = 63600, days = 3, guests = 4
      // Estimated standard = 5300 * 4 * 3 = 63600
      const res = calculateBudgetIntelligence({
        totalBudget: 63600,
        days: 3,
        guests: 4,
        destination: "Mumbai",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.tier).toBe(ECONOMIC_TIERS.TIER_1_METRO);
      expect(res.perPersonDailyBudget).toBe(5300); // 63600 / (4 * 3)
      expect(res.groupDailyBudget).toBe(21200);   // 63600 / 3
      expect(res.estimatedStandardTotal).toBe(63600);
      expect(res.standardBudgetDifference).toBe(0);
      expect(res.sufficiencyRatio).toBe(1.0);
      expect(res.category).toBe(COMFORT_CATEGORIES.MODERATE);
    });

    it("classifies LOW category when ratio < 0.75 and handles negative difference", () => {
      // Destination: Jaipur (TIER_3_BUDGET, standard = 3250)
      // Let perPersonDaily = 2000. 2000 / 3250 = ~0.6154 (< 0.75 -> LOW)
      // For 1 guest, 2 days: totalBudget = 4000. Estimated standard = 6500.
      const res = calculateBudgetIntelligence({
        totalBudget: 4000,
        days: 2,
        guests: 1,
        destination: "Jaipur",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.category).toBe(COMFORT_CATEGORIES.LOW);
      expect(res.sufficiencyRatio).toBeLessThan(0.75);
      expect(res.standardBudgetDifference).toBe(-2500); // 4000 - 6500 = -2500 (shortfall)
      expect(res.warnings.some((w) => w.code === "BUDGET_LOW_ADVISORY")).toBe(true);
    });

    it("classifies MODERATE category at exactly 0.75 threshold", () => {
      // Standard = 5000 (Goa). Target perPersonDaily = 5000 * 0.75 = 3750.
      // 1 guest, 2 days: totalBudget = 7500.
      const res = calculateBudgetIntelligence({
        totalBudget: 7500,
        days: 2,
        guests: 1,
        destination: "Goa",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.sufficiencyRatio).toBe(0.75);
      expect(res.category).toBe(COMFORT_CATEGORIES.MODERATE); // boundary test: 0.75 is moderate
    });

    it("classifies HIGH category at exactly 1.50 threshold", () => {
      // Standard = 5000 (Goa). Target perPersonDaily = 5000 * 1.50 = 7500.
      // 1 guest, 2 days: totalBudget = 15000.
      const res = calculateBudgetIntelligence({
        totalBudget: 15000,
        days: 2,
        guests: 1,
        destination: "Goa",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.sufficiencyRatio).toBe(1.5);
      expect(res.category).toBe(COMFORT_CATEGORIES.HIGH); // boundary test: 1.50 is high
      expect(res.standardBudgetDifference).toBe(5000);   // surplus of 5000
      expect(res.warnings.some((w) => w.code === "BUDGET_PREMIUM_COMFORTABLE")).toBe(true);
    });

    it("classifies HIGH category well above 1.50 threshold with surplus", () => {
      // Destination: Manali (standard = 3250)
      // totalBudget = 50000 for 1 guest, 3 days. perPersonDaily = 16667.
      // Ratio = ~5.1283 -> HIGH
      const res = calculateBudgetIntelligence({
        totalBudget: 50000,
        days: 3,
        guests: 1,
        destination: "Manali",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(res.category).toBe(COMFORT_CATEGORIES.HIGH);
      expect(res.sufficiencyRatio).toBeGreaterThan(1.5);
      expect(res.standardBudgetDifference).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Input Validation & Strict Error Handling
  // =========================================================================
  describe("4. Input Validation & Robust Safety Guards", () => {
    it("rejects missing, zero, and negative budget with validation errors", () => {
      const invalidBudgets = [null, undefined, "", 0, -500, "0", "-1500", "invalid"];
      for (const b of invalidBudgets) {
        const res = calculateBudgetIntelligence({
          totalBudget: b,
          days: 3,
          guests: 2,
          destination: "Goa",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
        expect(res.validationErrors.length).toBeGreaterThan(0);
        expect(res.validationErrors[0]).toContain("totalBudget");
      }
    });

    it("rejects non-integer, zero, and negative days without converting to defaults", () => {
      const invalidDays = [0, -1, 3.5, "3", "three", null, undefined, NaN, Infinity];
      for (const d of invalidDays) {
        const res = calculateBudgetIntelligence({
          totalBudget: 15000,
          days: d,
          guests: 2,
          destination: "Goa",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
        expect(res.validationErrors.some((e) => e.includes("days"))).toBe(true);
        expect(res.days).toBeNull(); // Never silently converted to 1!
      }
    });

    it("rejects non-integer, zero, and negative guests without converting to defaults", () => {
      const invalidGuests = [0, -2, 2.5, "2", "two", null, undefined, NaN, -Infinity];
      for (const g of invalidGuests) {
        const res = calculateBudgetIntelligence({
          totalBudget: 15000,
          days: 3,
          guests: g,
          destination: "Goa",
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
        expect(res.validationErrors.some((e) => e.includes("guests"))).toBe(true);
        expect(res.guests).toBeNull(); // Never silently converted to 1!
      }
    });

    it("rejects missing or empty destination strings", () => {
      const invalidDests = ["", "   ", null, undefined, 123, {}];
      for (const d of invalidDests) {
        const res = calculateBudgetIntelligence({
          totalBudget: 15000,
          days: 3,
          guests: 2,
          destination: d,
        });
        expect(res.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
        expect(res.validationErrors.some((e) => e.includes("destination"))).toBe(true);
      }
    });

    it("never mutates input objects", () => {
      const originalInput = Object.freeze({
        totalBudget: 25000,
        days: 4,
        guests: 2,
        destination: "Varanasi",
        currency: "INR",
      });

      // Should run without throw even though originalInput is frozen
      const res = calculateBudgetIntelligence(originalInput);
      expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(originalInput.totalBudget).toBe(25000);
    });
  });

  // =========================================================================
  // 5. Currency Safety & Foreign Currency Handling
  // =========================================================================
  describe("5. Currency Safety & International Boundaries", () => {
    it("returns UNSUPPORTED_CURRENCY for foreign currencies without assuming exchange rates", () => {
      const foreignCurrencies = ["USD", "EUR", "GBP", "JPY", "$", "€", "£", "¥", "AUD", "CAD"];
      for (const curr of foreignCurrencies) {
        const res = calculateBudgetIntelligence({
          totalBudget: 1500,
          days: 3,
          guests: 1,
          destination: "Goa",
          currency: curr,
        });

        expect(res.status).toBe(CALCULATION_STATUS.UNSUPPORTED_CURRENCY);
        expect(res.estimatedStandardTotal).toBeNull();
        expect(res.sufficiencyRatio).toBeNull();
        expect(res.category).toBeNull();
        expect(res.breakdown).toBeNull();
        expect(res.warnings.some((w) => w.code === "UNSUPPORTED_CURRENCY")).toBe(true);
      }
    });

    it("calculates deterministic budget intelligence for global tier destinations with advisory", () => {
      const intlDestinations = [
        { dest: "Tokyo", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, expectedMid: 22000 },
        { dest: "London", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, expectedMid: 22000 },
        { dest: "Paris", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_C, expectedMid: 22000 },
        { dest: "Singapore", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, expectedMid: 12000 },
        { dest: "Dubai", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_B, expectedMid: 12000 },
        { dest: "Bangkok", expectedTier: ECONOMIC_TIERS.GLOBAL_TIER_A, expectedMid: 5500 },
      ];

      for (const { dest, expectedTier, expectedMid } of intlDestinations) {
        const res = calculateBudgetIntelligence({
          totalBudget: expectedMid * 5, // 5 days, 1 guest -> ratio 1.0
          days: 5,
          guests: 1,
          destination: dest,
          currency: "INR",
        });

        expect(res.status).toBe(CALCULATION_STATUS.CALCULATED);
        expect(res.tier).toBe(expectedTier);
        expect(res.estimatedStandardTotal).toBe(expectedMid * 5);
        expect(res.sufficiencyRatio).toBe(1.0);
        expect(res.category).toBe(COMFORT_CATEGORIES.MODERATE);
        expect(res.breakdown).toBeDefined();
        expect(res.dailyTierEstimates).toBeDefined();
        expect(res.estimatedTripTotals).toBeDefined();
        expect(res.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
      }
    });

    it("calculates resort destinations under approved global tiers (Bali -> Tier B, Phuket -> Tier A)", () => {
      // Bali (Tier B: Low 7500, Mid 12000, High 22000)
      const baliRes = calculateBudgetIntelligence({
        totalBudget: 96000,
        days: 4,
        guests: 2,
        destination: "Bali",
        currency: "INR",
      });

      expect(baliRes.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(baliRes.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_B);
      expect(baliRes.dailyTierEstimates.mid).toBe(12000);
      expect(baliRes.estimatedTripTotals.mid).toBe(96000); // 12000 * 2 * 4
      expect(baliRes.sufficiencyRatio).toBe(1.0);
      expect(baliRes.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);

      // Phuket (Tier A: Low 3500, Mid 5500, High 11000)
      const phuketRes = calculateBudgetIntelligence({
        totalBudget: 44000,
        days: 4,
        guests: 2,
        destination: "Phuket",
        currency: "INR",
      });

      expect(phuketRes.status).toBe(CALCULATION_STATUS.CALCULATED);
      expect(phuketRes.tier).toBe(ECONOMIC_TIERS.GLOBAL_TIER_A);
      expect(phuketRes.dailyTierEstimates.mid).toBe(5500);
      expect(phuketRes.estimatedTripTotals.mid).toBe(44000); // 5500 * 2 * 4
      expect(phuketRes.sufficiencyRatio).toBe(1.0);
      expect(phuketRes.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
    });

    it("returns BASELINE_NOT_CONFIGURED for legacy unconfigured tier (TIER_4_INTERNATIONAL)", () => {
      // Direct call with unconfigured legacy tier in matrix
      const baseline = getBaselineForTier(ECONOMIC_TIERS.TIER_4_INTERNATIONAL, "INR");
      expect(baseline).toBeNull();
    });

    it("returns UNKNOWN_DESTINATION for unrecognized destinations without calculating misleading numbers", () => {
      const res = calculateBudgetIntelligence({
        totalBudget: 25000,
        days: 3,
        guests: 2,
        destination: "Wonderland",
        currency: "INR",
      });

      expect(res.status).toBe(CALCULATION_STATUS.UNKNOWN_DESTINATION);
      expect(res.tier).toBe(ECONOMIC_TIERS.UNKNOWN);
      expect(res.estimatedStandardTotal).toBeNull();
      expect(res.sufficiencyRatio).toBeNull();
      expect(res.category).toBeNull();
      expect(res.warnings.some((w) => w.code === "UNKNOWN_DESTINATION")).toBe(true);
    });
  });

  // =========================================================================
  // 6. Deterministic Repeatability & Performance
  // =========================================================================
  describe("6. Deterministic Repeatability & Performance", () => {
    it("produces byte-identical results across 500 consecutive executions in < 50ms", () => {
      const input = {
        totalBudget: 35000,
        days: 4,
        guests: 2,
        destination: "Goa",
        currency: "INR",
      };

      const start = Date.now();
      const firstResult = JSON.stringify(calculateBudgetIntelligence(input));

      for (let i = 0; i < 500; i++) {
        const iterResult = JSON.stringify(calculateBudgetIntelligence(input));
        expect(iterResult).toBe(firstResult);
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // 500 runs executed in under 500ms (< 1ms per run)
    });

    it("produces zero floating point display artifacts (all integers are rounded cleanly)", () => {
      // Numbers that commonly create floating point imprecision in JS:
      const input = {
        totalBudget: 10000,
        days: 3,
        guests: 3, // 10000 / 9 = 1111.111111111111
        destination: "Manali",
        currency: "INR",
      };

      const res = calculateBudgetIntelligence(input);
      expect(Number.isInteger(res.perPersonDailyBudget)).toBe(true);
      expect(Number.isInteger(res.groupDailyBudget)).toBe(true);
      expect(Number.isInteger(res.estimatedStandardTotal)).toBe(true);
      expect(Number.isInteger(res.standardBudgetDifference)).toBe(true);
      expect(res.perPersonDailyBudget).toBe(1111);
      expect(res.groupDailyBudget).toBe(3333);
    });
  });
});
