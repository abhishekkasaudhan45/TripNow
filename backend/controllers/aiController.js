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

// Classifies an error thrown while talking to Gemini into a stable bucket so the
// server logs make the failure mode obvious (auth / model / rate limit / timeout /
// upstream outage / unclassified) without ever leaking the key or a stack trace to
// the client. The HTTP status + message for each bucket are part of the API contract.
const classifyGeminiError = (error) => {
  const status =
    error.status ||
    error.statusCode ||
    error.code ||
    error?.response?.status ||
    error?.cause?.status;
  const rawMsg = error.message || "";
  let errorDetail = rawMsg;
  try {
    const parsed = typeof rawMsg === "string" && rawMsg.trim().startsWith("{") ? JSON.parse(rawMsg) : null;
    errorDetail = parsed?.error?.message || rawMsg;
  } catch {
    errorDetail = rawMsg;
  }
  const lower = errorDetail.toLowerCase();
  const logDetail = { status, name: error.name, message: errorDetail };

  if (
    status === 401 ||
    status === 403 ||
    (status === 400 && (errorDetail.includes("API key not valid") || errorDetail.includes("API_KEY_INVALID"))) ||
    errorDetail.includes("API_KEY_INVALID")
  ) {
    return { bucket: "auth", httpStatus: 502, message: "AI service authentication failed: Invalid or unauthorized API key", logDetail };
  }

  if (
    status === 404 ||
    errorDetail.includes("models/") ||
    errorDetail.includes("not found") ||
    errorDetail.includes("is not supported") ||
    errorDetail.includes("NOT_FOUND")
  ) {
    return { bucket: "model_unavailable", httpStatus: 502, message: "AI service model configuration error: Configured model is unavailable", logDetail };
  }

  if (
    status === 429 ||
    errorDetail.includes("RESOURCE_EXHAUSTED") ||
    errorDetail.includes("Quota exceeded") ||
    errorDetail.includes("rate limit")
  ) {
    return { bucket: "rate_limited", httpStatus: 429, message: "AI service rate limit reached. Please try again in a few moments.", logDetail };
  }

  if (
    status === 504 ||
    error.name === "AbortError" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNABORTED" ||
    error.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error.cause?.name === "ConnectTimeoutError" ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("fetch failed")
  ) {
    return { bucket: "timeout", httpStatus: 504, message: "AI service request timed out. Please try again.", logDetail };
  }

  // Gemini 500/503 "model is overloaded" / UNAVAILABLE / internal errors — common on
  // the free tier. Previously these fell through to the generic 502 with no signal.
  if (
    status === 500 ||
    status === 503 ||
    errorDetail.includes("UNAVAILABLE") ||
    errorDetail.includes("INTERNAL") ||
    lower.includes("overloaded") ||
    lower.includes("internal error")
  ) {
    return { bucket: "upstream_unavailable", httpStatus: 503, message: "AI service is temporarily overloaded. Please try again in a moment.", logDetail };
  }

  return { bucket: "unclassified", httpStatus: 502, message: "AI service error: Unable to generate itinerary at this time. Please try again.", logDetail };
};

const handleGeminiError = (error, res) => {
  const { bucket, httpStatus, message, logDetail } = classifyGeminiError(error);
  // 🪵 Server-side only — NEVER leaks to the client. The bucket makes Render logs triageable.
  console.error("🔒 AI Controller Internal Error:", { bucket, ...logDetail });
  return res.status(httpStatus).json({ success: false, message });
};

// Hard cap on the itinerary-generation Gemini call. A full multi-day itinerary is a
// larger generation than a single-slot pivot (12s), so this is more generous.
const AI_GENERATION_TIMEOUT_MS = 25000;

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

    const generationConfig = {
      systemInstruction: "You are an expert travel planner. Always respond with a valid JSON itinerary adhering strictly to the response schema. Never return markdown backticks or commentary.",
      responseMimeType: "application/json",
      responseSchema: itinerarySchema,
      temperature: 0.7,
    };

    // Perform the Gemini call (with the new-user deprecation fallback) but cap it with a
    // timeout so a hung upstream request surfaces as a clean 504 instead of hanging until
    // the platform kills the socket — matching pivot/fixDay service behaviour.
    const requestPromise = (async () => {
      try {
        return await ai.models.generateContent({ model: usedModel, contents: finalPrompt, config: generationConfig });
      } catch (primaryErr) {
        const msg = primaryErr.message || "";
        const isNewUserDeprecation =
          primaryErr.status === 404 &&
          msg.toLowerCase().includes("no longer available to new users");

        if (isNewUserDeprecation) {
          const originalModel = usedModel;
          usedModel = "gemini-3.6-flash";
          console.warn(`⚠️ Model '${originalModel}' is no longer available to new users. Falling back to Google AI Studio recommended '${usedModel}'...`);
          return await ai.models.generateContent({ model: usedModel, contents: finalPrompt, config: generationConfig });
        }
        throw primaryErr;
      }
    })();

    let timeoutTimer;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const err = new Error("AI service request timed out");
        err.name = "AbortError";
        err.status = 504;
        reject(err);
      }, AI_GENERATION_TIMEOUT_MS);
      if (timeoutTimer.unref) timeoutTimer.unref();
    });

    try {
      response = await Promise.race([requestPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutTimer);
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

    // Normalise dates so a valid itinerary always persists: Booking requires
    // checkout > checkin, so fall back to the day after check-in when the client
    // omitted or sent an invalid / reversed end date.
    const today = new Date();
    const parsedCheckin = startDate ? new Date(startDate) : today;
    const checkin = isNaN(parsedCheckin.getTime()) ? today : parsedCheckin;
    const parsedCheckout = endDate ? new Date(endDate) : null;
    const checkoutValid = parsedCheckout && !isNaN(parsedCheckout.getTime()) && parsedCheckout > checkin;
    const checkout = checkoutValid ? parsedCheckout : new Date(checkin.getTime() + 86400000);

    // Persist separately from the Gemini call: a DB failure must NOT be reported as an
    // "AI service error". The itinerary was generated successfully, so return it even if
    // saving fails — the user still sees their plan (save/adapt features stay disabled,
    // which the frontend already guards on a missing tripId).
    let tripId = null;
    try {
      const savedTrip = await Booking.create({
        user: req.user?._id || null,
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

    return res.json({ success: true, data: text, tripId });
  } catch (error) {
    return handleGeminiError(error, res);
  }
};

const { executePivot, PivotError } = require("../services/pivotService");
const { toggleActivityLock } = require("../services/lockService");

const pivotAITrip = async (req, res) => {
  try {
    const { tripId, dayNumber, block, activityId, pivotReason, customReason } = req.body;
    const user = req.user;

    const result = await executePivot({
      tripId,
      dayNumber,
      block,
      activityId,
      pivotReason,
      customReason,
      user,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof PivotError || error.statusCode) {
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: error.message,
      });
    }

    return handleGeminiError(error, res);
  }
};

const lockActivity = async (req, res) => {
  try {
    const { tripId, activityId, locked } = req.body;
    const user = req.user;

    const result = await toggleActivityLock({
      tripId,
      activityId,
      locked,
      user,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof PivotError || error.statusCode) {
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: error.message,
      });
    }

    return handleGeminiError(error, res);
  }
};

const { evaluateTripReality } = require("../services/realityEngine");

const getRealityScore = async (req, res) => {
  try {
    const { tripId } = req.body;
    const user = req.user;

    const trip = await Booking.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Ownership verification: If the trip belongs to a user, caller must match
    if (trip.user) {
      const callerId = user?._id ? user._id.toString() : null;
      if (!callerId || trip.user.toString() !== callerId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this trip's reality score",
        });
      }
    }

    const report = evaluateTripReality(trip);

    return res.status(200).json({
      success: true,
      data: {
        tripId: trip._id.toString(),
        ...report,
      },
    });
  } catch (error) {
    console.error("🔒 Reality Engine Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while evaluating trip reality score",
    });
  }
};

const { previewFixDay, applyFixDay, FixDayError } = require("../services/fixDayService");

const previewFixDayTrip = async (req, res) => {
  try {
    const { tripId, dayNumber, reason, currentPeriod, delayMinutes, customReason } = req.body;
    const user = req.user;

    const result = await previewFixDay({
      tripId,
      dayNumber,
      reason,
      currentPeriod,
      delayMinutes,
      customReason,
      user,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof FixDayError || error.statusCode) {
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        code: error.code || "INTERNAL_ERROR",
        message: error.message,
      });
    }

    return handleGeminiError(error, res);
  }
};

const applyFixDayTrip = async (req, res) => {
  try {
    const { tripId, dayNumber, proposalToken } = req.body;
    const user = req.user;

    const result = await applyFixDay({
      tripId,
      dayNumber,
      proposalToken,
      user,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof FixDayError || error.statusCode) {
      const status = error.statusCode || 500;
      return res.status(status).json({
        success: false,
        code: error.code || "INTERNAL_ERROR",
        message: error.message,
      });
    }

    return handleGeminiError(error, res);
  }
};

module.exports = {
  generateAITrip,
  pivotAITrip,
  lockActivity,
  getRealityScore,
  previewFixDayTrip,
  applyFixDayTrip,
  validateItinerary,
  itinerarySchema,
  handleGeminiError,
};