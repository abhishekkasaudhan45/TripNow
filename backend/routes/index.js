const express = require("express");

// Imports
const authRoutes      = require("./authRoutes");
const adminRoutes     = require("./adminRoutes");
const aiRoutes        = require("./aiRoutes");       
const tripRoutes      = require("./tripRoutes");
const bookingRoutes   = require("./bookingRoutes");
const sharedTripRoute = require("./sharedTripRoute"); // ✅ NEW: Public shared route

const router = express.Router();

// Root test
router.get("/", (req, res) => {
  res.json({ message: "API working ✅" });
});

// Standard Routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/ai", aiRoutes);                  
router.use("/trips", tripRoutes);

// ✅ IMPORTANT ROUTING ORDER
// Mount /bookings/shared BEFORE /bookings so Express matches the specific public route first.
// Otherwise, a dynamic route like /bookings/:id might accidentally swallow it.
router.use("/bookings/shared", sharedTripRoute); // 🟢 Public, no JWT required
router.use("/bookings", bookingRoutes);          // 🔴 Protected (existing)

module.exports = router;