const express = require("express");
const { createBooking } = require("../controllers/bookingController");
const router = express.Router();

const Booking = require("../models/Booking");

// CREATE BOOKING
router.post("/", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    const saved = await booking.save();

    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error saving booking",
    });
  }
});

module.exports = router;
