const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const { getBookings } = require("../controllers/bookingController");

// ✅ FIX: create correct route
router.get("/bookings", protect, getBookings);

module.exports = router;