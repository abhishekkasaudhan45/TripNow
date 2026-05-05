// backend/routes/bookingRoutes.js
const express  = require("express");
const router   = express.Router();
const Booking  = require("../models/Booking");

// ── CREATE ────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    const saved   = await booking.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("Create booking error:", err);
    res.status(500).json({ success: false, message: err.message || "Error saving booking" });
  }
});

// ── GET ALL ───────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const trips = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, data: trips });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch trips" });
  }
});

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const trip = await Booking.findById(req.params.id).lean();
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, data: trip });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch trip" });
  }
});

// ── UPDATE (EDIT) ─────────────────────────────────────────────────────────
// ✅ NEW: allows users to edit destination, dates, guests, budget, notes
router.put("/:id", async (req, res) => {
  try {
    const allowedFields = [
      "destination", "checkin", "checkout",
      "guests", "budget", "notes", "fullName",
      "email", "phone", "dayCount",
    ];

    // Only pick allowed fields — never let frontend overwrite aiPlan/tripData
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Recalculate dayCount if dates changed
    if (updates.checkin && updates.checkout) {
      const cin  = new Date(updates.checkin);
      const cout = new Date(updates.checkout);
      updates.dayCount = Math.max(1, Math.round((cout - cin) / 86400000));
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Trip not found" });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Update booking error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to update trip" });
  }
});

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Trip deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;