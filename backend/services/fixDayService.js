// backend/services/fixDayService.js
const crypto = require("crypto");
const { GoogleGenAI, Type } = require("@google/genai");
const Booking = require("../models/Booking");
const env = require("../config/env");
const { normalizeItinerary } = require("../utils/itineraryNormalizer");
const { evaluateTripReality } = require("./realityEngine");
const { parseCostString } = require("./realityEngine/budgetEngine");

const ALLOWED_CATEGORIES = [
  "Sightseeing",
  "Culture",
  "Adventure",
  "Dining & Nightlife",
  "Relaxation",
  "Nature",
  "Shopping",
];

const PERIOD_ORDER = {
  morning: 1,
  afternoon: 2,
  evening: 3,
};

const FIX_DAY_CANDIDATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    replacement: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        category: {
          type: Type.STRING,
          enum: ALLOWED_CATEGORIES,
        },
        indoorOutdoor: {
          type: Type.STRING,
          enum: ["Indoor", "Outdoor", "Mixed"],
        },
        durationMinutes: { type: Type.INTEGER },
        cost: { type: Type.STRING },
        reason: { type: Type.STRING },
      },
      required: [
        "title",
        "description",
        "category",
        "indoorOutdoor",
        "durationMinutes",
        "cost",
        "reason",
      ],
    },
  },
  required: ["replacement"],
};

class FixDayError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "FixDayError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Signs a proposal token using HMAC-SHA256 with FIX_DAY_PROPOSAL_SECRET.
 * Never uses JWT_SECRET.
 */
function signProposalToken(payload, customSecret = null) {
  const secret = customSecret || env.fixDayProposalSecret;
  if (!secret) {
    throw new FixDayError("Proposal signing secret is not configured", 500, "CONFIG_ERROR");
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureB64 = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signatureB64}`;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Cryptographically verifies proposal token and all signed claims PRE-DB.
 */
function verifyProposalToken(token, customSecret = null) {
  if (typeof token !== "string" || !token.includes(".")) {
    throw new FixDayError("Invalid proposal token format", 400, "INVALID_TOKEN");
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new FixDayError("Invalid proposal token format", 400, "INVALID_TOKEN");
  }

  const [payloadB64, signatureB64] = parts;
  const secret = customSecret || env.fixDayProposalSecret;
  if (!secret) {
    throw new FixDayError("Proposal signing secret is not configured", 500, "CONFIG_ERROR");
  }

  const expectedSignatureB64 = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSignatureB64);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new FixDayError("Invalid or tampered proposal token signature", 400, "INVALID_TOKEN");
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    throw new FixDayError("Invalid proposal token payload", 400, "INVALID_TOKEN");
  }

  // Pre-DB Claims Verification
  if (!payload || typeof payload !== "object") {
    throw new FixDayError("Malformed token payload", 400, "INVALID_TOKEN");
  }

  if (payload.purpose !== "fix-day") {
    throw new FixDayError("Invalid token purpose", 400, "INVALID_TOKEN");
  }

  if (!payload.proposalId || !UUID_V4_REGEX.test(payload.proposalId)) {
    throw new FixDayError("Invalid proposalId in token claims", 400, "INVALID_TOKEN");
  }

  if (!payload.tripId || typeof payload.tripId !== "string" || !/^[0-9a-fA-F]{24}$/.test(payload.tripId)) {
    throw new FixDayError("Invalid tripId in token claims", 400, "INVALID_TOKEN");
  }

  if (typeof payload.dayNumber !== "number" || payload.dayNumber < 1) {
    throw new FixDayError("Invalid dayNumber in token claims", 400, "INVALID_TOKEN");
  }

  if (typeof payload.baseVersion !== "number" || payload.baseVersion < 0) {
    throw new FixDayError("Invalid baseVersion in token claims", 400, "INVALID_TOKEN");
  }

  if (!["schedule_overload", "running_late", "custom"].includes(payload.reason)) {
    throw new FixDayError("Invalid reason in token claims", 400, "INVALID_TOKEN");
  }

  if (payload.reason === "running_late") {
    if (!["morning", "afternoon", "evening"].includes(payload.currentPeriod)) {
      throw new FixDayError("Invalid currentPeriod in token claims for running_late", 400, "INVALID_TOKEN");
    }
    if (typeof payload.delayMinutes !== "number" || payload.delayMinutes < 15 || payload.delayMinutes > 240) {
      throw new FixDayError("Invalid delayMinutes in token claims for running_late", 400, "INVALID_TOKEN");
    }
  }

  if (!Array.isArray(payload.replacementSlots)) {
    throw new FixDayError("Missing replacementSlots array in token claims", 400, "INVALID_TOKEN");
  }

  if (typeof payload.issuedAt !== "number" || typeof payload.expiresAt !== "number") {
    throw new FixDayError("Invalid timestamps in token claims", 400, "INVALID_TOKEN");
  }

  if (payload.expiresAt <= payload.issuedAt) {
    throw new FixDayError("Invalid token lifetime: expiresAt must be greater than issuedAt", 400, "INVALID_TOKEN");
  }

  // Enforce <= 15 minute lifetime
  if (payload.expiresAt - payload.issuedAt > 900000) {
    throw new FixDayError("Token lifetime exceeds maximum allowed duration (15 minutes)", 400, "INVALID_TOKEN");
  }

  // Reject expired tokens
  if (Date.now() > payload.expiresAt) {
    throw new FixDayError("Proposal token has expired. Please generate a new preview.", 410, "TOKEN_EXPIRED");
  }

  return payload;
}

/**
 * Calculates allowable future active minutes for running_late.
 * Formula: 480 - delayMinutes - PastScheduledActiveMinutes - CurrentScheduledActiveMinutes
 */
function calculateAllowableFutureActiveMinutes(delayMinutes, pastScheduledMinutes, currentScheduledMinutes) {
  return 480 - delayMinutes - pastScheduledMinutes - currentScheduledMinutes;
}

/**
 * Load authoritative trip from MongoDB and verify access permissions.
 */
async function loadTripAndAuthorize(tripId, user) {
  const trip = await Booking.findById(tripId);
  if (!trip) {
    throw new FixDayError("Trip not found", 404, "NOT_FOUND");
  }

  if (trip.user) {
    const callerId = user?._id ? user._id.toString() : null;
    if (!callerId || trip.user.toString() !== callerId) {
      throw new FixDayError("You are not authorized to modify this trip", 403, "FORBIDDEN");
    }
  }

  return trip;
}

/**
 * Deep compare all 10 canonical fields for locked activity immutability.
 */
function isLockedActivityUnchanged(orig, candidate) {
  if (!orig || !candidate) return false;
  const fields = [
    "id",
    "period",
    "title",
    "description",
    "category",
    "durationMinutes",
    "cost",
    "indoorOutdoor",
    "locked",
  ];

  for (const field of fields) {
    if (orig[field] !== candidate[field]) {
      return false;
    }
  }

  // Check nested location if present
  if (orig.location || candidate.location) {
    const origLoc = orig.location || {};
    const candLoc = candidate.location || {};
    if (
      origLoc.name !== candLoc.name ||
      origLoc.lat !== candLoc.lat ||
      origLoc.lng !== candLoc.lng
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Calls Gemini with timeout protection and model fallback.
 */
async function callGeminiForFixDay(prompt) {
  if (!env.geminiApiKey) {
    throw new FixDayError("AI service configuration error: API key is missing", 500, "CONFIG_ERROR");
  }

  const ai = new GoogleGenAI({
    apiKey: env.geminiApiKey,
  });

  let usedModel = env.geminiModel || "gemini-3.6-flash";
  const TIMEOUT_MS = 12000;

  const requestPromise = (async () => {
    try {
      return await ai.models.generateContent({
        model: usedModel,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an expert adaptive travel planner for Fix My Day. You adapt an exact designated target activity without inventing IDs or changing locked anchors. Respond ONLY with valid JSON adhering strictly to the schema.",
          responseMimeType: "application/json",
          responseSchema: FIX_DAY_CANDIDATE_SCHEMA,
          temperature: 0.7,
        },
      });
    } catch (primaryErr) {
      const msg = primaryErr.message || "";
      const isNewUserDeprecation =
        primaryErr.status === 404 &&
        msg.toLowerCase().includes("no longer available to new users");

      if (isNewUserDeprecation) {
        usedModel = "gemini-3.6-flash";
        return await ai.models.generateContent({
          model: usedModel,
          contents: prompt,
          config: {
            systemInstruction:
              "You are an expert adaptive travel planner for Fix My Day. You adapt an exact designated target activity without inventing IDs or changing locked anchors. Respond ONLY with valid JSON adhering strictly to the schema.",
            responseMimeType: "application/json",
            responseSchema: FIX_DAY_CANDIDATE_SCHEMA,
            temperature: 0.7,
          },
        });
      }
      throw primaryErr;
    }
  })();

  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("AI service request timed out");
      err.name = "AbortError";
      err.status = 504;
      reject(err);
    }, TIMEOUT_MS);
    if (timer.unref) timer.unref();
  });

  let response;
  try {
    response = await Promise.race([requestPromise, timeoutPromise]);
  } catch (err) {
    if (
      err.status === 504 ||
      err.name === "AbortError" ||
      err.code === "ETIMEDOUT" ||
      err.message?.toLowerCase().includes("timed out")
    ) {
      throw new FixDayError("AI service request timed out. Please try again.", 504, "UPSTREAM_TIMEOUT");
    }
    if (
      err.status === 429 ||
      err.message?.includes("RESOURCE_EXHAUSTED") ||
      err.message?.includes("Quota exceeded")
    ) {
      throw new FixDayError("AI service rate limit reached. Please try again in a few moments.", 429, "UPSTREAM_RATELIMIT");
    }
    if (
      err.status === 401 ||
      err.status === 403 ||
      err.message?.includes("API_KEY_INVALID") ||
      err.message?.includes("API key not valid")
    ) {
      throw new FixDayError("AI service authentication failed", 502, "UPSTREAM_AUTH_FAILED");
    }

    throw new FixDayError("Upstream AI service error", 502, "UPSTREAM_ERROR", err.message);
  }

  let text = response.text || "";
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  if (!text) {
    throw new FixDayError("AI service returned an empty response", 502, "PROPOSAL_VALIDATION_FAILED");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new FixDayError("AI service returned malformed JSON", 502, "PROPOSAL_VALIDATION_FAILED");
  }

  return parsed.replacement || parsed;
}

/**
 * Builds the prompt for Gemini candidate generation.
 */
function buildFixDayPrompt({
  destination,
  budget,
  dayNumber,
  targetActivity,
  maxDurationMinutes,
  reason,
  delayMinutes,
  customReason,
  retryConstraint = null,
}) {
  let prompt = `
Destination: ${destination}
Overall Trip Budget: ${budget}
Target Day: Day ${dayNumber}
Target Activity ID: "${targetActivity.id}"
Target Period: "${targetActivity.period}"
Current Planned Activity to Adapt:
- Title: "${targetActivity.title}"
- Description: "${targetActivity.description}"
- Category: "${targetActivity.category}"
- Duration: ${targetActivity.durationMinutes} minutes
- Cost: "${targetActivity.cost}"
- Indoor/Outdoor: "${targetActivity.indoorOutdoor}"

ADAPTATION REASON: ${reason.toUpperCase()}
${reason === "running_late" ? `- Delay: ${delayMinutes} minutes. You MUST compact or replace this upcoming activity so it fits comfortably within ${maxDurationMinutes} minutes.` : ""}
${reason === "schedule_overload" ? `- Schedule Overload: The day's active scheduled time must be reduced to $\\le$ 450 minutes. This activity must not exceed ${maxDurationMinutes} minutes.` : ""}
${reason === "custom" ? `- Custom Traveler Request: "${customReason}". Adapt this activity accordingly, within ${maxDurationMinutes} minutes.` : ""}

STRICT CONSTRAINTS:
1. Category MUST be one of: ${ALLOWED_CATEGORIES.join(", ")}.
2. Duration MUST be an integer between 15 and ${maxDurationMinutes} minutes.
3. Cost must NOT inflate budget (keep cost comparable to or less than "${targetActivity.cost}").
4. indoorOutdoor must be "Indoor", "Outdoor", or "Mixed".
5. Do NOT invent new activity IDs.
6. Provide a concise reason explaining why this adaptation resolves the schedule disruption.

Respond ONLY with a JSON object conforming to the schema.
`;

  if (retryConstraint) {
    prompt += `
⚠️ CRITICAL RETRY INSTRUCTION:
Your previous candidate was rejected because: ${retryConstraint}
You MUST strictly correct this. Return an alternative that 100% obeys this constraint.
`;
  }

  return prompt;
}

/**
 * Validates candidate against semantic rules, budget non-inflation, and Reality Engine simulation.
 */
function validateCandidate({
  candidate,
  targetActivity,
  maxDurationMinutes,
  trip,
  plan,
  targetDayIndex,
  dayNumber,
  currentReport,
  reason,
  currentPeriod,
}) {
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, violation: "Candidate is not an object" };
  }

  const { title, description, category, indoorOutdoor, durationMinutes, cost, reason: candidateReason } = candidate;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, violation: "Missing or empty title" };
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return { valid: false, violation: "Missing or empty description" };
  }
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return { valid: false, violation: `Category '${category}' is not one of the allowed categories: ${ALLOWED_CATEGORIES.join(", ")}` };
  }
  if (!["Indoor", "Outdoor", "Mixed"].includes(indoorOutdoor)) {
    return { valid: false, violation: "indoorOutdoor must be 'Indoor', 'Outdoor', or 'Mixed'" };
  }
  if (typeof durationMinutes !== "number" || durationMinutes < 15) {
    return { valid: false, violation: "durationMinutes must be an integer of at least 15 minutes" };
  }
  if (durationMinutes > maxDurationMinutes) {
    return { valid: false, violation: `durationMinutes of ${durationMinutes}m exceeds allowed maximum of ${maxDurationMinutes}m` };
  }
  if (!cost || typeof cost !== "string") {
    return { valid: false, violation: "Missing cost" };
  }
  if (!candidateReason || typeof candidateReason !== "string") {
    return { valid: false, violation: "Missing reason" };
  }

  // Budget Non-Inflation check (10% rule on known costs)
  const origCostParsed = parseCostString(targetActivity.cost);
  const candCostParsed = parseCostString(cost);

  if (origCostParsed.amount !== null && candCostParsed.amount !== null) {
    const maxAllowedCost = origCostParsed.amount * 1.10;
    if (candCostParsed.amount > maxAllowedCost) {
      return {
        valid: false,
        violation: `Candidate cost of ${candCostParsed.amount} exceeds 10% non-inflation threshold over original cost of ${origCostParsed.amount}`,
      };
    }
  }

  // Reality Engine Simulation
  const clonedPlan = JSON.parse(JSON.stringify(plan));
  const clonedDay = clonedPlan.days[targetDayIndex];
  const actIndex = clonedDay.activities.findIndex((a) => a.id === targetActivity.id);
  if (actIndex === -1) {
    return { valid: false, violation: "Target activity ID missing from cloned day" };
  }

  clonedDay.activities[actIndex] = {
    ...targetActivity,
    id: targetActivity.id,
    period: targetActivity.period,
    title,
    description,
    category,
    indoorOutdoor,
    durationMinutes,
    cost,
    durationInferred: false,
    locked: false,
  };
  clonedDay[targetActivity.period] = `${title} — ${description}`;

  // Immutability checks on simulated plan
  const origDay = plan.days[targetDayIndex];
  for (const act of origDay.activities) {
    if (act.locked) {
      const clonedAct = clonedDay.activities.find((a) => a.id === act.id);
      if (!isLockedActivityUnchanged(act, clonedAct)) {
        return { valid: false, violation: `Locked activity '${act.id}' was modified in simulation` };
      }
    }
    if (reason === "running_late" && currentPeriod) {
      const currOrder = PERIOD_ORDER[currentPeriod];
      if (PERIOD_ORDER[act.period] <= currOrder) {
        const clonedAct = clonedDay.activities.find((a) => a.id === act.id);
        if (!isLockedActivityUnchanged(act, clonedAct)) {
          return { valid: false, violation: `Past/current activity '${act.id}' was modified for running_late` };
        }
      }
    }
  }

  const simulatedTrip = { ...trip.toObject(), aiPlan: clonedPlan };
  const simulatedReport = evaluateTripReality(simulatedTrip);

  // Check hard schedule ceiling on Day X (480m)
  const dayXActiveMinutes = clonedDay.activities.reduce((sum, a) => sum + (Number(a.durationMinutes) || 0), 0);
  if (dayXActiveMinutes > 480) {
    return { valid: false, violation: `Simulated day active time of ${dayXActiveMinutes}m exceeds hard ceiling of 480m` };
  }

  // Check no Reality Score regression
  if (simulatedReport.score < currentReport.score) {
    return {
      valid: false,
      violation: `Simulated reality score regressed from ${currentReport.score} to ${simulatedReport.score}`,
    };
  }

  // Budget deficit checks
  if (!currentReport.metrics.overBudget && simulatedReport.metrics.overBudget) {
    return { valid: false, violation: "Candidate introduces a new budget deficit" };
  }
  if (currentReport.metrics.overBudget && simulatedReport.metrics.overBudget) {
    const beforeDiff = currentReport.metrics.totalKnownActivityCost - currentReport.metrics.budgetCeiling;
    const afterDiff = simulatedReport.metrics.totalKnownActivityCost - simulatedReport.metrics.budgetCeiling;
    if (afterDiff > beforeDiff) {
      return { valid: false, violation: "Candidate worsens an existing budget deficit" };
    }
  }

  return {
    valid: true,
    simulatedReport,
    clonedPlan,
    dayXActiveMinutes,
  };
}

/**
 * Preview endpoint handler logic.
 */
async function previewFixDay({
  tripId,
  dayNumber,
  reason,
  currentPeriod,
  delayMinutes,
  customReason,
  user,
}) {
  const trip = await loadTripAndAuthorize(tripId, user);
  const baseVersion = trip.__v;

  const { plan } = normalizeItinerary(trip.aiPlan);
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
    throw new FixDayError("Trip does not contain a valid itinerary", 404, "NOT_FOUND");
  }

  const targetDayIndex = plan.days.findIndex((d) => Number(d.day) === Number(dayNumber));
  if (targetDayIndex === -1) {
    throw new FixDayError(`Day ${dayNumber} not found in trip itinerary`, 404, "NOT_FOUND");
  }

  const targetDay = plan.days[targetDayIndex];
  if (!Array.isArray(targetDay.activities) || targetDay.activities.length < 2) {
    throw new FixDayError(
      `Cannot adapt Day ${dayNumber}: Day contains insufficient adaptable slots.`,
      422,
      "FUTURE_CAPACITY_INSUFFICIENT"
    );
  }

  const unlockedActivities = targetDay.activities.filter((a) => !a.locked);
  if (unlockedActivities.length === 0) {
    throw new FixDayError(
      `Cannot adapt Day ${dayNumber}: All activities on this day are locked.`,
      422,
      "FUTURE_CAPACITY_INSUFFICIENT"
    );
  }

  const currentReport = evaluateTripReality(trip);
  const beforeActiveMinutes = targetDay.activities.reduce(
    (sum, a) => sum + (Number(a.durationMinutes) || 0),
    0
  );

  let targetActivity = null;
  let maxDurationMinutes = 120;

  if (reason === "running_late") {
    const currOrder = PERIOD_ORDER[currentPeriod];
    const pastActs = targetDay.activities.filter((a) => PERIOD_ORDER[a.period] < currOrder);
    const currActs = targetDay.activities.filter((a) => PERIOD_ORDER[a.period] === currOrder);
    const futureActs = targetDay.activities.filter((a) => PERIOD_ORDER[a.period] > currOrder);

    if (futureActs.length === 0) {
      throw new FixDayError(
        "Cannot adapt: No upcoming periods remain after current period.",
        422,
        "FUTURE_CAPACITY_INSUFFICIENT"
      );
    }

    const pastScheduledMinutes = pastActs.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);
    const currentScheduledMinutes = currActs.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);

    const allowableFutureMinutes = calculateAllowableFutureActiveMinutes(
      delayMinutes,
      pastScheduledMinutes,
      currentScheduledMinutes
    );

    const futureUnlocked = futureActs.filter((a) => !a.locked);
    const futureLocked = futureActs.filter((a) => a.locked);
    const unavoidableLockedFutureMinutes = futureLocked.reduce(
      (s, a) => s + (Number(a.durationMinutes) || 0),
      0
    );

    // Pre-flight deterministic impossibility check (422)
    if (futureUnlocked.length === 0) {
      throw new FixDayError(
        "Unavoidable scheduled duration exceeds allowable remaining capacity. Zero eligible future unlocked activities.",
        422,
        "FUTURE_CAPACITY_INSUFFICIENT"
      );
    }

    if (allowableFutureMinutes <= 0 || unavoidableLockedFutureMinutes > allowableFutureMinutes) {
      throw new FixDayError(
        "Unavoidable scheduled duration exceeds allowable remaining capacity.",
        422,
        "FUTURE_CAPACITY_INSUFFICIENT"
      );
    }

    // Select candidate target from future unlocked activities
    const sortedFutureUnlocked = [...futureUnlocked].sort(
      (a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0)
    );
    targetActivity = sortedFutureUnlocked[0];

    const otherFutureMinutes = futureActs
      .filter((a) => a.id !== targetActivity.id)
      .reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);

    maxDurationMinutes = allowableFutureMinutes - otherFutureMinutes;
    maxDurationMinutes = Math.max(15, maxDurationMinutes);
  } else if (reason === "schedule_overload") {
    const lockedActs = targetDay.activities.filter((a) => a.locked);
    const lockedMinutes = lockedActs.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);

    if (lockedMinutes > 480) {
      throw new FixDayError(
        "Unavoidable scheduled duration exceeds allowable remaining capacity.",
        422,
        "FUTURE_CAPACITY_INSUFFICIENT"
      );
    }

    const sortedUnlocked = [...unlockedActivities].sort(
      (a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0)
    );
    targetActivity = sortedUnlocked[0];

    const otherMinutes = beforeActiveMinutes - (targetActivity.durationMinutes || 0);
    maxDurationMinutes = 450 - otherMinutes;
    if (maxDurationMinutes < 30) {
      maxDurationMinutes = 480 - otherMinutes;
    }
    maxDurationMinutes = Math.max(15, maxDurationMinutes);
  } else {
    // custom reason
    const sortedUnlocked = [...unlockedActivities].sort(
      (a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0)
    );
    targetActivity = sortedUnlocked[0];
    maxDurationMinutes = targetActivity.durationMinutes || 120;
  }

  // 1. Build initial prompt
  const initialPrompt = buildFixDayPrompt({
    destination: trip.destination || plan.destination || "Destination",
    budget: trip.budget || plan.budgetBreakdown?.total || "Standard",
    dayNumber,
    targetActivity,
    maxDurationMinutes,
    reason,
    delayMinutes,
    customReason,
  });

  // 2. Candidate generation (Attempt 1)
  let candidate = await callGeminiForFixDay(initialPrompt);
  let valResult = validateCandidate({
    candidate,
    targetActivity,
    maxDurationMinutes,
    trip,
    plan,
    targetDayIndex,
    dayNumber,
    currentReport,
    reason,
    currentPeriod,
  });

  // 3. Exactly ONE corrective retry if validation fails
  if (!valResult.valid) {
    const retryPrompt = buildFixDayPrompt({
      destination: trip.destination || plan.destination || "Destination",
      budget: trip.budget || plan.budgetBreakdown?.total || "Standard",
      dayNumber,
      targetActivity,
      maxDurationMinutes,
      reason,
      delayMinutes,
      customReason,
      retryConstraint: valResult.violation,
    });

    candidate = await callGeminiForFixDay(retryPrompt);
    valResult = validateCandidate({
      candidate,
      targetActivity,
      maxDurationMinutes,
      trip,
      plan,
      targetDayIndex,
      dayNumber,
      currentReport,
      reason,
      currentPeriod,
    });

    if (!valResult.valid) {
      throw new FixDayError(
        "Unable to generate a valid adaptation proposal that satisfies all constraints. Please adjust activities manually.",
        502,
        "PROPOSAL_VALIDATION_FAILED",
        valResult.violation
      );
    }
  }

  const { simulatedReport, dayXActiveMinutes: targetActiveMinutes } = valResult;

  // 4. Construct proposal token payload
  const proposalId = crypto.randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 900000; // 15 minutes max lifetime

  const replacementSlots = [
    {
      targetActivityId: targetActivity.id,
      replacement: {
        id: targetActivity.id,
        period: targetActivity.period,
        title: candidate.title,
        description: candidate.description,
        category: candidate.category,
        indoorOutdoor: candidate.indoorOutdoor,
        durationMinutes: candidate.durationMinutes,
        cost: candidate.cost,
        reason: candidate.reason,
      },
    },
  ];

  const tokenPayload = {
    purpose: "fix-day",
    proposalId,
    tripId: trip._id.toString(),
    dayNumber: Number(dayNumber),
    baseVersion,
    reason,
    currentPeriod: reason === "running_late" ? currentPeriod : null,
    delayMinutes: reason === "running_late" ? delayMinutes : null,
    replacementSlots,
    issuedAt,
    expiresAt,
  };

  const proposalToken = signProposalToken(tokenPayload);

  // 5. Construct diff slots for client preview
  const slots = targetDay.activities.map((act) => {
    if (reason === "running_late") {
      const currOrder = PERIOD_ORDER[currentPeriod];
      const actOrder = PERIOD_ORDER[act.period];

      if (actOrder < currOrder) {
        return {
          period: act.period,
          action: "COMPLETED_PAST",
          isLocked: Boolean(act.locked),
          activity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
        };
      }
      if (actOrder === currOrder) {
        return {
          period: act.period,
          action: "CURRENT_IN_PROGRESS",
          isLocked: Boolean(act.locked),
          activity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
        };
      }
      if (act.id === targetActivity.id) {
        return {
          period: act.period,
          action: "REPLACED",
          isLocked: false,
          originalActivity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
          replacementActivity: {
            id: targetActivity.id,
            title: candidate.title,
            description: candidate.description,
            category: candidate.category,
            indoorOutdoor: candidate.indoorOutdoor,
            durationMinutes: candidate.durationMinutes,
            cost: candidate.cost,
            reason: candidate.reason,
          },
        };
      }
      return {
        period: act.period,
        action: "UNCHANGED",
        isLocked: Boolean(act.locked),
        activity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
      };
    }

    // reason is schedule_overload or custom
    if (act.id === targetActivity.id) {
      return {
        period: act.period,
        action: "REPLACED",
        isLocked: false,
        originalActivity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
        replacementActivity: {
          id: targetActivity.id,
          title: candidate.title,
          description: candidate.description,
          category: candidate.category,
          indoorOutdoor: candidate.indoorOutdoor,
          durationMinutes: candidate.durationMinutes,
          cost: candidate.cost,
          reason: candidate.reason,
        },
      };
    }
    return {
      period: act.period,
      action: "UNCHANGED",
      isLocked: Boolean(act.locked),
      activity: { id: act.id, title: act.title, durationMinutes: act.durationMinutes },
    };
  });

  const issuesAddressed = currentReport.issues
    .filter((i) => i.id?.includes(`-${dayNumber}`) || i.message?.includes(`Day ${dayNumber}`))
    .map((i) => i.id || i.type);

  return {
    tripId: trip._id.toString(),
    dayNumber: Number(dayNumber),
    baseVersion,
    proposalToken,
    proposalId,
    issuedAt,
    expiresAt,
    diagnosis: {
      beforeActiveMinutes,
      targetActiveMinutes,
      issuesAddressed,
      lockedAnchorsCount: targetDay.activities.filter((a) => a.locked).length,
    },
    scoreDelta: {
      scoreBefore: currentReport.score,
      scoreAfter: simulatedReport.score,
      statusBefore: currentReport.status,
      statusAfter: simulatedReport.status,
      timeSubScoreBefore: currentReport.subScores.timeFeasibility,
      timeSubScoreAfter: simulatedReport.subScores.timeFeasibility,
    },
    slots,
  };
}

/**
 * Apply endpoint handler logic.
 * Follows strict 13-step transaction order.
 */
async function applyFixDay({ tripId, dayNumber, proposalToken, user }) {
  // 1. Verify HMAC/token claims PRE-DB
  const tokenPayload = verifyProposalToken(proposalToken);

  // Cross-check body params against token claims
  if (tokenPayload.tripId !== tripId || Number(tokenPayload.dayNumber) !== Number(dayNumber)) {
    throw new FixDayError("Token claims do not match request parameters", 400, "INVALID_TOKEN");
  }

  // 2. Fetch fresh authoritative DB state
  const trip = await Booking.findById(tokenPayload.tripId);
  if (!trip) {
    throw new FixDayError("Trip not found", 404, "NOT_FOUND");
  }

  // 3. Authorize caller
  if (trip.user) {
    const callerId = user?._id ? user._id.toString() : null;
    if (!callerId || trip.user.toString() !== callerId) {
      throw new FixDayError("You are not authorized to modify this trip", 403, "FORBIDDEN");
    }
  }

  // 4. Check OCC baseVersion
  if (trip.__v !== tokenPayload.baseVersion) {
    throw new FixDayError(
      "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
      409,
      "CONCURRENCY_CONFLICT"
    );
  }

  // 5. Reconstruct candidate against fresh state
  const { plan } = normalizeItinerary(trip.aiPlan);
  if (!plan || !Array.isArray(plan.days)) {
    throw new FixDayError("Trip does not contain a valid days itinerary", 404, "NOT_FOUND");
  }

  const targetDayIndex = plan.days.findIndex((d) => Number(d.day) === Number(tokenPayload.dayNumber));
  if (targetDayIndex === -1) {
    throw new FixDayError(`Day ${tokenPayload.dayNumber} not found in trip itinerary`, 404, "NOT_FOUND");
  }

  const freshDay = plan.days[targetDayIndex];
  const clonedPlan = JSON.parse(JSON.stringify(plan));
  const clonedDay = clonedPlan.days[targetDayIndex];

  // 6. Verify targetActivityId existence and eligibility for every replacement
  for (const slot of tokenPayload.replacementSlots) {
    const origAct = freshDay.activities?.find((a) => a.id === slot.targetActivityId);
    if (!origAct) {
      throw new FixDayError(
        `Target activity '${slot.targetActivityId}' not found on Day ${tokenPayload.dayNumber}`,
        422,
        "PROPOSAL_VALIDATION_FAILED"
      );
    }

    if (origAct.locked === true) {
      throw new FixDayError(
        `Cannot modify locked activity '${origAct.id}'. Locked activities are immutable.`,
        423,
        "LOCKED_ACTIVITY_CONFLICT"
      );
    }

    if (tokenPayload.reason === "running_late" && tokenPayload.currentPeriod) {
      const currOrder = PERIOD_ORDER[tokenPayload.currentPeriod];
      const actOrder = PERIOD_ORDER[origAct.period];
      if (actOrder <= currOrder) {
        throw new FixDayError(
          `Target activity '${origAct.id}' is in a past or current period and cannot be adapted.`,
          422,
          "PROPOSAL_VALIDATION_FAILED"
        );
      }
    }

    if (slot.replacement.id !== slot.targetActivityId) {
      throw new FixDayError(
        "Replacement ID must strictly match target activity ID",
        422,
        "PROPOSAL_VALIDATION_FAILED"
      );
    }

    if (slot.replacement.period !== origAct.period) {
      throw new FixDayError(
        "Replacement period must strictly match target activity period",
        422,
        "PROPOSAL_VALIDATION_FAILED"
      );
    }

    // Apply surgical replacement
    const actIndex = clonedDay.activities.findIndex((a) => a.id === slot.targetActivityId);
    clonedDay.activities[actIndex] = {
      ...origAct,
      id: slot.targetActivityId,
      period: origAct.period,
      title: slot.replacement.title,
      description: slot.replacement.description,
      category: slot.replacement.category,
      indoorOutdoor: slot.replacement.indoorOutdoor,
      durationMinutes: slot.replacement.durationMinutes,
      cost: slot.replacement.cost,
      durationInferred: false,
      locked: false,
    };
    clonedDay[origAct.period] = `${slot.replacement.title} — ${slot.replacement.description}`;
  }

  // 7. Verify deep locked immutability
  for (const act of freshDay.activities) {
    if (act.locked) {
      const reconstructedAct = clonedDay.activities.find((a) => a.id === act.id);
      if (!isLockedActivityUnchanged(act, reconstructedAct)) {
        throw new FixDayError(
          `Locked anchor '${act.id}' was violated during reconstruction.`,
          423,
          "LOCKED_ACTIVITY_CONFLICT"
        );
      }
    }
  }

  // 8. Verify past/current immutability for running_late
  if (tokenPayload.reason === "running_late" && tokenPayload.currentPeriod) {
    const currOrder = PERIOD_ORDER[tokenPayload.currentPeriod];
    for (const act of freshDay.activities) {
      if (PERIOD_ORDER[act.period] <= currOrder) {
        const reconstructedAct = clonedDay.activities.find((a) => a.id === act.id);
        if (!isLockedActivityUnchanged(act, reconstructedAct)) {
          throw new FixDayError(
            `Past/current activity '${act.id}' was violated during reconstruction.`,
            422,
            "PROPOSAL_VALIDATION_FAILED"
          );
        }
      }
    }
  }

  // 9. Run Reality Engine against reconstructed state
  const reconstructedTrip = { ...trip.toObject(), aiPlan: clonedPlan };
  const realityReport = evaluateTripReality(reconstructedTrip);

  const dayActiveMinutes = clonedDay.activities.reduce((s, a) => s + (Number(a.durationMinutes) || 0), 0);
  if (dayActiveMinutes > 480) {
    throw new FixDayError(
      `Reconstructed day schedule of ${dayActiveMinutes}m exceeds hard ceiling of 480m.`,
      502,
      "PROPOSAL_VALIDATION_FAILED"
    );
  }

  // 10. Atomically update with OCC
  const planToSave = typeof trip.aiPlan === "string" ? JSON.stringify(clonedPlan) : clonedPlan;
  const updatedTrip = await Booking.findOneAndUpdate(
    { _id: tokenPayload.tripId, __v: tokenPayload.baseVersion },
    {
      $set: { aiPlan: planToSave },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" }
  );

  if (!updatedTrip) {
    throw new FixDayError(
      "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
      409,
      "CONCURRENCY_CONFLICT"
    );
  }

  // 12. Recalculate authoritative Reality Report on persisted trip
  const finalRealityReport = evaluateTripReality(updatedTrip);
  const { plan: persistedPlan } = normalizeItinerary(updatedTrip.aiPlan);
  const updatedDay = persistedPlan.days.find((d) => Number(d.day) === Number(tokenPayload.dayNumber));

  // 13. Return updated day + Reality Report
  return {
    tripId: updatedTrip._id.toString(),
    version: updatedTrip.__v,
    dayNumber: Number(tokenPayload.dayNumber),
    updatedDay,
    realityReport: finalRealityReport,
  };
}

module.exports = {
  previewFixDay,
  applyFixDay,
  signProposalToken,
  verifyProposalToken,
  calculateAllowableFutureActiveMinutes,
  buildFixDayPrompt,
  validateCandidate,
  isLockedActivityUnchanged,
  FixDayError,
  ALLOWED_CATEGORIES,
  PERIOD_ORDER,
  FIX_DAY_CANDIDATE_SCHEMA,
};
