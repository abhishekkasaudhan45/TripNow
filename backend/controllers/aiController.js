// backend/controllers/aiController.js
const { GoogleGenAI, Type } = require("@google/genai");
const Booking = require("../models/Booking");
const env = require("../config/env");

const itinerarySchema = {
  type: Type.OBJECT,
  properties: {
    destination: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          title: { type: Type.STRING },
          morning: { type: Type.STRING },
          afternoon: { type: Type.STRING },
          evening: { type: Type.STRING },
          food: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["day", "title", "morning", "afternoon", "evening", "food"],
      },
    },
    mustEat: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    budgetBreakdown: {
      type: Type.OBJECT,
      properties: {
        accommodation: { type: Type.STRING },
        foodPerDay: { type: Type.STRING },
        transport: { type: Type.STRING },
        activities: { type: Type.STRING },
        total: { type: Type.STRING },
      },
      required: ["accommodation", "foodPerDay", "transport", "activities", "total"],
    },
    travelTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    whereToStay: {
      type: Type.OBJECT,
      properties: {
        budget: { type: Type.STRING },
        midRange: { type: Type.STRING },
      },
      required: ["budget", "midRange"],
    },
    bestTimeToVisit: { type: Type.STRING },
  },
  required: [
    "destination",
    "days",
    "mustEat",
    "budgetBreakdown",
    "travelTips",
    "whereToStay",
    "bestTimeToVisit",
  ],
};

const validateItinerary = (data) => {
  if (!data || typeof data !== "object") return false;
  if (!data.destination || typeof data.destination !== "string") return false;
  if (!Array.isArray(data.days) || data.days.length === 0) return false;
  if (!Array.isArray(data.mustEat)) return false;
  if (!data.budgetBreakdown || typeof data.budgetBreakdown !== "object") return false;
  if (!Array.isArray(data.travelTips)) return false;
  if (!data.whereToStay || typeof data.whereToStay !== "object") return false;
  if (!data.bestTimeToVisit || typeof data.bestTimeToVisit !== "string") return false;
  return true;
};

const handleGeminiError = (error, res) => {
  const status = error.status || error.statusCode || error.code;
  const rawMsg = error.message || "";
  let errorDetail = "";
  try {
    const parsed = typeof rawMsg === "string" && rawMsg.trim().startsWith("{") ? JSON.parse(rawMsg) : null;
    errorDetail = parsed?.error?.message || rawMsg;
  } catch {
    errorDetail = rawMsg;
  }

  // 🪵 Server-side logging only for Render console and debugging — NEVER leak to client
  console.error("🔒 AI Controller Internal Error:", {
    status,
    message: errorDetail,
    name: error.name,
  });

  const isAuthError =
    status === 401 ||
    status === 403 ||
    (status === 400 && (errorDetail.includes("API key not valid") || errorDetail.includes("API_KEY_INVALID"))) ||
    errorDetail.includes("API_KEY_INVALID");

  if (isAuthError) {
    return res.status(502).json({
      success: false,
      message: "AI service authentication failed: Invalid or unauthorized API key",
    });
  }

  const isModelUnavailable =
    status === 404 ||
    errorDetail.includes("models/") ||
    errorDetail.includes("not found") ||
    errorDetail.includes("is not supported") ||
    errorDetail.includes("NOT_FOUND");

  if (isModelUnavailable) {
    return res.status(502).json({
      success: false,
      message: "AI service model configuration error: Configured model is unavailable",
    });
  }

  const isRateLimited =
    status === 429 ||
    errorDetail.includes("RESOURCE_EXHAUSTED") ||
    errorDetail.includes("Quota exceeded") ||
    errorDetail.includes("rate limit");

  if (isRateLimited) {
    return res.status(429).json({
      success: false,
      message: "AI service rate limit reached. Please try again in a few moments.",
    });
  }

  const isTimeout =
    status === 504 ||
    error.name === "AbortError" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNABORTED" ||
    error.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error.cause?.name === "ConnectTimeoutError" ||
    errorDetail.toLowerCase().includes("timeout") ||
    errorDetail.toLowerCase().includes("timed out") ||
    errorDetail.toLowerCase().includes("fetch failed");

  if (isTimeout) {
    return res.status(504).json({
      success: false,
      message: "AI service request timed out. Please try again.",
    });
  }

  return res.status(502).json({
    success: false,
    message: "AI service error: Unable to generate itinerary at this time. Please try again.",
  });
};

const generateAITrip = async (req, res) => {
  try {
    const { prompt, destination, budget, startDate, endDate } = req.body;

    if (!destination && !prompt) {
      return res.status(400).json({ success: false, message: "Trip details are required" });
    }

    if (!env.geminiApiKey) {
      console.error("🔒 AI Controller Error: GEMINI_API_KEY is not set.");
      return res.status(500).json({
        success: false,
        message: "AI service configuration error: API key is missing",
      });
    }

    const finalPrompt = prompt || `
Destination: ${destination}
Dates: ${startDate || "Upcoming"} to ${endDate || "Flexible"}
Budget: ₹${budget || "Standard"}

Create a comprehensive day-by-day travel itinerary adhering to the JSON schema.
Ensure each day includes specific morning, afternoon, evening activities, and recommended food places.
`;

    console.log(`🚀 Calling Google Gemini API with model: ${env.geminiModel}...`);

    const ai = new GoogleGenAI({
      apiKey: env.geminiApiKey,
    });

    let response;
    let usedModel = env.geminiModel;

    try {
      response = await ai.models.generateContent({
        model: usedModel,
        contents: finalPrompt,
        config: {
          systemInstruction: "You are an expert travel planner. Always respond with a valid JSON itinerary adhering strictly to the response schema. Never return markdown backticks or commentary.",
          responseMimeType: "application/json",
          responseSchema: itinerarySchema,
          temperature: 0.7,
        },
      });
    } catch (primaryErr) {
      const msg = primaryErr.message || "";
      const isNewUserDeprecation =
        primaryErr.status === 404 &&
        msg.toLowerCase().includes("no longer available to new users");

      if (isNewUserDeprecation) {
        const fallbackModel = "gemini-3.6-flash";
        console.warn(`⚠️ Model '${usedModel}' is no longer available to new users. Falling back to Google AI Studio recommended '${fallbackModel}'...`);
        usedModel = fallbackModel;
        response = await ai.models.generateContent({
          model: usedModel,
          contents: finalPrompt,
          config: {
            systemInstruction: "You are an expert travel planner. Always respond with a valid JSON itinerary adhering strictly to the response schema. Never return markdown backticks or commentary.",
            responseMimeType: "application/json",
            responseSchema: itinerarySchema,
            temperature: 0.7,
          },
        });
      } else {
        throw primaryErr;
      }
    }

    let text = response.text || "";
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!text) {
      console.error("🔒 AI Controller Error: Gemini returned empty content.");
      return res.status(502).json({
        success: false,
        message: "AI service returned an empty response.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error("🔒 AI Controller Error: Failed to parse Gemini response as JSON:", parseErr.message);
      return res.status(502).json({
        success: false,
        message: "AI service returned malformed data.",
      });
    }

    if (!validateItinerary(parsed)) {
      console.error("🔒 AI Controller Error: Missing required itinerary fields in response.");
      return res.status(502).json({
        success: false,
        message: "AI service returned an incomplete itinerary structure.",
      });
    }

    console.log("✅ Google Gemini responded and validated successfully");

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const savedTrip = await Booking.create({
      user: req.user?._id || null,
      destination: destination || parsed.destination || "AI Generated",
      guests: 1,
      checkin: startDate ? new Date(startDate) : today,
      checkout: endDate ? new Date(endDate) : tomorrow,
      budget: budget ? String(budget) : null,
      aiPlan: text,
    });

    return res.json({ success: true, data: text, tripId: savedTrip._id });
  } catch (error) {
    return handleGeminiError(error, res);
  }
};

module.exports = {
  generateAITrip,
  validateItinerary,
  itinerarySchema,
  handleGeminiError,
};