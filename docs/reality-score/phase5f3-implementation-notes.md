# TripNow Phase 5F.3 — Logistics Friction & Data Confidence Implementation Notes

**Date:** November 2, 2026  
**Status:** Approved for Implementation  
**Module Scope:** `backend/services/realityEngine/timeEngine.js`, `backend/services/realityEngine/paceEngine.js`, `backend/services/realityEngine/index.js`, and associated regression tests.

---

## 1. Baseline & Current Defect Analysis

### Defect 1: Inferred Duration Penalty Bias
- **Current Behavior:** Historical or unannotated activities lacking explicit duration metadata fall back to 120 minutes. If an itinerary has 3 unannotated activities in a morning slot ($3 \times 120\text{m} = 360\text{m}$), or 5 in a day ($5 \times 120\text{m} = 600\text{m}$), it triggers high-severity `slot_overrun` and `daily_overload` issues (-15 points each), penalizing the trip as though the durations were confirmed user input.
- **Goal:** Differentiate explicit durations from inferred durations. Ensure inferred durations still contribute to conservative feasibility assessments, but do not create disproportionately punitive deductions.

### Defect 2: High-Overhead Transit Buffer Blindspot (`flight`, `ferry`)
- **Current Behavior:** Canonical Phase 5D metadata `act.travelMode` (`"flight"`, `"ferry"`) is completely uninspected when GPS coordinates are unavailable.
- **Flaw:** A morning slot with a 60-minute sightseeing activity and a 120-minute flight totals $180\text{m} \le 240\text{m}$. The duration engine reports zero overrun, ignoring that commercial flights require terminal arrival, security screening, and boarding buffers ($\ge 120\text{m}$ recommended). Packing other activities into the same 4-hour morning makes catching the flight unrealistic.
- **Double-Counting Risk:** If a slot already overruns its capacity without buffer (e.g. $150\text{m} + 150\text{m} = 300\text{m} > 240\text{m}$), it is already penalized under `slot_overrun`. The transition buffer evaluation must not duplicate this deduction.

---

## 2. Proposed Mathematical Formulas & Algorithms

### 2.1 Confidence-Aware Duration Saturation (`timeEngine.js`)

For each activity:
```javascript
const isExplicitDuration =
  typeof act.durationMinutes === "number" &&
  !act.durationInferred &&
  !Number.isNaN(act.durationMinutes);
const duration = isExplicitDuration ? Math.max(0, act.durationMinutes) : 120;
const isInferred = !isExplicitDuration;
```

For each slot group of activities:
$$\rho_{\text{inferred}} = \frac{N_{\text{inferred}}}{N_{\text{total}}}$$

When $\text{slotDuration} > \text{slotMax}$:
1. **Confirmed Overload ($\rho_{\text{inferred}} \le 0.5$):**
   - Majority of activities have confirmed durations.
   - Severity: $\text{overrunMin} \ge 60\text{m} \implies \text{"high"}$ (-15 pts); $< 60\text{m} \implies \text{"medium"}$ (-8 pts).
   - `confidence: "confirmed"`, `durationInferred: false`.
2. **Estimated Overload ($\rho_{\text{inferred}} > 0.5$):**
   - Majority of activities use inferred defaults.
   - Severity is dampened by one level:
     - $\text{overrunMin} \ge 60\text{m} \implies \text{"medium"}$ (-8 pts instead of 15).
     - $\text{overrunMin} < 60\text{m}$: if $\rho_{\text{inferred}} = 1.0 \implies \text{"low"}$ (advisory notice, 0 pts); if mixed $\implies \text{"medium"}$.
   - `confidence: "inferred"`, `durationInferred: true`.
   - Message prefix: `"(Estimated schedule - durations inferred)"`.

### 2.2 Daily Endurance Confidence Dampening (`timeEngine.js` & `paceEngine.js`)

When $\text{totalActiveMinutes} > 540\text{m}$:
Let $\rho_{\text{dayInferred}} = \frac{N_{\text{dayInferred}}}{N_{\text{dayActivities}}}$.
- If $\rho_{\text{dayInferred}} > 0.5$:
  - Critical overload ($> 660\text{m}$) is dampened from `"high"` to `"medium"`.
  - Non-critical overload ($540-660\text{m}$) where $\rho_{\text{dayInferred}} = 1.0$ is dampened to `"low"`.
  - In `paceEngine.js`, peak day penalty for inferred marathon days is dampened from 12 pts to 6 pts (or 0 for 100% inferred $\le 660\text{m}$).

### 2.3 Flight & Ferry Transition Buffer Evaluation (`timeEngine.js`)

**Configurable Conservative Buffer Assumptions:**
$$\text{TRANSIT\_BUFFER\_MINUTES} = \{ \text{flight}: 120, \text{ferry}: 60 \}$$

For each slot containing an activity with `act.travelMode === "flight"` or `"ferry"`:
1. **Context Check:**
   - Are there other activities in the same slot?
   - If `otherActs.length === 0`: The entire slot is reserved for the transit mode. Buffer is satisfied. Zero issues.
2. **Buffer Deficit Calculation:**
   $$\text{otherDuration} = \sum_{\text{other} \in \text{slot}} \text{other.duration}$$
   $$\text{availableBuffer} = \text{slotMax} - (\text{transitDuration} + \text{otherDuration})$$
   $$\text{bufferDeficit} = \text{requiredBuffer} - \text{availableBuffer}$$
3. **Double-Counting Prevention:**
   - If slot is **already overloaded** by active duration ($\text{slotDuration} > \text{slotMax}$):
     The slot overrun issue already penalizes the time crunch. The transit buffer issue is marked advisory (`severity: "low"`, `duplicatePrevented: true`) with 0 additional score deduction.
   - If slot active duration fits ($\text{slotDuration} \le \text{slotMax}$), but $\text{bufferDeficit} > 0$:
     Emits `type: "transit_buffer_deficit"`:
     - If $\text{bufferDeficit} \ge 60\text{m} \implies \text{severity: "medium"}$ (-8 pts).
     - If $\text{bufferDeficit} < 60\text{m} \implies \text{severity: "low"}$ (advisory, 0 pts).
4. **Insufficient Context Behavior:**
   - If `period` is missing/unrecognized: skipped safely with 0 false issues.
   - No flight/ferry mode inferred from text titles.
   - No fabricated flight departure times or terminal gates.

---

## 3. Data Confidence Metrics Addition (`index.js`)

Expose `durationCoverageRatio` alongside `costCoverageRatio` in `report.metrics.confidence`:
$$\text{durationCoverageRatio} = \frac{N_{\text{explicit}}}{N_{\text{total}}}$$

All existing confidence fields remain preserved.

