// backend/services/aiService.js
const Booking = require("../models/Booking");
const env = require("../config/env");
const {
  Type,
  getGeminiClient,
  getModelName,
  cleanMarkdownFences,
  classifyGeminiError,
  generateContentWithFallback,
} = require("./geminiClient");
const {
  ALLOWED_ACTIVITY_TYPES,
  ALLOWED_TRAVEL_MODES,
  ALLOWED_INTENSITIES,
  normalizeItinerary,
} = require("../utils/itineraryNormalizer");

const AI_GENERATION_TIMEOUT_MS = 25000;

class AIServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "AIServiceError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = true;
  }
}

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
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                period: {
                  type: Type.STRING,
                  enum: ["morning", "afternoon", "evening"],
                },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                activityType: {
                  type: Type.STRING,
                  enum: ALLOWED_ACTIVITY_TYPES,
                },
                durationMinutes: { type: Type.INTEGER },
                travelMode: {
                  type: Type.STRING,
                  enum: ALLOWED_TRAVEL_MODES,
                },
                intensity: {
                  type: Type.STRING,
                  enum: ALLOWED_INTENSITIES,
                },
              },
              required: ["period", "title", "description"],
            },
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

const buildItineraryPrompt = ({ prompt, destination, budget, startDate, endDate }) => {
  if (prompt) return prompt;

  const baseDetails = `Destination: ${destination}
Dates: ${startDate || "Upcoming"} to ${endDate || "Flexible"}
Budget: ₹${budget || "Standard"}`;

  return `${baseDetails}

Create a comprehensive day-by-day travel itinerary adhering to the JSON schema.
Ensure each day includes specific morning, afternoon, evening activities, and recommended food places.

For each day, also provide a structured "activities" array with 3 activities matching the morning, afternoon, and evening slots.
For each activity, provide:
- period: "morning", "afternoon", or "evening"
- title: concise title of the activity
- description: clear description of what to experience
- activityType: exact category from: "sightseeing", "culture", "adventure", "nature", "food", "relaxation", "shopping", "nightlife", "transport", "accommodation", "other"
- durationMinutes: realistic visit duration in minutes at the venue (integer between 15 and 720). Do not include travel time.
- travelMode: recommended transport mode to reach this activity from the previous stop or hotel: "walking", "public_transport", "driving", "taxi", "cycling", "ferry", "flight", "none", or "unknown". Use hotel/accommodation as reference for morning activities. Use "none" if already on-site.
- intensity: physical exertion required: "low", "moderate", or "high" (do not base on cost or excitement).
If any metadata field cannot be determined with confidence, omit it or use null.`;
};

const normalizeBookingDates = ({ startDate, endDate }) => {
  const today = new Date();
  const parsedCheckin = startDate ? new Date(startDate) : today;
  const checkin = isNaN(parsedCheckin.getTime()) ? today : parsedCheckin;
  const parsedCheckout = endDate ? new Date(endDate) : null;
  const checkoutValid =
    parsedCheckout && !isNaN(parsedCheckout.getTime()) && parsedCheckout > checkin;
  const checkout = checkoutValid ? parsedCheckout : new Date(checkin.getTime() + 86400000);

  return { checkin, checkout };
};

/**
 * Orchestrates AI itinerary generation with Gemini, validates structure, and persists booking.
 */
const generateItinerary = async ({
  prompt,
  destination,
  budget,
  startDate,
  endDate,
  user,
}) => {
  if (!env.geminiApiKey) {
    console.error("🔒 AI Service Error: GEMINI_API_KEY is not set.");
    throw new AIServiceError("AI service configuration error: API key is missing", 500);
  }

  const client = getGeminiClient();
  const finalPrompt = buildItineraryPrompt({ prompt, destination, budget, startDate, endDate });

  console.log(`🚀 Calling Google Gemini API with model: ${getModelName()}...`);

  const generationConfig = {
    systemInstruction:
      "You are an expert travel planner. Always respond with a valid JSON itinerary adhering strictly to the response schema. Never return markdown backticks or commentary.",
    responseMimeType: "application/json",
    responseSchema: itinerarySchema,
    temperature: 0.7,
  };

  const response = await generateContentWithFallback({
    client,
    model: getModelName(),
    contents: finalPrompt,
    config: generationConfig,
    timeoutMs: AI_GENERATION_TIMEOUT_MS,
  });

  let text = cleanMarkdownFences(response?.text || "");

  if (!text) {
    console.error("🔒 AI Controller Error: Gemini returned empty content.");
    throw new AIServiceError("AI service returned an empty response.", 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    console.error("🔒 AI Controller Error: Failed to parse Gemini response as JSON:", parseErr.message);
    throw new AIServiceError("AI service returned malformed data.", 502);
  }

  if (!validateItinerary(parsed)) {
    console.error("🔒 AI Controller Error: Missing required itinerary fields in response.");
    throw new AIServiceError("AI service returned an incomplete itinerary structure.", 502);
  }

  console.log("✅ Google Gemini responded and validated successfully");

  const { checkin, checkout } = normalizeBookingDates({ startDate, endDate });

  let tripId = null;
  try {
    const savedTrip = await Booking.create({
      user: user?._id || null,
      destination: destination || parsed.destination || "AI Generated",
      guests: 1,
      checkin,
      checkout,
      budget: budget ? String(budget) : null,
      aiPlan: text,
    });
    tripId = savedTrip._id;
  } catch (dbErr) {
    console.error("🗄️ AI Controller DB Error: itinerary generated but failed to persist:", {
      name: dbErr.name,
      code: dbErr.code,
      message: dbErr.message,
    });
  }

  return { text, parsed, tripId };
};

module.exports = {
  AIServiceError,
  itinerarySchema,
  validateItinerary,
  buildItineraryPrompt,
  normalizeBookingDates,
  generateItinerary,
  classifyGeminiError,
  AI_GENERATION_TIMEOUT_MS,
};
