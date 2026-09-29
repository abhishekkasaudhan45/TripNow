// backend/routes/aiRoutes.js
const express = require("express");
const { aiLimiter } = require("../middleware/rateLimiters");

// 🛡️ Phase 2 Validation & Identity Additions
const optionalAuth = require("../middleware/optionalAuth");
const { validate } = require("../middleware/validate");
const { aiTripSchema } = require("../validators/aiValidators");
const { pivotRequestSchema } = require("../validators/pivotValidators");
const { lockActivitySchema } = require("../validators/lockValidators");
const { realityScoreSchema } = require("../validators/realityValidators");
const { fixDayPreviewSchema, fixDayApplySchema } = require("../validators/fixDayValidators");

const {
  generateAITrip,
  pivotAITrip,
  lockActivity,
  getRealityScore,
  previewFixDayTrip,
  applyFixDayTrip,
} = require("../controllers/aiController");

const router = express.Router();

router.post("/", aiLimiter, optionalAuth, validate(aiTripSchema), generateAITrip);
router.post("/pivot", aiLimiter, optionalAuth, validate(pivotRequestSchema), pivotAITrip);
router.post("/activity/lock", aiLimiter, optionalAuth, validate(lockActivitySchema), lockActivity);
router.post("/reality-score", aiLimiter, optionalAuth, validate(realityScoreSchema), getRealityScore);
router.post("/fix-day/preview", aiLimiter, optionalAuth, validate(fixDayPreviewSchema), previewFixDayTrip);
router.post("/fix-day/apply", aiLimiter, optionalAuth, validate(fixDayApplySchema), applyFixDayTrip);

module.exports = router;