// backend/tests/fixDay.test.js
const request = require("supertest");
const crypto = require("crypto");
const app = require("../app");
const env = require("../config/env");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase } = require("./db");
const { GoogleGenAI } = require("@google/genai");
const {
  signProposalToken,
  verifyProposalToken,
  calculateAllowableFutureActiveMinutes,
  FixDayError,
  ALLOWED_CATEGORIES,
} = require("../services/fixDayService");
const { normalizeItinerary } = require("../utils/itineraryNormalizer");

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

const userA = { name: "Traveler A", email: "travelerA@example.com", password: "Password123" };
const userB = { name: "Traveler B", email: "travelerB@example.com", password: "Password123" };

const signup = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: res.body.data.token, user: res.body.data.user };
};

const sample3DayPlan = {
  destination: "Goa, India",
  days: [
    {
      day: 1,
      title: "North Goa Heritage",
      morning: "Visit Fort Aguada and lighthouse",
      afternoon: "Lunch at Candolim beachside shack",
      evening: "Sunset walk at Sinquerim beach",
      food: ["Goan Fish Curry", "Sol Kadi"],
    },
    {
      day: 2,
      title: "Coastal Adventure",
      morning: "Morning surf lesson at Morjim Beach",
      afternoon: "Parasailing and beach sports at Baga Beach",
      evening: "Dinner and live music at Curlies in Anjuna",
      food: ["Prawn Balchão", "Bebinca"],
    },
    {
      day: 3,
      title: "Old Goa Culture",
      morning: "Explore Basilica of Bom Jesus",
      afternoon: "Walk through Latin Quarter Fontainhas",
      evening: "Mandovi river evening cruise",
      food: ["Goan Pork Vindaloo", "Poee bread"],
    },
  ],
  mustEat: ["Goan Fish Curry", "Prawn Balchão", "Bebinca"],
  budgetBreakdown: {
    accommodation: "₹4,000/night",
    foodPerDay: "₹1,500",
    transport: "₹800",
    activities: "₹1,200",
    total: "₹25,000",
  },
  travelTips: ["Rent a scooter", "Keep cash handy"],
  whereToStay: { budget: "Zostel", midRange: "Fairfield" },
  bestTimeToVisit: "November to February",
};

const createTestBooking = async (plan = sample3DayPlan, ownerUser = null, budget = "25000") => {
  const userId = ownerUser ? (ownerUser._id || ownerUser.id) : null;
  const { plan: normalized } = normalizeItinerary(plan);
  return await Booking.create({
    user: userId,
    destination: "Goa, India",
    guests: 2,
    checkin: new Date("2026-11-01"),
    checkout: new Date("2026-11-04"),
    budget,
    aiPlan: JSON.stringify(normalized),
  });
};

const makeMockCandidate = (overrides = {}) => ({
  title: "Bairro Alto Traditional Dinner",
  description: "Relaxing dinner at a local taverna in historic Bairro Alto.",
  category: "Dining & Nightlife",
  indoorOutdoor: "Indoor",
  durationMinutes: 90,
  cost: "₹800",
  reason: "Compacted evening to absorb afternoon delay.",
  ...overrides,
});

describe("Phase 4 Fix My Day — Backend Test Suite (T-FD-01 through T-FD-35)", () => {
  // =========================================================================
  // Group 1: Security & Proposal Token Integrity (T-FD-01 to T-FD-07)
  // =========================================================================

  test("T-FD-01: Proposal token signature verification rejects modified token payload", async () => {
    const booking = await createTestBooking();
    const payload = {
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const validToken = signProposalToken(payload);
    const [payloadB64, sig] = validToken.split(".");

    // Tamper with payload (e.g. change dayNumber from 2 to 1)
    const tamperedObj = { ...payload, dayNumber: 1 };
    const tamperedB64 = Buffer.from(JSON.stringify(tamperedObj)).toString("base64url");
    const tamperedToken = `${tamperedB64}.${sig}`;

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 1,
      proposalToken: tamperedToken,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("T-FD-02: Token signed with wrong secret (e.g. jwtSecret) is strictly rejected", async () => {
    const booking = await createTestBooking();
    const payload = {
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
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    // Sign using JWT_SECRET instead of FIX_DAY_PROPOSAL_SECRET
    const wrongSecretToken = signProposalToken(payload, env.jwtSecret);

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: wrongSecretToken,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("T-FD-03: Expired proposal token (> 15 min or past expiresAt) is rejected with HTTP 410", async () => {
    const booking = await createTestBooking();
    const now = Date.now();
    const payload = {
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
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: now - 1000000,
      expiresAt: now - 100000, // already expired
    };

    const expiredToken = signProposalToken(payload);

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: expiredToken,
    });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  test("T-FD-04: Proposal token with invalid purpose is rejected with HTTP 400", async () => {
    const booking = await createTestBooking();
    const payload = {
      purpose: "pivot", // wrong purpose!
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "schedule_overload",
      currentPeriod: null,
      delayMinutes: null,
      replacementSlots: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const token = signProposalToken(payload);

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("T-FD-05: Proposal token with malformed or non-v4 UUID proposalId is rejected with HTTP 400", async () => {
    const booking = await createTestBooking();
    const payload = {
      purpose: "fix-day",
      proposalId: "non-uuid-random-id-12345",
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "schedule_overload",
      currentPeriod: null,
      delayMinutes: null,
      replacementSlots: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const token = signProposalToken(payload);

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("T-FD-06: Body tripId or dayNumber mismatching token claims is rejected with HTTP 400", async () => {
    const booking = await createTestBooking();
    const payload = {
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
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const token = signProposalToken(payload);

    // Mismatched dayNumber (body: 3, token: 2)
    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 3,
      proposalToken: token,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  test("T-FD-07: Client override attempts in apply body are strictly rejected by validator", async () => {
    const booking = await createTestBooking();
    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "schedule_overload",
      currentPeriod: null,
      delayMinutes: null,
      replacementSlots: [],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
      hackedReplacement: { title: "Malicious Injection" },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  // =========================================================================
  // Group 2: Running-Late Context & Capacity Calculation (T-FD-08 to T-FD-14)
  // =========================================================================

  test("T-FD-08: Missing currentPeriod when reason is running_late is rejected by validator with HTTP 400", async () => {
    const booking = await createTestBooking();
    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      delayMinutes: 60,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.currentPeriod).toBeDefined();
  });

  test("T-FD-09: Missing or out-of-bounds delayMinutes (<15 or >240) is rejected with HTTP 400", async () => {
    const booking = await createTestBooking();

    // Less than 15
    const resLow = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 10,
    });
    expect(resLow.status).toBe(400);

    // Greater than 240
    const resHigh = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 300,
    });
    expect(resHigh.status).toBe(400);
  });

  test("T-FD-10: Running-late scheduled duration formula calculates AllowableFutureActiveMinutes", () => {
    // Formula: 480 - delayMinutes - pastScheduled - currentScheduled
    const remaining = calculateAllowableFutureActiveMinutes(60, 120, 180);
    expect(remaining).toBe(120);

    const remaining2 = calculateAllowableFutureActiveMinutes(90, 150, 150);
    expect(remaining2).toBe(90);
  });

  test("T-FD-11: Pre-flight deterministic 422 when unavoidable locked future scheduled duration exceeds AllowableFutureActiveMinutes", async () => {
    // Setup Day 2: Morning 120m, Afternoon 180m, Evening (locked 180m).
    // Delay: 60m. Past (120) + Current (180) + Delay (60) = 360m. AllowableFuture = 120m.
    // Unavoidable locked evening (180m) > 120m => Pre-flight 422!
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[0].durationMinutes = 120; // morning
    norm.days[1].activities[1].durationMinutes = 180; // afternoon
    norm.days[1].activities[2].durationMinutes = 180; // evening
    norm.days[1].activities[2].locked = true;

    const booking = await createTestBooking(norm);

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("FUTURE_CAPACITY_INSUFFICIENT");
  });

  test("T-FD-12: Pre-flight deterministic 422 when zero eligible future unlocked replacement targets exist", async () => {
    // Current period is evening => zero upcoming periods!
    const booking = await createTestBooking();

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "evening",
      delayMinutes: 60,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("FUTURE_CAPACITY_INSUFFICIENT");
  });

  test("T-FD-13: Mathematically feasible short future schedule (<60m) is NOT automatically rejected", async () => {
    // Delay = 60m. Morning = 180m, Afternoon = 195m.
    // AllowableFuture = 480 - 60 - 180 - 195 = 45m.
    // Evening is unlocked and can be compacted to 45m.
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[0].durationMinutes = 180;
    norm.days[1].activities[1].durationMinutes = 195;
    norm.days[1].activities[2].durationMinutes = 120; // unlocked

    const booking = await createTestBooking(norm);

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              durationMinutes: 45,
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.proposalToken).toBeDefined();
  });

  test("T-FD-14: Past periods and current period remain strictly immutable in preview diff", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: makeMockCandidate() }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    const slots = res.body.data.slots;
    const morningSlot = slots.find((s) => s.period === "morning");
    const afternoonSlot = slots.find((s) => s.period === "afternoon");
    const eveningSlot = slots.find((s) => s.period === "evening");

    expect(morningSlot.action).toBe("COMPLETED_PAST");
    expect(afternoonSlot.action).toBe("CURRENT_IN_PROGRESS");
    expect(eveningSlot.action).toBe("REPLACED");
  });

  // =========================================================================
  // Group 3: Replacement Targeting & Canonical Identity (T-FD-15 to T-FD-20)
  // =========================================================================

  test("T-FD-15: Target activity must exist on requested day; invalid targetActivityId fails with HTTP 422", async () => {
    const booking = await createTestBooking();
    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-nonexistent-99",
          replacement: makeMockCandidate({ id: "d2-nonexistent-99", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PROPOSAL_VALIDATION_FAILED");
  });

  test("T-FD-16: Replacement inherits exact target activity ID; mismatch fails with HTTP 422", async () => {
    const booking = await createTestBooking();
    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "invented-id-xyz", period: "evening" }), // mismatch!
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PROPOSAL_VALIDATION_FAILED");
  });

  test("T-FD-17: Replacement inherits target exact period; period mismatch fails with HTTP 422", async () => {
    const booking = await createTestBooking();
    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "morning" }), // target is evening!
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("PROPOSAL_VALIDATION_FAILED");
  });

  test("T-FD-18: Multiple activities in one period: adaptation surgically targets exact targetActivityId while non-target remains unchanged", async () => {
    // Day 2 has two evening activities: d2-evening-01 and d2-evening-02
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities.push({
      id: "d2-evening-02",
      period: "evening",
      title: "Late Night Beach Stroll",
      description: "Quiet walk along the shore.",
      category: "Relaxation",
      durationMinutes: 45,
      cost: "Free",
      indoorOutdoor: "Outdoor",
      locked: false,
    });

    const booking = await createTestBooking(norm);

    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening", title: "Quick Taverna Dinner" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(200);
    const updatedTrip = await Booking.findById(booking._id);
    const { plan: updatedPlan } = normalizeItinerary(updatedTrip.aiPlan);
    const eveningActs = updatedPlan.days[1].activities.filter((a) => a.period === "evening");

    expect(eveningActs.length).toBe(2);
    const act1 = eveningActs.find((a) => a.id === "d2-evening-01");
    const act2 = eveningActs.find((a) => a.id === "d2-evening-02");

    expect(act1.title).toBe("Quick Taverna Dinner");
    expect(act2.title).toBe("Late Night Beach Stroll"); // untouched!
  });

  test("T-FD-19: Total activity count cannot increase (no new activities or new periods created)", async () => {
    const booking = await createTestBooking();
    const beforeCount = JSON.parse(booking.aiPlan).days[1].activities.length;

    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(200);
    const updatedTrip = await Booking.findById(booking._id);
    const afterCount = JSON.parse(updatedTrip.aiPlan).days[1].activities.length;
    expect(afterCount).toBe(beforeCount);
  });

  test("T-FD-20: Non-target activities across all periods on Day X remain 100% bit-for-bit unchanged", async () => {
    const booking = await createTestBooking();
    const origDay = JSON.parse(booking.aiPlan).days[1];
    const origMorning = origDay.activities.find((a) => a.period === "morning");
    const origAfternoon = origDay.activities.find((a) => a.period === "afternoon");

    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    const updatedTrip = await Booking.findById(booking._id);
    const updatedDay = JSON.parse(updatedTrip.aiPlan).days[1];
    const updatedMorning = updatedDay.activities.find((a) => a.period === "morning");
    const updatedAfternoon = updatedDay.activities.find((a) => a.period === "afternoon");

    expect(updatedMorning).toEqual(origMorning);
    expect(updatedAfternoon).toEqual(origAfternoon);
  });

  // =========================================================================
  // Group 4: Locked Anchor Immutability (T-FD-21 to T-FD-24)
  // =========================================================================

  test("T-FD-21: All activities on target day locked returns deterministic HTTP 422", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities.forEach((a) => (a.locked = true));

    const booking = await createTestBooking(norm);

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "schedule_overload",
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FUTURE_CAPACITY_INSUFFICIENT");
    expect(res.body.message).toContain("All activities on this day are locked");
  });

  test("T-FD-22: Direct attempt to adapt a locked activity in apply fails with HTTP 423", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[2].locked = true; // evening locked

    const booking = await createTestBooking(norm);

    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe("LOCKED_ACTIVITY_CONFLICT");
  });

  test("T-FD-23: Deep locked immutability: all 10 canonical fields of locked activities must be bit-for-bit identical after adaptation", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[0].locked = true; // morning locked

    const booking = await createTestBooking(norm);
    const origLocked = norm.days[1].activities[0];

    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(200);
    const updatedTrip = await Booking.findById(booking._id);
    const updatedLocked = JSON.parse(updatedTrip.aiPlan).days[1].activities[0];

    const fields = [
      "id",
      "period",
      "title",
      "description",
      "category",
      "durationMinutes",
      "cost",
      "indoorOutdoor",
      "location",
      "locked",
    ];

    for (const f of fields) {
      expect(updatedLocked[f]).toEqual(origLocked[f]);
    }
  });

  test("T-FD-24: Any tampering with locked activity during candidate reconstruction triggers HTTP 423", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[0].locked = true; // morning locked

    const booking = await createTestBooking(norm);

    // Token targets unlocked evening activity, but someone altered locked morning in replacement
    const token = signProposalToken({
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
          targetActivityId: "d2-morning-01", // trying to replace locked morning
          replacement: makeMockCandidate({ id: "d2-morning-01", period: "morning" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe("LOCKED_ACTIVITY_CONFLICT");
  });

  // =========================================================================
  // Group 5: Category & Budget Policies (T-FD-25 to T-FD-28)
  // =========================================================================

  test("T-FD-25: Candidate proposing category outside the 7 Phase 2 categories is rejected during candidate validation and retried", async () => {
    const booking = await createTestBooking();

    let callCount = 0;
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            // Invalid category on attempt 1
            return {
              text: JSON.stringify({
                replacement: makeMockCandidate({ category: "Nightclubbing" }), // invalid category!
              }),
            };
          }
          // Valid category on attempt 2 (corrective retry)
          return {
            text: JSON.stringify({
              replacement: makeMockCandidate({ category: "Dining & Nightlife" }),
            }),
          };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(callCount).toBe(2);
    expect(res.body.data.slots.find((s) => s.action === "REPLACED").replacementActivity.category).toBe("Dining & Nightlife");
  });

  test("T-FD-26: Unknown prose costs (Moderate) and Free ($0) are handled deterministically without fabricating numbers", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({ cost: "Moderate" }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.proposalToken).toBeDefined();
  });

  test("T-FD-27: Budget 10% non-inflation rule: candidate with known cost > 110% of original is rejected", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[2].cost = "₹1,000"; // original evening cost

    const booking = await createTestBooking(norm);

    let callCount = 0;
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async () => {
          callCount++;
          // Returns ₹1,500 which is 150% (> 110%)
          return {
            text: JSON.stringify({
              replacement: makeMockCandidate({ cost: "₹1,500" }),
            }),
          };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    // Fails after 1 retry => HTTP 502 PROPOSAL_VALIDATION_FAILED
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("PROPOSAL_VALIDATION_FAILED");
    expect(callCount).toBe(2);
  });

  test("T-FD-28: Pre-existing budget deficit is tolerated if not worsened; newly introduced deficit is rejected", async () => {
    // Trip with existing deficit
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities[2].cost = "₹5,000"; // high cost

    const booking = await createTestBooking(norm, null, "1000"); // low budget => already over budget

    // Candidate lowers cost to ₹800 (deficit improves)
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({ cost: "₹800" }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // =========================================================================
  // Group 6: Gemini Interaction & Single Retry Protocol (T-FD-29 to T-FD-31)
  // =========================================================================

  test("T-FD-29: Valid candidate on first attempt passes preview and generates proposalToken without retrying", async () => {
    const booking = await createTestBooking();
    let calls = 0;

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async () => {
          calls++;
          return {
            text: JSON.stringify({ replacement: makeMockCandidate() }),
          };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(calls).toBe(1);
    expect(res.body.data.proposalToken).toBeDefined();
  });

  test("T-FD-30: Invalid candidate on first attempt succeeds on single corrective retry", async () => {
    const booking = await createTestBooking();
    let calls = 0;
    let retryPromptReceived = "";

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async ({ contents }) => {
          calls++;
          if (calls === 1) {
            // Duration exceeds allowable limit
            return {
              text: JSON.stringify({ replacement: makeMockCandidate({ durationMinutes: 300 }) }),
            };
          }
          retryPromptReceived = contents;
          return {
            text: JSON.stringify({ replacement: makeMockCandidate({ durationMinutes: 60 }) }),
          };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(retryPromptReceived).toContain("CRITICAL RETRY INSTRUCTION");
  });

  test("T-FD-31: Candidate failing after single corrective retry aborts with HTTP 502 (no DB mutation)", async () => {
    const booking = await createTestBooking();
    let calls = 0;

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async () => {
          calls++;
          // Both attempts return invalid duration
          return {
            text: JSON.stringify({ replacement: makeMockCandidate({ durationMinutes: 350 }) }),
          };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("PROPOSAL_VALIDATION_FAILED");
    expect(calls).toBe(2);

    // Verify DB version was not bumped
    const refreshed = await Booking.findById(booking._id);
    expect(refreshed.__v).toBe(booking.__v);
  });

  // =========================================================================
  // Group 7: Concurrency, Permissions & End-to-End Apply Flow (T-FD-32 to T-FD-35)
  // =========================================================================

  test("T-FD-32: OCC version conflict: Apply with stale baseVersion fails with HTTP 409", async () => {
    const booking = await createTestBooking();
    const token = signProposalToken({
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 2,
      baseVersion: booking.__v,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
      replacementSlots: [
        {
          targetActivityId: "d2-evening-01",
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    // Simulate concurrent modification bumping __v
    await Booking.findByIdAndUpdate(booking._id, { $inc: { __v: 1 } });

    const res = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken: token,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONCURRENCY_CONFLICT");
  });

  test("T-FD-33: Ownership check: Caller cannot preview or apply Fix Day on another user's private trip", async () => {
    const authA = await signup(userA);
    const authB = await signup(userB);

    const booking = await createTestBooking(sample3DayPlan, authA.user);

    // User B tries to preview User A's trip
    const previewRes = await request(app)
      .post("/api/ai/fix-day/preview")
      .set("Authorization", `Bearer ${authB.token}`)
      .send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        reason: "schedule_overload",
      });

    expect(previewRes.status).toBe(403);

    // User B tries to apply on User A's trip
    const token = signProposalToken({
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
          replacement: makeMockCandidate({ id: "d2-evening-01", period: "evening" }),
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    const applyRes = await request(app)
      .post("/api/ai/fix-day/apply")
      .set("Authorization", `Bearer ${authB.token}`)
      .send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        proposalToken: token,
      });

    expect(applyRes.status).toBe(403);
  });

  test("T-FD-34: Legacy day with fewer than 2 activities returns HTTP 422", async () => {
    const plan = JSON.parse(JSON.stringify(sample3DayPlan));
    const { plan: norm } = normalizeItinerary(plan);
    norm.days[1].activities = [norm.days[1].activities[0]]; // only 1 activity on Day 2

    const booking = await createTestBooking(norm);

    const res = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "schedule_overload",
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FUTURE_CAPACITY_INSUFFICIENT");
    expect(res.body.message).toContain("insufficient adaptable slots");
  });

  test("T-FD-35: Full end-to-end Preview -> Apply lifecycle completes with atomic persistence and updated Reality Report", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Authentic Goan Seafood Dinner",
              durationMinutes: 75,
              cost: "₹600",
            }),
          }),
        }),
      },
    }));

    // 1. Preview
    const previewRes = await request(app).post("/api/ai/fix-day/preview").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      reason: "running_late",
      currentPeriod: "afternoon",
      delayMinutes: 60,
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    const { proposalToken, scoreDelta, diagnosis } = previewRes.body.data;
    expect(proposalToken).toBeDefined();
    expect(diagnosis.targetActiveMinutes).toBeDefined();
    expect(scoreDelta.scoreAfter).toBeGreaterThanOrEqual(scoreDelta.scoreBefore);

    // 2. Apply
    const applyRes = await request(app).post("/api/ai/fix-day/apply").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      proposalToken,
    });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.success).toBe(true);
    expect(applyRes.body.data.version).toBe(booking.__v + 1);
    expect(applyRes.body.data.updatedDay.activities.find((a) => a.period === "evening").title).toBe("Authentic Goan Seafood Dinner");
    expect(applyRes.body.data.realityReport.score).toBeDefined();

    // 3. Verify in MongoDB
    const persisted = await Booking.findById(booking._id);
    expect(persisted.__v).toBe(booking.__v + 1);
    const { plan: persistedPlan } = normalizeItinerary(persisted.aiPlan);
    expect(persistedPlan.days[1].activities.find((a) => a.period === "evening").title).toBe("Authentic Goan Seafood Dinner");
  });
});
