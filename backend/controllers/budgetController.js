// backend/controllers/budgetController.js
const { calculateBudgetIntelligence, CALCULATION_STATUS } = require("../services/budgetIntelligence");
const { sendSuccess } = require("../utils/response");

/**
 * Controller to compute deterministic budget intelligence.
 * Route: POST /api/budget/intelligence
 *
 * Guarantees:
 * - Pure calculation: Zero Gemini / AI API calls.
 * - Zero database writes.
 * - Zero external currency API calls.
 * - Ignores any client-supplied calculated values.
 * - Never leaks internal stack traces.
 */
const getBudgetIntelligence = async (req, res, next) => {
  try {
    const { totalBudget, days, guests, destination, currency } = req.body;

    const result = calculateBudgetIntelligence({
      totalBudget,
      days,
      guests,
      destination,
      currency,
    });

    if (result.status === CALCULATION_STATUS.INVALID_INPUT) {
      return res.status(400).json({
        success: false,
        message: "Invalid budget calculation input",
        errors: result.validationErrors,
      });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: "Budget intelligence calculated successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBudgetIntelligence,
};

