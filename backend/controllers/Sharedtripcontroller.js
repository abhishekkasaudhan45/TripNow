const Booking = require("../models/Booking");

// @desc  Fetch a single trip by ID — PUBLIC, no auth required
// @route GET /api/trips/shared/:id
const getSharedTrip = async (req, res) => {
  try {
    const { id } = req.params;

    // Basic ObjectId length check to avoid ugly cast errors
    if (!id || id.length !== 24) {
      return res.status(400).json({ success: false, message: "Invalid trip ID" });
    }

    const trip = await Booking.findById(id).select(
      "destination checkin checkout guests aiPlan createdAt"
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // Only share trips that have an AI plan
    if (!trip.aiPlan) {
      return res.status(403).json({ success: false, message: "This trip is not shareable" });
    }

    return res.status(200).json({ success: true, data: trip });
  } catch (error) {
    console.error("getSharedTrip error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getSharedTrip };