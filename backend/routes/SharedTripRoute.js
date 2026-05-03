// backend/routes/sharedTripRoute.js
// ✅ UNPROTECTED — no auth middleware, anyone with the link can access

const express = require("express");
const router  = express.Router();
const Booking = require("../models/Booking"); // ✅ your actual model

/**
 * GET /api/bookings/shared/:id
 * Public route — returns a single booking by MongoDB _id.
 * No JWT required so shared links work for non-logged-in users.
 */
router.get("/:id", async (req, res) => {
  try {
    const trip = await Booking.findById(req.params.id).lean();

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found.",
      });
    }

    res.json({ success: true, data: trip });
  } catch (err) {
    // Catches malformed ObjectId (CastError) too
    res.status(500).json({
      success: false,
      message: "Failed to fetch trip.",
    });
  }
});

module.exports = router;