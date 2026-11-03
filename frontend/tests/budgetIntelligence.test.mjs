// frontend/tests/budgetIntelligence.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Import frontend ESM utility
import {
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
} from "../src/utils/budgetIntelligence.js";

// Import backend CommonJS module for cross-implementation parity assertions
const require = createRequire(import.meta.url);
const backend = require("../../backend/services/budgetIntelligence/index.js");

test("TripNow Phase 5E.2 — Frontend Budget Intelligence Utility & Parity", async (t) => {
  await t.test("1. Destination Classification", () => {
    // Normalization
    assert.equal(resolveDestinationTier("  mumbai  ").tier, ECONOMIC_TIERS.TIER_1_METRO);
    assert.equal(resolveDestinationTier("Goa").tier, ECONOMIC_TIERS.TIER_2_RESORT);
    assert.equal(resolveDestinationTier("Manali").tier, ECONOMIC_TIERS.TIER_3_BUDGET);
    assert.equal(resolveDestinationTier("Tokyo").tier, ECONOMIC_TIERS.GLOBAL_TIER_C);
    assert.equal(resolveDestinationTier("Tokyo").isInternational, true);
    assert.equal(resolveDestinationTier("Bali").tier, ECONOMIC_TIERS.GLOBAL_TIER_B);
    assert.equal(resolveDestinationTier("Thailand").tier, ECONOMIC_TIERS.GLOBAL_TIER_A);

    // Collision protection
    assert.equal(resolveDestinationTier("Andaman").canonicalName, "Andaman and Nicobar");
    assert.equal(resolveDestinationTier("Daman").canonicalName, "Daman and Diu");
    assert.equal(resolveDestinationTier("Niagara Falls").tier, ECONOMIC_TIERS.UNKNOWN);

    // Unknown destination
    assert.equal(resolveDestinationTier("Atlantis").tier, ECONOMIC_TIERS.UNKNOWN);
    assert.equal(resolveDestinationTier("Atlantis").isKnown, false);
  });

  await t.test("2. Baseline Matrix & Proportions", () => {
    const t1 = getBaselineForTier(ECONOMIC_TIERS.TIER_1_METRO, "INR");
    assert.equal(t1.standard, 5300);
    assert.equal(t1.budget, 2000);
    assert.equal(t1.premium, 13300);

    const t2 = getBaselineForTier(ECONOMIC_TIERS.TIER_2_RESORT, "INR");
    assert.equal(t2.standard, 5000);

    const t3 = getBaselineForTier(ECONOMIC_TIERS.TIER_3_BUDGET, "INR");
    assert.equal(t3.standard, 3250);

    const t4 = getBaselineForTier(ECONOMIC_TIERS.TIER_4_INTERNATIONAL, "INR");
    assert.equal(t4, null); // NOT YET APPROVED in INR

    // Proportions
    const sum =
      CATEGORY_PROPORTIONS.accommodation +
      CATEGORY_PROPORTIONS.food +
      CATEGORY_PROPORTIONS.transport +
      CATEGORY_PROPORTIONS.activities +
      CATEGORY_PROPORTIONS.misc;
    assert.equal(Number(sum.toFixed(4)), 1.0);
  });

  await t.test("3. Core Calculations & Thresholds", () => {
    // Standard trip in Goa: 15,000 for 1 guest, 3 days
    const res = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 3,
      guests: 1,
      destination: "Goa",
      currency: "INR",
    });

    assert.equal(res.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(res.perPersonDailyBudget, 5000);
    assert.equal(res.groupDailyBudget, 5000);
    assert.equal(res.estimatedStandardTotal, 15000);
    assert.equal(res.standardBudgetDifference, 0);
    assert.equal(res.sufficiencyRatio, 1.0);
    assert.equal(res.category, COMFORT_CATEGORIES.MODERATE);

    // Low threshold (< 0.75)
    const lowRes = calculateBudgetIntelligence({
      totalBudget: 4000,
      days: 2,
      guests: 1,
      destination: "Jaipur",
      currency: "INR",
    });
    assert.equal(lowRes.category, COMFORT_CATEGORIES.LOW);
    assert.equal(lowRes.standardBudgetDifference, -2500);

    // High threshold (>= 1.50)
    const highRes = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 2,
      guests: 1,
      destination: "Goa",
      currency: "INR",
    });
    assert.equal(highRes.category, COMFORT_CATEGORIES.HIGH);
    assert.equal(highRes.standardBudgetDifference, 5000);
  });

  await t.test("4. Input Validation & Safety", () => {
    // Missing budget
    assert.equal(
      calculateBudgetIntelligence({ days: 3, guests: 2, destination: "Goa" }).status,
      CALCULATION_STATUS.INVALID_INPUT
    );

    // Non-integer days
    assert.equal(
      calculateBudgetIntelligence({ totalBudget: 15000, days: 3.5, guests: 2, destination: "Goa" }).status,
      CALCULATION_STATUS.INVALID_INPUT
    );

    // Unsupported currency
    assert.equal(
      calculateBudgetIntelligence({ totalBudget: 1500, days: 3, guests: 1, destination: "Goa", currency: "USD" })
        .status,
      CALCULATION_STATUS.UNSUPPORTED_CURRENCY
    );

    // International destination calculates with GLOBAL_TIER_C
    const intlCalc = calculateBudgetIntelligence({ totalBudget: 110000, days: 5, guests: 1, destination: "Tokyo", currency: "INR" });
    assert.equal(intlCalc.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(intlCalc.tier, ECONOMIC_TIERS.GLOBAL_TIER_C);
    assert.ok(intlCalc.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY"));

    // Unknown destination
    assert.equal(
      calculateBudgetIntelligence({ totalBudget: 25000, days: 3, guests: 2, destination: "Atlantis", currency: "INR" })
        .status,
      CALCULATION_STATUS.UNKNOWN_DESTINATION
    );
  });

  await t.test("5. Cross-Implementation Backend vs Frontend Parity", () => {
    const fixtures = [
      { totalBudget: 15000, days: 3, guests: 1, destination: "Goa", currency: "INR" },
      { totalBudget: 60000, days: 4, guests: 4, destination: "Mumbai", currency: "INR" },
      { totalBudget: 8000, days: 2, guests: 2, destination: "Manali", currency: "INR" },
      { totalBudget: 25000, days: 5, guests: 1, destination: "Varanasi", currency: "INR" },
      { totalBudget: 90000, days: 5, guests: 2, destination: "Tokyo", currency: "INR" },
      { totalBudget: 40000, days: 3, guests: 2, destination: "Bali", currency: "INR" },
      { totalBudget: 25000, days: 3, guests: 2, destination: "Gotham City", currency: "INR" },
      { totalBudget: 2000, days: 4, guests: 2, destination: "Goa", currency: "USD" },
      { totalBudget: 0, days: 3, guests: 2, destination: "Goa" },
      { totalBudget: -500, days: -1, guests: 0, destination: "" },
      { totalBudget: 25000, days: 3.5, guests: 2, destination: "Goa" },
      { totalBudget: "invalid", days: 3, guests: 2, destination: "Goa" },
      null,
    ];

    for (const fixture of fixtures) {
      const fRes = calculateBudgetIntelligence(fixture);
      const bRes = backend.calculateBudgetIntelligence(fixture);
      assert.deepEqual(fRes, bRes);
    }
  });
});

