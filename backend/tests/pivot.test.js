// backend/tests/pivot.test.js
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

const createTestBooking = async (plan = sample3DayPlan, ownerUser = null) => {
  const userId = ownerUser ? (ownerUser._id || ownerUser.id) : null;
  return await Booking.create({
    user: userId,
    destination: "Goa, India",
    guests: 2,
    checkin: new Date("2026-11-01"),
    checkout: new Date("2026-11-04"),
    budget: "25000",
    aiPlan: JSON.stringify(plan),
  });
};

const makeMockCandidate = (overrides = {}) => ({
  title: "Goa State Museum & Cultural Gallery",
  description: "Explore traditional Goan art, bronze sculptures, and historic artifacts inside the sheltered state museum.",
  category: "Culture & Museum",
  indoorOutdoor: "Indoor",
  estimatedDurationMinutes: 120,
  costEstimate: "₹100 per person",
  reason: "Completely indoor and weather-resilient, ideal during heavy rainfall.",
  insiderTip: "Carry ID proof for entry at the reception desk.",
  ...overrides,
});

describe("POST /api/ai/pivot - Input Validation", () => {
  it("rejects request if tripId is missing", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects request if tripId is not a valid 24-char ObjectId", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "invalid-id-123",
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.tripId).toBeDefined();
  });

  it("rejects request if dayNumber is invalid or missing", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 0,
      block: "afternoon",
      pivotReason: "rain",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.dayNumber).toBeDefined();
  });

  it("rejects request if block is unsupported", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 2,
      block: "midnight",
      pivotReason: "rain",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.block).toBeDefined();
    expect(res.body.errors?.block).toContain("morning");
  });

  it("rejects request if pivotReason is unsupported", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "bored",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.pivotReason).toBeDefined();
    expect(res.body.errors?.pivotReason).toContain("rain");
  });

  it("rejects custom pivot reason when customReason is missing or empty", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "custom",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.customReason).toBeDefined();
  });

  it("rejects client attempts to pass authoritative fields like destination or budget", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
      destination: "Client Overridden Destination",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/ai/pivot - Authorization & Ownership", () => {
  it("returns 404 if tripId does not exist in MongoDB", async () => {
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: "507f1f77bcf86cd799439011",
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });
    expect(res.status).toBe(404);
    expect(res.body.message).toContain("Trip not found");
  });

  it("returns 404 if dayNumber is beyond the trip itinerary days", async () => {
    const booking = await createTestBooking();
    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 99,
      block: "afternoon",
      pivotReason: "rain",
    });
    expect(res.status).toBe(404);
    expect(res.body.message).toContain("Day 99 not found in trip itinerary");
  });

  it("returns 403 when User B tries to pivot a trip owned by User A", async () => {
    const { user: owner } = await signup(userA);
    const { token: intruderToken } = await signup(userB);

    const booking = await createTestBooking(sample3DayPlan, owner);

    const res = await request(app)
      .post("/api/ai/pivot")
      .set("Authorization", `Bearer ${intruderToken}`)
      .send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        block: "afternoon",
        pivotReason: "rain",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("You are not authorized to modify this trip");
  });

  it("allows authorized owner to pivot their private trip", async () => {
    const { token: ownerToken, user: owner } = await signup(userA);
    const booking = await createTestBooking(sample3DayPlan, owner);

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: makeMockCandidate() }),
        }),
      },
    }));

    const res = await request(app)
      .post("/api/ai/pivot")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        tripId: booking._id.toString(),
        dayNumber: 2,
        block: "afternoon",
        pivotReason: "rain",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /api/ai/pivot - Core Pivot Reasons (Success Flows)", () => {
  let booking;

  beforeEach(async () => {
    booking = await createTestBooking();
  });

  it("successfully adapts block for reason: rain", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: makeMockCandidate({ indoorOutdoor: "Indoor" }) }),
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
    expect(res.body.data.pivotReason).toBe("rain");
    expect(res.body.data.replacement.indoorOutdoor).toBe("Indoor");
  });

  it("successfully adapts block for reason: low_energy", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Ayurvedic Spa & Herbal Tea Tasting",
              estimatedDurationMinutes: 90,
              indoorOutdoor: "Indoor",
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "low_energy",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.title).toBe("Ayurvedic Spa & Herbal Tea Tasting");
  });

  it("successfully adapts block for reason: budget", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Free Walking Tour of Fontainhas Latin Quarter",
              costEstimate: "Free / ₹0",
              indoorOutdoor: "Mixed",
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "budget",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.costEstimate).toBe("Free / ₹0");
  });

  it("successfully adapts block for reason: running_late", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Quick Viewpoint Stop at Reis Magos",
              estimatedDurationMinutes: 45,
              indoorOutdoor: "Mixed",
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "running_late",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.estimatedDurationMinutes).toBe(45);
  });

  it("successfully adapts block for reason: closed", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Houses of Goa Architecture Museum",
              indoorOutdoor: "Indoor",
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "closed",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.title).toBe("Houses of Goa Architecture Museum");
  });

  it("successfully adapts block for reason: custom", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: makeMockCandidate({
              title: "Air-Conditioned Indoor Cooking Masterclass",
              indoorOutdoor: "Indoor",
            }),
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "custom",
      customReason: "Too hot outside, need strong AC",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.replacement.title).toBe("Air-Conditioned Indoor Cooking Masterclass");
  });
});

describe("POST /api/ai/pivot - Defensive Semantic Validation & Single Retry", () => {
  let booking;

  beforeEach(async () => {
    booking = await createTestBooking();
  });

  it("triggers defensive retry when rain candidate is incorrectly Outdoor, and succeeds when retry returns Indoor", async () => {
    const outdoorCandidate = makeMockCandidate({
      title: "Beach volleyball at Calangute",
      indoorOutdoor: "Outdoor",
    });

    const indoorCandidate = makeMockCandidate({
      title: "Indoor Cultural Art Center",
      indoorOutdoor: "Indoor",
    });

    const mockGenerate = jest
      .fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ replacement: outdoorCandidate }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ replacement: indoorCandidate }) });

    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerate },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(2); // Attempt 1 + Exactly 1 Retry
    expect(res.body.data.replacement.title).toBe("Indoor Cultural Art Center");
    expect(res.body.data.replacement.indoorOutdoor).toBe("Indoor");
  });

  it("fails cleanly with 502 when defensive retry also violates semantic constraint, and does NOT save invalid state", async () => {
    const outdoorCandidate1 = makeMockCandidate({
      title: "Surfing at Baga",
      indoorOutdoor: "Outdoor",
    });

    const outdoorCandidate2 = makeMockCandidate({
      title: "Jet skiing at Anjuna",
      indoorOutdoor: "Outdoor",
    });

    const mockGenerate = jest
      .fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ replacement: outdoorCandidate1 }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ replacement: outdoorCandidate2 }) });

    GoogleGenAI.mockImplementation(() => ({
      models: { generateContent: mockGenerate },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Unable to find a suitable replacement right now");
    expect(mockGenerate).toHaveBeenCalledTimes(2); // Only 1 retry attempted

    // Database verification: original afternoon activity MUST remain untouched
    const freshBooking = await Booking.findById(booking._id);
    const plan = JSON.parse(freshBooking.aiPlan);
    expect(plan.days[1].afternoon).toBe("Parasailing and beach sports at Baga Beach");
  });
});

describe("POST /api/ai/pivot - Surgical Mutation & Data Integrity", () => {
  it("modifies ONLY the selected block; leaves all other days and blocks bit-for-bit identical", async () => {
    const booking = await createTestBooking();

    const replacementCandidate = makeMockCandidate({
      title: "Sunaparanta Centre for the Arts",
      description: "Non-profit arts center with covered galleries and European courtyard cafe.",
    });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ replacement: replacementCandidate }),
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

    // Fetch updated trip directly from MongoDB
    const persisted = await Booking.findById(booking._id);
    const updatedPlan = JSON.parse(persisted.aiPlan);

    // 1. Target block MUST be mutated
    expect(updatedPlan.days[1].afternoon).toContain("Sunaparanta Centre for the Arts");

    // 2. Day 1 MUST be completely identical
    expect(updatedPlan.days[0].morning).toBe(sample3DayPlan.days[0].morning);
    expect(updatedPlan.days[0].afternoon).toBe(sample3DayPlan.days[0].afternoon);
    expect(updatedPlan.days[0].evening).toBe(sample3DayPlan.days[0].evening);
    expect(updatedPlan.days[0].food).toEqual(sample3DayPlan.days[0].food);

    // 3. Day 2 neighbor blocks MUST be completely identical
    expect(updatedPlan.days[1].morning).toBe(sample3DayPlan.days[1].morning);
    expect(updatedPlan.days[1].evening).toBe(sample3DayPlan.days[1].evening);
    expect(updatedPlan.days[1].food).toEqual(sample3DayPlan.days[1].food);

    // 4. Day 3 MUST be completely identical
    expect(updatedPlan.days[2].morning).toBe(sample3DayPlan.days[2].morning);
    expect(updatedPlan.days[2].afternoon).toBe(sample3DayPlan.days[2].afternoon);
    expect(updatedPlan.days[2].evening).toBe(sample3DayPlan.days[2].evening);

    // 5. Budget, MustEat, and Metadata MUST be completely identical
    expect(updatedPlan.budgetBreakdown).toEqual(sample3DayPlan.budgetBreakdown);
    expect(updatedPlan.mustEat).toEqual(sample3DayPlan.mustEat);
    expect(updatedPlan.travelTips).toEqual(sample3DayPlan.travelTips);
  });
});

describe("POST /api/ai/pivot - Upstream Error Handling & Concurrency", () => {
  let booking;

  beforeEach(async () => {
    booking = await createTestBooking();
  });

  it("returns 429 when Gemini rate limit is exhausted", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockRejectedValue({
          status: 429,
          message: "Resource has been exhausted (e.g. check quota).",
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(429);
    expect(res.body.message).toContain("rate limit reached");
  });

  it("returns 504 when Gemini call times out", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              const err = new Error("Connection timed out");
              err.status = 504;
              err.name = "AbortError";
              reject(err);
            })
        ),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(504);
    expect(res.body.message).toContain("timed out");
  });

  it("returns 502 when Gemini returns malformed non-JSON", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: "I cannot assist with this request right now.",
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(502);
    expect(res.body.message).toContain("malformed");
  });

  it("returns 409 Conflict when concurrent stale mutation version occurs", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockImplementation(async () => {
          // Simulate a concurrent request sneaking in while Gemini was generating:
          // increment __v in MongoDB
          await Booking.findByIdAndUpdate(booking._id, { $inc: { __v: 1 } });
          return { text: JSON.stringify({ replacement: makeMockCandidate() }) };
        }),
      },
    }));

    const res = await request(app).post("/api/ai/pivot").send({
      tripId: booking._id.toString(),
      dayNumber: 2,
      block: "afternoon",
      pivotReason: "rain",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Conflict");
  });
});
