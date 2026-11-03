// backend/services/budgetIntelligence/budgetIntelligenceEngine.js
const {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  GLOBAL_ESTIMATE_DISCLOSURE,
  GLOBAL_TIER_CONFIG,
} = require("./constants");
const { getBaselineForTier, generateCategoryBreakdown } = require("./baselineMatrix");
const { resolveDestinationTier } = require("./destinationTierResolver");

/**
 * Parses and validates raw budget input into a clean positive number.
 * Accepts numbers or clean numeric strings (e.g. 15000, "15000", "₹15,000").
 * Returns null if missing, zero, negative, NaN, or non-finite.
 */
function parseNumericBudgetSafe(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === "string") {
    const clean = raw.replace(/[₹$€£¥,\s]/g, "").trim();
    if (!clean) return null;
    const num = Number(clean);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  return null;
}

/**
 * Normalizes input currency code.
 */
function normalizeCurrencyCode(rawCurrency) {
  if (!rawCurrency || typeof rawCurrency !== "string") {
    return "INR";
  }
  const clean = rawCurrency.trim();
  if (CURRENCY_SYMBOLS[clean]) {
    return CURRENCY_SYMBOLS[clean];
  }
  return clean.toUpperCase();
}

/**
 * Pure calculation engine for TripNow Deterministic Budget Intelligence.
 *
 * Requirements:
 * - Pure function: Same input ALWAYS produces same output.
 * - No mutation of input object.
 * - No database access.
 * - No network access.
 * - No Gemini or external LLM calls.
 * - No floating-point artifacts in displayed integer amounts.
 * - Never silently turn invalid inputs into defaults (e.g. 0 or 1).
 *
 * @param {object} input - Raw input contract
 * @param {number|string} input.totalBudget - Total budget for the entire party across entire duration
 * @param {number} input.days - Trip duration in whole days (> 0)
 * @param {number} input.guests - Number of travelers (> 0)
 * @param {string} input.destination - Trip destination name
 * @param {string} [input.currency] - Currency code (default: "INR")
 * @returns {object} Predictable calculation result contract
 */
function calculateBudgetIntelligence(input) {
  const validationErrors = [];
  const warnings = [];

  // Defensive input object check
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      status: CALCULATION_STATUS.INVALID_INPUT,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: "INR",
      totalBudget: null,
      days: null,
      guests: null,
      perPersonDailyBudget: null,
      dailyAvailablePerPerson: null,
      groupDailyBudget: null,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: "Unspecified",
      isInternational: false,
      warnings: [],
      validationErrors: ["Input must be a valid non-null object"],
    };
  }

  // 1. Validate totalBudget
  const parsedBudget = parseNumericBudgetSafe(input.totalBudget);
  if (parsedBudget === null) {
    if (input.totalBudget === undefined || input.totalBudget === null || input.totalBudget === "") {
      validationErrors.push("totalBudget is required and must be a finite positive number");
    } else {
      validationErrors.push(`totalBudget must be a finite positive number greater than 0 (received: ${input.totalBudget})`);
    }
  }

  // 2. Validate days
  const rawDays = input.days;
  const isDaysValidInteger = typeof rawDays === "number" && Number.isInteger(rawDays) && rawDays > 0;
  if (!isDaysValidInteger) {
    if (rawDays === undefined || rawDays === null || rawDays === "") {
      validationErrors.push("days is required and must be a positive integer");
    } else {
      validationErrors.push(`days must be a whole positive integer greater than 0 (received: ${rawDays})`);
    }
  }

  // 3. Validate guests
  const rawGuests = input.guests;
  const isGuestsValidInteger = typeof rawGuests === "number" && Number.isInteger(rawGuests) && rawGuests > 0;
  if (!isGuestsValidInteger) {
    if (rawGuests === undefined || rawGuests === null || rawGuests === "") {
      validationErrors.push("guests is required and must be a positive integer");
    } else {
      validationErrors.push(`guests must be a whole positive integer greater than 0 (received: ${rawGuests})`);
    }
  }

  // 4. Validate destination
  const rawDestination = input.destination;
  const isDestValid = typeof rawDestination === "string" && rawDestination.trim().length > 0;
  if (!isDestValid) {
    validationErrors.push("destination is required and must be a non-empty string");
  }

  // Normalize currency
  const normalizedCurrency = normalizeCurrencyCode(input.currency);

  // If validation errors exist, fail early without mutating input
  if (validationErrors.length > 0) {
    return {
      status: CALCULATION_STATUS.INVALID_INPUT,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget: parsedBudget,
      days: isDaysValidInteger ? rawDays : null,
      guests: isGuestsValidInteger ? rawGuests : null,
      perPersonDailyBudget: null,
      dailyAvailablePerPerson: null,
      groupDailyBudget: null,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: typeof rawDestination === "string" ? rawDestination.trim() : "Unspecified",
      isInternational: false,
      warnings,
      validationErrors,
    };
  }

  // Safe validated numbers
  const totalBudget = parsedBudget;
  const days = rawDays;
  const guests = rawGuests;

  // Compute party-level math regardless of tier (this is pure user math)
  const perPersonDailyBudget = Math.round(totalBudget / (guests * days));
  const groupDailyBudget = Math.round(totalBudget / days);

  // 5. Currency Check
  if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
    warnings.push({
      code: "UNSUPPORTED_CURRENCY",
      severity: "warning",
      message: `Currency "${normalizedCurrency}" is not currently supported for baseline calculations. Only INR (₹) reference anchors are currently approved.`,
    });
    return {
      status: CALCULATION_STATUS.UNSUPPORTED_CURRENCY,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: rawDestination.trim(),
      isInternational: false,
      warnings,
      validationErrors: [],
    };
  }

  // 6. Destination Tier Resolution
  const tierResolution = resolveDestinationTier(rawDestination);
  const resolvedTier = tierResolution.tier;

  // Unknown destination handling
  if (!tierResolution.isKnown || resolvedTier === ECONOMIC_TIERS.UNKNOWN) {
    warnings.push({
      code: "UNKNOWN_DESTINATION",
      severity: "warning",
      message: `Destination "${rawDestination.trim()}" is not recognized in the economic tier registry. Baseline cost estimates cannot be calculated without economic tier mapping.`,
    });
    return {
      status: CALCULATION_STATUS.UNKNOWN_DESTINATION,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: rawDestination.trim(),
      isInternational: false,
      warnings,
      validationErrors: [],
    };
  }

  // Legacy unconfigured international tier safety
  if (resolvedTier === ECONOMIC_TIERS.TIER_4_INTERNATIONAL) {
    warnings.push({
      code: "BASELINE_NOT_CONFIGURED",
      severity: "warning",
      message: `Baseline economic data is not yet approved for legacy international destination "${tierResolution.canonicalName}". Domestic INR anchors cannot be applied to international destinations.`,
    });
    return {
      status: CALCULATION_STATUS.BASELINE_NOT_CONFIGURED,
      tier: resolvedTier,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: tierResolution.canonicalName,
      isInternational: true,
      warnings,
      validationErrors: [],
    };
  }

  // 7. Retrieve Configured Baseline (Domestic or Global Tier)
  const baseline = getBaselineForTier(resolvedTier, normalizedCurrency);
  if (!baseline || !baseline.standard) {
    warnings.push({
      code: "BASELINE_NOT_CONFIGURED",
      severity: "warning",
      message: `No approved baseline anchors found for tier "${resolvedTier}" in currency "${normalizedCurrency}".`,
    });
    return {
      status: CALCULATION_STATUS.BASELINE_NOT_CONFIGURED,
      tier: resolvedTier,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: tierResolution.canonicalName,
      isInternational: Boolean(tierResolution.isInternational),
      warnings,
      validationErrors: [],
    };
  }

  // 8. Calculations with Approved Baseline (Preserves Low, Mid, High Estimates)
  const isIntl = Boolean(tierResolution.isInternational);
  const lowDaily = baseline.budget;
  const midDaily = baseline.standard;
  const highDaily = baseline.premium;

  const dailyTierEstimates = {
    low: lowDaily,
    mid: midDaily,
    high: highDaily,
  };

  const estimatedTripTotals = {
    low: lowDaily * guests * days,
    mid: midDaily * guests * days,
    high: highDaily * guests * days,
  };

  const standardDailyBaseline = midDaily;
  const estimatedStandardTotal = estimatedTripTotals.mid;
  const standardBudgetDifference = Math.round(totalBudget - estimatedStandardTotal);

  // Sufficiency ratio rounded cleanly to 4 decimal places
  const rawRatio = perPersonDailyBudget / standardDailyBaseline;
  const sufficiencyRatio = Number(rawRatio.toFixed(4));

  // 9. Category Comfort Classification
  let category;
  if (sufficiencyRatio < 0.75) {
    category = COMFORT_CATEGORIES.LOW;
  } else if (sufficiencyRatio < 1.50) {
    category = COMFORT_CATEGORIES.MODERATE;
  } else {
    category = COMFORT_CATEGORIES.HIGH;
  }

  // 10. Status & Advisory Warnings
  let status = CALCULATION_STATUS.CALCULATED;

  // International ground budget disclosure (mandatory disclosure excluding flights/visas)
  if (isIntl) {
    warnings.push({
      code: "GLOBAL_ESTIMATE_ADVISORY",
      severity: "info",
      message: GLOBAL_ESTIMATE_DISCLOSURE,
    });

    if (tierResolution.isUnlistedInternational) {
      status = CALCULATION_STATUS.GLOBAL_ESTIMATE_ADVISORY;
      warnings.push({
        code: "UNLISTED_INTERNATIONAL_PROVISIONAL",
        severity: "warning",
        message: `"${tierResolution.canonicalName}" is not explicitly listed in our international destination database. A provisional Global Tier B (Mid-Cost Hub) estimate has been applied.`,
      });
    }
  }

  if (category === COMFORT_CATEGORIES.LOW) {
    warnings.push({
      code: "BUDGET_LOW_ADVISORY",
      severity: "warning",
      message: `Your daily budget (₹${perPersonDailyBudget.toLocaleString("en-IN")}/person) is below the estimated standard baseline (₹${standardDailyBaseline.toLocaleString("en-IN")}/person) for ${tierResolution.canonicalName}. Hostels, public transit, and minimal extra expenses are advised.`,
    });
    if (sufficiencyRatio < 0.55) {
      warnings.push({
        code: "BUDGET_CRITICALLY_TIGHT",
        severity: "warning",
        message: `Your budget is very tight for this party size and duration. Estimated standard cost is ₹${estimatedStandardTotal.toLocaleString("en-IN")} (shortfall of ₹${Math.abs(standardBudgetDifference).toLocaleString("en-IN")}). Consider adjusting duration or budget.`,
      });
    }
  } else if (category === COMFORT_CATEGORIES.MODERATE) {
    warnings.push({
      code: "BUDGET_STANDARD_ADEQUATE",
      severity: "success",
      message: `Your budget aligns well with standard travel, dining, and local attractions in ${tierResolution.canonicalName}.`,
    });
  } else {
    warnings.push({
      code: "BUDGET_PREMIUM_COMFORTABLE",
      severity: "success",
      message: `Your budget comfortably supports premium resorts, private transport, and upscale experiences in ${tierResolution.canonicalName}.`,
    });
  }

  // 11. Transparent Category Breakdown
  const breakdown = generateCategoryBreakdown(standardDailyBaseline, guests, days);

  return {
    status,
    tier: resolvedTier,
    currency: normalizedCurrency,
    totalBudget,
    days,
    guests,
    perPersonDailyBudget,
    dailyAvailablePerPerson: perPersonDailyBudget,
    groupDailyBudget,
    estimatedStandardTotal,
    standardBudgetDifference,
    sufficiencyRatio,
    category,
    breakdown,
    dailyTierEstimates,
    estimatedTripTotals,
    resolvedDestination: tierResolution.canonicalName,
    isInternational: isIntl,
    warnings,
    validationErrors: [],
  };
}

module.exports = {
  parseNumericBudgetSafe,
  normalizeCurrencyCode,
  calculateBudgetIntelligence,
};

