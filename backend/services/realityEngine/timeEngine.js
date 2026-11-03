// backend/services/realityEngine/timeEngine.js

const SLOT_CAPACITIES_MINUTES = {
  morning: 240,   // 09:00 - 13:00 (4 hours)
  afternoon: 240, // 14:00 - 18:00 (4 hours)
  evening: 180,   // 19:00 - 22:00 (3 hours)
};

const STANDARD_BUFFER_MINUTES = 60; // Lunch & Dinner / transit buffer
const TRANSIT_BUFFER_MINUTES = {
  flight: 120, // 2 hours conservative check-in, security, boarding buffer
  ferry: 60,   // 1 hour conservative terminal/port check-in and boarding buffer
};
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

  const slotGroups = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const act of activities) {
    const hasExplicit =
      typeof act.durationMinutes === "number" &&
      !act.durationInferred &&
      !Number.isNaN(act.durationMinutes);
    const duration = hasExplicit ? Math.max(0, act.durationMinutes) : 120;
    const isInferred = !hasExplicit;
    if (isInferred) {
      inferredDurationCount++;
    }
    totalActiveMinutes += duration;

    const period = act.period || "morning";
    if (!slotGroups[period]) {
      slotGroups[period] = [];
    }
    slotGroups[period].push({
      activity: act,
      duration,
      isExplicit: hasExplicit,
      isInferred,
    });
  }

  const overloadedSlots = new Set();

  // Check 1: Slot-level cumulative duration saturation with confidence dampening
  for (const [period, group] of Object.entries(slotGroups)) {
    if (group.length === 0) continue;

    const slotMax = SLOT_CAPACITIES_MINUTES[period] || 240;
    const slotDuration = group.reduce((sum, item) => sum + item.duration, 0);

    if (slotDuration > slotMax) {
      overloadedSlots.add(period);
      const overrunMin = slotDuration - slotMax;
      const rawCritical = overrunMin >= 60;
      const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

      // Duration confidence calculation
      const inferredCount = group.filter((item) => item.isInferred).length;
      const inferredRatio = inferredCount / group.length;
      const isEstimated = inferredRatio > 0.5;

      // Severity determination with confidence-aware dampening
      let severity = rawCritical ? "high" : "medium";
      if (isEstimated) {
        if (rawCritical) {
          severity = "medium"; // Dampen high to medium when majority inferred
        } else if (inferredRatio === 1.0) {
          severity = "low"; // Dampen minor overrun to low when 100% inferred
        }
      }

      const confPrefix = isEstimated ? "Estimated schedule (durations inferred): " : "";

      if (group.length === 1) {
        const act = group[0].activity;
        issues.push({
          id: `iss-time-overrun-${dayNumber}-${act.id}`,
          type: "slot_overrun",
          severity,
          day: dayNumber,
          period,
          activityId: act.id,
          isLocked: Boolean(act.locked),
          confidence: isEstimated ? "inferred" : "confirmed",
          durationInferred: isEstimated,
          message: `${confPrefix}Activity "${act.title}" duration (${group[0].duration}m) exceeds the ${period} slot capacity (${slotMax}m) by ${overrunMin} minutes.`,
        });
      } else {
        const hasLocked = group.some((item) => Boolean(item.activity.locked));
        issues.push({
          id: `iss-time-slot-overrun-${dayNumber}-${period}`,
          type: "slot_overrun",
          severity,
          day: dayNumber,
          period,
          activityIds: group.map((item) => item.activity.id),
          isLocked: hasLocked,
          confidence: isEstimated ? "inferred" : "confirmed",
          durationInferred: isEstimated,
          message: `${confPrefix}${periodLabel} schedule cumulative duration (${slotDuration}m across ${group.length} activities) exceeds slot capacity (${slotMax}m) by ${overrunMin} minutes.`,
        });
      }
    }
  }

  // Check 2: Total daily active time exceeds recommended endurance with confidence dampening
  if (totalActiveMinutes > MAX_RECOMMENDED_DAILY_MINUTES) {
    const rawCritical = totalActiveMinutes > MAX_PHYSICAL_DAILY_MINUTES;
    const dayInferredRatio = activities.length > 0 ? inferredDurationCount / activities.length : 0;
    const isEstimated = dayInferredRatio > 0.5;

    let severity = rawCritical ? "high" : "medium";
    if (isEstimated) {
      if (rawCritical) {
        severity = "medium"; // Dampen critical to medium when majority inferred
      } else if (dayInferredRatio === 1.0) {
        severity = "low"; // Dampen medium to low when 100% inferred
      }
    }

    issues.push({
      id: `iss-time-overload-${dayNumber}`,
      type: "daily_overload",
      severity,
      day: dayNumber,
      confidence: isEstimated ? "inferred" : "confirmed",
      durationInferred: isEstimated,
      message: isEstimated
        ? `Day ${dayNumber} total estimated active schedule (${totalActiveMinutes}m / ${(totalActiveMinutes / 60).toFixed(1)}h - durations inferred) suggests potential overload.`
        : `Day ${dayNumber} total active schedule (${totalActiveMinutes}m / ${(totalActiveMinutes / 60).toFixed(1)}h) ${rawCritical ? "exceeds maximum daily travel capacity" : "leaves very little resting buffer"}.`,
    });
  }

  // Check 3: High-overhead transit transition buffers (flight / ferry)
  for (const [period, group] of Object.entries(slotGroups)) {
    if (group.length === 0) continue;

    const slotMax = SLOT_CAPACITIES_MINUTES[period];
    if (!slotMax) continue;

    const highTransitItems = group.filter(
      (item) => item.activity.travelMode === "flight" || item.activity.travelMode === "ferry"
    );

    if (highTransitItems.length === 0) continue;

    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const isSlotAlreadyOverloaded = overloadedSlots.has(period);
    const slotDuration = group.reduce((sum, item) => sum + item.duration, 0);

    for (const item of highTransitItems) {
      const mode = item.activity.travelMode;
      const requiredBuffer = TRANSIT_BUFFER_MINUTES[mode];

      // Context Check: Are there other activities scheduled in the same slot window?
      const otherItems = group.filter((g) => g.activity.id !== item.activity.id);

      if (otherItems.length === 0) {
        // Dedicated slot window for flight/ferry: buffer is satisfied
        continue;
      }

      const remainingBuffer = slotMax - slotDuration;
      const bufferDeficit = requiredBuffer - Math.max(0, remainingBuffer);

      if (isSlotAlreadyOverloaded) {
        // Duplicate-Penalty Prevention: Slot overrun already captures the duration impossibility.
        // Emit advisory low-severity issue (0 deduction) to prevent double counting.
        issues.push({
          id: `iss-time-transit-${dayNumber}-${item.activity.id}`,
          type: "transit_buffer_deficit",
          severity: "low",
          day: dayNumber,
          period,
          activityId: item.activity.id,
          travelMode: mode,
          isLocked: Boolean(item.activity.locked),
          duplicatePrevented: true,
          message: `${periodLabel} ${mode} ("${item.activity.title}") buffer is constrained within an already overloaded slot.`,
        });
      } else if (bufferDeficit > 0) {
        // Buffer deficit detected within a nominally fitting slot duration
        const severity = bufferDeficit >= 60 ? "medium" : "low";
        issues.push({
          id: `iss-time-transit-${dayNumber}-${item.activity.id}`,
          type: "transit_buffer_deficit",
          severity,
          day: dayNumber,
          period,
          activityId: item.activity.id,
          travelMode: mode,
          isLocked: Boolean(item.activity.locked),
          message: `${periodLabel} ${mode} ("${item.activity.title}") is scheduled alongside other activities with only ${Math.max(0, remainingBuffer)}m buffer remaining, leaving insufficient time for recommended ${mode} check-in and transit (${requiredBuffer}m buffer recommended).`,
        });
      }
    }
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
  TRANSIT_BUFFER_MINUTES,
  MAX_RECOMMENDED_DAILY_MINUTES,
  MAX_PHYSICAL_DAILY_MINUTES,
  evaluateDayTime,
  evaluateTripTime,
};
