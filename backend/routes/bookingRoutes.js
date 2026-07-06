const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} = require("../controllers/bookingController");

// 🔒 All routes here are scoped to the user's personal operations
router.use(protect);

// POST   /api/bookings      -> Create a personal itinerary entry
// GET    /api/bookings/mine -> Load user dashboard history
router.route("/")
  .post(createBooking)
  .get(getMyBookings);

// GET    /api/bookings/:id  -> Load a specific saved trip summary
// PUT    /api/bookings/:id  -> Update specific trip configurations
// DELETE /api/bookings/:id  -> Remove a trip from database logs
router.route("/:id")
  .get(getBookingById)
  .put(updateBooking)
  .delete(deleteBooking);

module.exports = router;