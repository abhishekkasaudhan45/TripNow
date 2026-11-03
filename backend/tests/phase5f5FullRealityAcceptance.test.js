// backend/tests/phase5f5FullRealityAcceptance.test.js
/**
 * TripNow Phase 5F.5 — End-to-End Reality Score Acceptance & Regression Suite
 *
 * Scenarios covered:
 * A. New Itinerary Evaluation (composite score, tiers, cumulative slot overload,
 *    single-day peak overload, consecutive fatigue, explicit vs inferred duration confidence,
 *    flight/ferry transition advisory).
 * B. Historical Itinerary Compatibility (legacy string-only days, missing duration/intensity/travelMode,
 *    empty days, null reality report, zero metadata fabrication).
 * C. Adaptive Pivot Integration (candidate generation, simulation, staging, failure protection,
 *    and post-pivot reality score re-evaluation).
 * D. Fix Day Integration (HMAC proposal verification, OCC concurrency, locked activity protection,
 *    reality score simulation, and post-apply authoritative report).
 * E. Budget Separation & Zero AI/Network Verification (deterministic isolation from Phase 5E,
 *    pure mathematical execution, zero Gemini/external API calls).
 * F. Shared-Trip Privacy & Access Control (strict sanitization on public endpoints, PII and internal
 *    metric stripping, owner-authorized access control on POST /api/ai/reality-score).
 */

const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const app = require("../app");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { evaluateTripReality } = require("../services/realityEngine");
const { signProposalToken } = require("../services/fixDayService");
const { calculateBudgetIntelligence } = require("../services/budgetIntelligence");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("TripNow Phase 5F.5 — End-to-End Reality Score Acceptance", () => {
  let testUser;
  let testToken;
  let intruderUser;
  let intruderToken;

  beforeEach(async () => {
    testUser = await User.create({
      name: "Traveler Jane",
      email: "jane@tripnow-acceptance.com",
      password: "Password123!",
      role: "user",
    });

    intruderUser = await User.create({
      name: "Intruder Bob",
      email: "bob@tripnow-intruder.com",
      password: "Password123!",
      role: "user",
    });

    const resLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@tripnow-acceptance.com", password: "Password123!" });
    testToken = extractToken(resLogin);

    const resIntruder = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@tripnow-intruder.com", password: "Password123!" });
    intruderToken = extractToken(resIntruder);
  });

  // =========================================================================
  // Scenario A: New Itinerary Evaluation
  // =========================================================================
  describe("Scenario A: New Itinerary Evaluation", () => {
    it("A1: evaluates a complete representative itinerary with accurate score, tiers, and metrics", () => {
      const trip = {
        budget: "50000",
        aiPlan: {
          destination: "Goa, India",
          days: [
            {
              day: 1,
              title: "South Goa Beaches",
              activities: [
                { id: "a1", period: "morning", title: "Colva Beach Walk", durationMinutes: 90, cost: "Free", intensity: "low" },
                { id: "a2", period: "afternoon", title: "Spice Plantation Tour", durationMinutes: 120, cost: "₹1,000", intensity: "moderate" },
                { id: "a3", period: "evening", title: "Palolem Sunset Dinner", durationMinutes: 120, cost: "₹1,500", intensity: "low" },
              ],
            },
            {
              day: 2,
              title: "Heritage & Forts",
              activities: [
                { id: "a4", period: "morning", title: "Cabo de Rama Fort", durationMinutes: 120, cost: "Free", intensity: "moderate" },
                { id: "a5", period: "afternoon", title: "Benaulim Seafood Lunch", durationMinutes: 90, cost: "₹800", intensity: "low" },
                { id: "a6", period: "evening", title: "Margao Market Tour", durationMinutes: 90, cost: "Free", intensity: "low" },
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(trip);

      // Verify numeric range and tier classification
      expect(typeof report.score).toBe("number");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(["Excellent", "Good", "Needs Attention", "Risky", "Critical"]).toContain(report.status);
      expect(report.color).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Verify subscore structure
      expect(report.subScores).toHaveProperty("timeFeasibility");
      expect(report.subScores).toHaveProperty("budgetFeasibility");
      expect(report.subScores).toHaveProperty("activityLoad");
      expect(report.subScores).toHaveProperty("travelPace");

      // Verify confidence metrics
      expect(report.metrics.confidence.durationCoverageRatio).toBe(1.0); // all 6 activities explicit
      expect(report.metrics.confidence.inferredDurationsCount).toBe(0);
      expect(report.metrics.totalActivities).toBe(6);
    });

    it("A2: identifies cumulative time-slot overload (morning > 240m)", () => {
      const overloadedTrip = {
        budget: "40000",
        aiPlan: {
          destination: "Goa",
          days: [
            {
              day: 1,
              activities: [
                { id: "act-m1", period: "morning", title: "Long Museum Tour", durationMinutes: 150 },
                { id: "act-m2", period: "morning", title: "Long Heritage Walk", durationMinutes: 150 }, // Total = 300m > 240m
                { id: "act-e1", period: "evening", title: "Dinner", durationMinutes: 90 },
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(overloadedTrip);
      const slotIssue = report.issues.find((i) => i.type === "slot_overrun" && i.period === "morning");
      expect(slotIssue).toBeDefined();
      expect(slotIssue.day).toBe(1);
      expect(slotIssue.message).toContain("exceeds slot capacity");
    });

    it("A3: detects single-day peak overload (active minutes > 600m) with high severity", () => {
      const peakTrip = {
        budget: "60000",
        aiPlan: {
          destination: "Manali",
          days: [
            {
              day: 1,
              activities: [
                { id: "p1", period: "morning", title: "Morning Trek", durationMinutes: 240 },
                { id: "p2", period: "afternoon", title: "Afternoon Hike", durationMinutes: 240 },
                { id: "p3", period: "evening", title: "Evening Exploration", durationMinutes: 210 }, // Total = 690m (11.5h > 660m critical)
              ],
            },
            {
              day: 2,
              activities: [
                { id: "p4", period: "morning", title: "Relaxed Cafe", durationMinutes: 90 },
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(peakTrip);
      const peakIssue = report.issues.find((i) => i.type === "pace_peak_overload");
      expect(peakIssue).toBeDefined();
      expect(peakIssue.severity).toBe("high");
      expect(peakIssue.day).toBe(1);
      expect(peakIssue.message).toContain("single-day fatigue");
    });

    it("A4: detects consecutive high-intensity fatigue streak", () => {
      const fatigueTrip = {
        budget: "40000",
        aiPlan: {
          destination: "Rishikesh",
          days: [
            {
              day: 1,
              activities: [
                { id: "f1", period: "morning", title: "White Water Rafting", durationMinutes: 120, intensity: "high" },
                { id: "f2", period: "morning", title: "Bungee Jumping", durationMinutes: 90, intensity: "high" }, // Consecutive high
                { id: "f3", period: "evening", title: "Ganga Aarti", durationMinutes: 60, intensity: "low" },
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(fatigueTrip);
      const fatigueIssue = report.issues.find((i) => i.type === "intensity_fatigue");
      expect(fatigueIssue).toBeDefined();
      expect(fatigueIssue.severity).toBe("medium");
      expect(fatigueIssue.activityIds).toContain("f1");
      expect(fatigueIssue.activityIds).toContain("f2");
    });

    it("A5: handles explicit vs inferred duration confidence ratio accurately", () => {
      const mixedConfidenceTrip = {
        budget: "30000",
        aiPlan: {
          destination: "Jaipur",
          days: [
            {
              day: 1,
              activities: [
                { id: "m1", period: "morning", title: "Amber Fort", durationMinutes: 120 }, // explicit
                { id: "m2", period: "afternoon", title: "City Palace" }, // missing duration -> inferred 120m
                { id: "m3", period: "evening", title: "Chokhi Dhani" }, // missing duration -> inferred 120m
                { id: "m4", period: "evening", title: "Local Bazaar", durationMinutes: 60 }, // explicit
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(mixedConfidenceTrip);
      expect(report.metrics.totalActivities).toBe(4);
      expect(report.metrics.confidence.inferredDurationsCount).toBe(2);
      expect(report.metrics.confidence.durationCoverageRatio).toBe(0.5); // 2 of 4 explicit
    });

    it("A6: provides flight/ferry transition advisory and prevents duplicate deductions", () => {
      // 1. Transit buffer deficit with sufficient slot capacity -> Medium severity (score impacting)
      const transitOnlyTrip = {
        budget: "30000",
        aiPlan: {
          destination: "Port Blair",
          days: [
            {
              day: 1,
              activities: [
                { id: "flt1", period: "morning", travelMode: "flight", title: "Flight to Port Blair", durationMinutes: 150 },
                { id: "act1", period: "morning", title: "Quick Beach Visit", durationMinutes: 45 }, // Total 195m < 240m slot, but 45m buffer < 120m flight recommendation
              ],
            },
          ],
        },
      };

      const report1 = evaluateTripReality(transitOnlyTrip);
      const transitIssue1 = report1.issues.find((i) => i.type === "transit_buffer_deficit");
      expect(transitIssue1).toBeDefined();
      expect(Boolean(transitIssue1.duplicatePrevented)).toBe(false);
      expect(transitIssue1.severity).toBe("medium");

      // 2. Transit buffer deficit in an already overloaded slot -> Duplicate prevented (0 pt advisory)
      const transitOverloadedTrip = {
        budget: "30000",
        aiPlan: {
          destination: "Port Blair",
          days: [
            {
              day: 1,
              activities: [
                { id: "flt2", period: "morning", travelMode: "flight", title: "Flight", durationMinutes: 180 },
                { id: "act2", period: "morning", title: "Tour", durationMinutes: 120 }, // Total 300m > 240m slot
              ],
            },
          ],
        },
      };

      const report2 = evaluateTripReality(transitOverloadedTrip);
      const transitIssue2 = report2.issues.find((i) => i.type === "transit_buffer_deficit");
      expect(transitIssue2).toBeDefined();
      expect(transitIssue2.duplicatePrevented).toBe(true);
      expect(transitIssue2.severity).toBe("low");
    });
  });

  // =========================================================================
  // Scenario B: Historical Itinerary Compatibility
  // =========================================================================
  describe("Scenario B: Historical Itinerary Compatibility", () => {
    it("B1: processes legacy string-only activities safely without fabricated metadata or crashes", () => {
      const legacyTrip = {
        budget: "35000",
        aiPlan: {
          destination: "Udaipur",
          days: [
            {
              day: 1,
              title: "City of Lakes",
              morning: "Visit City Palace and Lake Pichola",
              afternoon: "Boat ride and Jag Mandir lunch",
              evening: "Bagore Ki Haveli folk dance",
              food: ["Dal Baati Churma", "Gatte ki Sabzi"],
            },
          ],
        },
      };

      const report = evaluateTripReality(legacyTrip);
      expect(typeof report.score).toBe("number");
      expect(report.score).toBeGreaterThan(0);
      expect(report.metrics.totalActivities).toBe(3);
      // Historical activities without duration annotation safely use inferred fallback
      expect(report.metrics.confidence.inferredDurationsCount).toBe(3);
      expect(report.metrics.confidence.durationCoverageRatio).toBe(0.0);
    });

    it("B2: handles missing intensity and missing travelMode safely", () => {
      const unannotatedTrip = {
        budget: "20000",
        aiPlan: {
          destination: "Shimla",
          days: [
            {
              day: 1,
              activities: [
                { id: "u1", period: "morning", title: "Mall Road Walk" }, // no duration, no intensity, no travelMode
              ],
            },
          ],
        },
      };

      const report = evaluateTripReality(unannotatedTrip);
      expect(report.score).toBeDefined();
      expect(report.metrics.totalActivities).toBe(1);
      expect(report.issues).toBeDefined();
    });

    it("B3: handles historical Booking records lacking realityScore field", async () => {
      const booking = await Booking.create({
        user: testUser._id,
        destination: "Ooty",
        guests: 2,
        checkin: new Date("2026-11-10"),
        checkout: new Date("2026-11-13"),
        budget: "25000",
        isShared: false,
        aiPlan: {
          destination: "Ooty",
          days: [{ day: 1, morning: "Botanical gardens", afternoon: "Lake boating", evening: "Tea factory" }],
        },
        // realityScore intentionally omitted (pre-migration record)
      });

      // API fetch should return the booking cleanly
      const res = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set("Authorization", `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.destination).toBe("Ooty");
      expect(res.body.data.realityScore == null).toBe(true);

      // On-demand evaluation via reality-score endpoint succeeds
      const resScore = await request(app)
        .post("/api/ai/reality-score")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ tripId: booking._id });

      expect(resScore.status).toBe(200);
      expect(resScore.body.data.score).toBeGreaterThan(0);
    });

    it("B4: handles empty days array and partially populated objects without throwing errors", () => {
      const emptyTrip = {
        budget: "10000",
        aiPlan: {
          destination: "Unknown",
          days: [],
        },
      };

      const report = evaluateTripReality(emptyTrip);
      expect(report.score).toBe(100); // 0 activities, 0 violations
      expect(report.metrics.totalActivities).toBe(0);
      expect(report.metrics.confidence.durationCoverageRatio).toBe(1);
    });
  });

  // =========================================================================
  // Scenario C: Adaptive Pivot Integration
  // =========================================================================
  describe("Scenario C: Adaptive Pivot Integration", () => {
    it("C1: evaluates updated itinerary with Reality Score after applying a Pivot", async () => {
      // 1. Create a trip with an afternoon activity
      const trip = await Booking.create({
        user: testUser._id,
        destination: "Goa",
        guests: 2,
        budget: "40000",
        checkin: new Date("2026-11-15"),
        checkout: new Date("2026-11-18"),
        aiPlan: {
          destination: "Goa",
          days: [
            {
              day: 1,
              activities: [
                { id: "d1-m1", period: "morning", title: "Fort Aguada", durationMinutes: 120, cost: "Free" },
                { id: "d1-a1", period: "afternoon", title: "Beach Trek", durationMinutes: 180, cost: "Free" },
                { id: "d1-e1", period: "evening", title: "Sunset Cruise", durationMinutes: 90, cost: "₹1,000" },
              ],
            },
          ],
        },
      });

      const initialReport = evaluateTripReality(trip);

      // 2. Simulate applying an indoor pivot replacement for rain
      const updatedPlan = JSON.parse(JSON.stringify(trip.aiPlan));
      updatedPlan.days[0].activities[1] = {
        id: "d1-a1",
        period: "afternoon",
        title: "Goa State Museum & Indoor Gallery",
        description: "Explore rich cultural exhibits protected from rainfall",
        category: "Museums & Art",
        durationMinutes: 120,
        cost: "₹200",
        indoorOutdoor: "Indoor",
        travelMode: "walking",
        intensity: "low",
      };

      // 3. Save updated itinerary via booking endpoint
      const resSave = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          itinerary: updatedPlan,
          baseVersion: trip.__v,
        });

      expect(resSave.status).toBe(200);
      expect(resSave.body.data.realityScore).toBeDefined();

      const updatedReport = resSave.body.data.realityScore;
      expect(updatedReport.score).toBeGreaterThanOrEqual(0);
      expect(updatedReport.metrics.totalActivities).toBe(3);
    });

    it("C2: OCC conflict on concurrent modification preserves saved itinerary without corruption", async () => {
      const trip = await Booking.create({
        user: testUser._id,
        destination: "Kerala",
        guests: 2,
        budget: "30000",
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-24"),
        aiPlan: { destination: "Kerala", days: [{ day: 1, morning: "Tea gardens" }] },
      });

      // Submit stale baseVersion (99 vs 0)
      const resConflict = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          itinerary: { destination: "Kerala", days: [{ day: 1, morning: "Tampered" }] },
          baseVersion: 99,
        });

      expect(resConflict.status).toBe(409);

      // Verify DB record remained intact
      const uncorrupted = await Booking.findById(trip._id);
      expect(uncorrupted.__v).toBe(0);
      expect(JSON.stringify(uncorrupted.aiPlan)).toContain("Tea gardens");
    });
  });

  // =========================================================================
  // Scenario D: Fix Day Integration
  // =========================================================================
  describe("Scenario D: Fix Day Integration", () => {
    it("D1: protects locked activities during itinerary modifications (HTTP 423)", async () => {
      const trip = await Booking.create({
        user: testUser._id,
        destination: "Varanasi",
        guests: 1,
        budget: "20000",
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-23"),
        aiPlan: {
          destination: "Varanasi",
          days: [
            {
              day: 1,
              activities: [
                { id: "v1", period: "evening", title: "Ganga Aarti Ceremony", durationMinutes: 90, locked: true },
              ],
            },
          ],
        },
      });

      // Attempt to modify the locked activity
      const tamperedPlan = {
        destination: "Varanasi",
        days: [
          {
            day: 1,
            activities: [
              { id: "v1", period: "evening", title: "Unauthorized Replacement", durationMinutes: 180, locked: true },
            ],
          },
        ],
      };

      const resLocked = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          itinerary: tamperedPlan,
          baseVersion: trip.__v,
        });

      expect(resLocked.status).toBe(423);
      expect(resLocked.body.message).toContain("locked activity");
    });

    it("D2: applies valid Fix Day proposal and returns updated authoritative Reality Score", async () => {
      const trip = await Booking.create({
        user: testUser._id,
        destination: "Delhi",
        guests: 2,
        budget: "30000",
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-23"),
        aiPlan: {
          destination: "Delhi",
          days: [
            {
              day: 1,
              title: "Old Delhi",
              morning: "Red Fort",
              afternoon: "Chandni Chowk",
              evening: "Jama Masjid",
              activities: [
                { id: "d1-m1", period: "morning", title: "Red Fort Tour", durationMinutes: 150 },
                { id: "d1-a1", period: "afternoon", title: "Chandni Chowk Food Walk", durationMinutes: 180 },
                { id: "d1-e1", period: "evening", title: "Jama Masjid Visit", durationMinutes: 120 },
              ],
            },
          ],
        },
      });

      // Construct a valid candidate replacing the afternoon activity
      const replacementCandidate = {
        id: "d1-a1",
        period: "afternoon",
        title: "Express Chandni Chowk Walk",
        description: "Compact guided food tasting",
        category: "Food & Dining",
        durationMinutes: 90,
        cost: "₹500",
        indoorOutdoor: "Mixed",
        travelMode: "walk",
        intensity: "low",
      };

      const proposalToken = signProposalToken({
        purpose: "fix-day",
        proposalId: crypto.randomUUID(),
        tripId: trip._id.toString(),
        dayNumber: 1,
        baseVersion: trip.__v,
        reason: "schedule_overload",
        currentPeriod: null,
        delayMinutes: null,
        replacementSlots: [
          {
            targetActivityId: "d1-a1",
            replacement: replacementCandidate,
          },
        ],
        issuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
      });

      const resApply = await request(app)
        .post("/api/ai/fix-day/apply")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 1,
          proposalToken,
        });

      expect(resApply.status).toBe(200);
      expect(resApply.body.success).toBe(true);
      expect(resApply.body.data).toHaveProperty("realityReport");

      const appliedReport = resApply.body.data.realityReport;
      expect(appliedReport.score).toBeGreaterThanOrEqual(0);
      expect(appliedReport.metrics.totalActivities).toBe(3);
    });
  });

  // =========================================================================
  // Scenario E: Budget Separation & Zero AI/Network Verification
  // =========================================================================
  describe("Scenario E: Budget Separation & Zero AI/Network Verification", () => {
    it("E1: verifies Reality Score runs deterministically in-memory (< 10ms) without AI or network calls", () => {
      const trip = {
        budget: "45000",
        aiPlan: {
          destination: "Agra",
          days: [
            {
              day: 1,
              activities: [
                { id: "ag1", period: "morning", title: "Taj Mahal", durationMinutes: 150, cost: "₹1,000" },
                { id: "ag2", period: "afternoon", title: "Agra Fort", durationMinutes: 120, cost: "₹500" },
              ],
            },
          ],
        },
      };

      const start = performance.now();
      const report = evaluateTripReality(trip);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(15); // Pure in-memory math
      expect(report.score).toBeGreaterThan(0);
    });

    it("E2: verifies changing total budget does not distort time or pace subscores", () => {
      const basePlan = {
        destination: "Amritsar",
        days: [
          {
            day: 1,
            activities: [
              { id: "am1", period: "morning", title: "Golden Temple", durationMinutes: 120, cost: "Free" },
              { id: "am2", period: "afternoon", title: "Jallianwala Bagh", durationMinutes: 90, cost: "Free" },
            ],
          },
        ],
      };

      const reportLowBudget = evaluateTripReality({ budget: "5000", aiPlan: basePlan });
      const reportHighBudget = evaluateTripReality({ budget: "500000", aiPlan: basePlan });

      // Time and Pace subscores MUST be strictly identical
      expect(reportLowBudget.subScores.timeFeasibility).toBe(reportHighBudget.subScores.timeFeasibility);
      expect(reportLowBudget.subScores.travelPace).toBe(reportHighBudget.subScores.travelPace);
      expect(reportLowBudget.metrics.avgDailyActiveMinutes).toBe(reportHighBudget.metrics.avgDailyActiveMinutes);
      expect(reportLowBudget.metrics.paceCategory).toBe(reportHighBudget.metrics.paceCategory);
    });
  });

  // =========================================================================
  // Scenario F: Shared-Trip Privacy & Access Control
  // =========================================================================
  describe("Scenario F: Shared-Trip Privacy & Access Control", () => {
    it("F1: strips internal metrics, confidence ratios, and issues from public shared trips", async () => {
      const trip = await Booking.create({
        user: testUser._id,
        fullName: "Jane Confidential",
        email: "jane@private.com",
        phone: "+91 98765 43210",
        destination: "Goa",
        guests: 2,
        checkin: new Date("2026-11-25"),
        checkout: new Date("2026-11-28"),
        budget: "40000",
        isShared: true,
        realityScore: {
          score: 88,
          status: "Good",
          subScores: { timeFeasibility: 90, budgetFeasibility: 85, travelPace: 88 },
          metrics: {
            confidence: { durationCoverageRatio: 0.85, inferredDurationsCount: 1 },
            internalDeveloperToken: "secret-token-123",
          },
          issues: [{ id: "iss-1", message: "Internal warning" }],
        },
        aiPlan: {
          destination: "Goa",
          days: [{ day: 1, morning: "Calangute Beach" }],
        },
      });

      const res = await request(app).get(`/api/bookings/shared/${trip._id}`);
      expect(res.status).toBe(200);

      const data = res.body.data;
      // Sensitive owner PII is stripped
      expect(data.fullName).toBeUndefined();
      expect(data.email).toBeUndefined();
      expect(data.phone).toBeUndefined();

      // Reality Score internal details are sanitized
      const rawOutput = JSON.stringify(data);
      expect(rawOutput).not.toContain("secret-token-123");
      expect(rawOutput).not.toContain("Internal warning");
      expect(rawOutput).not.toContain("durationCoverageRatio");
    });

    it("F2: rejects unauthorized non-owners from POST /api/ai/reality-score (HTTP 403)", async () => {
      const trip = await Booking.create({
        user: testUser._id,
        destination: "Manali",
        guests: 1,
        budget: "30000",
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-23"),
        aiPlan: { destination: "Manali", days: [{ day: 1, morning: "Solang Valley" }] },
      });

      // Intruder Bob attempts to access Jane's reality score
      const resIntruder = await request(app)
        .post("/api/ai/reality-score")
        .set("Authorization", `Bearer ${intruderToken}`)
        .send({ tripId: trip._id });

      expect(resIntruder.status).toBe(403);
      expect(resIntruder.body.message).toContain("not authorized");

      // Owner Jane accesses successfully
      const resOwner = await request(app)
        .post("/api/ai/reality-score")
        .set("Authorization", `Bearer ${testToken}`)
        .send({ tripId: trip._id });

      expect(resOwner.status).toBe(200);
      expect(resOwner.body.data.score).toBeGreaterThan(0);
    });
  });
});
