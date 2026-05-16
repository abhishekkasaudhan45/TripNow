const express = require("express");

// Imports
const authRoutes      = require("./authRoutes");
const adminRoutes     = require("./adminRoutes");
const aiRoutes        = require("./aiRoutes");       
const tripRoutes      = require("./tripRoutes");
const bookingRoutes   = require("./bookingRoutes");
const sharedTripRoutes = require("./SharedTripRoute");
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
router.use("/bookings/shared", sharedTripRoute);
router.use("/bookings", bookingRoutes);          

module.exports = router;