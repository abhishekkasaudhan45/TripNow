// frontend/tests/budgetUiModernization.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  GLOBAL_TIER_CONFIG,
  BASELINE_MATRIX,
  calculateBudgetIntelligence,
  resolveDestinationTier,
} from "../src/utils/budgetIntelligence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const panelSrcPath = path.resolve(__dirname, "../src/components/budget/BudgetIntelligencePanel.jsx");
const panelSrc = fs.readFileSync(panelSrcPath, "utf-8");

test("TripNow Phase 5 — Budget Intelligence UI Modernization Suite", async (suite) => {
  // =========================================================================
  // Section 1: Three-Estimate Cards (Low, Mid [Highlighted], High)
  // =========================================================================
  await suite.test("Section 1: Low, Mid, and High Travel-Cost Estimates", async (s) => {
    await s.test("1.1 Returns low, mid, and high daily estimates and total trip costs for International destinations", () => {
      // Bangkok: Global Tier A (Low: 3500, Mid: 5500, High: 11000) for 2 travelers, 4 days
      const resA = calculateBudgetIntelligence({
        destination: "Bangkok",
        totalBudget: 50000,
        days: 4,
        guests: 2,
      });

      assert.equal(resA.status, CALCULATION_STATUS.CALCULATED);
      assert.equal(resA.tier, ECONOMIC_TIERS.GLOBAL_TIER_A);
      assert.deepEqual(resA.dailyTierEstimates, { low: 3500, mid: 5500, high: 11000 });
      assert.deepEqual(resA.estimatedTripTotals, {
        low: 3500 * 2 * 4,   // 28,000
        mid: 5500 * 2 * 4,   // 44,000
        high: 11000 * 2 * 4, // 88,000
      });

      // Dubai: Global Tier B (Low: 7500, Mid: 12000, High: 22000) for 3 travelers, 5 days
      const resB = calculateBudgetIntelligence({
        destination: "Dubai",
        totalBudget: 180000,
        days: 5,
        guests: 3,
      });
      assert.equal(resB.tier, ECONOMIC_TIERS.GLOBAL_TIER_B);
      assert.deepEqual(resB.dailyTierEstimates, { low: 7500, mid: 12000, high: 22000 });
      assert.deepEqual(resB.estimatedTripTotals, {
        low: 7500 * 3 * 5,   // 112,500
        mid: 12000 * 3 * 5,  // 180,000
        high: 22000 * 3 * 5, // 330,000
      });

      // Paris: Global Tier C (Low: 14000, Mid: 22000, High: 40000) for 1 traveler, 6 days
      const resC = calculateBudgetIntelligence({
        destination: "Paris",
        totalBudget: 150000,
        days: 6,
        guests: 1,
      });
      assert.equal(resC.tier, ECONOMIC_TIERS.GLOBAL_TIER_C);
      assert.deepEqual(resC.dailyTierEstimates, { low: 14000, mid: 22000, high: 40000 });
      assert.deepEqual(resC.estimatedTripTotals, {
        low: 14000 * 1 * 6, // 84,000
        mid: 22000 * 1 * 6, // 132,000
        high: 40000 * 1 * 6, // 240,000
      });
    });

    await s.test("1.2 Returns low, mid, and high estimates for domestic destinations preserving baseline integrity", () => {
      // Goa: Tier 2 Resort (Low: 1800, Mid: 5000, High: 12500) for 2 travelers, 3 days
      const resGoa = calculateBudgetIntelligence({
        destination: "Goa",
        totalBudget: 30000,
        days: 3,
        guests: 2,
      });
      assert.equal(resGoa.status, CALCULATION_STATUS.CALCULATED);
      assert.equal(resGoa.tier, ECONOMIC_TIERS.TIER_2_RESORT);
      assert.deepEqual(resGoa.dailyTierEstimates, { low: 1800, mid: 5000, high: 12500 });
      assert.deepEqual(resGoa.estimatedTripTotals, {
        low: 1800 * 2 * 3,   // 10,800
        mid: 5000 * 2 * 3,   // 30,000
        high: 12500 * 2 * 3, // 75,000
      });

      // Mumbai: Tier 1 Metro (Low: 2000, Mid: 5300, High: 13300) for 1 traveler, 2 days
      const resMumbai = calculateBudgetIntelligence({
        destination: "Mumbai",
        totalBudget: 15000,
        days: 2,
        guests: 1,
      });
      assert.equal(resMumbai.tier, ECONOMIC_TIERS.TIER_1_METRO);
      assert.deepEqual(resMumbai.dailyTierEstimates, { low: 2000, mid: 5300, high: 13300 });
      assert.deepEqual(resMumbai.estimatedTripTotals, {
        low: 2000 * 1 * 2,   // 4,000
        mid: 5300 * 1 * 2,   // 10,600
        high: 13300 * 1 * 2, // 26,600
      });
    });

    await s.test("1.3 Component source contains distinct cards for Low, Mid, and High with Mid visual emphasis", () => {
      // Assert presence of all three cards
      assert.ok(panelSrc.includes("Low Estimate"), "Panel renders Low Estimate card");
      assert.ok(panelSrc.includes("Mid Estimate"), "Panel renders Mid Estimate card");
      assert.ok(panelSrc.includes("High Estimate"), "Panel renders High Estimate card");

      // Assert visual emphasis on Mid estimate (Recommended badge, amber border, elevated shadow)
      assert.ok(panelSrc.includes("★ Recommended"), "Mid estimate has '★ Recommended' badge");
      assert.ok(panelSrc.includes("border-2 border-amber-400"), "Mid estimate has accented golden border");
      assert.ok(panelSrc.includes("ring-2 ring-amber-400/20"), "Mid estimate has accent ring highlight");

      // Assert both per-person daily and total trip cost are displayed
      assert.ok(panelSrc.includes("/ person / day"), "Cards display per person per day rate");
      assert.ok(panelSrc.includes("Estimated Total:"), "Cards display estimated trip total");
    });
  });

  // =========================================================================
  // Section 2: Expense Allocation Terminology ("Buffer & Contingency")
  // =========================================================================
  await suite.test("Section 2: Terminology Update & Allocation Parity", async (s) => {
    await s.test("2.1 Expense allocation replaces 'Party' category with 'Buffer & Contingency'", () => {
      // Must contain 'Buffer & Contingency (10%)'
      assert.ok(
        panelSrc.includes("Buffer & Contingency (10%)"),
        "Panel renders category as 'Buffer & Contingency (10%)'"
      );

      // Must not contain 'Party (10%)' or 'Buffer (10%)' without contingency
      assert.ok(!panelSrc.includes("Party (10%)"), "No misleading 'Party (10%)' label");

      // Group totals must use 'Group Total:' instead of ambiguous 'Party:'
      assert.ok(panelSrc.includes("Group Total:"), "Breakdown totals are clearly labeled 'Group Total:'");
    });

    await s.test("2.2 Preserves exact 35/25/15/15/10 mathematical allocation and amounts", () => {
      // Check mathematical proportions
      assert.equal(CATEGORY_PROPORTIONS.accommodation, 0.35);
      assert.equal(CATEGORY_PROPORTIONS.food, 0.25);
      assert.equal(CATEGORY_PROPORTIONS.transport, 0.15);
      assert.equal(CATEGORY_PROPORTIONS.activities, 0.15);
      assert.equal(CATEGORY_PROPORTIONS.misc, 0.10);

      // Verify category calculation on Tier 1 (5300 daily mid baseline, 2 travelers, 3 days)
      const res = calculateBudgetIntelligence({
        destination: "Mumbai",
        totalBudget: 40000,
        days: 3,
        guests: 2,
      });

      const { dailyPerPerson, tripTotal } = res.breakdown;
      assert.equal(dailyPerPerson.accommodation, Math.round(5300 * 0.35)); // 1855
      assert.equal(dailyPerPerson.food, Math.round(5300 * 0.25));          // 1325
      assert.equal(dailyPerPerson.transport, Math.round(5300 * 0.15));     // 795
      assert.equal(dailyPerPerson.activities, Math.round(5300 * 0.15));    // 795
      assert.equal(dailyPerPerson.misc, Math.round(5300 * 0.10));          // 530
      assert.equal(dailyPerPerson.total, 5300);

      // Total for 2 travelers, 3 days (factor = 6)
      assert.equal(tripTotal.misc, 530 * 6); // 3180
      assert.equal(tripTotal.total, 5300 * 6); // 31800
    });
  });

  // =========================================================================
  // Section 3: International Ground Stay Notice & Advisories
  // =========================================================================
  await suite.test("Section 3: International Ground Stay Notice & Advisories", async (s) => {
    await s.test("3.1 Component displays 'Ground stay estimate (excludes international flights & visas)' for international destinations", () => {
      assert.ok(
        panelSrc.includes("Ground stay estimate (excludes international flights & visas)"),
        "Panel renders required prominent international ground stay disclaimer"
      );
    });

    await s.test("3.2 Unlisted international destinations trigger provisional Tier B and GLOBAL_ESTIMATE_ADVISORY", () => {
      // Unlisted international destination token (e.g. Reykjavik)
      const res = calculateBudgetIntelligence({
        destination: "Reykjavik",
        totalBudget: 100000,
        days: 4,
        guests: 2,
      });

      assert.equal(res.status, CALCULATION_STATUS.GLOBAL_ESTIMATE_ADVISORY);
      assert.equal(res.tier, ECONOMIC_TIERS.GLOBAL_TIER_B);
      assert.equal(res.isInternational, true);
      assert.ok(res.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY"));
      assert.ok(res.warnings.some((w) => w.code === "UNLISTED_INTERNATIONAL_PROVISIONAL"));
    });

    await s.test("3.3 Unknown destinations preserve UNKNOWN state without inventing Tier B values", () => {
      const resUnknown = calculateBudgetIntelligence({
        destination: "AtlantisMythicalUnderwaterCity999",
        totalBudget: 50000,
        days: 3,
        guests: 2,
      });

      assert.equal(resUnknown.status, CALCULATION_STATUS.UNKNOWN_DESTINATION);
      assert.equal(resUnknown.tier, ECONOMIC_TIERS.UNKNOWN);
      assert.equal(resUnknown.dailyTierEstimates, null);
      assert.equal(resUnknown.estimatedTripTotals, null);
      assert.equal(resUnknown.breakdown, null);

      // UI component renders unmapped destination notice safely
      assert.ok(panelSrc.includes("Unmapped Destination"), "UI renders Unmapped Destination notice");
    });
  });

  // =========================================================================
  // Section 4: Compact View & Mobile Responsiveness
  // =========================================================================
  await suite.test("Section 4: Compact View & Mobile Responsiveness", async (s) => {
    await s.test("4.1 Compact view renders 3 estimates mini-grid with Mid highlighted", () => {
      assert.ok(panelSrc.includes("compact) {"), "Supports compact mode branch");
      assert.ok(panelSrc.includes("grid grid-cols-3 gap-2"), "Compact mode renders 3-column spectrum");
      assert.ok(panelSrc.includes("border-2 border-amber-400 bg-amber-50/70"), "Compact Mid card is highlighted");
    });

    await s.test("4.2 Maintains non-overflow mobile layout and Concept 06 design tokens", () => {
      assert.ok(panelSrc.includes("grid-cols-1 sm:grid-cols-3"), "3-estimate grid is single column on mobile");
      assert.ok(panelSrc.includes("grid-cols-1 sm:grid-cols-5"), "Expense breakdown is single column on mobile");
      assert.ok(panelSrc.includes("fontFamily: \"'DM Sans', sans-serif\""), "Uses DM Sans typography");
    });
  });
});
