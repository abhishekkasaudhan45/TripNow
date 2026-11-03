// frontend/src/components/reality/RealityScoreBanner.jsx
import React from "react";

/**
 * Trip Reality Score Banner Component.
 * Displays authoritative backend Reality Score, status tier, sub-score summary,
 * pacing load, duration coverage confidence, and issue count.
 */
export default function RealityScoreBanner({
  realityReport,
  isLoading = false,
  onViewDetails,
}) {
  // Loading skeleton state when report is pending initial fetch
  if (!realityReport && isLoading) {
    return (
      <div
        className="reality-banner-skeleton"
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(16px)",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        }}
        role="status"
        aria-label="Calculating Trip Reality Score"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            className="skeleton-shimmer"
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: "rgba(0, 0, 0, 0.06)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                ⭐ Trip Reality Score
              </span>
              <span style={{ fontSize: "11px", color: "var(--dim)", fontWeight: "600" }}>
                ⚡ Calculating feasibility...
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              Deterministic verification across time windows, activity buffers, budget allowance, and daily workload
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback state for historical bookings where realityScore is null or not yet calculated
  if (!realityReport && !isLoading) {
    return (
      <div
        className="reality-banner-pending"
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(16px)",
          borderRadius: "14px",
          padding: "14px 20px",
          marginBottom: "16px",
          border: "1px dashed var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
        role="region"
        aria-label="Trip Reality Score Status"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "18px" }}>⭐</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)" }}>
              Trip Reality Score Pending
            </div>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Feasibility scores calculate automatically when adapting or saving the itinerary.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    score = 0,
    status = "Pending",
    color = "#059669",
    subScores = {},
    metrics = {},
    issues = [],
  } = realityReport;

  const durationCoverage = metrics.confidence?.durationCoverageRatio;
  const durationCoveragePercent =
    typeof durationCoverage === "number" && !isNaN(durationCoverage)
      ? Math.round(durationCoverage * 100)
      : null;

  const issueCount = Array.isArray(issues) ? issues.length : 0;
  const advisoryCount = Array.isArray(issues)
    ? issues.filter((i) => i.severity === "low" || i.duplicatePrevented).length
    : 0;
  const actionableCount = issueCount - advisoryCount;

  return (
    <section
      className="reality-score-banner"
      style={{
        background: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(16px)",
        borderRadius: "14px",
        padding: "16px 20px",
        marginBottom: "16px",
        border: `1px solid ${color || "rgba(16, 185, 129, 0.3)"}`,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        position: "relative",
      }}
      aria-label={`Trip Reality Score: ${score} out of 100, Status: ${status}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Left: Score Badge & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: color ? `${color}15` : "rgba(16, 185, 129, 0.1)",
              color: color || "#059669",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `1.5px solid ${color || "#059669"}`,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: "900",
                lineHeight: "1",
                fontFamily: "var(--font-ui)",
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontSize: "9px",
                fontWeight: "700",
                opacity: 0.85,
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Score
            </span>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                ⭐ Trip Reality Score
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: color ? `${color}20` : "rgba(16, 185, 129, 0.15)",
                  color: color || "#059669",
                }}
              >
                {status}
              </span>
              {isLoading && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--amber-text)",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  role="status"
                  aria-live="polite"
                >
                  ⚡ Recalculating...
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              Deterministic verification across time windows, activity buffers, budget allowance, and daily workload
            </div>
          </div>
        </div>

        {/* Right: View Details Action */}
        <button
          type="button"
          onClick={onViewDetails}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "7px 16px",
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--text)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "var(--font-ui)",
            transition: "all 0.15s ease",
          }}
          aria-haspopup="dialog"
          aria-label="View Reality Verification Breakdown details"
        >
          🔍 View Breakdown
        </button>
      </div>

      {/* Sub-scores Strip */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(0, 0, 0, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            padding: "3px 10px",
            borderRadius: "6px",
            background: "rgba(0, 0, 0, 0.03)",
            color: "var(--muted)",
            fontWeight: "500",
          }}
        >
          ⏱️ Time Feasibility:{" "}
          <b style={{ color: "var(--text)" }}>{subScores.timeFeasibility ?? "—"}/100</b>
        </div>

        <div
          style={{
            fontSize: "11px",
            padding: "3px 10px",
            borderRadius: "6px",
            background: "rgba(0, 0, 0, 0.03)",
            color: "var(--muted)",
            fontWeight: "500",
          }}
        >
          💰 Budget Feasibility:{" "}
          <b style={{ color: "var(--text)" }}>{subScores.budgetFeasibility ?? "—"}/100</b>
        </div>

        <div
          style={{
            fontSize: "11px",
            padding: "3px 10px",
            borderRadius: "6px",
            background: "rgba(0, 0, 0, 0.03)",
            color: "var(--muted)",
            fontWeight: "500",
          }}
        >
          🏃 Pace: <b style={{ color: "var(--text)" }}>{metrics.paceCategory || "Balanced"}</b>
        </div>

        <div
          style={{
            fontSize: "11px",
            padding: "3px 10px",
            borderRadius: "6px",
            background: "rgba(0, 0, 0, 0.03)",
            color: "var(--muted)",
            fontWeight: "500",
          }}
        >
          🗺️ Route:{" "}
          <span style={{ color: "var(--dim)" }}>
            {subScores.routeEfficiency !== null && subScores.routeEfficiency !== undefined
              ? `${subScores.routeEfficiency}/100`
              : "Stage A (Awaiting Coords)"}
          </span>
        </div>

        {/* Duration Coverage Data Confidence Chip */}
        {durationCoveragePercent !== null && (
          <div
            style={{
              fontSize: "11px",
              padding: "3px 10px",
              borderRadius: "6px",
              background:
                durationCoveragePercent >= 70
                  ? "rgba(16, 185, 129, 0.10)"
                  : "rgba(245, 158, 11, 0.12)",
              color:
                durationCoveragePercent >= 70
                  ? "var(--emerald-text)"
                  : "var(--amber-text)",
              fontWeight: "600",
            }}
            title="Percentage of activities with explicitly confirmed duration metadata (vs inferred fallback)"
          >
            📊 Durations: {durationCoveragePercent}% explicit
          </div>
        )}

        {/* Issue Count Summary */}
        {issueCount > 0 ? (
          <div
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              color: actionableCount > 0 ? "#b45309" : "var(--muted)",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ⚠️ {issueCount} {issueCount === 1 ? "issue" : "issues"} detected
            {advisoryCount > 0 && (
              <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: "500" }}>
                ({advisoryCount} advisory)
              </span>
            )}
          </div>
        ) : (
          <div
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              color: "var(--emerald-text)",
              fontWeight: "600",
            }}
          >
            ✨ All constraints verified
          </div>
        )}
      </div>
    </section>
  );
}

