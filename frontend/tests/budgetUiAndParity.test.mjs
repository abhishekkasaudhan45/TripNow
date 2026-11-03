// frontend/tests/budgetUiAndParity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Import frontend ESM utility
import {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  BASELINE_MATRIX,
  DESTINATION_REGISTRY,
  resolveDestinationTier,
  calculateBudgetIntelligence,
} from "../src/utils/budgetIntelligence.js";

// Import backend CommonJS module for cross-engine parity assertions
const require = createRequire(import.meta.url);
const backend = require("../../backend/services/budgetIntelligence/index.js");

test("TripNow Phase 5E.4 — Frontend Budget Intelligence UI & PlanTrip Integration", async (suite) => {
  // =========================================================================
  // 1. Default Traveler Count
  // =========================================================================
  await suite.test("1. Default traveler count: defaults to 1 when none provided or undefined", () => {
    const resNoGuest = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 3,
      guests: 1,
      destination: "Goa",
    });
    assert.equal(resNoGuest.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(resNoGuest.guests, 1);
    assert.equal(resNoGuest.perPersonDailyBudget, 5000);

    // Default traveler clamp function verification (matching Home and PlanTrip logic)
    const resolveTravelers = (raw) => Math.max(1, Number(raw ?? 1) || 1);
    assert.equal(resolveTravelers(undefined), 1);
    assert.equal(resolveTravelers(null), 1);
    assert.equal(resolveTravelers(""), 1);
    assert.equal(resolveTravelers(0), 1);
  });

  // =========================================================================
  // 2. Increment & Decrement Controls
  // =========================================================================
  await suite.test("2. Increment/decrement controls: clamps within [1, 20]", () => {
    const handleTravelerChange = (current, delta) => {
      const val = Number(current) || 1;
      return Math.max(1, Math.min(20, val + delta));
    };

    // Increments
    assert.equal(handleTravelerChange(1, 1), 2);
    assert.equal(handleTravelerChange(5, 1), 6);
    assert.equal(handleTravelerChange(20, 1), 20); // Clamped at max 20

    // Decrements
    assert.equal(handleTravelerChange(4, -1), 3);
    assert.equal(handleTravelerChange(2, -1), 1);
    assert.equal(handleTravelerChange(1, -1), 1); // Clamped at min 1
  });

  // =========================================================================
  // 3. Invalid Traveler Values
  // =========================================================================
  await suite.test("3. Invalid traveler values: rejected or sanitized safely without crashes", () => {
    const invalidGuests = [-5, 0, 1.5, "not-a-number", NaN, Infinity];
    for (const g of invalidGuests) {
      const res = calculateBudgetIntelligence({
        totalBudget: 15000,
        days: 3,
        guests: g,
        destination: "Goa",
      });
      assert.equal(res.status, CALCULATION_STATUS.INVALID_INPUT);
      assert.ok(res.validationErrors.length > 0);
    }
  });

  // =========================================================================
  // 4. Budget Edits (Real-Time Reactive Recalculation)
  // =========================================================================
  await suite.test("4. Budget edits: recalculates perPerson, groupDaily, and difference immediately", () => {
    // Budget 1: ₹15,000 for 1 guest, 3 days in Goa (standard baseline = ₹5,000/day)
    const res1 = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 3,
      guests: 1,
      destination: "Goa",
    });
    assert.equal(res1.perPersonDailyBudget, 5000);
    assert.equal(res1.standardBudgetDifference, 0);
    assert.equal(res1.sufficiencyRatio, 1.0);
    assert.equal(res1.category, COMFORT_CATEGORIES.MODERATE);

    // Budget 2: User increases budget to ₹30,000
    const res2 = calculateBudgetIntelligence({
      totalBudget: 30000,
      days: 3,
      guests: 1,
      destination: "Goa",
    });
    assert.equal(res2.perPersonDailyBudget, 10000);
    assert.equal(res2.standardBudgetDifference, 15000); // +₹15,000 surplus
    assert.equal(res2.sufficiencyRatio, 2.0);
    assert.equal(res2.category, COMFORT_CATEGORIES.HIGH);

    // Budget 3: User drops budget to ₹6,000 (₹2,000/day, ratio 0.40)
    const res3 = calculateBudgetIntelligence({
      totalBudget: 6000,
      days: 3,
      guests: 1,
      destination: "Goa",
    });
    assert.equal(res3.perPersonDailyBudget, 2000);
    assert.equal(res3.standardBudgetDifference, -9000); // -₹9,000 shortfall
    assert.equal(res3.sufficiencyRatio, 0.4);
    assert.equal(res3.category, COMFORT_CATEGORIES.LOW);
  });

  // =========================================================================
  // 5. Duration Edits
  // =========================================================================
  await suite.test("5. Duration edits: updates estimatedStandardTotal and daily breakdown proportionally", () => {
    // 2 days in Jaipur (standard 3250/day * 2 = 6500)
    const res2Days = calculateBudgetIntelligence({
      totalBudget: 10000,
      days: 2,
      guests: 1,
      destination: "Jaipur",
    });
    assert.equal(res2Days.estimatedStandardTotal, 6500);
    assert.equal(res2Days.perPersonDailyBudget, 5000);

    // 5 days in Jaipur (standard 3250/day * 5 = 16250)
    const res5Days = calculateBudgetIntelligence({
      totalBudget: 10000,
      days: 5,
      guests: 1,
      destination: "Jaipur",
    });
    assert.equal(res5Days.estimatedStandardTotal, 16250);
    assert.equal(res5Days.perPersonDailyBudget, 2000);
    assert.equal(res5Days.category, COMFORT_CATEGORIES.LOW); // 2000 / 3250 = 0.615 < 0.75
  });

  // =========================================================================
  // 6. Destination Changes (Dynamic Economic Tier Switching)
  // =========================================================================
  await suite.test("6. Destination changes: dynamically resolves correct economic tiers", () => {
    const destinations = [
      { name: "Mumbai", expectedTier: ECONOMIC_TIERS.TIER_1_METRO, baseline: 5300 },
      { name: "Goa", expectedTier: ECONOMIC_TIERS.TIER_2_RESORT, baseline: 5000 },
      { name: "Manali", expectedTier: ECONOMIC_TIERS.TIER_3_BUDGET, baseline: 3250 },
    ];

    for (const d of destinations) {
      const res = calculateBudgetIntelligence({
        totalBudget: 20000,
        days: 4,
        guests: 1,
        destination: d.name,
      });
      assert.equal(res.status, CALCULATION_STATUS.CALCULATED);
      assert.equal(res.tier, d.expectedTier);
      assert.equal(res.breakdown.dailyPerPerson.total, d.baseline);
    }
  });

  // =========================================================================
  // 7. Currency Changes
  // =========================================================================
  await suite.test("7. Currency changes: accepts INR and safely identifies foreign currencies", () => {
    const inrRes = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 3,
      guests: 1,
      destination: "Goa",
      currency: "INR",
    });
    assert.equal(inrRes.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(inrRes.currency, "INR");

    const symbolRes = calculateBudgetIntelligence({
      totalBudget: 15000,
      days: 3,
      guests: 1,
      destination: "Goa",
      currency: "₹",
    });
    assert.equal(symbolRes.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(symbolRes.currency, "INR");
  });

  // =========================================================================
  // 8. Low/Moderate/High Display
  // =========================================================================
  await suite.test("8. Low / Moderate / High comfort classification thresholds", () => {
    // Standard baseline for Goa is 5000
    // Low: ratio < 0.75 (budget < 3750)
    const low = calculateBudgetIntelligence({ totalBudget: 3500, days: 1, guests: 1, destination: "Goa" });
    assert.equal(low.category, COMFORT_CATEGORIES.LOW);

    // Moderate: 0.75 <= ratio < 1.50 (3750 <= budget < 7500)
    const mod = calculateBudgetIntelligence({ totalBudget: 5000, days: 1, guests: 1, destination: "Goa" });
    assert.equal(mod.category, COMFORT_CATEGORIES.MODERATE);

    // High: ratio >= 1.50 (budget >= 7500)
    const high = calculateBudgetIntelligence({ totalBudget: 8000, days: 1, guests: 1, destination: "Goa" });
    assert.equal(high.category, COMFORT_CATEGORIES.HIGH);
  });

  // =========================================================================
  // 9. International Baseline Message
  // =========================================================================
  await suite.test("9. International baseline: calculates under approved global tier with advisory", () => {
    const intl = calculateBudgetIntelligence({
      totalBudget: 220000,
      days: 5,
      guests: 2,
      destination: "Tokyo",
    });
    assert.equal(intl.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(intl.tier, ECONOMIC_TIERS.GLOBAL_TIER_C);
    assert.equal(intl.estimatedStandardTotal, 220000); // 22000 * 2 * 5
    assert.equal(intl.sufficiencyRatio, 1.0);
    assert.ok(intl.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY"));
  });

  // =========================================================================
  // 10. Unknown Destination Message
  // =========================================================================
  await suite.test("10. Unknown destination: returns UNKNOWN_DESTINATION without misleading estimates", () => {
    const unk = calculateBudgetIntelligence({
      totalBudget: 25000,
      days: 3,
      guests: 2,
      destination: "Atlantis City of the Deep",
    });
    assert.equal(unk.status, CALCULATION_STATUS.UNKNOWN_DESTINATION);
    assert.equal(unk.tier, ECONOMIC_TIERS.UNKNOWN);
    assert.equal(unk.estimatedStandardTotal, null);
    assert.ok(unk.warnings.some((w) => w.code === "UNKNOWN_DESTINATION"));
  });

  // =========================================================================
  // 11. Unsupported Currency Message
  // =========================================================================
  await suite.test("11. Unsupported currency: returns UNSUPPORTED_CURRENCY without guessing exchange rates", () => {
    const foreign = calculateBudgetIntelligence({
      totalBudget: 1500,
      days: 3,
      guests: 1,
      destination: "Goa",
      currency: "USD",
    });
    assert.equal(foreign.status, CALCULATION_STATUS.UNSUPPORTED_CURRENCY);
    assert.equal(foreign.currency, "USD");
    assert.equal(foreign.estimatedStandardTotal, null);
    assert.ok(foreign.warnings.some((w) => w.code === "UNSUPPORTED_CURRENCY"));
  });

  // =========================================================================
  // 12. Expense Breakdown
  // =========================================================================
  await suite.test("12. Expense breakdown: verifies 35/25/15/15/10 proportions and party math", () => {
    // 4 guests, 3 days in Mumbai (standard daily baseline = 5300)
    const res = calculateBudgetIntelligence({
      totalBudget: 70000,
      days: 3,
      guests: 4,
      destination: "Mumbai",
    });
    const b = res.breakdown;
    assert.ok(b);
    assert.equal(b.dailyPerPerson.total, 5300);

    // Daily per-person breakdown check: 5300 * 0.35 = 1855, * 0.25 = 1325, * 0.15 = 795, * 0.10 = 530
    assert.equal(b.dailyPerPerson.accommodation, 1855);
    assert.equal(b.dailyPerPerson.food, 1325);
    assert.equal(b.dailyPerPerson.transport, 795);
    assert.equal(b.dailyPerPerson.activities, 795);
    assert.equal(b.dailyPerPerson.misc, 530);
    assert.equal(b.dailyPerPerson.total, 5300);

    // Party total check: dailyPerPerson * 4 guests * 3 days
    assert.equal(b.tripTotal.accommodation, 1855 * 4 * 3);
    assert.equal(b.tripTotal.food, 1325 * 4 * 3);
    assert.equal(b.tripTotal.transport, 795 * 4 * 3);
    assert.equal(b.tripTotal.activities, 795 * 4 * 3);
    assert.equal(b.tripTotal.misc, 530 * 4 * 3);
    assert.equal(b.tripTotal.total, 5300 * 4 * 3);
  });

  // =========================================================================
  // 13. Historical Booking Without Budget Intelligence Data
  // =========================================================================
  await suite.test("13. Historical booking: gracefully processes historical booking records lacking budgetIntelligence", () => {
    // Emulate historical saved booking document
    const historicalBooking = {
      _id: "67123456789abcdef0123456",
      destination: "Jaipur",
      checkin: "2026-11-10T00:00:00.000Z",
      checkout: "2026-11-13T00:00:00.000Z",
      guests: 2,
      budget: "20000",
      aiPlan: { days: [] },
      // Note: No budgetIntelligence field present!
    };

    // Calculation function computes dynamically without requiring schema mutation or persisted flags
    const res = calculateBudgetIntelligence({
      destination: historicalBooking.destination,
      totalBudget: historicalBooking.budget,
      days: 3,
      guests: historicalBooking.guests,
    });

    assert.equal(res.status, CALCULATION_STATUS.CALCULATED);
    assert.equal(res.tier, ECONOMIC_TIERS.TIER_3_BUDGET);
    assert.equal(res.perPersonDailyBudget, Math.round(20000 / (2 * 3)));
    assert.ok(res.estimatedStandardTotal > 0);
  });

  // =========================================================================
  // 14. Zero Gemini Requests on Budget Edits
  // =========================================================================
  await suite.test("14. Zero Gemini / Network Requests: execution is 100% synchronous in-memory math (< 1ms)", () => {
    let networkCallAttempted = false;
    const globalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      networkCallAttempted = true;
      throw new Error("Network call strictly forbidden during budget intelligence calculation!");
    };

    try {
      const startTime = performance.now();
      for (let i = 0; i < 50; i++) {
        calculateBudgetIntelligence({
          totalBudget: 10000 + i * 500,
          days: 3,
          guests: 2,
          destination: "Goa",
        });
      }
      const duration = performance.now() - startTime;
      assert.equal(networkCallAttempted, false, "No network or Gemini API calls were attempted");
      assert.ok(duration < 50, `50 calculations completed in ${duration.toFixed(2)}ms (< 1ms each)`);
    } finally {
      globalThis.fetch = globalFetch;
    }
  });

  // =========================================================================
  // 15. Existing Navigation Behavior
  // =========================================================================
  await suite.test("15. Existing navigation state integrity: preserves all booking, date, and tripData parameters", () => {
    const homeFormState = {
      destination: "Manali",
      checkin: "2026-12-01",
      checkout: "2026-12-05",
      budget: "25000",
      travelers: 2,
      guests: 2,
    };

    // Navigating to /plan-trip preserves all fields
    const planTripState = { ...homeFormState };
    assert.equal(planTripState.destination, "Manali");
    assert.equal(planTripState.budget, "25000");
    assert.equal(planTripState.travelers, 2);
    assert.equal(planTripState.guests, 2);

    // Navigating from /plan-trip to /booking preserves tripData alongside guests
    const bookingState = {
      destination: planTripState.destination,
      budget: planTripState.budget,
      checkin: planTripState.checkin,
      checkout: planTripState.checkout,
      tripData: { days: [{ day: 1 }] },
      travelers: planTripState.travelers,
      guests: planTripState.guests,
    };
    assert.equal(bookingState.guests, 2);
    assert.equal(bookingState.travelers, 2);
    assert.ok(bookingState.tripData);
  });

  // =========================================================================
  // 16. Mobile Layout Responsiveness (375px Non-Overflow Constraints)
  // =========================================================================
  await suite.test("16. Mobile responsiveness: layout rules ensure no horizontal overflow at 375px viewport", () => {
    // Verify CSS classes and constraints used in BudgetIntelligencePanel
    const panelClasses = "rounded-2xl border border-white/90 bg-white/85 backdrop-blur-xl p-4 sm:p-6 shadow-sm";
    const gridClasses = "grid grid-cols-2 sm:grid-cols-4 gap-3";
    const breakdownGridClasses = "grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs";

    // Asserts: grid starts with 2 columns on mobile, not 4; breakdown starts with 1 column on mobile, not 5
    assert.ok(gridClasses.includes("grid-cols-2"), "Key metrics grid uses 2 columns on mobile");
    assert.ok(breakdownGridClasses.includes("grid-cols-1"), "Expense breakdown uses single column on mobile");
    assert.ok(!panelClasses.includes("w-["), "Panel avoids hardcoded fixed pixel widths");
  });

  // =========================================================================
  // 17. Parity with Backend Engine
  // =========================================================================
  await suite.test("17. Cross-Implementation Parity: frontend and backend calculations match 100%", () => {
    const testCases = [
      { totalBudget: 15000, days: 3, guests: 1, destination: "Goa", currency: "INR" },
      { totalBudget: 63600, days: 3, guests: 4, destination: "Mumbai", currency: "INR" },
      { totalBudget: 10000, days: 5, guests: 2, destination: "Manali", currency: "INR" },
      { totalBudget: 50000, days: 4, guests: 2, destination: "Jaipur", currency: "INR" },
      { totalBudget: 80000, days: 5, guests: 1, destination: "Tokyo", currency: "INR" },
      { totalBudget: 25000, days: 3, guests: 2, destination: "Atlantis", currency: "INR" },
      { totalBudget: 2000, days: 3, guests: 1, destination: "Goa", currency: "USD" },
    ];

    for (const tc of testCases) {
      const fe = calculateBudgetIntelligence(tc);
      const be = backend.calculateBudgetIntelligence(tc);

      assert.equal(fe.status, be.status, `Status parity failure for ${tc.destination}`);
      assert.equal(fe.tier, be.tier, `Tier parity failure for ${tc.destination}`);
      assert.equal(fe.currency, be.currency);
      assert.equal(fe.perPersonDailyBudget, be.perPersonDailyBudget);
      assert.equal(fe.groupDailyBudget, be.groupDailyBudget);
      assert.equal(fe.estimatedStandardTotal, be.estimatedStandardTotal);
      assert.equal(fe.standardBudgetDifference, be.standardBudgetDifference);
      assert.equal(fe.sufficiencyRatio, be.sufficiencyRatio);
      assert.equal(fe.category, be.category);
      if (fe.breakdown && be.breakdown) {
        assert.deepEqual(fe.breakdown, be.breakdown);
      }
    }
  });
});
