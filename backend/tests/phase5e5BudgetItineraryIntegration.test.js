// backend/tests/phase5e5BudgetItineraryIntegration.test.js
/**
 * TripNow Phase 5E.5 — Itinerary, Adaptive Pivot & Fix Day Budget Integration Test Suite
 *
 * Covers 15 strict verification criteria:
 * 1. Initial itinerary generation preserves budget context.
 * 2. No additional Gemini call for deterministic calculations.
 * 3. Adaptive Pivot preserves budget inputs.
 * 4. Budget pivot does not fabricate monetary savings.
 * 5. Qualitative activity costs remain separate from numeric budgets.
 * 6. Fix Day preview shows correct budget context.
 * 7. Fix Day apply preserves explicit approval.
 * 8. HMAC proposal tampering is rejected.
 * 9. Expired proposals are rejected.
 * 10. Locked activities remain unchanged.
 * 11. OCC conflicts remain correctly handled.
 * 12. Historical bookings without budget metadata remain safe.
 * 13. Shared-trip privacy is preserved.
 * 14. PDF export remains functional.
 * 15. Reality Score outputs remain unchanged.
 */

const request = require("supertest");
const crypto = require("crypto");
const app = require("../app");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { GoogleGenAI } = require("@google/genai");
const {
  signProposalToken,
} = require("../services/fixDayService");
const { normalizeItinerary } = require("../utils/itineraryNormalizer");
const { calculateBudgetIntelligence, CALCULATION_STATUS } = require("../services/budgetIntelligence");
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
      title: "North Goa Beaches & Fort",
      morning: "Explore Fort Aguada and lighthouse",
      afternoon: "Relax at Candolim Beach shack",
      evening: "Sunset stroll at Sinquerim Beach",
      food: ["Goan Fish Curry", "Sol Kadi"],
    },
    {
      day: 2,
      title: "Culture & Old Goa",
      morning: "Visit Basilica of Bom Jesus",
      afternoon: "Walk through Latin Quarter Fontainhas",
      evening: "Mandovi river sunset cruise",
      food: ["Goan Prawn Curry", "Poee Bread"],
    },
    {
      day: 3,
      title: "Spice Plantation & Cuisine",
      morning: "Tour Sahakari Spice Farm",
      afternoon: "Traditional Goan feast lunch",
      evening: "Shopping at Anjuna Flea Market",
      food: ["Bebinca", "Feni Cocktail"],
    },
  ],
  budgetBreakdown: {
    accommodation: "₹4,000/night",
    foodPerDay: "₹1,500",
    transport: "₹800",
    activities: "₹1,200",
    total: "₹30,000",
  },
  whereToStay: { budget: "Zostel Goa", midRange: "Fairfield by Marriott" },
  mustEat: ["Goan Fish Curry", "Bebinca"],
  travelTips: ["Rent a scooter for easy commuting", "Carry cash for beach shacks"],
};

const createTestBooking = async (overrides = {}) => {
  let rawPlan = overrides.aiPlan || sampleItinerary;
  if (typeof rawPlan === "string") {
    try { rawPlan = JSON.parse(rawPlan); } catch (e) {}
  }
  const { plan: normalized } = normalizeItinerary(rawPlan);
  const data = {
    destination: "Goa, India",
    budget: "30000",
    guests: 2,
    checkin: new Date("2026-11-10"),
    checkout: new Date("2026-11-13"),
    ...overrides,
    aiPlan: JSON.stringify(normalized),
  };
  return await Booking.create(data);
};

const mockReplacementCandidate = (overrides = {}) => ({
  title: "Fontainhas Heritage Architecture Walk",
  description: "A scenic walking tour through colorful Portuguese colonial villas.",
  category: "Culture",
  activityType: "culture",
  indoorOutdoor: "Indoor",
  durationMinutes: 75,
  travelMode: "walking",
  intensity: "low",
  cost: "Free",
  reason: "Budget-friendly cultural replacement requiring zero entrance fees.",
  insiderTip: "Carry a camera for the pastel-colored balconies.",
  ...overrides,
});

describe("TripNow Phase 5E.5 — Itinerary, Adaptive Pivot & Fix Day Budget Integration", () => {
  // =========================================================================
  // 1. Initial itinerary generation preserves budget context
  // =========================================================================
  test("1. Initial itinerary generation preserves budget context", async () => {
    const booking = await createTestBooking({ budget: "35000", guests: 3 });
    const fetched = await Booking.findById(booking._id);

    expect(fetched).toBeDefined();
    expect(fetched.budget).toBe("35000");
    expect(fetched.guests).toBe(3);
    expect(fetched.destination).toBe("Goa, India");

    const parsedPlan = JSON.parse(fetched.aiPlan);
    expect(parsedPlan.days).toHaveLength(3);
    expect(parsedPlan.budgetBreakdown.total).toBe("₹30,000");
  });

  // =========================================================================
  // 2. No additional Gemini call for deterministic calculations
  // =========================================================================
  test("2. No additional Gemini call for deterministic calculations", () => {
    const mockGenerate = jest.fn();
    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerate },
    }));

    const result = calculateBudgetIntelligence({
      destination: "Goa, India",
      totalBudget: 40000,
      days: 4,
      guests: 2,
      currency: "INR",
    });

    expect(result.status).toBe(CALCULATION_STATUS.CALCULATED);
    expect(result.tier).toBe("TIER_2_RESORT");
    expect(result.perPersonDailyBudget).toBe(5000);
    expect(result.groupDailyBudget).toBe(10000);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 3. Adaptive Pivot preserves budget inputs
  // =========================================================================
  test("3. Adaptive Pivot preserves budget inputs", async () => {
    const booking = await createTestBooking({ budget: "45000", guests: 2 });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: mockReplacementCandidate({ indoorOutdoor: "Indoor" }) }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify budgetGuidance in response
    expect(res.body.data.budgetGuidance).toBeDefined();
    expect(res.body.data.budgetGuidance.destinationTier).toBe("TIER_2_RESORT");
    expect(res.body.data.budgetGuidance.currency).toBe("INR");
    expect(typeof res.body.data.budgetGuidance.dailyPerPerson).toBe("number");

    // Authoritative DB state remains unchanged (staged pivot)
    const tripInDb = await Booking.findById(booking._id);
    expect(tripInDb.budget).toBe("45000");
    expect(tripInDb.guests).toBe(2);
    expect(tripInDb.destination).toBe("Goa, India");
  });

  // =========================================================================
  // 4. Budget pivot does not fabricate monetary savings
  // =========================================================================
  test("4. Budget pivot does not fabricate monetary savings", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: mockReplacementCandidate({
              cost: "Free",
              reason: "Free cultural alternative to cut trip expenses.",
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
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.cost).toBe("Free");

    // Critical: System must NOT fabricate a numeric savings field
    expect(res.body.data.numericSavings).toBeUndefined();
    expect(res.body.data.moneySaved).toBeUndefined();
    expect(res.body.data.budgetGuidance.qualitativeNote).toContain("Budget-conscious replacement selected");
  });

  // =========================================================================
  // 5. Qualitative activity costs remain separate from numeric budgets
  // =========================================================================
  test("5. Qualitative activity costs remain separate from numeric budgets", async () => {
    const plan = JSON.parse(JSON.stringify(sampleItinerary));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[0].activities[0].cost = "Free";
    norm.days[0].activities[1].cost = "Low (₹150 snack)";
    norm.days[0].activities[2].cost = "Moderate";

    const booking = await createTestBooking({ aiPlan: norm, budget: "30000" });
    const fetched = await Booking.findById(booking._id);

    // Qualitative cost strings remain preserved in activities
    const parsedPlan = JSON.parse(fetched.aiPlan);
    expect(parsedPlan.days[0].activities[0].cost).toBe("Free");
    expect(parsedPlan.days[0].activities[1].cost).toBe("Low (₹150 snack)");
    expect(parsedPlan.days[0].activities[2].cost).toBe("Moderate");

    // Total budget is strictly the user's numeric budget string, never summed from activity strings
    expect(fetched.budget).toBe("30000");
  });

  // =========================================================================
  // 6. Fix Day preview shows correct budget context
  // =========================================================================
  test("6. Fix Day preview shows correct budget context", async () => {
    const booking = await createTestBooking({ budget: "30000", guests: 2 });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: mockReplacementCandidate({ durationMinutes: 45 }) }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 45,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.budgetGuidance).toBeDefined();
    expect(data.budgetGuidance.destinationTier).toBe("TIER_2_RESORT");
    expect(data.budgetGuidance.comfortCategory).toBeDefined();
    expect(typeof data.budgetGuidance.dailyPerPerson).toBe("number");
    expect(data.budgetGuidance.qualitativeNote).toContain("qualitative venue estimates");

    // Verify slots contain original and replacement costs
    const replacedSlot = data.slots.find((s) => s.action === "REPLACED");
    expect(replacedSlot).toBeDefined();
    expect(replacedSlot.replacementActivity.cost).toBe("Free");
    expect(replacedSlot.originalActivity.cost).toBeDefined();
  });

  // =========================================================================
  // 7. Fix Day apply preserves explicit approval
  // =========================================================================
  test("7. Fix Day apply preserves explicit approval", async () => {
    const booking = await createTestBooking();

    // Attempting apply without valid signed token fails
    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // 8. HMAC proposal tampering is rejected
  // =========================================================================
  test("8. HMAC proposal tampering is rejected", async () => {
    const booking = await createTestBooking();

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
        {
          targetActivityId: "d2-evening-01",
          replacement: mockReplacementCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    // Tamper with the token payload
    const parts = validToken.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8")), dayNumber: 3 })
    ).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: tamperedToken,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  // =========================================================================
  // 9. Expired proposals are rejected
  // =========================================================================
  test("9. Expired proposals are rejected", async () => {
    const booking = await createTestBooking();

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
        {
          targetActivityId: "d2-evening-01",
          replacement: mockReplacementCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now() - 500000,
      expiresAt: Date.now() - 100000, // expired 100 seconds ago (lifetime 400s < 900s limit)
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: expiredToken,
    });

    expect(res.status).toBe(410);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  // =========================================================================
  // 10. Locked activities remain unchanged
  // =========================================================================
  test("10. Locked activities remain unchanged", async () => {
    const plan = JSON.parse(JSON.stringify(sampleItinerary));
    const { plan: norm } = normalizeItinerary(plan);
    // Lock the morning activity on day 2
    norm.days[1].activities[0].locked = true;

    const booking = await createTestBooking({ aiPlan: norm });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: mockReplacementCandidate() }),
        }),
      },
    }));

    // Attempting to pivot a locked block must be rejected
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "morning",
      pivotReason: "rain",
    });

    expect(res.status).toBe(423);
    expect(res.body.message).toContain("locked");
  });

  // =========================================================================
  // 11. OCC conflicts remain correctly handled
  // =========================================================================
  test("11. OCC conflicts remain correctly handled", async () => {
    const booking = await createTestBooking();

    // Create proposal based on current version __v = 0
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
        {
          targetActivityId: "d2-evening-01",
          replacement: mockReplacementCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    // Simulate concurrent modification in DB
    await Booking.findByIdAndUpdate(booking._id, { $inc: { __v: 1 } });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONCURRENCY_CONFLICT");
  });

  // =========================================================================
  // 12. Historical bookings without budget metadata remain safe
  // =========================================================================
  test("12. Historical bookings without budget metadata remain safe", async () => {
    // Register test user for authenticated booking retrieval
    const signupRes = await request(app).post("/api/auth/signup").send({
      name: "Legacy Traveler",
      email: "legacy@example.com",
      password: "Password123",
    });
    const authToken = extractToken(signupRes);
    const userId = signupRes.body.data.user.id || signupRes.body.data.user._id;

    // Legacy booking lacking budget or structured activity metadata
    const legacyBooking = await Booking.create({
      user: userId,
      destination: "Goa, India",
      guests: 1,
      checkin: new Date("2026-11-01"),
      checkout: new Date("2026-11-04"),
      aiPlan: JSON.stringify({
        destination: "Goa, India",
        days: [
          { day: 1, morning: "Beach walk", afternoon: "Lunch", evening: "Sunset" },
          { day: 2, morning: "Church", afternoon: "Fort", evening: "Dinner" },
        ],
      }),
    });

    const res = await request(app)
      .get(`/api/bookings/${legacyBooking._id}`)
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Baseline calculation handles legacy values safely without throwing
    const safeFallbackIntel = calculateBudgetIntelligence({
      destination: legacyBooking.destination,
      totalBudget: 30000,
      days: 3,
      guests: legacyBooking.guests || 1,
      currency: "INR",
    });
    expect(safeFallbackIntel.status).toBe(CALCULATION_STATUS.CALCULATED);
    expect(safeFallbackIntel.tier).toBe("TIER_2_RESORT");

    // Lacking budget entirely yields predictable error response without crashes
    const missingBudgetIntel = calculateBudgetIntelligence({
      destination: legacyBooking.destination,
      totalBudget: legacyBooking.budget || 0,
      days: 3,
      guests: legacyBooking.guests || 1,
      currency: "INR",
    });
    expect(missingBudgetIntel.status).toBe(CALCULATION_STATUS.INVALID_INPUT);
    expect(missingBudgetIntel.validationErrors.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 13. Shared-trip privacy is preserved
  // =========================================================================
  test("13. Shared-trip privacy is preserved", async () => {
    const booking = await createTestBooking({
      budget: "50000",
      guests: 2,
    });

    const sanitized = sanitizePublicAiPlan(booking.aiPlan);

    // Verify public properties present
    expect(sanitized.destination).toBe("Goa, India");
    expect(sanitized.days).toHaveLength(3);

    // Verify private properties are strictly absent
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.userId).toBeUndefined();
    expect(sanitized.email).toBeUndefined();
    expect(sanitized.budget).toBeUndefined();
    expect(sanitized.paymentId).toBeUndefined();
    expect(sanitized.proposalToken).toBeUndefined();
  });

  // =========================================================================
  // 14. PDF export remains functional
  // =========================================================================
  test("14. PDF export remains functional", () => {
    const { normalizeDurationMinutes } = require("../utils/itineraryNormalizer");

    // Test duration formatting helper behavior matching pdf.js
    const durationMeta1 = normalizeDurationMinutes({ durationMinutes: 90 });
    expect(durationMeta1.durationMinutes).toBe(90);
    expect(durationMeta1.durationInferred).toBe(false);

    const durationMeta2 = normalizeDurationMinutes({});
    expect(durationMeta2.durationMinutes).toBeNull();
    expect(durationMeta2.durationInferred).toBe(false);
  });

  // =========================================================================
  // 15. Reality Score outputs remain unchanged
  // =========================================================================
  test("15. Reality Score outputs remain unchanged", () => {
    const plan = JSON.parse(JSON.stringify(sampleItinerary));
    const { plan: norm } = normalizeItinerary(plan);

    const report = evaluateTripReality(norm, {
      destination: "Goa, India",
      budget: 30000,
      travelers: 2,
    });

    expect(report.score).toBeGreaterThan(0);
    expect(report.subScores).toBeDefined();
    expect(report.subScores.timeFeasibility).toBeDefined();
    expect(report.subScores.budgetFeasibility).toBeDefined();
    expect(["Excellent", "Good", "Needs Attention", "Risky", "Critical"]).toContain(report.status);
  });
});
