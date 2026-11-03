// backend/services/realityEngine/paceEngine.js

/**
 * Calculates a deterministic base pace score (0-100) based on average daily
 * active minutes and activity density (stops per day).
 *
 * Scoring Curve Rationale:
 * - Sustainable Range (0-360m / 0-6h): Minimal physical fatigue. Smooth descent from 100 to 98.
 *   Both Relaxed (<=270m) and Balanced (<=360m) receive top-tier feasibility scores (98-100).
 * - Upper Balanced Range (360-420m / 6-7h): Moderate daily workload. Smooth descent from 98 to 90.
 * - Busy / Demanding Range (420-540m / 7-9h): Packed schedule with tight buffers. Descent from 90 to 65.
 * - Overloaded Range (>540m / >9h): Severe burnout risk. Rapid descent from 65 down towards 20.
 * - Density Adjustment: >3.5 stops/day adds friction penalty for transit hopping.
 */
function calculateBasePaceScore(avgDailyActiveMinutes = 0, avgActivitiesPerDay = 0) {
  const M = Math.max(0, Number(avgDailyActiveMinutes) || 0);
  const A = Math.max(0, Number(avgActivitiesPerDay) || 0);

  let score = 100;

  if (M <= 360) {
    // 0 to 6 hours active: Sustainable band
    score = 100 - (M / 360) * 2;
  } else if (M <= 420) {
    // 6 to 7 hours active: Upper balanced band (98 -> 90)
    const ratio = (M - 360) / (420 - 360);
    score = 98 - ratio * 8;
  } else if (M <= 540) {
    // 7 to 9 hours active: Busy / Demanding band (90 -> 64)
    const ratio = (M - 420) / (540 - 420);
    score = 90 - ratio * 26;
  } else {
    // >9 hours active: Severe exhaustion risk
    const excessHours = (M - 540) / 60;
    score = Math.max(20, 65 - excessHours * 20);
  }

  // Activity density adjustment: excessive stops add transit context-switching load
  if (A > 3.5) {
    const densityPenalty = Math.min(10, Math.round((A - 3.5) * 4));
    score -= densityPenalty;
  }

  return Math.round(score);
}

/**
 * Evaluates travel pace, daily workload distribution, and physical intensity.
 *
 * Categorizes trip into: Relaxed, Balanced, Busy, Very Busy.
 * Detects:
 * 1. Trip-level pace exhaustion or busy schedules.
 * 2. Single-day peak overload masked by relaxed days.
 * 3. Consecutive high-intensity activities without recovery periods.
 */
function evaluateTripPace(days = [], avgDailyActiveMinutes = 0) {
  const issues = [];
  const dayCount = Array.isArray(days) && days.length > 0 ? days.length : 1;

  let totalActivities = 0;
  if (Array.isArray(days)) {
    for (const d of days) {
      if (Array.isArray(d?.activities)) {
        totalActivities += d.activities.length;
      }
    }
  }

  const avgActivitiesPerDay = Math.round((totalActivities / dayCount) * 10) / 10;

  // 1. Determine trip-level category classification
  let paceCategory = "Balanced";
  if (avgDailyActiveMinutes <= 270 && avgActivitiesPerDay <= 2.2) {
    paceCategory = "Relaxed";
  } else if (avgDailyActiveMinutes <= 420) {
    paceCategory = "Balanced";
  } else if (avgDailyActiveMinutes <= 540) {
    paceCategory = "Busy";
    issues.push({
      id: "iss-pace-busy",
      type: "pace_intense",
      severity: "medium",
      message: `Average active duration is ${Math.round(avgDailyActiveMinutes / 60)} hours per day (${avgActivitiesPerDay} stops/day). Schedule is tightly packed.`,
    });
  } else {
    paceCategory = "Very Busy";
    issues.push({
      id: "iss-pace-exhaustion",
      type: "pace_exhaustion",
      severity: "high",
      message: `Average active duration exceeds ${(avgDailyActiveMinutes / 60).toFixed(1)} hours per day. High risk of traveler burnout and missed activities.`,
    });
  }

  // 2. Compute base score from deterministic pacing curve
  const baseScore = calculateBasePaceScore(avgDailyActiveMinutes, avgActivitiesPerDay);

  // 3. Single-day peak overload detection
  // Evaluates daily loads to catch severe marathon days masked by light days.
  let peakOverloadPenalty = 0;
  const peakOverloadDays = [];

  if (Array.isArray(days) && days.length > 0) {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dayNum = Number(d?.day) || i + 1;
      let dayActive = 0;

      let dayInferred = 0;
      let dayTotalActs = 0;

      if (Array.isArray(d?.activities)) {
        dayTotalActs = d.activities.length;
        for (const act of d.activities) {
          const hasExplicit =
            typeof act.durationMinutes === "number" &&
            !act.durationInferred &&
            !Number.isNaN(act.durationMinutes);
          const duration = hasExplicit ? Math.max(0, act.durationMinutes) : 120;
          if (!hasExplicit) dayInferred++;
          dayActive += duration;
        }
      }

      if (dayActive > 540) {
        const inferredRatio = dayTotalActs > 0 ? dayInferred / dayTotalActs : 0;
        const isEstimated = inferredRatio > 0.5;
        let isCritical = dayActive > 660;
        let penalty = isCritical ? 12 : 6;

        if (isEstimated) {
          if (isCritical) {
            isCritical = false; // Dampen critical to medium when majority inferred
            penalty = 6;
          } else if (inferredRatio === 1.0) {
            penalty = 0; // 100% inferred unannotated day does not penalize peak pace
          }
        }

        if (penalty > 0) {
          peakOverloadDays.push({
            dayNumber: dayNum,
            activeMinutes: dayActive,
            isCritical,
            isEstimated,
          });
          peakOverloadPenalty += penalty;
        }
      }
    }
  }

  // Only emit peak overload issues when trip average did not already trigger trip-wide exhaustion
  if (avgDailyActiveMinutes <= 540 && peakOverloadDays.length > 0) {
    for (const peak of peakOverloadDays) {
      issues.push({
        id: `iss-pace-peak-${peak.dayNumber}`,
        type: "pace_peak_overload",
        severity: peak.isCritical ? "high" : "medium",
        day: peak.dayNumber,
        confidence: peak.isEstimated ? "inferred" : "confirmed",
        durationInferred: Boolean(peak.isEstimated),
        message: peak.isEstimated
          ? `Day ${peak.dayNumber} estimated active duration (${peak.activeMinutes}m / ${(peak.activeMinutes / 60).toFixed(1)}h - durations inferred) suggests potential single-day overload.`
          : `Day ${peak.dayNumber} active duration (${peak.activeMinutes}m / ${(peak.activeMinutes / 60).toFixed(1)}h) creates extreme single-day fatigue despite an acceptable trip average.`,
      });
    }
  }

  // 4. Consecutive high-intensity fatigue evaluation
  // Detects back-to-back high-intensity activities without recovery within each day.
  let fatiguePenalty = 0;

  if (Array.isArray(days)) {
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dayNum = Number(d?.day) || i + 1;
      const acts = Array.isArray(d?.activities) ? d.activities : [];

      let currentStreak = 0;
      let streakActivities = [];

      const flushStreak = () => {
        if (currentStreak >= 2) {
          const isExtreme = currentStreak >= 3;
          const actTitles = streakActivities.map((a) => `"${a.title || "Activity"}"`).join(" and ");
          const firstActId = streakActivities[0]?.id || `act-${dayNum}-01`;

          issues.push({
            id: `iss-pace-fatigue-${dayNum}-${firstActId}`,
            type: "intensity_fatigue",
            severity: isExtreme ? "high" : "medium",
            day: dayNum,
            activityIds: streakActivities.map((a) => a.id).filter(Boolean),
            message: `Day ${dayNum} schedules ${currentStreak} consecutive high-intensity activities (${actTitles}) without a recovery period.`,
          });

          fatiguePenalty += isExtreme ? 12 : 6;
        }
        currentStreak = 0;
        streakActivities = [];
      };

      for (const act of acts) {
        if (act && act.intensity === "high") {
          currentStreak++;
          streakActivities.push(act);
        } else {
          flushStreak();
        }
      }
      flushStreak();
    }
  }

  // Bounded penalty application
  const totalPeakPenalty = avgDailyActiveMinutes <= 540 ? Math.min(24, peakOverloadPenalty) : 0;
  const totalFatiguePenalty = Math.min(20, fatiguePenalty);
  const finalSubScore = Math.max(10, Math.min(100, baseScore - totalPeakPenalty - totalFatiguePenalty));

  return {
    subScore: finalSubScore,
    paceCategory,
    avgActivitiesPerDay,
    avgDailyActiveMinutes,
    issues,
  };
}

module.exports = {
  calculateBasePaceScore,
  evaluateTripPace,
};
