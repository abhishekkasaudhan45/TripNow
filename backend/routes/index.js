const express = require("express");

const authRoutes = require("./authRoutes");
const bookingRoutes = require("./bookingRoutes");
const adminRoutes = require("./adminRoutes");
const aiRoutes = require("./aiRoutes");       // ✅ AI route
const tripRoutes = require("./tripRoutes");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "API working ✅" });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/bookings", bookingRoutes);
router.use("/ai", aiRoutes);                  // ✅ Mounted at /api/ai
router.use("/trips", tripRoutes);

module.exports = router;