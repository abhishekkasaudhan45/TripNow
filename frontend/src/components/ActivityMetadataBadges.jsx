// frontend/src/components/ActivityMetadataBadges.jsx
import React from "react";

export const ACTIVITY_TYPE_MAP = {
  sightseeing:   { label: "Sightseeing",    icon: "🏛️", bg: "rgba(245, 158, 11, 0.10)", text: "#b45309", border: "rgba(245, 158, 11, 0.25)" },
  culture:       { label: "Culture",        icon: "🎭", bg: "rgba(168, 85, 247, 0.10)", text: "#7e22ce", border: "rgba(168, 85, 247, 0.25)" },
  adventure:     { label: "Adventure",      icon: "🧗", bg: "rgba(249, 115, 22, 0.10)", text: "#c2410c", border: "rgba(249, 115, 22, 0.25)" },
  nature:        { label: "Nature",         icon: "🌿", bg: "rgba(16, 185, 129, 0.10)", text: "#047857", border: "rgba(16, 185, 129, 0.25)" },
  food:          { label: "Food & Dining",  icon: "🍽️", bg: "rgba(244, 63, 94, 0.10)",  text: "#be123c", border: "rgba(244, 63, 94, 0.25)" },
  relaxation:    { label: "Relaxation",     icon: "🧘", bg: "rgba(20, 184, 166, 0.10)", text: "#0f766e", border: "rgba(20, 184, 166, 0.25)" },
  shopping:      { label: "Shopping",       icon: "🛍️", bg: "rgba(236, 72, 153, 0.10)", text: "#be185d", border: "rgba(236, 72, 153, 0.25)" },
  nightlife:     { label: "Nightlife",      icon: "🌙", bg: "rgba(99, 102, 241, 0.10)", text: "#4338ca", border: "rgba(99, 102, 241, 0.25)" },
  transport:     { label: "Transit",        icon: "🚆", bg: "rgba(59, 130, 246, 0.10)", text: "#1d4ed8", border: "rgba(59, 130, 246, 0.25)" },
  accommodation: { label: "Stay",           icon: "🏨", bg: "rgba(6, 182, 212, 0.10)",  text: "#0e7490", border: "rgba(6, 182, 212, 0.25)" },
  other:         { label: "Activity",       icon: "📍", bg: "rgba(100, 116, 139, 0.10)",text: "#334155", border: "rgba(100, 116, 139, 0.25)" },
};

export const TRAVEL_MODE_MAP = {
  walking:          { label: "Walk",    icon: "🚶" },
  public_transport: { label: "Transit", icon: "🚌" },
  driving:          { label: "Drive",   icon: "🚗" },
  taxi:             { label: "Taxi",    icon: "🚕" },
  cycling:          { label: "Cycle",   icon: "🚲" },
  ferry:            { label: "Ferry",   icon: "⛴️" },
  flight:           { label: "Flight",  icon: "✈️" },
};

export const INTENSITY_MAP = {
  low:      { label: "Low",      icon: "🟢", bg: "rgba(16, 185, 129, 0.08)", text: "#047857", border: "rgba(16, 185, 129, 0.22)" },
  moderate: { label: "Moderate", icon: "🟡", bg: "rgba(245, 158, 11, 0.08)", text: "#b45309", border: "rgba(245, 158, 11, 0.22)" },
  high:     { label: "High",     icon: "🔴", bg: "rgba(239, 68, 68, 0.08)",  text: "#b91c1c", border: "rgba(239, 68, 68, 0.22)" },
};

/**
 * Format durationMinutes into human-friendly format (e.g., 45m, 1h, 1h 30m, 2h).
 * Differentiates confirmed duration vs. durationInferred estimate.
 */
export function formatDuration(durationMinutes, durationInferred = false) {
  if (typeof durationMinutes !== "number" || isNaN(durationMinutes)) {
    return null;
  }
  const minutes = Math.round(durationMinutes);
  if (minutes < 15 || minutes > 720) {
    return null;
  }

  let text = "";
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours === 0) {
    text = `${remainingMins}m`;
  } else if (remainingMins === 0) {
    text = `${hours}h`;
  } else {
    text = `${hours}h ${remainingMins}m`;
  }

  return {
    raw: minutes,
    text: durationInferred ? `~${text}` : text,
    isEstimated: Boolean(durationInferred),
  };
}

export function getActivityTypeMeta(type) {
  if (typeof type !== "string") return null;
  const key = type.trim().toLowerCase();
  return ACTIVITY_TYPE_MAP[key] || null;
}

export function getTravelModeMeta(mode) {
  if (typeof mode !== "string") return null;
  const key = mode.trim().toLowerCase();
  return TRAVEL_MODE_MAP[key] || null;
}

export function getIntensityMeta(intensity) {
  if (typeof intensity !== "string") return null;
  const key = intensity.trim().toLowerCase();
  return INTENSITY_MAP[key] || null;
}

/**
 * Returns true if the activity has at least one valid metadata attribute to display.
 */
export function hasActivityMetadata(activity, options = {}) {
  if (!activity || typeof activity !== "object") return false;
  const { showCategoryFallback = true, showCostAndIndoor = true } = options;
  const typeMeta = getActivityTypeMeta(activity.activityType);
  const durationMeta = formatDuration(activity.durationMinutes, activity.durationInferred);
  const travelMeta = getTravelModeMeta(activity.travelMode);
  const intensityMeta = getIntensityMeta(activity.intensity);
  const hasLegacyCategory = showCategoryFallback && !typeMeta && activity.category;
  const hasIndoorOutdoor = showCostAndIndoor && activity.indoorOutdoor && ["Indoor", "Outdoor", "Mixed"].includes(activity.indoorOutdoor);
  const hasCost = showCostAndIndoor && Boolean(activity.cost);
  return Boolean(typeMeta || durationMeta || travelMeta || intensityMeta || hasLegacyCategory || hasIndoorOutdoor || hasCost);
}

/**
 * Reusable metadata badge ribbon for structured activities.
 * Gracefully handles null/missing fields and historical activities.
 */
export default function ActivityMetadataBadges({
  activity,
  compact = false,
  showCategoryFallback = true,
  showCostAndIndoor = true,
  className = "",
  style = {},
}) {
  if (!activity || typeof activity !== "object") {
    return null;
  }

  const typeMeta = getActivityTypeMeta(activity.activityType);
  const durationMeta = formatDuration(activity.durationMinutes, activity.durationInferred);
  const travelMeta = getTravelModeMeta(activity.travelMode);
  const intensityMeta = getIntensityMeta(activity.intensity);

  const hasLegacyCategory = showCategoryFallback && !typeMeta && activity.category;
  const hasIndoorOutdoor = showCostAndIndoor && activity.indoorOutdoor && ["Indoor", "Outdoor", "Mixed"].includes(activity.indoorOutdoor);
  const hasCost = showCostAndIndoor && Boolean(activity.cost);

  const hasAnyBadge = hasActivityMetadata(activity, { showCategoryFallback, showCostAndIndoor });

  if (!hasAnyBadge) {
    return null;
  }

  const pillBaseStyle = {
    fontSize: compact ? "10px" : "11px",
    fontWeight: 600,
    padding: compact ? "1.5px 7px" : "2.5px 9px",
    borderRadius: "9999px",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    lineHeight: "1.25",
    letterSpacing: "0.01em",
  };

  return (
    <div
      className={`activity-metadata-badges flex flex-wrap items-center gap-1.5 ${className}`}
      style={{ marginTop: compact ? "4px" : "8px", ...style }}
    >
      {/* 1. Canonical Activity Type Badge */}
      {typeMeta && (
        <span
          className="meta-badge-type"
          style={{
            ...pillBaseStyle,
            background: typeMeta.bg,
            color: typeMeta.text,
            border: `1px solid ${typeMeta.border}`,
          }}
          title={`Category: ${typeMeta.label}`}
          aria-label={`Category: ${typeMeta.label}`}
        >
          <span aria-hidden="true">{typeMeta.icon}</span>
          <span>{typeMeta.label}</span>
        </span>
      )}

      {/* 1b. Legacy Category Fallback (only when canonical activityType is missing) */}
      {hasLegacyCategory && (
        <span
          className="meta-badge-category"
          style={{
            ...pillBaseStyle,
            background: "rgba(217, 119, 6, 0.08)",
            color: "#b45309",
            border: "1px solid rgba(217, 119, 6, 0.2)",
          }}
          title={`Category: ${activity.category}`}
          aria-label={`Category: ${activity.category}`}
        >
          <span aria-hidden="true">🏷️</span>
          <span>{activity.category}</span>
        </span>
      )}

      {/* 2. Duration Badge (Never presents inferred duration as confirmed) */}
      {durationMeta && (
        <span
          className="meta-badge-duration"
          style={{
            ...pillBaseStyle,
            background: durationMeta.isEstimated ? "rgba(5, 150, 105, 0.05)" : "rgba(5, 150, 105, 0.09)",
            color: "#047857",
            border: `1px ${durationMeta.isEstimated ? "dashed" : "solid"} rgba(5, 150, 105, 0.25)`,
            opacity: durationMeta.isEstimated ? 0.9 : 1,
          }}
          title={durationMeta.isEstimated ? "Estimated visit duration (inferred)" : `Planned visit duration: ${durationMeta.text}`}
          aria-label={durationMeta.isEstimated ? `Estimated visit duration: ${durationMeta.text}` : `Visit duration: ${durationMeta.text}`}
        >
          <span aria-hidden="true">⏱️</span>
          <span>{durationMeta.text}</span>
          {durationMeta.isEstimated && (
            <span style={{ fontSize: "9px", opacity: 0.75, fontWeight: 500 }}>(est.)</span>
          )}
        </span>
      )}

      {/* 3. Travel Mode Badge (Recommended transport from previous stop/hotel) */}
      {travelMeta && (
        <span
          className="meta-badge-travel"
          style={{
            ...pillBaseStyle,
            background: "rgba(14, 165, 233, 0.09)",
            color: "#0369a1",
            border: "1px solid rgba(14, 165, 233, 0.25)",
          }}
          title={`Recommended travel from prior stop: ${travelMeta.label}`}
          aria-label={`Travel to venue: ${travelMeta.label}`}
        >
          <span aria-hidden="true" style={{ opacity: 0.7 }}>→</span>
          <span aria-hidden="true">{travelMeta.icon}</span>
          <span>{travelMeta.label}</span>
        </span>
      )}

      {/* 4. Physical Intensity / Exertion Badge */}
      {intensityMeta && (
        <span
          className="meta-badge-intensity"
          style={{
            ...pillBaseStyle,
            background: intensityMeta.bg,
            color: intensityMeta.text,
            border: `1px solid ${intensityMeta.border}`,
          }}
          title={`Physical exertion: ${intensityMeta.label}`}
          aria-label={`Physical exertion: ${intensityMeta.label}`}
        >
          <span aria-hidden="true">{intensityMeta.icon}</span>
          <span>{intensityMeta.label}</span>
        </span>
      )}

      {/* 5. Indoor / Outdoor Badge */}
      {hasIndoorOutdoor && (
        <span
          className="meta-badge-indoor-outdoor"
          style={{
            ...pillBaseStyle,
            background: "rgba(79, 70, 229, 0.08)",
            color: "#4338ca",
            border: "1px solid rgba(79, 70, 229, 0.2)",
          }}
          title={`Setting: ${activity.indoorOutdoor}`}
          aria-label={`Setting: ${activity.indoorOutdoor}`}
        >
          <span aria-hidden="true">
            {activity.indoorOutdoor === "Indoor" ? "🏠" : activity.indoorOutdoor === "Outdoor" ? "☀️" : "⛅"}
          </span>
          <span>{activity.indoorOutdoor}</span>
        </span>
      )}

      {/* 6. Cost Badge */}
      {hasCost && (
        <span
          className="meta-badge-cost"
          style={{
            ...pillBaseStyle,
            background: "rgba(107, 114, 128, 0.08)",
            color: "#374151",
            border: "1px solid rgba(107, 114, 128, 0.2)",
          }}
          title={`Cost: ${activity.cost}`}
          aria-label={`Cost: ${activity.cost}`}
        >
          <span aria-hidden="true">💰</span>
          <span>{activity.cost}</span>
        </span>
      )}
    </div>
  );
}
