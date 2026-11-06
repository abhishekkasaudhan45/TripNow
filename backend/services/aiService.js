// backend/services/aiService.js
const Booking = require("../models/Booking");
const ItineraryCache = require("../models/ItineraryCache");
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
} = require("../utils/itineraryNormalizer");

const AI_GENERATION_TIMEOUT_MS =
  Number(process.env.AI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS) || 60000;

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

/**
 * Resilient Itinerary Validator & Auto-Repairer.
 * Validates the core required fields (destination, non-empty days array).
 * Gracefully auto-repairs missing or incomplete secondary fields
 * (mustEat, budgetBreakdown, travelTips, whereToStay, bestTimeToVisit)
 * so valid itineraries are never discarded due to optional field omissions.
 *
 * @param {object} data - Parsed itinerary object
 * @param {string} [fallbackDestination] - Optional fallback destination string
 * @returns {boolean} - Returns true if valid or successfully repaired, false if fatally invalid
 */
const validateItinerary = (data, fallbackDestination) => {
  if (!data || typeof data !== "object") return false;

  // Primary hard requirements: destination string and valid non-empty days array
  if (typeof data.destination !== "string" || !data.destination.trim()) {
    if (fallbackDestination && typeof fallbackDestination === "string" && fallbackDestination.trim()) {
      data.destination = fallbackDestination;
    } else {
      return false;
    }
  }

  if (!Array.isArray(data.days) || data.days.length === 0) {
    return false;
  }

  // Gracefully auto-fill missing or empty secondary fields in-place with safe neutral representations
  if (!Array.isArray(data.mustEat) || data.mustEat.length === 0) {
    data.mustEat = ["Explore regional specialties and popular local eateries."];
  }

  if (!data.budgetBreakdown || typeof data.budgetBreakdown !== "object") {
    data.budgetBreakdown = {
      accommodation: "Standard stays",
      foodPerDay: "Mid-range dining",
      transport: "Local transit & transit options",
      activities: "Sightseeing and venue entries",
      total: "Estimated total ground spend",
    };
  }

  if (!Array.isArray(data.travelTips) || data.travelTips.length === 0) {
    data.travelTips = [
      "Check local travel advisories and weather forecasts before departure.",
      "Keep digital and offline copies of reservations.",
    ];
  }

  if (!data.whereToStay || typeof data.whereToStay !== "object") {
    data.whereToStay = {
      budget: "Centrally located hostels and guesthouses",
      midRange: "Boutique hotels near city center",
    };
  }

  if (!data.bestTimeToVisit || typeof data.bestTimeToVisit !== "string") {
    data.bestTimeToVisit =
      "Check local seasonal guides for optimal travel weather.";
  }

  return true;
};

/**
 * Backwards-compatible sanitizer returning repaired object or null if fatally invalid.
 */
const sanitizeAndValidateItinerary = (data, fallbackDestination) => {
  const isValid = validateItinerary(data, fallbackDestination);
  return isValid ? data : null;
};

const buildItineraryPrompt = ({ prompt, destination, budget, startDate, endDate, daysCount }) => {
  if (prompt) return prompt;

  const durationNote = daysCount ? ` (${daysCount} Days)` : "";
  const baseDetails = `Destination: ${destination || "Popular Destination"}
Dates: ${startDate || "Upcoming"} to ${endDate || "Flexible"}${durationNote}
Budget: ₹${budget || "Standard"}`;

  return `${baseDetails}

Create a comprehensive day-by-day travel itinerary adhering strictly to the JSON schema.
Ensure each day includes specific morning, afternoon, evening activities, and recommended food places.

CRITICAL CONCISENESS REQUIREMENT:
Keep every activity title concise (under 6 words) and every description crisp and concise (under 18 words).
This ensures all days fit completely without truncation and reduces response latency.

For each day, also provide a structured "activities" array with 3 activities matching the morning, afternoon, and evening slots.
For each activity, provide:
- period: "morning", "afternoon", or "evening"
- title: concise title of the activity
- description: clear concise description of what to experience (under 18 words)
- activityType: exact category from: "sightseeing", "culture", "adventure", "nature", "food", "relaxation", "shopping", "nightlife", "transport", "accommodation", "other"
- durationMinutes: realistic visit duration in minutes at the venue (integer between 15 and 720). Do not include travel time.
- travelMode: recommended transport mode to reach this activity from the previous stop or hotel: "walking", "public_transport", "driving", "taxi", "cycling", "ferry", "flight", "none", or "unknown". Use hotel/accommodation as reference for morning activities. Use "none" if already on-site.
- intensity: physical exertion required: "low", "moderate", or "high" (do not base on cost or excitement).
If any metadata field cannot be determined with confidence, omit it or use null. Always provide mustEat, travelTips, whereToStay, budgetBreakdown, and bestTimeToVisit.`;
};

const normalizeBookingDates = ({ startDate, endDate }) => {
  const today = new Date();
  const parsedCheckin = startDate ? new Date(startDate) : today;
  const checkin = isNaN(parsedCheckin.getTime()) ? today : parsedCheckin;
  const parsedCheckout = endDate ? new Date(endDate) : null;
  const checkoutValid =
    parsedCheckout && !isNaN(parsedCheckout.getTime()) && parsedCheckout > checkin;
  const checkout = checkoutValid ? parsedCheckout : new Date(checkin.getTime() + 86400000);

  const diffTime = Math.abs(checkout.getTime() - checkin.getTime());
  const daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  return { checkin, checkout, daysCount };
};

const buildCacheKey = (destination, daysCount) => {
  const cleanDest = (destination || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  return `itinerary_${cleanDest}_${daysCount}d`;
};

/**
 * Orchestrates AI itinerary generation with caching, validation, and booking persistence.
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
    throw new AIServiceError("AI service configuration error: API key is missing", 500);
  }

  const { checkin, checkout, daysCount } = normalizeBookingDates({ startDate, endDate });
  const cleanDestination = destination || "AI Generated";
  const cacheKey = buildCacheKey(cleanDestination, daysCount);

  // 1. Check Smart Cache first (Instant load in <20ms)
  if (!prompt) {
    try {
      const cached = await ItineraryCache.findOne({ cacheKey }).lean();
      if (cached && validateItinerary(cached.data, cleanDestination)) {
        console.log(`⚡ Cache HIT for [${cacheKey}]. Instant return.`);

        let tripId = null;
        try {
          const savedTrip = await Booking.create({
            user: user?._id || user?.id || null,
            destination: cleanDestination,
            guests: 1,
            checkin,
            checkout,
            budget: budget ? String(budget) : null,
            aiPlan: cached.rawText,
          });
          tripId = savedTrip._id;
        } catch (dbErr) {
          console.error("🗄️ Booking creation error on cache hit:", dbErr.message);
        }

        return { text: cached.rawText, parsed: cached.data, tripId, fromCache: true };
      }
    } catch (cacheErr) {
      console.warn("⚠️ Cache lookup failed, proceeding to Gemini:", cacheErr.message);
    }
  }

  // 2. Call Gemini
  const client = getGeminiClient();
  const finalPrompt = buildItineraryPrompt({
    prompt,
    destination: cleanDestination,
    budget,
    startDate,
    endDate,
    daysCount,
  });

  console.log(`🚀 Requesting itinerary from Gemini model: ${getModelName()}...`);

  const generationConfig = {
    systemInstruction:
      "You are an expert travel planner. Always return complete, valid JSON adhering to the schema. Keep descriptions concise (under 18 words) so all days fit completely without truncation.",
    responseMimeType: "application/json",
    responseSchema: itinerarySchema,
    temperature: 0.4,
    maxOutputTokens: 8192, // Eliminates mid-stream JSON truncations
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
    throw new AIServiceError("AI service returned an empty response.", 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    console.error("❌ JSON Parse Failed. Raw preview:", text.slice(0, 200));
    throw new AIServiceError("AI service returned malformed data.", 502);
  }

  const isValid = validateItinerary(parsed, cleanDestination);
  if (!isValid) {
    throw new AIServiceError("AI service returned an incomplete itinerary structure.", 502);
  }

  console.log("✅ Itinerary successfully validated.");

  // 3. Save to Cache in background
  if (!prompt) {
    ItineraryCache.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        destination: cleanDestination,
        daysCount,
        data: parsed,
        rawText: text,
      },
      { upsert: true, returnDocument: "after" }
    ).catch((err) => console.warn("Cache write warning:", err.message));
  }

  // 4. Save to User Bookings
  let tripId = null;
  try {
    const savedTrip = await Booking.create({
      user: user?._id || user?.id || null,
      destination: cleanDestination,
      guests: 1,
      checkin,
      checkout,
      budget: budget ? String(budget) : null,
      aiPlan: text,
    });
    tripId = savedTrip._id;
  } catch (dbErr) {
    console.error("🗄️ Booking save error:", dbErr.message);
  }

  return { text, parsed, tripId, fromCache: false };
};

module.exports = {
  AIServiceError,
  itinerarySchema,
  validateItinerary,
  sanitizeAndValidateItinerary,
  buildItineraryPrompt,
  normalizeBookingDates,
  generateItinerary,
  classifyGeminiError,
  AI_GENERATION_TIMEOUT_MS,
};
