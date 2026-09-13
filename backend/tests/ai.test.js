// backend/tests/ai.test.js
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

const sampleItinerary = {
  destination: "Goa",
  days: [
    {
      day: 1,
      title: "Beach Exploration",
      morning: "Visit Calangute Beach",
      afternoon: "Lunch at Curlies and water sports",
      evening: "Sunset walk at Anjuna Beach",
      food: ["Goan Fish Curry at Fisherman's Wharf", "Bebinca at local bakery"],
    },
  ],
  mustEat: ["Goan Prawn Balchão", "Pork Vindaloo"],
  budgetBreakdown: {
    accommodation: "₹4,000 per night",
    foodPerDay: "₹1,500",
    transport: "₹800",
    activities: "₹1,200",
    total: "₹20,000",
  },
  travelTips: ["Rent a scooter for easy travel", "Keep cash handy for beach shacks"],
  whereToStay: {
    budget: "Zostel Goa",
    midRange: "Fairfield by Marriott",
  },
  bestTimeToVisit: "November to February for pleasant weather",
};

describe("POST /api/ai - Google Gemini Integration", () => {
  it("rejects request if destination and prompt are missing", async () => {
    const res = await request(app).post("/api/ai").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 if GEMINI_API_KEY is missing", async () => {
    const originalKey = env.geminiApiKey;
    env.geminiApiKey = "";

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("AI service configuration error: API key is missing");

    env.geminiApiKey = originalKey;
  });

  it("returns 502 with clean error message when API key is invalid or unauthorized", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockRejectedValue({
          status: 400,
          name: "ApiError",
          message: JSON.stringify({
            error: {
              code: 400,
              message: "API key not valid. Please pass a valid API key.",
              status: "INVALID_ARGUMENT",
              details: [{ reason: "API_KEY_INVALID" }],
            },
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("AI service authentication failed");
    expect(res.body.message).not.toContain("API_KEY_INVALID");
  });

  it("returns 502 when Gemini model is unavailable or not found", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockRejectedValue({
          status: 404,
          name: "ApiError",
          message: JSON.stringify({
            error: {
              code: 404,
              message: "models/gemini-3.8-flash is not found for API version v1beta",
              status: "NOT_FOUND",
            },
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "AI service model configuration error: Configured model is unavailable"
    );
  });

  it("returns 429 when rate limit is exceeded", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockRejectedValue({
          status: 429,
          name: "ApiError",
          message: JSON.stringify({
            error: {
              code: 429,
              message: "Resource has been exhausted (e.g. check quota).",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "AI service rate limit reached. Please try again in a few moments."
    );
  });

  it("returns 504 on request timeout", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockRejectedValue({
          name: "AbortError",
          code: "ETIMEDOUT",
          message: "The operation was aborted due to timeout",
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("AI service request timed out. Please try again.");
  });

  it("returns 502 when Gemini returns empty or malformed non-JSON output", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: "I cannot plan this trip for you.",
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("AI service returned malformed data.");
  });

  it("returns 502 when Gemini returns JSON missing required itinerary fields", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({ destination: "Goa", days: [] }),
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("AI service returned an incomplete itinerary structure.");
  });

  it("successfully generates itinerary, preserves frontend contract, and persists in MongoDB", async () => {
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify(sampleItinerary),
        }),
      },
    }));

    const res = await request(app).post("/api/ai").send({
      destination: "Goa",
      budget: "20000",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBe(JSON.stringify(sampleItinerary));
    expect(res.body.tripId).toBeDefined();

    // Verify MongoDB persistence
    const savedBooking = await Booking.findById(res.body.tripId);
    expect(savedBooking).not.toBeNull();
    expect(savedBooking.destination).toBe("Goa");
    expect(savedBooking.budget).toBe("20000");
    expect(savedBooking.aiPlan).toBe(JSON.stringify(sampleItinerary));
  });

  it("falls back to gemini-3.6-flash ONLY when model returns the specific 'no longer available to new users' error", async () => {
    const origModel = env.geminiModel;
    env.geminiModel = "gemini-2.5-flash";

    const generateContentMock = jest
      .fn()
      .mockRejectedValueOnce({
        status: 404,
        name: "ApiError",
        message:
          '{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements.","status":"NOT_FOUND"}}',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(sampleItinerary),
      });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: generateContentMock,
      },
    }));

    const res = await request(app).post("/api/ai").send({ destination: "Goa" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(generateContentMock.mock.calls[0][0].model).toBe("gemini-2.5-flash");
    expect(generateContentMock.mock.calls[1][0].model).toBe("gemini-3.6-flash");

    env.geminiModel = origModel;
  });
});

