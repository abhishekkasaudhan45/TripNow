// backend/services/realityEngine/scoringEngine.js

const STATUS_TIERS = [
  { min: 90, status: "Excellent", tier: "excellent", color: "#059669" },
  { min: 75, status: "Good", tier: "good", color: "#10B981" },
  { min: 60, status: "Needs Attention", tier: "needs_attention", color: "#D97706" },
  { min: 40, status: "Risky", tier: "risky", color: "#F97316" },
  { min: 0, status: "Critical", tier: "critical", color: "#E11D48" },
];

function getStatusTier(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const tier of STATUS_TIERS) {
    if (clamped >= tier.min) {
      return tier;
    }
  }
  return STATUS_TIERS[STATUS_TIERS.length - 1];
}

/**
 * Calculates the overall Trip Reality Score from sub-scores
 * based on the presence of geocoding coordinates.
 */
function calculateOverallScore({ timeSubScore, budgetSubScore, paceSubScore, routeSubScore }) {
  let overall = 0;

  if (typeof routeSubScore === "number") {
    // Stage C: Complete coordinates available
    overall =
      timeSubScore * 0.3 +
      routeSubScore * 0.25 +
      budgetSubScore * 0.25 +
      paceSubScore * 0.2;
  } else {
    // Stage A: Coordinates absent (Stage A baseline)
    overall =
      timeSubScore * 0.4 +
      budgetSubScore * 0.35 +
      paceSubScore * 0.25;
  }

  return Math.max(0, Math.min(100, Math.round(overall)));
}

/**
 * Formats and sorts issues by severity: high -> medium -> low.
 */
function sortAndDedupeIssues(issues = []) {
  const order = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  const deduped = [];

  for (const iss of issues) {
    const key = iss.id || `${iss.type}-${iss.day}-${iss.activityId || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(iss);
    }
  }

  return deduped.sort((a, b) => {
    const sevDiff = (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    const dayDiff = (a.day || 0) - (b.day || 0);
    if (dayDiff !== 0) return dayDiff;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

module.exports = {
  STATUS_TIERS,
  getStatusTier,
  calculateOverallScore,
  sortAndDedupeIssues,
};
