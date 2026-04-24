const Booking = require("../models/Booking");
const { sendSuccess } = require("../utils/response");

const createBooking = async (req, res, next) => {
  try {
    const booking = await Booking.create(req.body);

    sendSuccess(res, {
      statusCode: 201,
      message: "Booking saved successfully",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const requestedPage = Math.max(
      Number.parseInt(req.query.page || "1", 10),
      1
    );
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit || "8", 10), 1),
      50
    );
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
  getBookings,
};
