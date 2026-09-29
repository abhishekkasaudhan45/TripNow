/**
 * Detects currency code from text string.
 */
function detectCurrency(text) {
  if (!text || typeof text !== "string") return null;
  const clean = text.toLowerCase().trim();
  if (clean.includes("₹") || clean.includes("inr") || clean.includes("rupee") || clean.includes("rs")) return "INR";
  if (clean.includes("$") || clean.includes("usd") || clean.includes("dollar")) return "USD";
  if (clean.includes("€") || clean.includes("eur") || clean.includes("euro")) return "EUR";
  if (clean.includes("£") || clean.includes("gbp") || clean.includes("pound")) return "GBP";
  if (clean.includes("¥") || clean.includes("jpy") || clean.includes("yen")) return "JPY";
  return null;
}

/**
 * Parses a cost string into a structured classification and numeric estimate.
 * Never guesses random numbers for arbitrary words like "Moderate".
 * Validates currency against expectedCurrency to prevent mixed-currency arithmetic.
 */
function parseCostString(costStr, expectedCurrency = null) {
  if (costStr === null || costStr === undefined) {
    return { amount: null, isFree: false, isRange: false, isUnspecified: true, raw: "" };
  }

  const clean = String(costStr).trim().toLowerCase();

  // 1. Free variants
  if (clean === "free" || clean === "₹0" || clean === "$0" || clean === "€0" || clean === "£0" || clean === "0") {
    return { amount: 0, isFree: true, isRange: false, isUnspecified: false, raw: costStr };
  }

  const detectedCurrency = detectCurrency(clean);

  // Currency Mismatch Protection: Never silently treat "$25" as ₹25
  if (expectedCurrency && detectedCurrency && detectedCurrency !== expectedCurrency) {
    return {
      amount: null,
      isFree: false,
      isRange: false,
      isUnspecified: true,
      currencyMismatch: true,
      detectedCurrency,
      raw: costStr,
    };
  }

  // 2. Price Range (e.g., "₹100 - ₹200", "$20 - $40", "100-200")
  const rangeMatch = clean.match(/(\d+(?:,\d+)*)\s*[-–—to]+\s*[^0-9\s]*\s*(\d+(?:,\d+)*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    const max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      const midpoint = Math.round((min + max) / 2);
      return { amount: midpoint, isFree: false, isRange: true, isUnspecified: false, raw: costStr };
    }
  }

  // 3. Exact numeric (e.g., "₹500", "250 INR", "$15", "€30", "1500")
  const numMatch = clean.match(/(\d+(?:,\d+)*)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(val)) {
      return { amount: val, isFree: false, isRange: false, isUnspecified: false, raw: costStr };
    }
  }

  // 4. Unspecified / Non-numeric prose (e.g., "Moderate", "Varies", "TBD")
  return { amount: null, isFree: false, isRange: false, isUnspecified: true, raw: costStr };
}

/**
 * Extracts a numeric budget ceiling from raw trip budget fields.
 */
function parseNumericBudget(rawBudget) {
  if (!rawBudget) return null;
  const clean = String(rawBudget).replace(/,/g, "").trim();
  const match = clean.match(/(\d+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Evaluates trip-level budget realism and calculates Budget Feasibility Sub-Score (0-100).
 */
function evaluateTripBudget({ days = [], rawBudget = null, budgetBreakdown = null }) {
  const issues = [];

  // Determine trip base currency (e.g. INR, USD, EUR)
  let baseCurrency = detectCurrency(rawBudget);
  if (!baseCurrency && budgetBreakdown?.total) {
    baseCurrency = detectCurrency(budgetBreakdown.total);
  }
  if (!baseCurrency && budgetBreakdown?.activities) {
    baseCurrency = detectCurrency(budgetBreakdown.activities);
  }
  if (!baseCurrency) {
    baseCurrency = "INR";
  }

  const currencySymbol =
    baseCurrency === "INR" ? "₹" :
    baseCurrency === "USD" ? "$" :
    baseCurrency === "EUR" ? "€" :
    baseCurrency === "GBP" ? "£" :
    baseCurrency === "JPY" ? "¥" : `${baseCurrency} `;

  // Parse overall target budget
  let budgetCeiling = parseNumericBudget(rawBudget);
  if (!budgetCeiling && budgetBreakdown?.total) {
    budgetCeiling = parseNumericBudget(budgetBreakdown.total);
  }

  let totalKnownActivityCost = 0;
  let knownCount = 0;
  let freeCount = 0;
  let unspecifiedCount = 0;
  let currencyMismatchCount = 0;
  let totalActivities = 0;

  const dayCosts = [];

  for (const day of days) {
    const activities = Array.isArray(day?.activities) ? day.activities : [];
    let dayTotal = 0;

    for (let actIdx = 0; actIdx < activities.length; actIdx++) {
      const act = activities[actIdx];
      totalActivities++;
      const parsed = parseCostString(act.cost, baseCurrency);

      if (parsed.currencyMismatch) {
        currencyMismatchCount++;
        unspecifiedCount++;
        issues.push({
          id: `iss-budget-currency-mismatch-${day.day}-${act.id || actIdx}`,
          type: "currency_mismatch",
          severity: "medium",
          day: day.day,
          activityId: act.id,
          message: `Activity cost "${act.cost}" uses currency (${parsed.detectedCurrency}) which differs from the trip budget currency (${baseCurrency}). Excluded from numerical budget calculations to prevent invalid comparison.`,
        });
      } else if (parsed.amount !== null) {
        dayTotal += parsed.amount;
        totalKnownActivityCost += parsed.amount;
        knownCount++;
        if (parsed.isFree) freeCount++;
      } else {
        unspecifiedCount++;
      }
    }

    dayCosts.push({
      day: day.day,
      knownTotal: dayTotal,
    });
  }

  // Determine budget status & sub-score
  let subScore = 100;
  let overBudget = false;

  if (budgetCeiling && budgetCeiling > 0) {
    // Budget Precedence:
    // 1. Explicit activity cap from budgetBreakdown.activities
    // 2. Fallback: 40% of total budget ceiling
    const allocatedCap = budgetBreakdown?.activities
      ? parseNumericBudget(budgetBreakdown.activities) || budgetCeiling * 0.4
      : budgetCeiling * 0.4;

    const ratio = totalKnownActivityCost / allocatedCap;

    if (ratio <= 0.85) {
      subScore = 100;
    } else if (ratio <= 1.0) {
      // 85% to 100% capacity: scale from 100 down to 80
      subScore = Math.round(100 - (ratio - 0.85) * 133);
    } else if (ratio <= 1.25) {
      // 100% to 125%: over budget, scale from 80 down to 40
      overBudget = true;
      subScore = Math.round(80 - (ratio - 1.0) * 160);
      issues.push({
        id: "iss-budget-overrun",
        type: "budget_overrun",
        severity: "high",
        message: `Total estimated activity cost (${currencySymbol}${totalKnownActivityCost.toLocaleString("en-IN")}) exceeds the allocated activity budget (${currencySymbol}${Math.round(allocatedCap).toLocaleString("en-IN")}) by ${Math.round((ratio - 1) * 100)}%.`,
      });
    } else {
      // Severe overrun > 125%
      overBudget = true;
      subScore = Math.max(0, Math.round(40 - (ratio - 1.25) * 100));
      issues.push({
        id: "iss-budget-overrun-severe",
        type: "budget_overrun",
        severity: "high",
        message: `Activity costs (${currencySymbol}${totalKnownActivityCost.toLocaleString("en-IN")}) severely exceed the estimated allowance (${currencySymbol}${Math.round(allocatedCap).toLocaleString("en-IN")}).`,
      });
    }
  } else {
    // Unspecified budget default
    subScore = 85;
    if (unspecifiedCount > totalActivities / 2 && totalActivities > 0) {
      issues.push({
        id: "iss-budget-unspecified",
        type: "budget_unspecified",
        severity: "low",
        message: "Most activities have non-numeric cost indicators (e.g. 'Moderate'); exact budget feasibility could not be calculated.",
      });
    }
  }

  return {
    subScore: Math.max(0, Math.min(100, subScore)),
    totalKnownActivityCost,
    budgetCeiling,
    baseCurrency,
    currencySymbol,
    overBudget,
    knownCount,
    freeCount,
    unspecifiedCount,
    currencyMismatchCount,
    totalActivities,
    dayCosts,
    issues,
  };
}

module.exports = {
  detectCurrency,
  parseCostString,
  parseNumericBudget,
  evaluateTripBudget,
};
