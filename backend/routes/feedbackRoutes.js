const express = require("express");
const router = express.Router();
const optionalAuth = require("../middleware/optionalAuth");
const protect = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { feedbackLimiter } = require("../middleware/rateLimiters");
const { createFeedback, getAllFeedback } = require("../controllers/feedbackController");

// Public feedback submission (with optional authentication attachment)
router.post("/", feedbackLimiter, optionalAuth, createFeedback);

// Admin review endpoint (protected)
router.get("/", protect, requireAdmin, getAllFeedback);

module.exports = router;

