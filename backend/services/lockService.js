// backend/services/lockService.js
const Booking = require("../models/Booking");
const { normalizeItinerary, findActivityInPlan } = require("../utils/itineraryNormalizer");
const { PivotError } = require("./pivotService");

/**
 * Toggles the server-authoritative lock state of a structured activity.
 */
async function toggleActivityLock({ tripId, activityId, locked, user }) {
  // 1. Load authoritative trip
  const trip = await Booking.findById(tripId);
  if (!trip) {
    throw new PivotError("Trip not found", 404);
  }

  // 2. Ownership verification: If the trip belongs to a user, caller must match
  if (trip.user) {
    const callerId = user?._id ? user._id.toString() : null;
    if (!callerId || trip.user.toString() !== callerId) {
      throw new PivotError("You are not authorized to modify this trip", 403);
    }
  }

  const currentVersion = trip.__v;

  // 3. Normalize itinerary to guarantee Phase 2 Structured Activity model
  const { plan, isString } = normalizeItinerary(trip.aiPlan);
  if (!plan || !Array.isArray(plan.days)) {
    throw new PivotError("Trip does not contain a valid itinerary structure", 404);
  }

  // 4. Locate target activity
  const match = findActivityInPlan(plan, { activityId });
  if (!match) {
    throw new PivotError(`Activity '${activityId}' not found in trip itinerary`, 404);
  }

  // 5. Update lock status
  match.activity.locked = Boolean(locked);

  // 6. Synchronize legacy block string for dual-format compatibility if missing
  if (!match.day[match.activity.period]) {
    match.day[match.activity.period] = `${match.activity.title} — ${match.activity.description}`;
  }

  // 7. Atomic persistence with Optimistic Concurrency Control
  const planToSave = isString ? JSON.stringify(plan) : plan;

  const updatedTrip = await Booking.findOneAndUpdate(
    { _id: tripId, __v: currentVersion },
    {
      $set: { aiPlan: planToSave },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" }
  );

  if (!updatedTrip) {
    throw new PivotError(
      "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
      409
    );
  }

  console.log(`🔒 [Lock] Activity ${activityId} on trip ${tripId} locked=${match.activity.locked}`);

  return {
    tripId: trip._id.toString(),
    activityId,
    locked: match.activity.locked,
    activity: match.activity,
  };
}

module.exports = {
  toggleActivityLock,
};
