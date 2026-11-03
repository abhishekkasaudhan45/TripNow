// backend/routes/budgetRoutes.js
const express = require("express");
const router = express.Router();
const optionalAuth = require("../middleware/optionalAuth");
const { validate } = require("../middleware/validate");
const { budgetLimiter } = require("../middleware/rateLimiters");
const { budgetCalculationSchema } = require("../validators/budgetValidators");
const { getBudgetIntelligence } = require("../controllers/budgetController");

// POST /api/budget/intelligence -> Deterministic Budget Intelligence Calculation
router.post(
  "/intelligence",
  budgetLimiter,
  optionalAuth,
  validate(budgetCalculationSchema),
  getBudgetIntelligence
);

// Alias: POST /api/budget/calculate
router.post(
  "/calculate",
  budgetLimiter,
  optionalAuth,
  validate(budgetCalculationSchema),
  getBudgetIntelligence
);

module.exports = router;

