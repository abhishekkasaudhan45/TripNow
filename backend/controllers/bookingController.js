const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { sendSuccess } = require("../utils/response");
const storageService = require("../services/storageService");
const { normalizeItinerary } = require("../utils/itineraryNormalizer");
const { evaluateTripReality } = require("../services/realityEngine");

// @desc    Create a new manual trip/booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res, next) => {
  try {
    // Automatically link the new entry to the logged-in user
    const bookingData = {
      ...req.body,
      user: req.user?._id || null,
    };

    const booking = await Booking.create(bookingData);

    sendSuccess(res, {
      statusCode: 201,
      message: "Booking saved successfully",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all saved itineraries for the logged-in user
// @route   GET /api/bookings/mine
// @access  Private
const getMyBookings = async (req, res, next) => {
  try {
    const trips = await Booking.find({ user: req.user._id })
      .select("destination checkin checkout guests budget dayCount coverImage isShared createdAt notes")
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, {
      statusCode: 200,
      message: "Your trips fetched successfully",
      data: trips,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single trip by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res, next) => {
  try {
    const trip = await Booking.findOne({ _id: req.params.id, user: req.user._id }).lean();

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Trip fetched successfully",
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update/Edit an existing trip
// @route   PUT /api/bookings/:id
// @access  Private
const updateBooking = async (req, res, next) => {
  try {
    const allowedFields = [
      "destination", "checkin", "checkout",
      "guests", "budget", "notes", "fullName",
      "email", "phone", "dayCount", "coverImage",
    ];

    // Only copy allowed fields — never let the client overwrite raw AI plans directly
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Recalculate day tracking count if parameters changed
    if (updates.checkin && updates.checkout) {
      const cin = new Date(updates.checkin);
      const cout = new Date(updates.checkout);
      updates.dayCount = Math.max(1, Math.round((cout - cin) / 86400000));
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Trip updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a saved trip
// @route   DELETE /api/bookings/:id
// @access  Private
const deleteBooking = async (req, res, next) => {
  try {
    const deleted = await Booking.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    if (deleted.coverImage) {
      storageService.deleteImage(deleted.coverImage).catch((err) => {
        console.warn("⚠️ Non-fatal image cleanup on trip delete error:", err.message);
      });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Trip deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings (Admin View with Pagination)
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getBookings = async (req, res, next) => {
  try {
    const requestedPage = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "8", 10), 1), 50);
    const total = await Booking.countDocuments();
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * limit;

    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    sendSuccess(res, {
      message: "Bookings fetched successfully",
      data: bookings,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Explicitly share a trip (make it publicly viewable)
// @route   PATCH /api/bookings/:id/share
// @access  Private (Owner only)
const shareBooking = async (req, res, next) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid trip ID format" });
    }

    const trip = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isShared: true } },
      { returnDocument: "after" }
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Trip shared successfully",
      data: { _id: trip._id, isShared: true },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Explicitly unshare a trip (make it private)
// @route   PATCH /api/bookings/:id/unshare
// @access  Private (Owner only)
const unshareBooking = async (req, res, next) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid trip ID format" });
    }

    const trip = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isShared: false } },
      { returnDocument: "after" }
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Trip unshared successfully",
      data: { _id: trip._id, isShared: false },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload trip cover image
// @route   POST /api/bookings/:id/cover-image
// @access  Private
const uploadCoverImage = async (req, res, next) => {
  try {
    const trip = await Booking.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    const isOwner = trip.user && trip.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this trip's cover image",
      });
    }

    if (!req.validatedImage) {
      return res.status(400).json({
        success: false,
        message: "No validated image file found.",
      });
    }

    const oldCoverImage = trip.coverImage;

    // Upload to storage provider
    const uploadResult = await storageService.uploadImage(req.validatedImage.buffer, {
      folder: "tripnow/covers",
      format: req.validatedImage.extension,
    });

    // Update trip coverImage in database
    trip.coverImage = uploadResult.url;
    try {
      await trip.save();
    } catch (dbErr) {
      // If database persistence fails, attempt to remove the newly uploaded asset
      storageService.deleteImage(uploadResult.url || uploadResult.publicId).catch((cleanupErr) => {
        console.warn(
          "⚠️ Non-fatal newly uploaded image cleanup error after DB persistence failure:",
          cleanupErr.message
        );
      });
      throw dbErr;
    }

    // If previous image was a custom cloud asset, safely remove it in the background
    if (oldCoverImage && oldCoverImage !== uploadResult.url) {
      storageService.deleteImage(oldCoverImage).catch((err) => {
        console.warn("⚠️ Non-fatal old image cleanup error:", err.message);
      });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Cover image uploaded successfully",
      data: {
        coverImage: trip.coverImage,
        tripId: trip._id,
      },
    });
  } catch (error) {
    if (error.name === "StorageServiceError") {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// @desc    Remove trip cover image
// @route   DELETE /api/bookings/:id/cover-image
// @access  Private
const deleteCoverImage = async (req, res, next) => {
  try {
    const trip = await Booking.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    const isOwner = trip.user && trip.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this trip's cover image",
      });
    }

    const oldCoverImage = trip.coverImage;
    if (oldCoverImage) {
      await storageService.deleteImage(oldCoverImage);
      trip.coverImage = null;
      await trip.save();
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Cover image removed successfully",
      data: {
        coverImage: null,
        tripId: trip._id,
      },
    });
  } catch (error) {
    if (error.name === "StorageServiceError") {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// @desc    Update and persist modified itinerary (Phase 3C)
// @route   PATCH /api/bookings/:id/itinerary
// @access  Private
const updateItinerary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itinerary, baseVersion } = req.body;
    const parsedBaseVersion = Number(baseVersion);

    // 1. Ownership & existence verification
    const existingTrip = await Booking.findOne({ _id: id, user: req.user._id });
    if (!existingTrip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // 2. Optimistic Concurrency Control check
    if (existingTrip.__v !== parsedBaseVersion) {
      return res.status(409).json({
        success: false,
        message: "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
        currentVersion: existingTrip.__v,
        expectedVersion: parsedBaseVersion,
      });
    }

    // 3. Extract and enforce activity lock invariants
    const { plan: existingPlan } = normalizeItinerary(existingTrip.aiPlan);
    const lockedMap = new Map();
    if (existingPlan && Array.isArray(existingPlan.days)) {
      for (const day of existingPlan.days) {
        if (Array.isArray(day.activities)) {
          for (const act of day.activities) {
            if (act && act.locked === true) {
              lockedMap.set(act.id, act);
            }
          }
        }
      }
    }

    const { plan: incomingPlan } = normalizeItinerary(itinerary);

    if (lockedMap.size > 0) {
      const incomingActivities = new Map();
      if (incomingPlan && Array.isArray(incomingPlan.days)) {
        for (const day of incomingPlan.days) {
          if (Array.isArray(day.activities)) {
            for (const act of day.activities) {
              if (act && act.id) {
                incomingActivities.set(act.id, act);
              }
            }
          }
        }
      }

      for (const [lockedId, originalAct] of lockedMap.entries()) {
        const incomingAct = incomingActivities.get(lockedId);
        if (!incomingAct) {
          return res.status(423).json({
            success: false,
            message: `Locked activity '${originalAct.title}' is missing from the updated itinerary. Locked activities cannot be deleted.`,
          });
        }

        if (incomingAct.locked !== true) {
          return res.status(423).json({
            success: false,
            message: `Cannot unlock activity '${originalAct.title}' via itinerary save. Use the dedicated activity lock toggle action.`,
          });
        }

        const titleChanged = incomingAct.title !== originalAct.title;
        const descChanged = incomingAct.description !== originalAct.description;
        const periodChanged = incomingAct.period !== originalAct.period;
        const categoryChanged = incomingAct.category !== originalAct.category;
        const activityTypeChanged = (incomingAct.activityType ?? null) !== (originalAct.activityType ?? null);
        const durationChanged = (incomingAct.durationMinutes ?? null) !== (originalAct.durationMinutes ?? null);
        const travelModeChanged = (incomingAct.travelMode ?? null) !== (originalAct.travelMode ?? null);
        const intensityChanged = (incomingAct.intensity ?? null) !== (originalAct.intensity ?? null);

        if (
          titleChanged ||
          descChanged ||
          periodChanged ||
          categoryChanged ||
          activityTypeChanged ||
          durationChanged ||
          travelModeChanged ||
          intensityChanged
        ) {
          return res.status(423).json({
            success: false,
            message: `Cannot modify locked activity '${originalAct.title}'. Please unlock the activity first.`,
          });
        }
      }
    }

    // 4. Deterministic Reality Score synchronization
    let realityReport = null;
    try {
      realityReport = evaluateTripReality({
        aiPlan: incomingPlan,
        budget: existingTrip.budget,
      });
    } catch (err) {
      console.warn("⚠️ Non-fatal reality score evaluation failure during itinerary save:", err.message);
    }

    // 5. Atomic persistence of ONLY aiPlan and realityScore with OCC
    const planToSave = typeof existingTrip.aiPlan === "string" ? JSON.stringify(incomingPlan) : incomingPlan;
    const updateSet = { aiPlan: planToSave };
    if (realityReport) {
      updateSet.realityScore = realityReport;
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: id, user: req.user._id, __v: parsedBaseVersion },
      {
        $set: updateSet,
        $inc: { __v: 1 },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "Conflict: Trip was modified concurrently by another action. Please refresh and try again.",
      });
    }

    sendSuccess(res, {
      statusCode: 200,
      message: "Itinerary saved successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBooking,
  updateItinerary,
  deleteBooking,
  getBookings,
  shareBooking,
  unshareBooking,
  uploadCoverImage,
  deleteCoverImage,
};