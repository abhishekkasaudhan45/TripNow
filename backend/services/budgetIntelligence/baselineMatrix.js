// backend/services/budgetIntelligence/baselineMatrix.js
const { ECONOMIC_TIERS, CATEGORY_PROPORTIONS } = require("./constants");

/**
 * Baseline Economic Matrix.
 * Configurable reference anchors in INR per person per day.
 *
 * NOTE: These figures are configurable reference estimates for algorithmic budgeting,
 * NOT verified real-time market prices or guaranteed commercial quotes.
 * Accommodation components assume twin-sharing room occupancy (Room cost / 2).
 * Intercity flights and long-distance rail are explicitly excluded.
 */
const BASELINE_MATRIX = Object.freeze({
  INR: Object.freeze({
    [ECONOMIC_TIERS.TIER_1_METRO]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_1_METRO,
      currency: "INR",
      budget: 2000,
      standard: 5300,
      premium: 13300,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "High-cost metropolitan destinations (e.g., Mumbai, Delhi, Bengaluru)",
    }),
    [ECONOMIC_TIERS.TIER_2_RESORT]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_2_RESORT,
      currency: "INR",
      budget: 1800,
      standard: 5000,
      premium: 12500,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "Beach, island and resort destinations (e.g., Goa, Andaman)",
    }),
    [ECONOMIC_TIERS.TIER_3_BUDGET]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_3_BUDGET,
      currency: "INR",
      budget: 1250,
      standard: 3250,
      premium: 8300,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "Budget-oriented hills, heritage, and regional destinations (e.g., Manali, Jaipur, Varanasi)",
    }),
    [ECONOMIC_TIERS.TIER_4_INTERNATIONAL]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_4_INTERNATIONAL,
      currency: "INR",
      budget: null,
      standard: null,
      premium: null,
      isConfigured: false,
      accommodationTwinSharing: true,
      description: "Legacy unconfigured international tier",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_A]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
      currency: "INR",
      budget: 3500,
      standard: 5500,
      premium: 11000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Budget Neighbors & Southeast Asia (Nepal, Sri Lanka, Thailand, Vietnam, Indonesia, Bhutan, Cambodia, Laos, Philippines)",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_B]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
      currency: "INR",
      budget: 7500,
      standard: 12000,
      premium: 22000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Mid-Cost Hubs & Middle East (UAE, Dubai, Abu Dhabi, Singapore, Malaysia, Bali, Turkey, Oman, Qatar, Georgia, Egypt)",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_C]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
      currency: "INR",
      budget: 14000,
      standard: 22000,
      premium: 40000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Western & High-Cost Hubs (Europe, UK, London, USA, France, Paris, Italy, Japan, Tokyo, Australia, Switzerland)",
    }),
  }),
});

/**
 * Retrieve the baseline anchors for a specific economic tier and currency.
 * Returns null if tier or currency baseline is not configured.
 */
function getBaselineForTier(tier, currency = "INR") {
  const normCurrency = String(currency || "").trim().toUpperCase();
  const currencyMatrix = BASELINE_MATRIX[normCurrency];
  if (!currencyMatrix) return null;

  const baseline = currencyMatrix[tier];
  if (!baseline || !baseline.isConfigured || baseline.standard === null) {
    return null;
  }
  return baseline;
}

/**
 * Generate a transparent breakdown of daily and total expenses
 * based on standard daily baseline and configurable category proportions.
 *
 * @param {number} standardDailyBaseline - Per person standard daily anchor
 * @param {number} guests - Number of travelers
 * @param {number} days - Trip duration in days
 * @returns {object} Breakdown details with daily per-person, trip total, and disclaimers
 */
function generateCategoryBreakdown(standardDailyBaseline, guests = 1, days = 1) {
  if (typeof standardDailyBaseline !== "number" || standardDailyBaseline <= 0) {
    return null;
  }

  const g = Math.max(1, guests);
  const d = Math.max(1, days);

  // Compute rounded daily per-person amounts
  const dailyPerPerson = {
    accommodation: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.accommodation),
    food: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.food),
    transport: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.transport),
    activities: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.activities),
    misc: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.misc),
  };

  // Ensure sum of rounded parts matches standardDailyBaseline exactly
  const sumDaily =
    dailyPerPerson.accommodation +
    dailyPerPerson.food +
    dailyPerPerson.transport +
    dailyPerPerson.activities +
    dailyPerPerson.misc;

  const diffDaily = standardDailyBaseline - sumDaily;
  if (diffDaily !== 0) {
    dailyPerPerson.misc += diffDaily; // absorb rounding delta in misc buffer
  }

  // Trip total = daily per person * guests * days
  const tripTotal = {
    accommodation: dailyPerPerson.accommodation * g * d,
    food: dailyPerPerson.food * g * d,
    transport: dailyPerPerson.transport * g * d,
    activities: dailyPerPerson.activities * g * d,
    misc: dailyPerPerson.misc * g * d,
    total: standardDailyBaseline * g * d,
  };

  return {
    dailyPerPerson: {
      ...dailyPerPerson,
      total: standardDailyBaseline,
    },
    tripTotal,
    proportions: { ...CATEGORY_PROPORTIONS },
    assumptions: {
      accommodation: "Assumes twin-sharing hotel or guesthouse accommodation (room rate / 2).",
      transport: "Covers local in-destination transit (metro, taxis, autos, scooters). Intercity/international travel excluded.",
      nature: "Reference estimates for planning guidance, not live commercial quotes.",
    },
  };
}

module.exports = {
  BASELINE_MATRIX,
  getBaselineForTier,
  generateCategoryBreakdown,
};

