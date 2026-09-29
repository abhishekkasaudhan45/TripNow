// backend/services/realityEngine/index.js

const { normalizeItinerary } = require("../../utils/itineraryNormalizer");
const { evaluateDayRoute } = require("./distanceEngine");
const { evaluateTripTime } = require("./timeEngine");
const { evaluateTripBudget } = require("./budgetEngine");
const { evaluateTripPace } = require("./paceEngine");
const {
  getStatusTier,
  calculateOverallScore,
  sortAndDedupeIssues,
} = require("./scoringEngine");

/**
 * Primary Reality Engine Orchestrator.
 * Accepts a Booking document or raw itinerary object, executes purely deterministic
 * verification calculations across time, budget, pace, and route, and produces the
 * authoritative Trip Reality Report (0-100).
 */
function evaluateTripReality(tripOrPlan) {
  let rawPlan = tripOrPlan;
  let rawBudget = null;

  if (tripOrPlan && typeof tripOrPlan === "object" && "aiPlan" in tripOrPlan) {
    rawPlan = tripOrPlan.aiPlan;
    rawBudget = tripOrPlan.budget;
  } else if (tripOrPlan?.budget) {
    rawBudget = tripOrPlan.budget;
  }

  // 1. Normalize itinerary to guarantee Structured Activity representation
  const { plan } = normalizeItinerary(rawPlan);
  const days = Array.isArray(plan?.days) ? plan.days : [];

  // Count locked activities
  let lockedActivityCount = 0;
  let totalActivityCount = 0;
  for (const day of days) {
    if (Array.isArray(day.activities)) {
      for (const act of day.activities) {
        totalActivityCount++;
        if (act.locked) lockedActivityCount++;
      }
    }
  }

  // 2. Evaluate Time & Duration Feasibility
  const timeEval = evaluateTripTime(days);

  // 3. Evaluate Budget Feasibility
  const budgetEval = evaluateTripBudget({
    days,
    rawBudget: rawBudget || plan?.budgetBreakdown?.total,
    budgetBreakdown: plan?.budgetBreakdown,
  });

  // 4. Evaluate Pace & Intensity
  const paceEval = evaluateTripPace(days, timeEval.avgDailyActiveMinutes);

  // 5. Evaluate Route & Distance (Stage A: Graceful null when coords missing)
  const routeDayEvals = [];
  const routeIssues = [];
  let allDaysHaveCoords = days.length > 0;
  let totalTripDistanceKm = 0;

  for (const day of days) {
    const routeEval = evaluateDayRoute(day);
    routeDayEvals.push(routeEval);
    totalTripDistanceKm += routeEval.totalDistanceKm || 0;
    if (!routeEval.hasCoordinates) {
      allDaysHaveCoords = false;
    }
    routeIssues.push(...routeEval.anomalies);
  }

  let routeSubScore = null;
  if (allDaysHaveCoords && days.length > 0) {
    // Stage C: When coordinates exist, calculate efficiency
    let rScore = 100;
    for (const anom of routeIssues) {
      if (anom.severity === "high") rScore -= 20;
    }
    routeSubScore = Math.max(20, Math.min(100, rScore));
  }

  // 6. Aggregate Overall Reality Score (0-100)
  const overallScore = calculateOverallScore({
    timeSubScore: timeEval.subScore,
    budgetSubScore: budgetEval.subScore,
    paceSubScore: paceEval.subScore,
    routeSubScore,
  });

  const tier = getStatusTier(overallScore);

  // 7. Consolidate and Sort All Issues
  const allIssues = sortAndDedupeIssues([
    ...timeEval.issues,
    ...budgetEval.issues,
    ...paceEval.issues,
    ...routeIssues,
  ]);

  return {
    score: overallScore,
    status: tier.status,
    statusTier: tier.tier,
    color: tier.color,
    evaluatedAt: new Date().toISOString(),
    subScores: {
      timeFeasibility: timeEval.subScore,
      budgetFeasibility: budgetEval.subScore,
      activityLoad: paceEval.subScore,
      travelPace: paceEval.subScore,
      routeEfficiency: routeSubScore,
    },
    metrics: {
      paceCategory: paceEval.paceCategory,
      avgDailyActiveMinutes: timeEval.avgDailyActiveMinutes,
      totalTripActiveMinutes: timeEval.totalActiveMinutes,
      totalKnownActivityCost: budgetEval.totalKnownActivityCost,
      budgetCeiling: budgetEval.budgetCeiling,
      tripBudget: budgetEval.budgetCeiling,
      overBudget: budgetEval.overBudget,
      totalActivities: totalActivityCount,
      lockedActivityCount,
      totalEstimatedDistanceKm: allDaysHaveCoords ? Math.round(totalTripDistanceKm * 10) / 10 : null,
      hasFullCoordinates: allDaysHaveCoords,
      confidence: {
        costCoverageRatio: totalActivityCount > 0 ? Math.round((budgetEval.knownCount / totalActivityCount) * 100) / 100 : 1,
        inferredDurationsCount: timeEval.inferredDurationCount || 0,
        hasExactCoordinates: allDaysHaveCoords,
        budgetSource: rawBudget ? "booking" : (rawPlan?.budgetBreakdown?.total ? "plan_estimate" : "unspecified"),
        baseCurrency: budgetEval.baseCurrency,
      },
    },
    issues: allIssues,
  };
}

module.exports = {
  evaluateTripReality,
};
