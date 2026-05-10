const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const {
  signup,
  login,
  getMe,
} = require("../controllers/authController");

// --- Public Routes ---
// These do not require a token
router.post("/signup", signup);
router.post("/login", login);

// --- Private Routes ---
// This requires a valid Bearer token in the header
router.get("/me", protect, getMe);

module.exports = router;