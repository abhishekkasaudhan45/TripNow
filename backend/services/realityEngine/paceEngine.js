// backend/services/realityEngine/paceEngine.js

/**
 * Evaluates travel pace and workload intensity.
 * Categorizes trip into: Relaxed, Balanced, Busy, Very Busy.
 */
function evaluateTripPace(days = [], avgDailyActiveMinutes = 0) {
  const issues = [];
  const dayCount = Array.isArray(days) && days.length > 0 ? days.length : 1;

  let totalActivities = 0;
  if (Array.isArray(days)) {
    for (const d of days) {
      if (Array.isArray(d.activities)) {
        totalActivities += d.activities.length;
      }
    }
  }

  const avgActivitiesPerDay = Math.round((totalActivities / dayCount) * 10) / 10;

  let paceCategory = "Balanced";
  let subScore = 98;

  if (avgDailyActiveMinutes <= 270 && avgActivitiesPerDay <= 2.2) {
    paceCategory = "Relaxed";
    subScore = 92;
  } else if (avgDailyActiveMinutes <= 420) {
    paceCategory = "Balanced";
    subScore = 98;
  } else if (avgDailyActiveMinutes <= 540) {
    paceCategory = "Busy";
    subScore = 75;
    issues.push({
      id: "iss-pace-busy",
      type: "pace_intense",
      severity: "medium",
      message: `Average active duration is ${Math.round(avgDailyActiveMinutes / 60)} hours per day (${avgActivitiesPerDay} stops/day). Schedule is tightly packed.`,
    });
  } else {
    paceCategory = "Very Busy";
    subScore = 45;
    issues.push({
      id: "iss-pace-exhaustion",
      type: "pace_exhaustion",
      severity: "high",
      message: `Average active duration exceeds ${(avgDailyActiveMinutes / 60).toFixed(1)} hours per day. High risk of traveler burnout and missed activities.`,
    });
  }

  return {
    subScore,
    paceCategory,
    avgActivitiesPerDay,
    avgDailyActiveMinutes,
    issues,
  };
}

module.exports = {
  evaluateTripPace,
};
