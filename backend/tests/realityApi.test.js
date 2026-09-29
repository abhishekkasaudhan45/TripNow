// backend/tests/realityApi.test.js
const request = require("supertest");
const app = require("../app");
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
      food: ["Goan Fish Curry"],
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Fort Aguada Exploration",
          description: "Visit 17th-century Portuguese lighthouse and fort",
          category: "Sightseeing",
          durationMinutes: 120,
          cost: "₹100",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d1-afternoon-01",
          period: "afternoon",
          title: "Candolim Lunch & Beach Relax",
          description: "Enjoy fresh seafood and shaded beach beds",
          category: "Dining & Nightlife",
          durationMinutes: 150,
          cost: "₹800",
          indoorOutdoor: "Mixed",
          locked: false,
        },
        {
          id: "d1-evening-01",
          period: "evening",
          title: "Sinquerim Sunset Promenade",
          description: "Relaxing sunset coastal stroll",
          category: "Relaxation",
          durationMinutes: 90,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: true, // Locked anchor
        },
      ],
    },
    {
      day: 2,
      title: "Coastal Adventure",
      morning: "Morning surf lesson at Morjim Beach",
      afternoon: "Parasailing and beach sports at Baga Beach",
      evening: "Dinner and live music at Curlies in Anjuna",
      food: ["Prawn Balchão"],
      activities: [
        {
          id: "d2-morning-01",
          period: "morning",
          title: "Morjim Surf School",
          description: "Beginner surf coaching session",
          category: "Adventure",
          durationMinutes: 120,
          cost: "₹1,500",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d2-afternoon-01",
          period: "afternoon",
          title: "Baga Water Sports",
          description: "High-intensity parasailing and jet-skiing",
          category: "Adventure",
          durationMinutes: 180,
          cost: "₹2,000",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d2-evening-01",
          period: "evening",
          title: "Curlies Beach Dinner",
          description: "Dinner and seaside atmosphere",
          category: "Dining & Nightlife",
          durationMinutes: 120,
          cost: "₹1,200",
          indoorOutdoor: "Mixed",
          locked: false,
        },
      ],
    },
  ],
  budgetBreakdown: {
    accommodation: "₹3,500/night",
    foodPerDay: "₹1,200",
    transport: "₹600",
    activities: "₹10,000",
    total: "₹30,000",
  },
  mustEat: ["Goan Fish Curry"],
  travelTips: ["Rent a scooter"],
};

describe("POST /api/ai/reality-score - Input Validation", () => {
  it("rejects request if tripId is missing", async () => {
    const res = await request(app).post("/api/ai/reality-score").send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects request if tripId is not a 24-character hexadecimal ObjectId", async () => {
    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({ tripId: "invalid-trip-id" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects unrecognized client fields in strict mode", async () => {
    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({
        tripId: "664a78bc9d2e1f4a9c801234",
        clientScore: 99,
        mockBudget: 100000,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/ai/reality-score - Authorization & Ownership", () => {
  it("returns 404 if trip does not exist in MongoDB", async () => {
    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({ tripId: "664a78bc9d2e1f4a9c801234" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Trip not found");
  });

  it("allows anonymous trip reality score evaluation", async () => {
    const booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-03"),
      budget: "30000",
      aiPlan: sample3DayPlan,
    });

    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({ tripId: booking._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.score).toBeLessThanOrEqual(100);
  });

  it("allows authorized trip owner to fetch reality score", async () => {
    const { token, user } = await signup(userA);

    const booking = await Booking.create({
      user: user._id,
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-03"),
      budget: "30000",
      aiPlan: sample3DayPlan,
    });

    const res = await request(app)
      .post("/api/ai/reality-score")
      .set("Authorization", `Bearer ${token}`)
      .send({ tripId: booking._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tripId).toBe(booking._id.toString());
  });

  it("returns 403 Forbidden if another user tries to fetch reality score of a private trip", async () => {
    const { user: userAData } = await signup(userA);
    const { token: userBToken } = await signup(userB);

    const booking = await Booking.create({
      user: userAData.id || userAData._id,
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-03"),
      budget: "30000",
      aiPlan: sample3DayPlan,
    });

    const res = await request(app)
      .post("/api/ai/reality-score")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ tripId: booking._id.toString() });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("not authorized");
  });
});

describe("POST /api/ai/reality-score - Report Output & Calculation", () => {
  it("returns complete structured report conforming to PRD/TRD specs", async () => {
    const booking = await Booking.create({
      destination: "Goa",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-03"),
      budget: "30000",
      aiPlan: sample3DayPlan,
    });

    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({ tripId: booking._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.tripId).toBe(booking._id.toString());
    expect(typeof data.score).toBe("number");
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);

    // Status mapping
    expect(["Excellent", "Good", "Needs Attention", "Risky", "Critical"]).toContain(data.status);
    expect(["excellent", "good", "needs_attention", "risky", "critical"]).toContain(data.statusTier);

    // Sub-scores
    expect(typeof data.subScores.timeFeasibility).toBe("number");
    expect(typeof data.subScores.budgetFeasibility).toBe("number");
    expect(typeof data.subScores.activityLoad).toBe("number");
    expect(typeof data.subScores.travelPace).toBe("number");
    // Stage A: routeEfficiency is null
    expect(data.subScores.routeEfficiency).toBeNull();

    // Metrics
    expect(data.metrics).toBeDefined();
    expect(data.metrics.paceCategory).toBe("Balanced");
    expect(data.metrics.totalKnownActivityCost).toBe(5600); // 100+800+0+1500+2000+1200
    expect(data.metrics.tripBudget).toBe(30000);
    expect(data.metrics.overBudget).toBe(false);
    expect(data.metrics.lockedActivityCount).toBe(1);

    // Issues array
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it("correctly handles legacy string itineraries transparently via normalizer", async () => {
    const legacyPlan = {
      destination: "Paris, France",
      days: [
        {
          day: 1,
          morning: "Eiffel Tower and Champ de Mars walk",
          afternoon: "Louvre Museum highlights tour",
          evening: "Seine River romantic dinner cruise",
        },
      ],
      budgetBreakdown: {
        total: "€2,000",
      },
    };

    const booking = await Booking.create({
      destination: "Paris",
      guests: 2,
      checkin: new Date("2026-10-01"),
      checkout: new Date("2026-10-02"),
      aiPlan: JSON.stringify(legacyPlan),
    });

    const res = await request(app)
      .post("/api/ai/reality-score")
      .send({ tripId: booking._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.subScores.timeFeasibility).toBeDefined();
  });
});
