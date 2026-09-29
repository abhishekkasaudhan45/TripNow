// backend/tests/lock.test.js
const request = require("supertest");
const app = require("../app");
const env = require("../config/env");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase } = require("./db");
const { GoogleGenAI } = require("@google/genai");

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
      afternoon: "Visit Archaeological Museum",
      evening: "Mandovi river sunset cruise",
      food: ["Vindaloo"],
    },
  ],
  budgetBreakdown: {
    accommodation: "₹3,500/night",
    foodPerDay: "₹1,200",
    transport: "₹600",
    activities: "₹1,000",
    total: "₹21,000",
  },
  mustEat: ["Goan Fish Curry"],
  travelTips: ["Rent a scooter"],
};

describe("POST /api/ai/activity/lock - Input Validation", () => {
  it("rejects request if tripId is missing", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({ activityId: "d1-morning-01", locked: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects request if tripId is not a valid 24-character ObjectId", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({ tripId: "invalid-id", activityId: "d1-morning-01", locked: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects request if activityId is missing or empty", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({ tripId: "664a78bc9d2e1f4a9c801234", activityId: "   ", locked: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.activityId).toBeDefined();
  });

  it("rejects request if locked is not a boolean", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({ tripId: "664a78bc9d2e1f4a9c801234", activityId: "d1-morning-01", locked: "yes" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.locked).toBeDefined();
  });

  it("rejects unrecognized client fields (strict schema)", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: "664a78bc9d2e1f4a9c801234",
        activityId: "d1-morning-01",
        locked: true,
        extraHack: "bypass",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?._errors || res.body.message).toBeDefined();
  });
});

describe("POST /api/ai/activity/lock - Authorization & Ownership", () => {
  it("returns 404 if trip does not exist", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: "664a78bc9d2e1f4a9c801234",
        activityId: "d1-morning-01",
        locked: true,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Trip not found");
  });

  it("returns 404 if activityId does not exist in the trip", async () => {
    const booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });

    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "nonexistent-activity-id",
        locked: true,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("not found in trip itinerary");
  });

  it("returns 403 when User B attempts to lock an activity on User A's private trip", async () => {
    const { token: tokenA, user: userADoc } = await signup(userA);
    const { token: tokenB } = await signup(userB);

    const bookingA = await Booking.create({
      user: userADoc.id,
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });

    const res = await request(app)
      .post("/api/ai/activity/lock")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        tripId: bookingA._id.toString(),
        activityId: "d1-morning-01",
        locked: true,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("not authorized");
  });

  it("allows authorized owner to lock their private trip", async () => {
    const { token: tokenA, user: userADoc } = await signup(userA);

    const bookingA = await Booking.create({
      user: userADoc.id,
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });

    const res = await request(app)
      .post("/api/ai/activity/lock")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        tripId: bookingA._id.toString(),
        activityId: "d1-morning-01",
        locked: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locked).toBe(true);
  });

  it("allows anonymous trip locking when no user is associated", async () => {
    const booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });

    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        locked: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locked).toBe(true);
    expect(res.body.data.activityId).toBe("d2-afternoon-01");
  });
});

describe("POST /api/ai/activity/lock - Lock and Unlock State Persistence", () => {
  let booking;

  beforeEach(async () => {
    booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });
  });

  it("locks an activity and persists locked: true in MongoDB", async () => {
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-morning-01",
        locked: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locked).toBe(true);
    expect(res.body.data.activity.title).toBe("Morning surf lesson at Morjim Beach");

    const persisted = await Booking.findById(booking._id);
    const plan = JSON.parse(persisted.aiPlan);
    const d2Morning = plan.days[1].activities.find((a) => a.id === "d2-morning-01");
    expect(d2Morning.locked).toBe(true);
  });

  it("unlocks a previously locked activity and persists locked: false in MongoDB", async () => {
    // 1. Lock it
    await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-morning-01",
        locked: true,
      });

    // 2. Unlock it
    const res = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-morning-01",
        locked: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locked).toBe(false);

    const persisted = await Booking.findById(booking._id);
    const plan = JSON.parse(persisted.aiPlan);
    const d2Morning = plan.days[1].activities.find((a) => a.id === "d2-morning-01");
    expect(d2Morning.locked).toBe(false);
  });

  it("handles optimistic concurrency conflict when document version is stale", async () => {
    jest.spyOn(Booking, "findOneAndUpdate").mockResolvedValueOnce(null);

    const { toggleActivityLock } = require("../services/lockService");
    await expect(
      toggleActivityLock({
        tripId: booking._id.toString(),
        activityId: "d1-morning-01",
        locked: true,
        user: null,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Conflict"),
    });
  });
});

describe("POST /api/ai/pivot & Activity Lock Integration", () => {
  let booking;

  beforeEach(async () => {
    booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-04"),
      aiPlan: JSON.stringify(sample3DayPlan),
    });
  });

  it("rejects pivot with HTTP 423 when the targeted activity is locked", async () => {
    // 1. Lock Day 2 Afternoon activity
    const lockRes = await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        locked: true,
      });
    expect(lockRes.status).toBe(200);

    // 2. Attempt to pivot the locked activity using activityId
    const pivotRes = await request(app)
      .post("/api/ai/pivot")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        dayNumber: 2,
        block: "afternoon",
        pivotReason: "rain",
      });

    expect(pivotRes.status).toBe(423);
    expect(pivotRes.body.success).toBe(false);
    expect(pivotRes.body.message).toContain("Cannot pivot a locked activity");

    // Verify Gemini was NOT called
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it("allows pivot to succeed after the activity is unlocked", async () => {
    // 1. Mock Gemini replacement
    const mockGenerateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify({
        replacement: {
          title: "Sunaparanta Centre for the Arts",
          description: "Explore the indoor European-style galleries and enjoy cafe pastries.",
          category: "Culture & Museum",
          indoorOutdoor: "Indoor",
          estimatedDurationMinutes: 120,
          costEstimate: "₹200",
          reason: "Completely indoor and shielded from rain.",
          insiderTip: "Try the cinnamon roll at the cafe courtyard.",
        },
      }),
    });

    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    }));

    // 2. Lock Day 2 Afternoon
    await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        locked: true,
      });

    // 3. Unlock Day 2 Afternoon
    await request(app)
      .post("/api/ai/activity/lock")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        locked: false,
      });

    // 4. Pivot Day 2 Afternoon
    const pivotRes = await request(app)
      .post("/api/ai/pivot")
      .send({
        tripId: booking._id.toString(),
        activityId: "d2-afternoon-01",
        dayNumber: 2,
        block: "afternoon",
        pivotReason: "rain",
      });

    expect(pivotRes.status).toBe(200);
    expect(pivotRes.body.success).toBe(true);
    expect(pivotRes.body.data.replacement.title).toBe("Sunaparanta Centre for the Arts");

    // Verify in MongoDB that structured activity was mutated
    const persisted = await Booking.findById(booking._id);
    const plan = JSON.parse(persisted.aiPlan);
    const d2Aft = plan.days[1].activities.find((a) => a.id === "d2-afternoon-01");
    expect(d2Aft.title).toBe("Sunaparanta Centre for the Arts");
    expect(d2Aft.indoorOutdoor).toBe("Indoor");
  });
});
