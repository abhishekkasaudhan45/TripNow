// backend/routes/aiRoutes.js
const express = require("express");
const { aiLimiter } = require("../middleware/rateLimiters");

// 🛡️ Phase 2 Validation & Identity Additions
const optionalAuth = require("../middleware/optionalAuth");
const { validate } = require("../middleware/validate");
const { aiTripSchema } = require("../validators/aiValidators");

const { generateAITrip } = require("../controllers/aiController");

const router = express.Router();


router.post("/", aiLimiter, optionalAuth, validate(aiTripSchema), generateAITrip);

module.exports = router;