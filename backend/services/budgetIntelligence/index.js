// backend/services/budgetIntelligence/index.js

const constants = require("./constants");
const baselineMatrix = require("./baselineMatrix");
const destinationTierResolver = require("./destinationTierResolver");
const budgetIntelligenceEngine = require("./budgetIntelligenceEngine");

module.exports = {
  // Constants
  ECONOMIC_TIERS: constants.ECONOMIC_TIERS,
  CALCULATION_STATUS: constants.CALCULATION_STATUS,
  COMFORT_CATEGORIES: constants.COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS: constants.CATEGORY_PROPORTIONS,
  SUPPORTED_CURRENCIES: constants.SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS: constants.CURRENCY_SYMBOLS,
  GLOBAL_TIER_CONFIG: constants.GLOBAL_TIER_CONFIG,
  GLOBAL_ESTIMATE_DISCLOSURE: constants.GLOBAL_ESTIMATE_DISCLOSURE,

  // Baseline Matrix
  BASELINE_MATRIX: baselineMatrix.BASELINE_MATRIX,
  getBaselineForTier: baselineMatrix.getBaselineForTier,
  generateCategoryBreakdown: baselineMatrix.generateCategoryBreakdown,

  // Destination Tier Resolver
  DESTINATION_REGISTRY: destinationTierResolver.DESTINATION_REGISTRY,
  normalizeDestination: destinationTierResolver.normalizeDestination,
  resolveDestinationTier: destinationTierResolver.resolveDestinationTier,

  // Engine
  parseNumericBudgetSafe: budgetIntelligenceEngine.parseNumericBudgetSafe,
  normalizeCurrencyCode: budgetIntelligenceEngine.normalizeCurrencyCode,
  calculateBudgetIntelligence: budgetIntelligenceEngine.calculateBudgetIntelligence,
};

