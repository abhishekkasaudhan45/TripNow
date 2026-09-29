// backend/services/pivotService.js
const { GoogleGenAI, Type } = require("@google/genai");
const Booking = require("../models/Booking");
const env = require("../config/env");

const PIVOT_CANDIDATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    replacement: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        indoorOutdoor: {
          type: Type.STRING,
          enum: ["Indoor", "Outdoor", "Mixed"],
        },
        estimatedDurationMinutes: { type: Type.INTEGER },
        costEstimate: { type: Type.STRING },
        reason: { type: Type.STRING },
        insiderTip: { type: Type.STRING },
      },
      required: [
        "title",
        "description",
        "category",
        "indoorOutdoor",
        "estimatedDurationMinutes",
        "costEstimate",
        "reason",
        "insiderTip",
      ],
    },
  },
  required: ["replacement"],
};

class PivotError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = "PivotError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Load authoritative trip from MongoDB and verify access permissions.
 */
async function loadTripAndAuthorize(tripId, user) {
  const trip = await Booking.findById(tripId);
  if (!trip) {
    throw new PivotError("Trip not found", 404);
  }

  // Ownership verification: If the trip belongs to a user, caller must match
  if (trip.user) {
    const callerId = user?._id ? user._id.toString() : null;
    if (!callerId || trip.user.toString() !== callerId) {
      throw new PivotError("You are not authorized to modify this trip", 403);
    }
  }

  return trip;
}

const { normalizeItinerary, findActivityInPlan } = require("../utils/itineraryNormalizer");

/**
 * Safely parse aiPlan and locate the specific day and block context.
 * Enforces Phase 2 Structured Activity checks and activity lock invariants.
 */
function extractBlockContext(trip, param1, param2) {
  let dayNumber;
  let block;
  let activityId;

  if (param1 && typeof param1 === "object") {
    dayNumber = param1.dayNumber;
    block = param1.block;
    activityId = param1.activityId;
  } else {
    dayNumber = param1;
    block = param2;
  }

  const { plan } = normalizeItinerary(trip.aiPlan);

  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
    throw new PivotError("Trip does not contain a valid days itinerary", 404);
  }

  let match = null;
  if (activityId) {
    match = findActivityInPlan(plan, { activityId });
    if (!match) {
      throw new PivotError(`Activity '${activityId}' not found in trip itinerary`, 404);
    }
  } else if (dayNumber !== undefined && block) {
    match = findActivityInPlan(plan, { dayNumber, block });
  }

  let targetDay;
  let dayIndex;
  let targetActivity = match?.activity || null;
  let resolvedBlock = block;
  let resolvedDayNumber = dayNumber;

  if (match) {
    targetDay = match.day;
    dayIndex = match.dayIndex;
    resolvedBlock = match.activity.period;
    resolvedDayNumber = match.day.day;
  } else {
    dayIndex = plan.days.findIndex((d) => Number(d.day) === Number(dayNumber));
    if (dayIndex === -1) {
      throw new PivotError(`Day ${dayNumber} not found in trip itinerary`, 404);
    }
    targetDay = plan.days[dayIndex];
    if (!(block in targetDay)) {
      throw new PivotError(`Block '${block}' does not exist on Day ${dayNumber}`, 400);
    }
  }

  // 🔒 INVARIANT: Check if activity is locked
  if (targetActivity && targetActivity.locked === true) {
    throw new PivotError("Cannot pivot a locked activity. Please unlock the activity first.", 423);
  }

  const currentActivity = targetActivity
    ? `${targetActivity.title} — ${targetActivity.description}`
    : targetDay[resolvedBlock];

  return {
    plan,
    dayIndex,
    targetDay,
    targetActivity,
    activityId: targetActivity?.id || null,
    dayNumber: resolvedDayNumber,
    block: resolvedBlock,
    currentActivity,
    destination: trip.destination || plan.destination || "Destination",
    budget: trip.budget || plan.budgetBreakdown?.total || "Standard",
    neighborBlocks: {
      morning: targetDay.morning,
      afternoon: targetDay.afternoon,
      evening: targetDay.evening,
    },
  };
}

/**
 * Build tailored instructions and constraints for the Gemini prompt.
 */
function buildPivotPrompt({
  destination,
  budget,
  dayNumber,
  block,
  currentActivity,
  neighborBlocks,
  pivotReason,
  customReason,
  retryConstraint = null,
}) {
  let constraintInstructions = "";

  switch (pivotReason) {
    case "rain":
      constraintInstructions = `
REASON CONSTRAINTS (RAIN):
- Prefer: 100% Indoor, covered, or weather-resilient activities (museums, indoor markets, cultural centers, aquariums, art galleries, historic tea houses).
- Avoid: Beaches, open viewpoints, outdoor walks, coastal cruises, hiking, or open-air parks.
- STRICT RULE: indoorOutdoor MUST be "Indoor" or "Mixed" (sheltered). indoorOutdoor CANNOT be "Outdoor".
`;
      break;
    case "low_energy":
      constraintInstructions = `
REASON CONSTRAINTS (LOW ENERGY):
- Prefer: Relaxing, seated, low-exertion experiences (spas, gentle scenic viewpoints, tea houses, relaxing boat rides, easy cafes, quiet libraries).
- Avoid: Strenuous hikes, long walking tours, intensive sports, crowded high-stress sights.
- STRICT RULE: estimatedDurationMinutes must be relaxing and low physical strain (under 180 minutes).
`;
      break;
    case "budget":
      constraintInstructions = `
REASON CONSTRAINTS (BUDGET CONCERN):
- Prefer: Free or very low-cost experiences (public parks, historic courtyards, free museums, street art walks, affordable local markets).
- Avoid: High-priced admission venues, expensive guided tours, luxury dining.
- STRICT RULE: costEstimate must be free or minimal.
`;
      break;
    case "running_late":
      constraintInstructions = `
REASON CONSTRAINTS (RUNNING LATE):
- Prefer: Compact, flexible, quick activities with low transit overhead and no strict entry deadlines.
- Avoid: Long transfers, rigid booking windows, activities requiring more than 2 hours.
- STRICT RULE: estimatedDurationMinutes must be 90 minutes or less.
`;
      break;
    case "closed":
      constraintInstructions = `
REASON CONSTRAINTS (VENUE CLOSED):
- Prefer: High-quality alternatives with a similar cultural or recreational vibe located in the same geographic area.
- Avoid: Recommending the exact same closed activity.
- STRICT RULE: title must NOT match the original closed activity: "${currentActivity}".
`;
      break;
    case "custom":
      constraintInstructions = `
REASON CONSTRAINTS (CUSTOM TRAVELER SITUATION):
- Traveler's situation: "${customReason || "Specific accommodation needed"}"
- Strictly tailor the replacement to satisfy this custom need.
`;
      break;
    default:
      constraintInstructions = "Provide a high-quality, culturally engaging alternative activity.";
  }

  let prompt = `
Destination: ${destination}
Overall Trip Budget: ${budget}
Target Day: Day ${dayNumber}
Target Period: ${block.toUpperCase()}
Current Planned Activity to Replace: "${currentActivity}"

Context for Day ${dayNumber}:
- Morning: "${neighborBlocks.morning || "N/A"}"
- Afternoon: "${neighborBlocks.afternoon || "N/A"}"
- Evening: "${neighborBlocks.evening || "N/A"}"

Pivot Reason: ${pivotReason.toUpperCase()}
${constraintInstructions}

Respond ONLY with a JSON object adhering strictly to the schema.
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
 * Validate that candidate meets semantic constraints for the pivot reason.
 */
function validateCandidateSemantics(candidate, pivotReason, originalActivity) {
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, violation: "Candidate is not an object" };
  }

  const {
    title,
    description,
    category,
    indoorOutdoor,
    estimatedDurationMinutes,
    costEstimate,
    reason,
    insiderTip,
  } = candidate;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, violation: "Missing or empty title" };
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return { valid: false, violation: "Missing or empty description" };
  }
  if (!category || typeof category !== "string") {
    return { valid: false, violation: "Missing category" };
  }
  if (!["Indoor", "Outdoor", "Mixed"].includes(indoorOutdoor)) {
    return { valid: false, violation: "indoorOutdoor must be 'Indoor', 'Outdoor', or 'Mixed'" };
  }
  if (typeof estimatedDurationMinutes !== "number" || estimatedDurationMinutes <= 0) {
    return { valid: false, violation: "estimatedDurationMinutes must be a positive integer" };
  }
  if (!costEstimate || typeof costEstimate !== "string") {
    return { valid: false, violation: "Missing costEstimate" };
  }
  if (!reason || typeof reason !== "string") {
    return { valid: false, violation: "Missing reason" };
  }
  if (!insiderTip || typeof insiderTip !== "string") {
    return { valid: false, violation: "Missing insiderTip" };
  }

  // Reason-specific semantic validation
  if (pivotReason === "rain") {
    if (indoorOutdoor === "Outdoor") {
      return {
        valid: false,
        violation: "The replacement was marked 'Outdoor' during a rain disruption. It must be Indoor or weather-resilient.",
      };
    }
  }

  if (pivotReason === "running_late") {
    if (estimatedDurationMinutes > 120) {
      return {
        valid: false,
        violation: `Duration of ${estimatedDurationMinutes}m is too long for a traveler running late. Must be 90m or less.`,
      };
    }
  }

  if (pivotReason === "closed" && originalActivity) {
    if (title.toLowerCase().trim() === originalActivity.toLowerCase().trim()) {
      return {
        valid: false,
        violation: "Candidate recommended the exact same activity that was reported closed.",
      };
    }
  }

  return { valid: true };
}

/**
 * Call Gemini API with timeout protection and model fallback.
 */
async function callGemini(prompt, attempt = 1) {
  if (!env.geminiApiKey) {
    throw new PivotError("AI service configuration error: API key is missing", 500);
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
            "You are an expert adaptive travel planner. You replace single itinerary blocks when reality disrupts travel plans. Respond ONLY with valid JSON adhering strictly to the schema. Never return markdown backticks or commentary.",
          responseMimeType: "application/json",
          responseSchema: PIVOT_CANDIDATE_SCHEMA,
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
              "You are an expert adaptive travel planner. You replace single itinerary blocks when reality disrupts travel plans. Respond ONLY with valid JSON adhering strictly to the schema. Never return markdown backticks or commentary.",
            responseMimeType: "application/json",
            responseSchema: PIVOT_CANDIDATE_SCHEMA,
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
    // Allow process to exit cleanly
    if (timer.unref) timer.unref();
  });

  let response;
  try {
    response = await Promise.race([requestPromise, timeoutPromise]);
  } catch (err) {
    // Check if error is timeout
    if (
      err.status === 504 ||
      err.name === "AbortError" ||
      err.code === "ETIMEDOUT" ||
      err.message?.toLowerCase().includes("timed out")
    ) {
      throw new PivotError("AI service request timed out. Please try again.", 504);
    }
    // Check if rate limited
    if (
      err.status === 429 ||
      err.message?.includes("RESOURCE_EXHAUSTED") ||
      err.message?.includes("Quota exceeded")
    ) {
      throw new PivotError("AI service rate limit reached. Please try again in a few moments.", 429);
    }
    // Check auth
    if (
      err.status === 401 ||
      err.status === 403 ||
      err.message?.includes("API_KEY_INVALID") ||
      err.message?.includes("API key not valid")
    ) {
      throw new PivotError("AI service authentication failed", 502);
    }

    throw new PivotError("Upstream AI service error", 502, err.message);
  }

  let text = response.text || "";
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  if (!text) {
    throw new PivotError("AI service returned an empty response", 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PivotError("AI service returned malformed JSON", 502);
  }

  return parsed.replacement || parsed;
}

/**
 * Primary Pivot orchestration: load, prompt, generate with 1 retry, mutate, and save atomically.
 */
async function executePivot({ tripId, dayNumber, block, activityId, pivotReason, customReason, user }) {
  // 1. Load and authorize
  const trip = await loadTripAndAuthorize(tripId, user);
  const currentVersion = trip.__v;

  // 2. Extract block context (enforces lock checks)
  const context = extractBlockContext(trip, { dayNumber, block, activityId });
  const resolvedDayNumber = context.dayNumber;
  const resolvedBlock = context.block;

  // 3. Assemble prompt for first attempt
  let prompt = buildPivotPrompt({
    ...context,
    dayNumber: resolvedDayNumber,
    block: resolvedBlock,
    pivotReason,
    customReason,
  });

  // 4. Generate candidate (Attempt 1)
  console.log(`⚡ [Pivot] Generating candidate for trip=${tripId} D${resolvedDayNumber} ${resolvedBlock} reason=${pivotReason} (Attempt 1)...`);
  let candidate = await callGemini(prompt, 1);
  let validation = validateCandidateSemantics(candidate, pivotReason, context.currentActivity);

  // 5. Defensive Retry (Attempt 2) if semantic validation failed
  if (!validation.valid) {
    console.warn(`⚠️ [Pivot] Candidate attempt 1 failed semantic check: "${validation.violation}". Triggering single corrective retry...`);
    const retryPrompt = buildPivotPrompt({
      ...context,
      dayNumber: resolvedDayNumber,
      block: resolvedBlock,
      pivotReason,
      customReason,
      retryConstraint: validation.violation,
    });

    candidate = await callGemini(retryPrompt, 2);
    validation = validateCandidateSemantics(candidate, pivotReason, context.currentActivity);

    if (!validation.valid) {
      console.error(`🔒 [Pivot] Corrective retry failed constraint check again: "${validation.violation}". Aborting mutation.`);
      throw new PivotError(
        "Unable to find a suitable replacement right now. Please try again.",
        502,
        validation.violation
      );
    }
    console.log("✅ [Pivot] Corrective retry candidate passed validation!");
  } else {
    console.log("✅ [Pivot] Candidate passed validation on first attempt.");
  }

  // 6. Surgical Mutation: Mutate ONLY the target block and its structured activity
  const clonedPlan = JSON.parse(JSON.stringify(context.plan));
  const formattedBlock = `${candidate.title} — ${candidate.description}`;
  clonedPlan.days[context.dayIndex][resolvedBlock] = formattedBlock;

  if (Array.isArray(clonedPlan.days[context.dayIndex].activities)) {
    const actMatch = clonedPlan.days[context.dayIndex].activities.find(
      (a) => (context.activityId && a.id === context.activityId) || a.period === resolvedBlock
    );
    if (actMatch) {
      actMatch.title = candidate.title;
      actMatch.description = candidate.description;
      actMatch.category = candidate.category;
      actMatch.durationMinutes = candidate.estimatedDurationMinutes;
      actMatch.cost = candidate.costEstimate;
      actMatch.indoorOutdoor = candidate.indoorOutdoor;
    }
  }

  // 7. Atomic persistence with Optimistic Concurrency Control (__v)
  const planToSave = typeof trip.aiPlan === "string" ? JSON.stringify(clonedPlan) : clonedPlan;

  const updatedTrip = await Booking.findOneAndUpdate(
    { _id: tripId, __v: currentVersion },
    {
      $set: { aiPlan: planToSave },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" }
  );

  if (!updatedTrip) {
    console.warn(`🔒 [Pivot] Optimistic concurrency conflict on trip=${tripId}. Expected __v=${currentVersion}.`);
    throw new PivotError(
      "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
      409
    );
  }

  console.log(`🎉 [Pivot] Successfully persisted surgical pivot on trip=${tripId} D${resolvedDayNumber} ${resolvedBlock}!`);

  return {
    tripId: trip._id.toString(),
    dayNumber: Number(resolvedDayNumber),
    block: resolvedBlock,
    activityId: context.activityId || null,
    pivotReason,
    replacement: candidate,
    formattedBlock,
  };
}

module.exports = {
  executePivot,
  loadTripAndAuthorize,
  extractBlockContext,
  buildPivotPrompt,
  validateCandidateSemantics,
  callGemini,
  PivotError,
  PIVOT_CANDIDATE_SCHEMA,
};
