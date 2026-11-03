// frontend/src/components/reality/RealityScoreModal.jsx
import React, { useEffect } from "react";
import {
  formatMinutes,
  classifyIssue,
  deduplicateIssues,
} from "./realityPresentation.js";

/**
 * Detailed Reality Score Modal Component.
 * Presents comprehensive breakdown of:
 * 1. Overall Score and Sub-Score progress analysis.
 * 2. Pacing & Daily Workload metrics (daily active minutes, density, fatigue).
 * 3. Duration Data Confidence explanation & coverage ratio.
 * 4. Indicative Flight/Ferry transition buffer guidance.
 * 5. Feasibility Issues & Warnings hierarchy with explicit score-impact indicators.
 */
export default function RealityScoreModal({ isOpen, onClose, realityReport }) {
  // Listen for Escape key to close modal accessibly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !realityReport) return null;

  const {
    score = 0,
    status = "Pending",
    color = "#059669",
    subScores = {},
    metrics = {},
    issues = [],
  } = realityReport;

  const durationCoverage = metrics.confidence?.durationCoverageRatio;
  const hasDurationCoverage =
    typeof durationCoverage === "number" && !isNaN(durationCoverage);
  const durationCoveragePercent = hasDurationCoverage
    ? Math.round(durationCoverage * 100)
    : null;

  const inferredDurationsCount = metrics.confidence?.inferredDurationsCount || 0;
  const totalActivities = metrics.totalActivities || 0;
  const explicitDurationsCount = Math.max(0, totalActivities - inferredDurationsCount);

  // Check if any flight or ferry transition buffer issues are present
  const transitIssues = issues.filter((i) => i.type === "transit_buffer_deficit");
  const hasTransitIssues = transitIssues.length > 0;

  // Deduplicate issues by id or key to ensure presentation integrity
  const dedupedIssues = deduplicateIssues(issues);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reality-modal-title"
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          padding: "24px",
          fontFamily: "var(--font-ui)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
            paddingBottom: "12px",
          }}
        >
          <div>
            <h3
              id="reality-modal-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "800",
                color: "var(--text)",
              }}
            >
              ⭐ Reality Verification Breakdown
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
              Deterministic feasibility evaluation by TripNow Reality Engine
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reality details"
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Overall Score Header Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: color ? `${color}10` : "rgba(16, 185, 129, 0.08)",
            padding: "16px",
            borderRadius: "12px",
            border: `1px solid ${color || "#059669"}30`,
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted)",
              }}
            >
              Authoritative Reality Score
            </span>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: color || "var(--emerald-text)",
              }}
            >
              {score}{" "}
              <span style={{ fontSize: "18px", fontWeight: "600", color: "var(--muted)" }}>
                / 100
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "800",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "4px 12px",
                borderRadius: "6px",
                background: color || "#059669",
                color: "#FFFFFF",
                display: "inline-block",
              }}
            >
              {status}
            </span>
            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
              {metrics.lockedActivityCount || 0} Locked{" "}
              {metrics.lockedActivityCount === 1 ? "Anchor" : "Anchors"}
            </div>
          </div>
        </div>

        {/* Sub-Score Analysis Progress Bars */}
        <div style={{ marginBottom: "20px" }}>
          <h4
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "12px",
            }}
          >
            Sub-Score Analysis
          </h4>
          <div style={{ display: "grid", gap: "10px" }}>
            {/* Time Feasibility */}
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "6px",
                }}
              >
                <span>⏱️ Time Feasibility</span>
                <span style={{ color: "var(--text)" }}>
                  {subScores.timeFeasibility ?? "—"}/100
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, subScores.timeFeasibility || 0))}%`,
                    height: "100%",
                    background: "#059669",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>

            {/* Budget Feasibility */}
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "6px",
                }}
              >
                <span>💰 Budget Feasibility</span>
                <span style={{ color: "var(--text)" }}>
                  {subScores.budgetFeasibility ?? "—"}/100
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, subScores.budgetFeasibility || 0))}%`,
                    height: "100%",
                    background: "#10B981",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>

            {/* Pacing & Daily Load */}
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "6px",
                }}
              >
                <span>
                  🏃 Pacing & Daily Load ({metrics.paceCategory || "Balanced"})
                </span>
                <span style={{ color: "var(--text)" }}>
                  {subScores.activityLoad ?? subScores.travelPace ?? "—"}/100
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, subScores.activityLoad ?? subScores.travelPace ?? 0)
                    )}%`,
                    height: "100%",
                    background: "#D97706",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>

            {/* Route & Distance Efficiency */}
            <div
              style={{
                background: "rgba(0,0,0,0.02)",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "6px",
                }}
              >
                <span>🗺️ Route & Distance Efficiency</span>
                <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                  {subScores.routeEfficiency !== null && subScores.routeEfficiency !== undefined
                    ? `${subScores.routeEfficiency}/100`
                    : "Stage A (Awaiting Coords)"}
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "rgba(0,0,0,0.06)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: subScores.routeEfficiency
                      ? `${subScores.routeEfficiency}%`
                      : "100%",
                    height: "100%",
                    background: "rgba(0,0,0,0.15)",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pacing & Workload Feasibility Details Card (Step 2.B) */}
        <div
          style={{
            background: "rgba(245, 158, 11, 0.05)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "12px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px" }}>🏃</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "var(--amber-text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Pacing & Workload Feasibility
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                background: "rgba(245, 158, 11, 0.15)",
                color: "var(--amber-text)",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {metrics.paceCategory || "Balanced"} Pace
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>
                Avg Daily Active
              </div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>
                {metrics.avgDailyActiveMinutes
                  ? `${formatMinutes(metrics.avgDailyActiveMinutes)} / day`
                  : "—"}
              </div>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>
                Total Trip Active
              </div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>
                {metrics.totalTripActiveMinutes
                  ? formatMinutes(metrics.totalTripActiveMinutes)
                  : "—"}
              </div>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase" }}>
                Activity Density
              </div>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--text)" }}>
                {totalActivities} total stops
              </div>
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5" }}>
            {metrics.paceCategory === "Relaxed" &&
              "Comfortable travel pace with generous rest intervals and minimal physical fatigue."}
            {metrics.paceCategory === "Balanced" &&
              "Evenly distributed daily workload with sustainable buffers between stops."}
            {metrics.paceCategory === "Busy" &&
              "Packed daily schedule with tight buffers between stops. Monitor fatigue on consecutive days."}
            {metrics.paceCategory === "Very Busy" &&
              "High daily workload exceeding recommended endurance limits. Risk of traveler burnout."}
            {!metrics.paceCategory &&
              "Deterministic pace calculations evaluate active schedule duration against physical rest limits."}
          </div>
        </div>

        {/* Duration Data Confidence Card (Step 2.C) */}
        <div
          style={{
            background: hasDurationCoverage
              ? durationCoveragePercent >= 70
                ? "rgba(16, 185, 129, 0.05)"
                : "rgba(245, 158, 11, 0.05)"
              : "rgba(0, 0, 0, 0.02)",
            border: `1px solid ${
              hasDurationCoverage
                ? durationCoveragePercent >= 70
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(245, 158, 11, 0.2)"
                : "rgba(0, 0, 0, 0.06)"
            }`,
            borderRadius: "12px",
            padding: "14px 16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px" }}>📊</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color:
                    hasDurationCoverage && durationCoveragePercent >= 70
                      ? "var(--emerald-text)"
                      : "var(--text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Duration Data Confidence
              </span>
            </div>

            {hasDurationCoverage ? (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background:
                    durationCoveragePercent >= 70
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(245, 158, 11, 0.15)",
                  color:
                    durationCoveragePercent >= 70
                      ? "var(--emerald-text)"
                      : "var(--amber-text)",
                }}
              >
                {durationCoveragePercent}% Verified Durations
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>
                Confidence data not available
              </span>
            )}
          </div>

          {hasDurationCoverage ? (
            <>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "6px",
                }}
              >
                {explicitDurationsCount} of {totalActivities} activities have confirmed durations
                {inferredDurationsCount > 0 && ` (${inferredDurationsCount} use 120m fallback)`}.
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5" }}>
                <p style={{ margin: "0 0 4px" }}>
                  • <b>Higher coverage</b> means more activity durations were explicitly specified
                  by your plan or preferences.
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  • <b>Lower coverage</b> means more activities rely on the engine's 120-minute
                  inferred fallback heuristic.
                </p>
                <p style={{ margin: "4px 0 0", fontStyle: "italic", opacity: 0.9 }}>
                  ℹ️ This is a metadata quality and transparency indicator, not a guarantee of
                  travel accuracy.
                </p>
              </div>
            </>
          ) : (
            <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5" }}>
              Duration coverage ratio is calculated from activities with explicit duration metadata.
              This historical booking does not carry confidence metadata.
            </div>
          )}
        </div>

        {/* Indicative Flight / Ferry Transition Buffer Guidance (Step 2.D) */}
        {hasTransitIssues && (
          <div
            style={{
              background: "rgba(59, 130, 246, 0.05)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "16px" }}>✈️</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#1d4ed8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Indicative Transit Buffer Guidance
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text)", lineHeight: "1.5" }}>
              Commercial flight and ferry transitions require substantial terminal check-in,
              security screening, and boarding buffers (typically 2 hours for flights, 1 hour for ferries).
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                marginTop: "6px",
                lineHeight: "1.4",
              }}
            >
              ⚠️ <b>Planning Note:</b> This check evaluates coarse time-slot capacity (morning,
              afternoon, evening). It does not represent confirmed ticket departure times, airline
              schedules, or port terminal queues.
            </div>
          </div>
        )}

        {/* Detected Issues & Warnings Hierarchy (Step 2.E) */}
        <div>
          <h4
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "12px",
            }}
          >
            Friction Warnings & Feasibility Issues ({dedupedIssues.length})
          </h4>

          {dedupedIssues.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(16, 185, 129, 0.08)",
                borderRadius: "8px",
                color: "var(--emerald-text)",
                fontSize: "13px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>✨</span>
              <span>
                All feasibility constraints verified. Your itinerary features realistic durations,
                sustainable pacing, and comfortable transitions.
              </span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {dedupedIssues.map((iss, idx) => {
                const {
                  scoreImpactText,
                  badgeBg,
                  borderCol,
                  bgCol,
                  dayText,
                  isDuplicatePrevented,
                  isInferred,
                  isLocked,
                } = classifyIssue(iss);

                return (
                  <div
                    key={iss.id || idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: bgCol,
                      border: `1px solid ${borderCol}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Severity / Score Impact Badge */}
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: badgeBg,
                          color: "#FFFFFF",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {scoreImpactText}
                      </span>

                      {/* Day & Period Context */}
                      {dayText && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "var(--muted)",
                          }}
                        >
                          {dayText}
                        </span>
                      )}

                      {/* Duplicate Protected Notice */}
                      {isDuplicatePrevented && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#1d4ed8",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                          title="Slot duration is already penalized under slot overrun; duplicate deduction prevented"
                        >
                          🛡️ Duplicate Protected (0 pts)
                        </span>
                      )}

                      {/* Inferred Duration Notice */}
                      {isInferred && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "600",
                            background: "rgba(0, 0, 0, 0.05)",
                            color: "var(--muted)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                          title="Overload is based on unannotated 120m inferred defaults; penalty softened"
                        >
                          ⏱️ Durations Inferred
                        </span>
                      )}

                      {/* Locked Anchor Flag */}
                      {isLocked && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            background: "rgba(0,0,0,0.08)",
                            color: "var(--text)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            marginLeft: "auto",
                          }}
                        >
                          🔒 Locked Anchor
                        </span>
                      )}
                    </div>

                    {/* Issue Message */}
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text)",
                        lineHeight: "1.5",
                      }}
                    >
                      {iss.message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div style={{ marginTop: "24px", textAlign: "right" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--text)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "9px 22px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "var(--font-ui)",
              transition: "opacity 0.15s ease",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

