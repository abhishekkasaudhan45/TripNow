// backend/tests/geminiClientAndAiService.test.js
const {
  getGeminiClient,
  resetGeminiClient,
  getModelName,
  classifyGeminiError,
  cleanMarkdownFences,
  generateContentWithFallback,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
} = require("../services/geminiClient");

const {
  itinerarySchema,
  validateItinerary,
  buildItineraryPrompt,
  normalizeBookingDates,
  generateItinerary,
  AIServiceError,
} = require("../services/aiService");

const env = require("../config/env");
const { GoogleGenAI } = require("@google/genai");

jest.mock("@google/genai", () => {
  const original = jest.requireActual("@google/genai");
  return {
    ...original,
    GoogleGenAI: jest.fn(),
  };
});

describe("Batch 2C — ARCH-07: Centralized Gemini Client (geminiClient.js)", () => {
  const originalKey = env.geminiApiKey;
  const originalModel = env.geminiModel;

  afterEach(() => {
    resetGeminiClient();
    jest.clearAllMocks();
    env.geminiApiKey = originalKey;
    env.geminiModel = originalModel;
  });

  it("initializes a GoogleGenAI client with the configured API key", () => {
    env.geminiApiKey = "test-api-key-123";
    const client = getGeminiClient();

    expect(client).toBeDefined();
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-api-key-123" });
  });

  it("handles missing API key safely by returning null", () => {
    env.geminiApiKey = "";
    const client = getGeminiClient({ apiKey: "" });

    expect(client).toBeNull();
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it("caches the client in production mode (lazy initialization)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      env.geminiApiKey = "prod-key";
      const client1 = getGeminiClient();
      const client2 = getGeminiClient();

      expect(client1).toBe(client2);
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("verifies centralized model configuration (primary: gemini-3.6-flash, fallback: gemini-3.5-flash-lite)", () => {
    expect(DEFAULT_MODEL).toBe("gemini-3.6-flash");
    expect(FALLBACK_MODEL).toBe("gemini-3.5-flash-lite");

    env.geminiModel = "gemini-custom-pro";
    expect(getModelName()).toBe("gemini-custom-pro");

    env.geminiModel = "";
    expect(getModelName()).toBe("gemini-3.6-flash");
  });

  it("cleans markdown fences cleanly from responses", () => {
    expect(cleanMarkdownFences("```json\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
    expect(cleanMarkdownFences("```\n{\"ok\":true}\n```")).toBe("{\"ok\":true}");
    expect(cleanMarkdownFences("   plain text   ")).toBe("plain text");
  });

  it("classifies Gemini provider errors into distinct operational buckets", () => {
    // Auth errors (401, 403, or 400 with API_KEY_INVALID)
    const authErr = classifyGeminiError({ status: 400, message: "API_KEY_INVALID" });
    expect(authErr.bucket).toBe("auth");
    expect(authErr.httpStatus).toBe(502);

    // Model unavailable (404)
    const modelErr = classifyGeminiError({ status: 404, message: "models/gemini-old is not found" });
    expect(modelErr.bucket).toBe("model_unavailable");
    expect(modelErr.httpStatus).toBe(502);

    // Rate limit (429)
    const rateErr = classifyGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED" });
    expect(rateErr.bucket).toBe("rate_limited");
    expect(rateErr.httpStatus).toBe(429);

    // Timeout (504, AbortError, or ETIMEDOUT)
    const timeoutErr = classifyGeminiError({ name: "AbortError", message: "timed out" });
    expect(timeoutErr.bucket).toBe("timeout");
    expect(timeoutErr.httpStatus).toBe(504);

    // Upstream overloaded (500 or 503)
    const upstreamErr = classifyGeminiError({ status: 503, message: "model is overloaded" });
    expect(upstreamErr.bucket).toBe("upstream_unavailable");
    expect(upstreamErr.httpStatus).toBe(503);

    // Unclassified fallback
    const genericErr = classifyGeminiError({ status: 502, message: "Something strange" });
    expect(genericErr.bucket).toBe("unclassified");
    expect(genericErr.httpStatus).toBe(502);
  });

  it("executes primary-to-fallback order (gemini-3.5-flash-lite) on deprecation failure", async () => {
    const mockGenerateContent = jest
      .fn()
      .mockRejectedValueOnce({
        status: 404,
        message: "Model 'gemini-2.5-flash' is no longer available to new users",
      })
      .mockResolvedValueOnce({ text: "{\"fallback\": true}" });

    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    };

    const mockLogger = { warn: jest.fn() };

    const result = await generateContentWithFallback({
      client: mockClient,
      model: "gemini-2.5-flash",
      contents: "Test prompt",
      config: {},
      logger: mockLogger,
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-2.5-flash" })
    );
    expect(mockGenerateContent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-3.5-flash-lite" })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Falling back to Google AI Studio recommended 'gemini-3.5-flash-lite'")
    );
    expect(result.text).toBe("{\"fallback\": true}");
  });

  it("does not attempt fallback when primary model succeeds", async () => {
    const mockGenerateContent = jest.fn().mockResolvedValueOnce({ text: "{\"success\": true}" });
    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    };

    const result = await generateContentWithFallback({
      client: mockClient,
      model: "gemini-3.6-flash",
      contents: "Test prompt",
      config: {},
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.6-flash" })
    );
    expect(result.text).toBe("{\"success\": true}");
  });

  it("does not attempt fallback on non-deprecation errors and immediately propagates error", async () => {
    const mockGenerateContent = jest.fn().mockRejectedValueOnce({
      status: 429,
      message: "Resource exhausted",
    });
    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    };

    await expect(
      generateContentWithFallback({
        client: mockClient,
        model: "gemini-3.6-flash",
        contents: "Test prompt",
        config: {},
      })
    ).rejects.toMatchObject({ status: 429 });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("propagates error correctly when both primary and fallback models fail", async () => {
    const mockGenerateContent = jest
      .fn()
      .mockRejectedValueOnce({
        status: 404,
        message: "Model is no longer available to new users",
      })
      .mockRejectedValueOnce({
        status: 503,
        message: "Fallback service unavailable",
      });

    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    };

    await expect(
      generateContentWithFallback({
        client: mockClient,
        model: "gemini-2.5-flash",
        contents: "Test prompt",
        config: {},
        logger: { warn: jest.fn() },
      })
    ).rejects.toMatchObject({ status: 503 });

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockGenerateContent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-2.5-flash" })
    );
    expect(mockGenerateContent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-3.5-flash-lite" })
    );
  });

  it("enforces timeout on slow Gemini upstream calls", async () => {
    jest.useFakeTimers();

    const mockClient = {
      models: {
        generateContent: jest.fn(() => new Promise(() => {})), // never resolves
      },
    };

    const callPromise = generateContentWithFallback({
      client: mockClient,
      model: "gemini-3.6-flash",
      contents: "Test",
      config: {},
      timeoutMs: 3000,
    });

    // Advance fake timers past 3000ms
    jest.advanceTimersByTime(3500);

    await expect(callPromise).rejects.toMatchObject({
      name: "AbortError",
      status: 504,
      message: "AI service request timed out",
    });

    jest.useRealTimers();
  });
});

describe("Batch 2C — ARCH-06: AI Service Extraction (aiService.js)", () => {
  it("orchestrates prompts accurately with given destination, dates, and budget", () => {
    const prompt = buildItineraryPrompt({
      destination: "Rome",
      budget: "25000",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(prompt).toContain("Destination: Rome");
    expect(prompt).toContain("Budget: ₹25000");
    expect(prompt).toContain("Dates: 2026-09-01 to 2026-09-05");
    expect(prompt).toContain("Create a comprehensive day-by-day travel itinerary");
  });

  it("passes custom prompts through unmodified when provided", () => {
    const custom = "Custom specialized itinerary for high altitude trekking";
    expect(buildItineraryPrompt({ prompt: custom })).toBe(custom);
  });

  it("normalizes booking dates guaranteeing checkout > checkin", () => {
    // Valid dates
    const res1 = normalizeBookingDates({
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });
    expect(res1.checkout.getTime()).toBeGreaterThan(res1.checkin.getTime());

    // Reversed dates (checkout before checkin)
    const res2 = normalizeBookingDates({
      startDate: "2026-09-10",
      endDate: "2026-09-05",
    });
    expect(res2.checkout.getTime()).toBeGreaterThan(res2.checkin.getTime());

    // Missing end date
    const res3 = normalizeBookingDates({
      startDate: "2026-09-10",
    });
    expect(res3.checkout.getTime()).toBeGreaterThan(res3.checkin.getTime());
  });

  it("validates valid itinerary structures and rejects invalid ones", () => {
    const valid = {
      destination: "Paris",
      days: [{ day: 1, title: "Day 1", morning: "Louvre", afternoon: "Eiffel", evening: "Seine", food: ["Croissant"] }],
      mustEat: ["Baguette"],
      budgetBreakdown: { accommodation: "100", foodPerDay: "50", transport: "20", activities: "30", total: "200" },
      travelTips: ["Metro pass"],
      whereToStay: { budget: "Hostel", midRange: "Hotel" },
      bestTimeToVisit: "Spring",
    };

    expect(validateItinerary(valid)).toBe(true);

    // Missing destination
    expect(validateItinerary({ ...valid, destination: "" })).toBe(false);

    // Empty days
    expect(validateItinerary({ ...valid, days: [] })).toBe(false);

    // Missing budget breakdown
    expect(validateItinerary({ ...valid, budgetBreakdown: null })).toBe(false);

    // Not an object
    expect(validateItinerary(null)).toBe(false);
  });

  it("throws AIServiceError with 500 when API key is missing", async () => {
    const original = env.geminiApiKey;
    env.geminiApiKey = "";

    try {
      await expect(
        generateItinerary({ destination: "Madrid" })
      ).rejects.toThrow("AI service configuration error: API key is missing");
    } finally {
      env.geminiApiKey = original;
    }
  });
});

