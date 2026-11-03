// frontend/src/components/reality/realityPresentation.js

/**
 * Formats duration in minutes into a human-friendly string (e.g., "6h 30m", "45m").
 */
export function formatMinutes(minutes) {
  if (typeof minutes !== "number" || isNaN(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Evaluates duration data coverage ratio and formats plain-language explanations.
 * Handles missing or null confidence data gracefully without fabricating values.
 */
export function getDurationCoverageMeta(confidence, totalActivities = 0) {
  const ratio = confidence?.durationCoverageRatio;
  const hasCoverage = typeof ratio === "number" && !isNaN(ratio) && ratio >= 0 && ratio <= 1;

  if (!hasCoverage) {
    return {
      hasCoverage: false,
      percent: null,
      explicitCount: null,
      inferredCount: null,
      totalCount: totalActivities || 0,
      badgeText: "Confidence data not available",
      summary: "Duration coverage ratio not available for this record.",
      explanation:
        "Duration confidence metadata is unavailable. Historical itineraries calculate feasibility using default duration fallbacks.",
      disclaimer: null,
    };
  }

  const percent = Math.round(ratio * 100);
  const inferredCount = confidence?.inferredDurationsCount || 0;
  const explicitCount = Math.max(0, (totalActivities || 0) - inferredCount);

  return {
    hasCoverage: true,
    percent,
    explicitCount,
    inferredCount,
    totalCount: totalActivities || 0,
    badgeText: `${percent}% Verified Durations`,
    summary: `${explicitCount} of ${totalActivities} activities have confirmed durations${
      inferredCount > 0 ? ` (${inferredCount} use 120m fallback)` : ""
    }`,
    higherCoverageExplanation:
      "Higher coverage means more activity durations are explicitly specified by your plan or user preferences.",
    lowerCoverageExplanation:
      "Lower coverage means more durations rely on the engine's 120-minute inferred fallback heuristic.",
    disclaimer:
      "Data-quality indicator reflecting itinerary metadata completeness, not a guarantee of travel feasibility.",
  };
}

/**
 * Returns pacing descriptions and workload guidance based on pace category and active minutes.
 */
export function getPacingGuidance(metrics = {}) {
  const paceCategory = metrics.paceCategory || "Balanced";
  const avgActive = metrics.avgDailyActiveMinutes || 0;
  const totalActive = metrics.totalTripActiveMinutes || 0;
  const totalActivities = metrics.totalActivities || 0;

  let description = "";
  switch (paceCategory) {
    case "Relaxed":
      description =
        "Comfortable travel pace with generous rest intervals and minimal physical fatigue.";
      break;
    case "Balanced":
      description =
        "Evenly distributed daily workload with sustainable buffers between stops.";
      break;
    case "Busy":
      description =
        "Packed daily schedule with tight buffers between stops. Monitor fatigue on consecutive days.";
      break;
    case "Very Busy":
      description =
        "High daily workload exceeding recommended endurance limits. Elevated risk of traveler burnout.";
      break;
    default:
      description =
        "Deterministic pace calculations evaluate active schedule duration against physical rest limits.";
  }

  return {
    paceCategory,
    avgDailyActiveText: avgActive > 0 ? `${formatMinutes(avgActive)} / day` : "—",
    totalTripActiveText: totalActive > 0 ? formatMinutes(totalActive) : "—",
    totalActivitiesText: `${totalActivities} total stops`,
    description,
  };
}

/**
 * Evaluates transit buffer issues and returns indicative guidance details.
 */
export function getTransitBufferGuidance(issues = []) {
  const transitIssues = Array.isArray(issues)
    ? issues.filter((i) => i.type === "transit_buffer_deficit")
    : [];

  const hasTransitIssues = transitIssues.length > 0;
  const advisoryIssues = transitIssues.filter(
    (i) => i.severity === "low" || i.duplicatePrevented
  );
  const scoreImpactingIssues = transitIssues.filter(
    (i) => i.severity === "medium" || i.severity === "high"
  );

  return {
    hasTransitIssues,
    totalTransitIssues: transitIssues.length,
    advisoryCount: advisoryIssues.length,
    scoreImpactingCount: scoreImpactingIssues.length,
    disclaimer:
      "Flight and ferry transition checks evaluate coarse time-slot window capacity (morning, afternoon, evening). They do not represent confirmed airline or port tickets, terminal gate schedules, or live departure times.",
  };
}

/**
 * Classifies an individual issue's severity, score impact, and display tags.
 * Never infers numerical deductions from severity.
 * Displays general severity descriptors:
 * - High: "HIGH SEVERITY"
 * - Medium / Default: "MODERATE"
 * - Low / Duplicate Prevented: "ADVISORY · 0 PTS"
 * If an explicit deduction is provided by the backend on the issue object,
 * it formats it accurately; otherwise, it never assumes or invents one.
 */
export function classifyIssue(iss = {}) {
  const rawSeverity =
    typeof iss?.severity === "string" ? iss.severity.toLowerCase().trim() : "";
  const isDuplicatePrevented = Boolean(iss?.duplicatePrevented);
  const isAdvisory = rawSeverity === "low" || isDuplicatePrevented;
  const isHigh = !isAdvisory && rawSeverity === "high";
  const isMedium = !isAdvisory && !isHigh;

  const severity = isAdvisory ? "low" : isHigh ? "high" : "medium";

  // Check if backend explicitly supplied an issue-level deduction number
  const hasExplicitDeduction =
    typeof iss?.deduction === "number" &&
    !isNaN(iss.deduction) &&
    iss.deduction > 0;

  let scoreImpactText = "MODERATE";
  let badgeBg = "var(--amber)";
  let borderCol = "rgba(245, 158, 11, 0.25)";
  let bgCol = "rgba(245, 158, 11, 0.07)";

  if (isHigh) {
    scoreImpactText = hasExplicitDeduction
      ? `HIGH SEVERITY · -${iss.deduction} PTS`
      : "HIGH SEVERITY";
    badgeBg = "var(--rose)";
    borderCol = "rgba(225, 29, 72, 0.25)";
    bgCol = "rgba(225, 29, 72, 0.06)";
  } else if (isAdvisory) {
    scoreImpactText = "ADVISORY · 0 PTS";
    badgeBg = "#3b82f6";
    borderCol = "rgba(59, 130, 246, 0.25)";
    bgCol = "rgba(59, 130, 246, 0.06)";
  } else {
    // Medium or unrecognized severity fallback
    scoreImpactText = hasExplicitDeduction
      ? `MODERATE · -${iss.deduction} PTS`
      : "MODERATE";
    badgeBg = "var(--amber)";
    borderCol = "rgba(245, 158, 11, 0.25)";
    bgCol = "rgba(245, 158, 11, 0.07)";
  }

  const isInferred = Boolean(iss?.confidence === "inferred" || iss?.durationInferred);

  return {
    severity,
    isHigh,
    isMedium,
    isAdvisory,
    isDuplicatePrevented,
    isInferred,
    isLocked: Boolean(iss?.isLocked),
    scoreImpactText,
    badgeBg,
    borderCol,
    bgCol,
    dayText: iss?.day
      ? `Day ${iss.day}${
          iss.period ? ` · ${iss.period.charAt(0).toUpperCase() + iss.period.slice(1)}` : ""
        }`
      : null,
  };
}

/**
 * Safely deduplicates issues list while preserving order and issue IDs.
 */
export function deduplicateIssues(issues = []) {
  if (!Array.isArray(issues)) return [];
  const seen = new Set();
  return issues.filter((iss) => {
    const key =
      iss.id || `${iss.type}-${iss.day || 0}-${iss.period || ""}-${iss.activityId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

