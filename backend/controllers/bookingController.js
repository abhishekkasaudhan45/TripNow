const Booking = require("../models/Booking");
const { sendSuccess } = require("../utils/response");

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
    const trips = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });

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
      "email", "phone", "dayCount",
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
      { new: true, runValidators: true }
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

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getBookings, // Kept separate for your admin system use
};