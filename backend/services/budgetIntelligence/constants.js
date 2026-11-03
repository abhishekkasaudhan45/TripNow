// backend/services/budgetIntelligence/constants.js

/**
 * Canonical destination economic tiers.
 * Exactly four categories as mandated by Phase 5E.2.
 */
const ECONOMIC_TIERS = Object.freeze({
  TIER_1_METRO: "TIER_1_METRO",
  TIER_2_RESORT: "TIER_2_RESORT",
  TIER_3_BUDGET: "TIER_3_BUDGET",
  TIER_4_INTERNATIONAL: "TIER_4_INTERNATIONAL",
  GLOBAL_TIER_A: "GLOBAL_TIER_A",
  GLOBAL_TIER_B: "GLOBAL_TIER_B",
  GLOBAL_TIER_C: "GLOBAL_TIER_C",
  UNKNOWN: "UNKNOWN",
});

/**
 * Calculation result status codes.
 */
const CALCULATION_STATUS = Object.freeze({
  CALCULATED: "CALCULATED",
  GLOBAL_ESTIMATE_ADVISORY: "GLOBAL_ESTIMATE_ADVISORY",
  BASELINE_NOT_CONFIGURED: "BASELINE_NOT_CONFIGURED",
  UNSUPPORTED_CURRENCY: "UNSUPPORTED_CURRENCY",
  UNKNOWN_DESTINATION: "UNKNOWN_DESTINATION",
  INVALID_INPUT: "INVALID_INPUT",
});

/**
 * Global Tier Config & Reference Ranges (in INR per person per day).
 * All three estimates (low, mid, high) are strictly preserved.
 */
const GLOBAL_TIER_CONFIG = Object.freeze({
  [ECONOMIC_TIERS.GLOBAL_TIER_A]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    label: "Budget Neighbors & Southeast Asia",
    low: 3500,
    mid: 5500,
    high: 11000,
  }),
  [ECONOMIC_TIERS.GLOBAL_TIER_B]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    label: "Mid-Cost Hubs & Middle East",
    low: 7500,
    mid: 12000,
    high: 22000,
  }),
  [ECONOMIC_TIERS.GLOBAL_TIER_C]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    label: "Western & High-Cost Hubs",
    low: 14000,
    mid: 22000,
    high: 40000,
  }),
});

/**
 * Mandatory disclosure for international ground budget estimates.
 */
const GLOBAL_ESTIMATE_DISCLOSURE =
  "International baseline estimates cover in-destination daily expenses (accommodation, dining, local transit, activities). Intercontinental flights, visa fees, and currency exchange buffers are excluded.";

/**
 * Comfort classification categories based on sufficiency ratio.
 * - low: ratio < 0.75
 * - moderate: 0.75 <= ratio < 1.50
 * - high: ratio >= 1.50
 */
const COMFORT_CATEGORIES = Object.freeze({
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
});

/**
 * Canonical category proportions for standard baseline breakdown.
 * Proportions must be configurable and sum to exactly 1.00 (100%).
 * Note: Accommodation component assumes twin-sharing.
 */
const CATEGORY_PROPORTIONS = Object.freeze({
  accommodation: 0.35, // 35% (twin-sharing assumed)
  food: 0.25,          // 25% (casual to mid-range dining)
  transport: 0.15,     // 15% (local transit, cabs, autos)
  activities: 0.15,    // 15% (sightseeing & entrance fees)
  misc: 0.10,          // 10% (buffer, water, incidentals)
});

/**
 * Currencies approved for calculation in Phase 5E.2.
 * Currently INR-only. External live rates and foreign currency baselines are not yet approved.
 */
const SUPPORTED_CURRENCIES = Object.freeze(["INR"]);

/**
 * Recognized currency symbols for normalization.
 */
const CURRENCY_SYMBOLS = Object.freeze({
  "₹": "INR",
  INR: "INR",
  "$": "USD",
  USD: "USD",
  "€": "EUR",
  EUR: "EUR",
  "£": "GBP",
  GBP: "GBP",
  "¥": "JPY",
  JPY: "JPY",
});

module.exports = {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  GLOBAL_TIER_CONFIG,
  GLOBAL_ESTIMATE_DISCLOSURE,
};

