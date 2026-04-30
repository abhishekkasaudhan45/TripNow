const express = require("express");
const { createBooking } = require("../controllers/bookingController"); // Kept in case you refactor to controller pattern later
const router = express.Router();

const Booking = require("../models/Booking");

// 🟢 CREATE BOOKING (Your existing logic)
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

// ✅ GET ALL AI TRIPS (Your existing logic)
router.get("/", async (req, res) => {
  try {
    const trips = await Booking.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: trips,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trips" });
  }
});

// 🗑️ DELETE TRIP (Perfectly implemented)
router.delete("/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Trip deleted",
    });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;