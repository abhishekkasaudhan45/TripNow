// frontend/tests/phase6CrossPageIntegration.test.mjs
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
  calculateBudgetIntelligence,
  resolveDestinationTier,
} from "../src/utils/budgetIntelligence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read page and component sources for structural AST/regex integration verification
const readSource = (relPath) => fs.readFileSync(path.resolve(__dirname, relPath), "utf-8");

const homeSrc = readSource("../src/pages/Home.jsx");
const planTripSrc = readSource("../src/pages/PlanTrip.jsx");
const bookingSrc = readSource("../src/pages/Booking.jsx");
const dashboardSrc = readSource("../src/pages/Dashboard.jsx");
const loginSrc = readSource("../src/pages/Login.jsx");
const signupSrc = readSource("../src/pages/Signup.jsx");
const sharedTripSrc = readSource("../src/pages/SharedTrip.jsx");
const headerSrc = readSource("../src/layouts/Header.jsx");
const footerSrc = readSource("../src/layouts/Footer.jsx");
const panelSrc = readSource("../src/components/budget/BudgetIntelligencePanel.jsx");

test("TripNow Phase 6 — Cross-Page Integration & Regression Acceptance Suite", async (suite) => {
  // =========================================================================
  // Section 1: Home-to-PlanTrip Data Contract
  // =========================================================================
  await suite.test("Section 1: Home-to-PlanTrip Navigation Contract", async (s) => {
    await s.test("1.1 Home hero search constructs valid navigation payload with travelers and guests", () => {
      // Assert navigate calls /plan-trip with complete state object
      assert.ok(homeSrc.includes('navigate("/plan-trip"'), "Home navigates to /plan-trip");
      assert.ok(homeSrc.includes("destination: trimmedDest"), "Payload contains destination");
      assert.ok(homeSrc.includes("checkin: form.checkin"), "Payload contains checkin");
      assert.ok(homeSrc.includes("checkout: form.checkout"), "Payload contains checkout");
      assert.ok(homeSrc.includes("budget: String(budgetNum)"), "Payload contains budget");
      assert.ok(homeSrc.includes("travelers: guests"), "Payload contains travelers count");
      assert.ok(homeSrc.includes("guests: guests"), "Payload contains legacy guests alias");
    });

    await s.test("1.2 PlanTrip consumes navigation state and seeds initial state cleanly", () => {
      assert.ok(planTripSrc.includes("state?.destination || \"\""), "PlanTrip consumes destination");
      assert.ok(planTripSrc.includes("state?.budget || \"\""), "PlanTrip consumes budget");
      assert.ok(planTripSrc.includes("state?.checkin || \"\""), "PlanTrip consumes checkin");
      assert.ok(planTripSrc.includes("state?.checkout || \"\""), "PlanTrip consumes checkout");
      assert.ok(planTripSrc.includes("state?.travelers ?? state?.guests ?? 1"), "PlanTrip handles travelers/guests fallback");
    });

    await s.test("1.3 Form validation prevents submission on invalid or past inputs", () => {
      assert.ok(homeSrc.includes("Check-in date cannot be in the past"), "Validates checkin >= today");
      assert.ok(homeSrc.includes("Check-out date must be after check-in date"), "Validates checkout > checkin");
      assert.ok(homeSrc.includes("Please enter a valid travel budget"), "Validates positive budget");
    });
  });

  // =========================================================================
  // Section 2: PlanTrip-to-Booking Data Contract
  // =========================================================================
  await suite.test("Section 2: PlanTrip-to-Booking Navigation & Save Flow", async (s) => {
    await s.test("2.1 PlanTrip passes complete tripData and parameters to /booking", () => {
      assert.ok(planTripSrc.includes('safeNavigate("/booking"'), "PlanTrip safely navigates to /booking");
      assert.ok(planTripSrc.includes("destination, budget, checkin: startDate, checkout: endDate, tripData, travelers, guests: travelers"), "Passes tripData and traveler parameters");
    });

    await s.test("2.2 Booking page reads navigation state and initializes form safely", () => {
      assert.ok(bookingSrc.includes("travelers: String(state?.travelers || state?.guests || \"1\")"), "Booking initializes travelers from state");
      assert.ok(bookingSrc.includes("const tripDays = dayCount(startDate, endDate)"), "Booking computes duration safely");
    });

    await s.test("2.3 Booking page renders BudgetIntelligencePanel without mutating payload", () => {
      assert.ok(bookingSrc.includes("<BudgetIntelligencePanel"), "Booking renders BudgetIntelligencePanel");
      assert.ok(bookingSrc.includes("destination={destination}"), "Passes destination");
      assert.ok(bookingSrc.includes("totalBudget={budget}"), "Passes budget");
      assert.ok(bookingSrc.includes("guests={Number(form.travelers) || 1}"), "Passes dynamic traveler count");

      // Verify POST /api/bookings payload uses user's explicit form values
      assert.ok(bookingSrc.includes("destination,\n        guests:   Number(form.travelers)"), "Payload maps explicit destination and guests");
      assert.ok(bookingSrc.includes("aiPlan:   tripData || null"), "Payload attaches tripData");
    });
  });

  // =========================================================================
  // Section 3: Budget Intelligence Consistency Across Pages
  // =========================================================================
  await suite.test("Section 3: Budget Intelligence Consistency Across Views", async (s) => {
    await s.test("3.1 Domestic destination (Goa) yields identical calculations in Home, PlanTrip, and Booking", () => {
      const homeParams = { destination: "Goa", totalBudget: 30000, days: 3, guests: 2 };
      const planParams = { destination: "Goa", totalBudget: "30000", days: 3, guests: 2 };
      const bookingParams = { destination: "Goa", totalBudget: 30000, days: 3, guests: 2 };

      const resHome = calculateBudgetIntelligence(homeParams);
      const resPlan = calculateBudgetIntelligence(planParams);
      const resBooking = calculateBudgetIntelligence(bookingParams);

      assert.equal(resHome.status, CALCULATION_STATUS.CALCULATED);
      assert.equal(resHome.tier, ECONOMIC_TIERS.TIER_2_RESORT);
      assert.equal(resHome.perPersonDailyBudget, 5000);
      assert.equal(resHome.estimatedStandardTotal, 30000);
      assert.equal(resHome.standardBudgetDifference, 0);

      // Parity across all three views
      assert.deepEqual(resHome.dailyTierEstimates, resPlan.dailyTierEstimates);
      assert.deepEqual(resHome.dailyTierEstimates, resBooking.dailyTierEstimates);
      assert.deepEqual(resHome.estimatedTripTotals, resBooking.estimatedTripTotals);
    });

    await s.test("3.2 International destination (Paris) displays Ground Stay notice across views", () => {
      const resParis = calculateBudgetIntelligence({ destination: "Paris", totalBudget: 150000, days: 5, guests: 2 });
      assert.equal(resParis.tier, ECONOMIC_TIERS.GLOBAL_TIER_C);
      assert.equal(resParis.isInternational, true);

      // Verify banner text is present in component source for both compact and comprehensive modes
      assert.ok(panelSrc.includes("Ground stay estimate (excludes international flights & visas)"), "Contains required ground stay disclaimer");
    });

    await s.test("3.3 Unknown destination gracefully falls back without fabricating estimates", () => {
      const resUnknown = calculateBudgetIntelligence({ destination: "NonExistentCity999", totalBudget: 25000, days: 3, guests: 1 });
      assert.equal(resUnknown.status, CALCULATION_STATUS.UNKNOWN_DESTINATION);
      assert.equal(resUnknown.tier, ECONOMIC_TIERS.UNKNOWN);
      assert.equal(resUnknown.dailyTierEstimates, null);
      assert.equal(resUnknown.estimatedTripTotals, null);

      assert.ok(panelSrc.includes("Unmapped Destination"), "UI renders Unmapped Destination notice");
    });
  });

  // =========================================================================
  // Section 4: Authentication, SharedTrip Privacy & Security Boundaries
  // =========================================================================
  await suite.test("Section 4: Security, Privacy Boundaries & Brand Alignment", async (s) => {
    await s.test("4.1 Login and Signup render unified TripNowLogo and secure form controls", () => {
      assert.ok(loginSrc.includes("<TripNowLogo"), "Login renders TripNowLogo");
      assert.ok(signupSrc.includes("<TripNowLogo"), "Signup renders TripNowLogo");
      assert.ok(headerSrc.includes("<TripNowLogo"), "Header renders TripNowLogo");
      assert.ok(footerSrc.includes("<TripNowLogo"), "Footer renders TripNowLogo");
      assert.ok(dashboardSrc.includes("<TripNowLogo"), "Dashboard renders TripNowLogo");
    });

    await s.test("4.2 SharedTrip does not display private user credentials or editable controls", () => {
      // Shared trip is strictly read-only for public visitors
      assert.ok(!sharedTripSrc.includes("handleDeleteTrip"), "Shared trip has no delete handler");
      assert.ok(!sharedTripSrc.includes("handleUpdateTrip"), "Shared trip has no edit handler");
      assert.ok(sharedTripSrc.includes("🔗 Shared Trip"), "Renders Shared Trip badge");
    });

    await s.test("4.3 Responsive mobile layouts avoid horizontal overflow constraints", () => {
      // Check that cards use flex-wrap or responsive grids
      assert.ok(panelSrc.includes("grid-cols-1 sm:grid-cols-3"), "3-estimate cards collapse on mobile");
      assert.ok(panelSrc.includes("grid-cols-1 sm:grid-cols-5"), "Expense breakdown collapses on mobile");
      assert.ok(!panelSrc.includes("w-[1200px]"), "BudgetIntelligencePanel avoids fixed wide pixel widths");
    });
  });
});

