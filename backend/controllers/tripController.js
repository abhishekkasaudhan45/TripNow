const Trip = require("../models/Trip");

// 1. Create a trip (linked to logged-in user)
const createTrip = async (req, res, next) => {
  try {
    const { destination, budget, itinerary, rawResponse } = req.body;

    const trip = await Trip.create({
      user: req.user.id, // 👇 Secures the trip to the specific user
      destination,
      budget,
      itinerary,
      rawResponse,
    });

    res.status(201).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get trips (only fetch trips owned by the user)
const getTrips = async (req, res, next) => {
  try {
    // 👇 Matches the user ID from the JWT token
    const trips = await Trip.find({ user: req.user.id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: trips,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Delete a trip (ensures user owns the trip before deleting)
const deleteTrip = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 👇 Validates both the Trip ID and the User ID
    const trip = await Trip.findOneAndDelete({ _id: id, user: req.user.id });

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found or unauthorized" });
    }

    res.json({
      success: true,
      message: "Trip deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// 4. Update a trip (ensures user owns the trip before updating)
const updateTrip = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 👇 Validates both the Trip ID and the User ID
    const updated = await Trip.findOneAndUpdate(
      { _id: id, user: req.user.id },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Trip not found or unauthorized" });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTrip, getTrips, deleteTrip, updateTrip };