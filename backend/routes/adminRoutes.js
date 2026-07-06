const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");

const { getBookings } = require("../controllers/bookingController");


router.use(protect, requireAdmin);

router.get("/bookings", getBookings);

module.exports = router;