# TripNow Phase 5F.4 — Reality Score Frontend Presentation Notes

**Date:** November 2, 2026  
**Status:** Approved & Implemented  
**Author:** Senior React Frontend Engineer & Product UI/UX Engineer  
**Scope:** `frontend/src/components/reality/`, `frontend/src/pages/PlanTrip.jsx`, and `frontend/tests/realityScoreUi.test.mjs`

---

## 1. Architectural Strategy & Design System Alignment

Phase 5F.4 delivers the frontend presentation layer for TripNow's calibrated **Reality Score Engine**. It adheres to the primary principle that **the backend is the authoritative source for all scoring calculations**. The React client performs zero score recalculation, approximation, or heuristic guessing.

### 1.1 Component Hierarchy & Directory Structure

Following the architectural patterns established by `frontend/src/components/budget/` and `frontend/src/components/pivot/`, the Reality Score presentation components are isolated into a dedicated feature module:

```
frontend/src/components/reality/
├── RealityScoreBanner.jsx    # Compact banner embedded above PlanTrip tab bar
├── RealityScoreModal.jsx     # Comprehensive breakdown modal dialog
├── realityPresentation.js   # Pure, zero-dependency ESM formatting and categorization utilities
└── index.js                 # Barrel exports for clean consumption
```

This modularization decoupled `PlanTrip.jsx` from over 300 lines of inline modal markup, improving maintainability and testability without altering existing state lifecycles.

---

## 2. Key Presentation Contracts

### 2.1 Authoritative Score & Tier Mapping
- The overall score (`realityReport.score`), status tier (`realityReport.status`), and brand color (`realityReport.color`) are rendered directly from the backend response.
- No score numbers are clamped, scaled, or rounded in React.
- Accessible ARIA labels communicate the score and tier to assistive technologies:  
  `aria-label="Trip Reality Score: {score} out of 100, Status: {status}"`.

### 2.2 Pacing & Feasibility Guidance
- Displays daily workload metrics:
  - Average daily active minutes (`metrics.avgDailyActiveMinutes` formatted as `"Xh Ym / day"`).
  - Total trip active schedule (`metrics.totalTripActiveMinutes` formatted as `"Xh"` or `"Xh Ym"`).
  - Activity density (`metrics.totalActivities` total stops).
  - Pacing category badge (`metrics.paceCategory`): Relaxed, Balanced, Busy, or Very Busy.
- Plain-language traveler explanations describe physical fatigue and rest buffers based on the backend category.

### 2.3 Duration Data Confidence Display
- Displays `report.metrics?.confidence?.durationCoverageRatio` as a formatted percentage (`"X% Verified Durations"`).
- Explains the metric in plain language:
  - **Higher coverage:** Activities have explicitly confirmed durations from user input or structured generator outputs.
  - **Lower coverage:** Remaining activities rely on the engine's 120-minute inferred default for conservative scheduling.
  - **Transparency disclaimer:** Clarifies that duration coverage is a data-quality indicator of metadata completeness, not a guarantee of travel feasibility.
- Safely handles historical bookings where `durationCoverageRatio` is null or missing by displaying a graceful `"Confidence data not available"` notice without rendering `NaN%`.

### 2.4 Flight & Ferry Indicative Guidance
- Displays a dedicated transit guidance card when transition buffer issues exist.
- Emphasizes that transit checks evaluate **coarse time-slot window capacity** (`morning`, `afternoon`, `evening`) and do not represent confirmed tickets, airline schedules, or airport terminal queues.
- Clearly distinguishes **advisory notices** (`duplicatePrevented: true` or `severity: "low"`, deducting $0$ points) from **score-impacting warnings** (`severity: "medium"`, deducting $8$ points).
- Zero departure or arrival times are fabricated.

### 2.5 Warning Hierarchy & Issue Deduplication
Issues are categorized strictly by the backend `severity` field:
1. **High Severity (Critical · -15 pts):** Rose theme, clear impact badge.
2. **Medium Severity (Moderate · -8 pts):** Amber theme, moderate impact badge.
3. **Low / Advisory (Informational · 0 pts):** Blue theme, advisory notice badge with `duplicatePrevented` protection indicator.

Issue properties display affected `Day {day}` and `period` (`Morning`, `Afternoon`, `Evening`), along with `🔒 Locked Anchor` and `⏱️ Durations Inferred` badges when applicable. Duplicate issues are safely eliminated via `deduplicateIssues`.

---

## 3. Accessibility & Responsive Verification

- **Keyboard Support:** The details modal automatically binds a `keydown` listener for `Escape` to close the dialog.
- **Semantic Roles:** Container uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="reality-modal-title"`. The close button has an explicit `aria-label="Close reality details"`.
- **Contrast & Color Safety:** All text uses high-contrast TripNow CSS custom properties (`var(--text)`, `var(--muted)`, `var(--emerald-text)`, `var(--amber-text)`).
- **Mobile Fluidity:** All flex containers use `flexWrap: "wrap"` and avoidance of fixed pixel widths to prevent horizontal overflow on 375px mobile viewports.

