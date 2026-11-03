const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const {
  normalizeActivityType,
  normalizeDurationMinutes,
  normalizeTravelMode,
  normalizeIntensity,
} = require("../utils/itineraryNormalizer");

/**
 * Parses raw aiPlan safely into an object if it is a JSON string or markdown code fence.
 */
const parseAiPlanSafely = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const clean = String(raw)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

/**
 * Serializes and allowlists a structured activity object.
 * Strips away any private client notes, booking barcodes, internal IDs, or user data.
 * Preserves canonical metadata fields when valid; never fabricates defaults.
 */
const sanitizeStructuredActivity = (act, fallbackPeriod = "morning") => {
  if (!act || typeof act !== "object") return null;

  const durationMeta = normalizeDurationMinutes(act);
  const activityType = normalizeActivityType(act.activityType);
  const travelMode = normalizeTravelMode(act.travelMode);
  const intensity = normalizeIntensity(act.intensity);

  const sanitized = {
    id: typeof act.id === "string" ? act.id : undefined,
    period: typeof act.period === "string" ? act.period : fallbackPeriod,
    title:
      typeof act.title === "string"
        ? act.title
        : typeof act.name === "string"
        ? act.name
        : "Activity",
    description: typeof act.description === "string" ? act.description : "",
    category: typeof act.category === "string" ? act.category : "Sightseeing",
    durationMinutes: durationMeta.durationMinutes,
    cost:
      typeof act.cost === "string"
        ? act.cost
        : typeof act.costEstimate === "string"
        ? act.costEstimate
        : "Moderate",
    indoorOutdoor: ["Indoor", "Outdoor", "Mixed"].includes(act.indoorOutdoor)
      ? act.indoorOutdoor
      : "Mixed",
    location: typeof act.location === "string" ? act.location : null,
    locked: Boolean(act.locked),
  };

  if (activityType) {
    sanitized.activityType = activityType;
  }
  if (durationMeta.durationInferred) {
    sanitized.durationInferred = true;
  }
  if (travelMode) {
    sanitized.travelMode = travelMode;
  }
  if (intensity) {
    sanitized.intensity = intensity;
  }

  return sanitized;
};

/**
 * Serializes and allowlists a single day object within the itinerary.
 * Only returns public day properties and sanitized food/activity lists.
 */
const sanitizeDay = (dayObj, index) => {
  if (!dayObj || typeof dayObj !== "object") return null;

  const dayNumber = Number(dayObj.day) || index + 1;
  const title = typeof dayObj.title === "string" ? dayObj.title : `Day ${dayNumber}`;
  const morning = typeof dayObj.morning === "string" ? dayObj.morning : "";
  const afternoon = typeof dayObj.afternoon === "string" ? dayObj.afternoon : "";
  const evening = typeof dayObj.evening === "string" ? dayObj.evening : "";
  const food = Array.isArray(dayObj.food)
    ? dayObj.food.filter((f) => typeof f === "string")
    : [];

  const sanitized = {
    day: dayNumber,
    title,
    morning,
    afternoon,
    evening,
    food,
  };

  // If structured activities exist, strictly sanitize them
  if (Array.isArray(dayObj.activities)) {
    sanitized.activities = dayObj.activities
      .map((act) => sanitizeStructuredActivity(act))
      .filter(Boolean);
  }

  return sanitized;
};

/**
 * Explicit Public Itinerary Serializer.
 * Allow-lists ONLY safe public trip planning properties.
 * Excludes private notes, developer metadata, raw prompt instructions,
 * payment identifiers, creator identities, and debugging timestamps.
 */
const sanitizePublicAiPlan = (rawPlan) => {
  const parsed = parseAiPlanSafely(rawPlan);
  if (!parsed || typeof parsed !== "object") return null;

  const sanitized = {};

  if (typeof parsed.destination === "string") {
    sanitized.destination = parsed.destination;
  }

  if (typeof parsed.bestTimeToVisit === "string") {
    sanitized.bestTimeToVisit = parsed.bestTimeToVisit;
  }

  if (Array.isArray(parsed.days)) {
    sanitized.days = parsed.days
      .map((day, idx) => sanitizeDay(day, idx))
      .filter(Boolean);
  }

  if (parsed.budgetBreakdown && typeof parsed.budgetBreakdown === "object") {
    sanitized.budgetBreakdown = {};
    const allowedBreakdownKeys = ["accommodation", "foodPerDay", "transport", "activities", "total"];
    for (const key of allowedBreakdownKeys) {
      if (
        typeof parsed.budgetBreakdown[key] === "string" ||
        typeof parsed.budgetBreakdown[key] === "number"
      ) {
        sanitized.budgetBreakdown[key] = String(parsed.budgetBreakdown[key]);
      }
    }
  }

  if (parsed.whereToStay && typeof parsed.whereToStay === "object") {
    sanitized.whereToStay = {};
    const allowedWhereKeys = ["budget", "midRange", "luxury"];
    for (const key of allowedWhereKeys) {
      if (typeof parsed.whereToStay[key] === "string") {
        sanitized.whereToStay[key] = parsed.whereToStay[key];
      }
    }
  }

  if (Array.isArray(parsed.mustEat)) {
    sanitized.mustEat = parsed.mustEat.filter((item) => typeof item === "string");
  }

  if (Array.isArray(parsed.travelTips)) {
    sanitized.travelTips = parsed.travelTips.filter((item) => typeof item === "string");
  }

  return sanitized;
};

/**
 * Serializes and allowlists reality score output.
 */
const sanitizeRealityScore = (score) => {
  if (!score || typeof score !== "object") return null;

  return {
    total: typeof score.total === "number" ? score.total : undefined,
    grade: typeof score.grade === "string" ? score.grade : undefined,
    pace: typeof score.pace === "string" ? score.pace : undefined,
    breakdown:
      score.breakdown && typeof score.breakdown === "object"
        ? {
            time: typeof score.breakdown.time === "number" ? score.breakdown.time : undefined,
            budget: typeof score.breakdown.budget === "number" ? score.breakdown.budget : undefined,
            pace: typeof score.breakdown.pace === "number" ? score.breakdown.pace : undefined,
            distance: typeof score.breakdown.distance === "number" ? score.breakdown.distance : undefined,
          }
        : undefined,
  };
};

/**
 * Explicit Public Trip Response DTO.
 * Excludes all creator PII, user IDs, internal notes, credentials, and system fields.
 */
const formatPublicTrip = (trip) => {
  const sanitizedAiPlan = sanitizePublicAiPlan(trip.aiPlan);

  let daysCount = trip.dayCount;
  if (!daysCount && trip.checkin && trip.checkout) {
    const msDiff = new Date(trip.checkout).getTime() - new Date(trip.checkin).getTime();
    daysCount = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
  } else if (!daysCount && Array.isArray(sanitizedAiPlan?.days)) {
    daysCount = sanitizedAiPlan.days.length;
  }

  const itinerary = Array.isArray(sanitizedAiPlan?.days)
    ? sanitizedAiPlan.days
    : Array.isArray(trip.tripData?.itinerary)
    ? trip.tripData.itinerary.map(sanitizeDay).filter(Boolean)
    : [];

  return {
    _id: trip._id,
    destination: trip.destination,
    // Canonical date aliases for frontend and API consumers
    startDate: trip.checkin,
    endDate: trip.checkout,
    checkin: trip.checkin,
    checkout: trip.checkout,
    days: daysCount || 1,
    budget: trip.budget || null,
    // Canonical traveler count aliases
    travelers: trip.guests,
    guests: trip.guests,
    itinerary,
    aiPlan: sanitizedAiPlan, // 🔒 EXPLICITLY SANITIZED (NEVER raw trip.aiPlan)
    coverImage: trip.coverImage || null,
    realityScore: sanitizeRealityScore(trip.realityScore || trip.tripData?.realityScore),
    createdAt: trip.createdAt,
    isShared: true,
  };
};

// @desc  Fetch a single trip by ID — PUBLIC, no auth required
// @route GET /api/bookings/shared/:id or GET /api/shared/:id
const getSharedTrip = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID format",
      });
    }

    // Defense-in-depth: Strict projection directly at the database layer
    const trip = await Booking.findById(id)
      .select(
        "destination checkin checkout guests budget dayCount aiPlan tripData coverImage realityScore isShared createdAt"
      )
      .lean();

    // Finding 2 Security Enforcement:
    // Requires an EXPLICIT sharing decision (isShared === true).
    // Trips with isShared: false, or legacy records with isShared missing/undefined, are rejected.
    if (!trip || trip.isShared !== true) {
      return res.status(404).json({
        success: false,
        message: "Trip not found or is private",
      });
    }

    const publicTrip = formatPublicTrip(trip);

    return res.status(200).json({
      success: true,
      data: publicTrip,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trip",
    });
  }
};

module.exports = {
  getSharedTrip,
  formatPublicTrip,
  sanitizePublicAiPlan,
  sanitizeDay,
  sanitizeStructuredActivity,
};
