// backend/controllers/aiController.js
const Booking = require("../models/Booking");
const { executePivot, PivotError } = require("../services/pivotService");
const { toggleActivityLock } = require("../services/lockService");
const { evaluateTripReality } = require("../services/realityEngine");
const { previewFixDay, applyFixDay, FixDayError } = require("../services/fixDayService");
const {
  AIServiceError,
  itinerarySchema,
  validateItinerary,
  generateItinerary,
} = require("../services/aiService");
const { classifyGeminiError } = require("../services/geminiClient");

const handleGeminiError = (error, res) => {
  if (error instanceof AIServiceError || error?.isOperational) {
    const status = error.statusCode || error.status || 502;
    return res.status(status).json({ success: false, message: error.message });
  }

  const { bucket, httpStatus, message, logDetail } = classifyGeminiError(error);
  // 🪵 Server-side only — NEVER leaks to the client. The bucket makes Render logs triageable.
  console.error("🔒 AI Controller Internal Error:", { bucket, ...logDetail });
  return res.status(httpStatus).json({ success: false, message });
};

const generateAITrip = async (req, res) => {
  try {
    const { prompt, destination, budget, startDate, endDate } = req.body;

    if (!destination && !prompt) {
      return res.status(400).json({ success: false, message: "Trip details are required" });
    }

    const result = await generateItinerary({
      prompt,
      destination,
      budget,
      startDate,
      endDate,
      user: req.user,
    });

    return res.json({ success: true, data: result.text, tripId: result.tripId });
  } catch (error) {
    return handleGeminiError(error, res);
  }
};

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
      autoPersist: false, // Explicit: user-facing pivot generation is non-persisting (staged for review)
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
  AIServiceError,
};
