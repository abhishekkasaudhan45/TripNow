// backend/services/realityEngine/timeEngine.js

const SLOT_CAPACITIES_MINUTES = {
  morning: 240,   // 09:00 - 13:00 (4 hours)
  afternoon: 240, // 14:00 - 18:00 (4 hours)
  evening: 180,   // 19:00 - 22:00 (3 hours)
};

const STANDARD_BUFFER_MINUTES = 60; // Lunch & Dinner / transit buffer
const MAX_RECOMMENDED_DAILY_MINUTES = 540; // 9 hours active
const MAX_PHYSICAL_DAILY_MINUTES = 660; // 11 hours active capacity

/**
 * Evaluates schedule and duration feasibility for a given day.
 */
function evaluateDayTime(day) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  const dayNumber = Number(day?.day) || 1;

  let totalActiveMinutes = 0;
  let inferredDurationCount = 0;
  const issues = [];

  for (const act of activities) {
    const hasExplicit =
      typeof act.durationMinutes === "number" &&
      !act.durationInferred &&
      !Number.isNaN(act.durationMinutes);
    const duration = hasExplicit ? act.durationMinutes : 120;
    if (!hasExplicit) {
      inferredDurationCount++;
    }
    totalActiveMinutes += duration;

    const slotMax = SLOT_CAPACITIES_MINUTES[act.period] || 240;

    // Check 1: Individual activity duration exceeds the standard period slot
    if (duration > slotMax) {
      const overrunMin = duration - slotMax;
      issues.push({
        id: `iss-time-overrun-${dayNumber}-${act.id}`,
        type: "slot_overrun",
        severity: overrunMin >= 60 ? "high" : "medium",
        day: dayNumber,
        period: act.period,
        activityId: act.id,
        isLocked: Boolean(act.locked),
        message: `Activity "${act.title}" duration (${duration}m) exceeds the ${act.period} slot capacity (${slotMax}m) by ${overrunMin} minutes.`,
      });
    }
  }

  // Check 2: Total daily active time exceeds recommended endurance
  if (totalActiveMinutes > MAX_RECOMMENDED_DAILY_MINUTES) {
    const isCritical = totalActiveMinutes > MAX_PHYSICAL_DAILY_MINUTES;
    issues.push({
      id: `iss-time-overload-${dayNumber}`,
      type: "daily_overload",
      severity: isCritical ? "high" : "medium",
      day: dayNumber,
      message: `Day ${dayNumber} total active schedule (${totalActiveMinutes}m / ${(totalActiveMinutes / 60).toFixed(1)}h) ${isCritical ? "exceeds maximum daily travel capacity" : "leaves very little resting buffer"}.`,
    });
  }

  return {
    dayNumber,
    totalActiveMinutes,
    inferredDurationCount,
    activityCount: activities.length,
    issues,
  };
}

/**
 * Aggregates time metrics and calculates the Time Feasibility Sub-Score (0-100).
 */
function evaluateTripTime(days = []) {
  if (!Array.isArray(days) || days.length === 0) {
    return {
      subScore: 100,
      avgDailyActiveMinutes: 0,
      totalActiveMinutes: 0,
      issues: [],
    };
  }

  let totalTripActiveMinutes = 0;
  let totalInferredDurationCount = 0;
  const allIssues = [];
  const dayEvaluations = [];

  for (const day of days) {
    const dayEval = evaluateDayTime(day);
    dayEvaluations.push(dayEval);
    totalTripActiveMinutes += dayEval.totalActiveMinutes;
    totalInferredDurationCount += dayEval.inferredDurationCount || 0;
    allIssues.push(...dayEval.issues);
  }

  const avgDailyActiveMinutes = Math.round(totalTripActiveMinutes / days.length);

  // Deterministic Sub-Score Calculation:
  // Starts at 100
  // Each high severity time issue deducts 15 points
  // Each medium severity time issue deducts 8 points
  let score = 100;
  for (const issue of allIssues) {
    if (issue.severity === "high") {
      score -= 15;
    } else if (issue.severity === "medium") {
      score -= 8;
    }
  }

  // Cap at 0-100
  const subScore = Math.max(0, Math.min(100, score));

  return {
    subScore,
    avgDailyActiveMinutes,
    totalActiveMinutes: totalTripActiveMinutes,
    inferredDurationCount: totalInferredDurationCount,
    dayEvaluations,
    issues: allIssues,
  };
}

module.exports = {
  SLOT_CAPACITIES_MINUTES,
  STANDARD_BUFFER_MINUTES,
  MAX_RECOMMENDED_DAILY_MINUTES,
  MAX_PHYSICAL_DAILY_MINUTES,
  evaluateDayTime,
  evaluateTripTime,
};
