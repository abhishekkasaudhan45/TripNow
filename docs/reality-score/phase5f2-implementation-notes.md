# TripNow Phase 5F.2 — Core Pacing & Intensity Engine Implementation Notes

**Date:** November 2, 2026  
**Status:** Approved for Implementation  
**Module Scope:** `backend/services/realityEngine/timeEngine.js`, `backend/services/realityEngine/paceEngine.js`, and associated regression tests.

---

## 1. Baseline & Current Defect Analysis

### Defect 1: Cumulative Slot Saturation Failure (`timeEngine.js`)
- **Current Behavior:** `timeEngine.js` iterates through activities and checks `if (duration > slotMax)`.
- **Flaw:** If multiple activities are assigned to the same time period (e.g., three 90-minute activities in a 240-minute morning window, total = 270m), each individual activity fits ($90 \le 240$), resulting in **0 reported issues**, despite a 30-minute schedule overrun with zero buffer.
- **Double-Counting Risk:** If a slot has a single activity of 300m, it is already an individual overrun. We must ensure that reporting slot-level overruns does not emit duplicate issues or penalties for the same duration.

### Defect 2: Single-Day Peak Overload Masked by Trip Averages (`paceEngine.js`)
- **Current Behavior:** `paceEngine.js` evaluates only `avgDailyActiveMinutes` across the entire trip.
- **Flaw:** A 5-day trip with four 3-hour days (180m) and one 11-hour marathon day (660m) averages 276 min/day (~4.6h). `paceEngine` marks the entire trip as **"Balanced"** with a sub-score of **98/100**, completely masking acute traveler exhaustion on the peak day.
- **Independence & Double-Counting Risk:** `timeEngine.js` already assesses daily endurance in `timeSubScore`. `paceEngine.js` must reflect workload distribution in `paceSubScore` without duplicating the exact issue ID or message.

### Defect 3: Pace Scoring Inversion for Relaxed Trips (`paceEngine.js`)
- **Current Behavior:** Trips with $\le 270$ min/day and $\le 2.2$ stops/day are categorized as "Relaxed" and assigned a hardcoded sub-score of **92**, while "Balanced" trips get **98**.
- **Flaw:** Leisure travelers with realistic, leisurely 2-activity days are arbitrarily penalized 8 points.
- **Design Mandate:** Define a continuous/piecewise deterministic curve based on documented activity density and active hours, rather than hardcoding relaxed trips to 98 or creating an artificial floor.

### Defect 4: Phase 5D Canonical `intensity` Metadata Ignored
- **Current Behavior:** `act.intensity` (`low`, `moderate`, `high`) exists across Gemini prompts, normalizer, pivot, and fix-day schemas, but is completely uninspected in `backend/services/realityEngine/`.
- **Flaw:** Consecutive high-intensity activities (e.g., morning surfing + afternoon dune climbing + evening clubbing) cause severe physical strain but incur zero penalty.

---

## 2. Proposed Mathematical Formulas & Algorithms

### 2.1 Slot-Level Cumulative Duration Saturation (`timeEngine.js`)

For each day $d$, group activities by their scheduled `period` (`morning`, `afternoon`, `evening`):
$$\text{slotMax} = \text{SLOT\_CAPACITIES\_MINUTES}[\text{period}] \quad (\text{morning: 240m, afternoon: 240m, evening: 180m})$$

For each non-empty slot:
1. Compute the cumulative duration of activities in that slot:
   $$\text{slotActiveMinutes} = \sum_{\text{act} \in \text{slot}} \text{duration}(\text{act})$$
   where $\text{duration}(\text{act}) = \text{act.durationMinutes}$ if numeric and valid, else 120m (with `inferredDurationCount++`).
2. If $\text{slotActiveMinutes} > \text{slotMax}$:
   $$\text{overrunMin} = \text{slotActiveMinutes} - \text{slotMax}$$
   - If slot has **1 activity**: emit `id: iss-time-overrun-${dayNumber}-${act.id}` with `activityId: act.id` (preserves 100% backward compatibility with existing tests).
   - If slot has **$\ge 2$ activities**: emit `id: iss-time-slot-overrun-${dayNumber}-${period}` with `activityIds: slotActs.map(a => a.id)` and `isLocked: slotActs.some(a => a.locked)`.
   - Severity:
     $$\text{severity} = \begin{cases} \text{"high"}, & \text{if } \text{overrunMin} \ge 60 \\ \text{"medium"}, & \text{if } \text{overrunMin} < 60 \end{cases}$$
   - Deductions: -15 points for high severity, -8 points for medium severity on `timeSubScore`.
3. Zero double-counting: Exactly one issue is emitted per overloaded slot.

### 2.2 Deterministic Base Pace Scoring Curve (`paceEngine.js`)

Instead of hardcoded sub-score jumps, calculate base pace score $S_{\text{base}}(M, A)$ as a function of average daily active minutes $M$ and average activities per day $A$:

$$S_{\text{base}}(M) = \begin{cases} 
100 - \left(\frac{M}{360}\right) \times 2, & \text{if } M \le 360 \text{ (Sustainable / Relaxed & Early Balanced)} \\
98 - \left(\frac{M - 360}{60}\right) \times 8, & \text{if } 360 < M \le 420 \text{ (Upper Balanced: 98 down to 90)} \\
90 - \left(\frac{M - 420}{120}\right) \times 25, & \text{if } 420 < M \le 540 \text{ (Busy / Demanding: 90 down to 65)} \\
\max\left(20, 65 - \left(\frac{M - 540}{60}\right) \times 20\right), & \text{if } M > 540 \text{ (Very Busy / Overloaded: < 65)}
\end{cases}$$

**Activity Density Adjustment:**  
If $A > 3.5$ stops/day (frenetic transit hopping), apply a density deduction:
$$\text{densityPenalty} = \min(10, \text{round}((A - 3.5) \times 4))$$

**Rationale:**
- Relaxed ($M = 240, A = 2$): $100 - (240/360) \times 2 = 98.7 \to \mathbf{98}$ or $\mathbf{99}$.
- Balanced ($M = 360, A = 3$): $100 - (360/360) \times 2 = \mathbf{98}$.
- Busy ($M = 480, A = 4$): $90 - 12.5 - 2 = 75.5 \to \mathbf{75}$.
- Very Busy ($M = 600, A = 3$): $65 - 20 = \mathbf{45}$.
- Fully continuous across thresholds. No artificial hardcodes.

### 2.3 Single-Day Peak Overload Detection (`paceEngine.js`)

In addition to trip averages, inspect per-day active loads:
$$\text{dailyLoads} = [\text{dayActiveMinutes}_1, \dots, \text{dayActiveMinutes}_N]$$
$$\text{maxDayMinutes} = \max(\text{dailyLoads})$$

If any day exceeds $540$ minutes (9 hours):
- For each day where $\text{dayActiveMinutes} > 660$ (critical, $> 11$h): apply a peak penalty of **12 points**.
- For each day where $540 < \text{dayActiveMinutes} \le 660$ (heavy, $9-11$h): apply a peak penalty of **6 points**.
- Total peak penalty is bounded: $\text{peakPenalty} = \min(24, \sum \text{dayPenalty})$.
- Issue emitted for the peak day(s):
  `id: iss-pace-peak-${worstDay.dayNumber}`
  `type: "pace_peak_overload"`
  `severity: worstDay.activeMinutes > 660 ? "high" : "medium"`
  `message: Day X active duration (Ym / Zh) creates extreme single-day fatigue despite an acceptable trip average.`

### 2.4 Consecutive High-Intensity Fatigue Evaluation (`paceEngine.js`)

Within each day, inspect the chronological sequence of activities:
- Let `streak` count consecutive activities with `act.intensity === "high"`.
- A streak is broken by any activity with `act.intensity === "low"` or `"moderate"`, or when the day ends.
- Missing/unknown intensity does not increment streaks and is never assumed to be high.
- Evaluation rules:
  - `streak === 1`: Normal active travel. Penalty = 0.
  - `streak === 2`: Consecutive high-intensity activities without recovery.
    - Penalty: **6 points**.
    - Issue: `id: iss-pace-fatigue-${dayNumber}-${actId}`, `type: "intensity_fatigue"`, `severity: "medium"`.
  - `streak >= 3`: Three or more consecutive high-intensity activities.
    - Penalty: **12 points**.
    - Issue: `id: iss-pace-fatigue-${dayNumber}-${actId}`, `type: "intensity_fatigue"`, `severity: "high"`.
- Total fatigue penalty across trip is bounded: $\text{fatiguePenalty} = \min(20, \sum \text{streakPenalties})$.

### 2.5 Final Pace Sub-Score Assembly
$$\text{paceSubScore} = \max(10, \min(100, S_{\text{base}}(M, A) - \text{peakPenalty} - \text{fatiguePenalty}))$$

---

## 3. Double-Counting Prevention Matrix

| Condition | Reported in `timeEngine` | Reported in `paceEngine` | Issue ID Distinction | Deduction Distinction |
|---|---|---|---|---|
| Slot cumulative overload ($> \text{slotMax}$) | `slot_overrun` | Not evaluated | `iss-time-slot-overrun-D-P` | Deducts from `timeSubScore` only |
| Single activity $> \text{slotMax}$ | `slot_overrun` | Not evaluated | `iss-time-overrun-D-ActId` | Deducts from `timeSubScore` only (slot cumulative skipped) |
| Whole trip average high ($> 540$m/day) | Not evaluated | `pace_exhaustion` | `iss-pace-exhaustion` | Deducts from `paceSubScore` |
| Single peak day overload ($> 540$m) | `daily_overload` | `pace_peak_overload` | `iss-time-overload-D` vs `iss-pace-peak-D` | Evaluates time endurance (`timeSubScore`) vs pace load (`paceSubScore`) |
| Consecutive high intensity | Not evaluated | `intensity_fatigue` | `iss-pace-fatigue-D-ActId` | Deducts from `paceSubScore` only |

---

## 4. Missing-Data & Backward-Compatibility Policy

1. **Missing Duration:** Falls back to 120m with `inferredDurationCount++`. Missing durations are NEVER treated as 0 minutes.
2. **Missing Intensity:** Remains `null`/unknown. It is NEVER assumed to be `low` or `high`. Does not trigger fatigue penalties.
3. **Legacy String Itineraries:** Synthesized activities have `intensity: null`, `durationMinutes: 120`, `durationInferred: true`. They pass through cleanly without false fatigue penalties.
4. **Boundary Durations:** Safely handles 0m, negative durations (clamped to 0), exactly full slots, and 1m over/under.

