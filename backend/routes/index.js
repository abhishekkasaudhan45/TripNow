const express = require("express");

// Imports
const authRoutes       = require("./authRoutes");
const adminRoutes      = require("./adminRoutes");
const aiRoutes         = require("./aiRoutes");
const bookingRoutes    = require("./bookingRoutes");
const budgetRoutes     = require("./budgetRoutes");
const sharedTripRoutes = require("./SharedTripRoute");
const feedbackRoutes   = require("./feedbackRoutes");
const { getCsrfTokenHandler } = require("../middleware/csrf");
const router = express.Router();

// Root test
router.get("/", (req, res) => {
  res.json({ message: "API working ✅" });
});

// 🛡️ CSRF Token Issuance
router.get("/csrf-token", getCsrfTokenHandler);

// Standard Routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/ai", aiRoutes);                  
router.use("/budget", budgetRoutes);
router.use("/bookings/shared", sharedTripRoutes); // ✅ Standard booking share path
router.use("/shared", sharedTripRoutes);          // 🔒 Alias for /api/shared/:id
router.use("/bookings", bookingRoutes);          
router.use("/feedback", feedbackRoutes);          

module.exports = router;