# TRIPNOW: ADAPTIVE AI TRAVEL PLANNER
## Phased Implementation Plan (IMPLEMENTATION_PLAN.md)

**Document Version:** 1.0.0  
**Methodology:** Incremental Implementation, Test-Driven Verification, Zero Regressions  
**Core Mission:** PLAN → VERIFY → ADAPT  

---

## 1. Roadmap Overview & Milestones

The TripNow evolution is partitioned into four distinct phases to minimize risk, guarantee backward compatibility, and deliver immediate value:

```
[Phase 1: Adaptive Pivot Engine] ──> [Phase 2: Structured Activities & Locks]
            │                                         │
            v                                         v
[Phase 3: Deterministic Reality Engine] ──> [Phase 4: Autonomous Real-Time Sync]
```

| Phase | Core Objective | Key Deliverable | Risk Level | Target Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Adaptive Pivot Engine (MVP)** | `POST /api/ai/pivot` + Inline UI Pivot in `PlanTrip.jsx` | Low | Block-Level Semantic Adaptation |
| **Phase 2** | **Structured Activities & Locking** | Schema Migration to `activities[]` + Lock Activity Feature | Medium | Entity-Level Schema & UX |
| **Phase 3** | **Trip Reality Score & Engine** | 0–100 Reality Score, Haversine checks, Opening Hours | Medium | Deterministic Verification Engine |
| **Phase 4** | **Autonomous Real-Time Sync** | Weather APIs, Transit sync, "Fix My Day" replanning | High | External Real-time Integrations |

---

## 2. Phase 1: Adaptive Pivot Engine (Immediate Execution)

### 2.1 Goal & Scope
Implement surgical, single-block adaptation on existing itinerary documents in MongoDB without breaking `POST /api/ai` or migrating the existing schema.

### 2.2 Task Breakdown & Work Items

#### Task 1.1: Request Validation & DTOs
- **Module:** `backend/validators/pivotValidators.js`
- **Actions:**
  - Create Zod schema `pivotRequestSchema` validating `tripId` (Mongo ObjectId), `dayNumber` (positive integer), `block` (`morning | afternoon | evening`), `pivotReason` (`rain | low_energy | budget | running_late | closed | custom`), and `customReason` (1–300 chars, required if `pivotReason === "custom"`).
- **Verification:** Unit tests testing invalid blocks, missing reason, and malformed IDs.

#### Task 1.2: Server-Authoritative Pivot Service
- **Module:** `backend/services/pivotService.js`
- **Actions:**
  1. `loadAuthoritativeTrip(tripId, userId)`: Load from MongoDB, verify user ownership if trip is linked to an account.
  2. `buildPivotPrompt(trip, dayNumber, block, reason, customReason)`: Assemble context including destination, dates, budget, the current block prose, and neighboring blocks.
  3. `generateCandidateWithGemini(prompt, reason)`: Invoke `@google/genai` with `responseSchema: pivotCandidateSchema`.
  4. `validateSemanticConstraints(candidate, reason)`: Programmatically check constraints (e.g. `indoorOutdoor !== "Outdoor"` for rain).
  5. `retryWithFeedback(prompt, failedCandidate, violation)`: Single corrective retry if constraint failed.
  6. `applySurgicalMutation(trip, dayNumber, block, candidate)`: Mutate *only* target block, leaving other days and metadata untouched.
  7. `persistWithConcurrencyCheck(tripId, updatedPlan, currentVersion)`: Execute atomic `findOneAndUpdate` with `__v` check.
- **Verification:** Service-level tests with mocked Gemini SDK.

#### Task 1.3: Controller & Route Registration
- **Module:** `backend/controllers/aiController.js` & `backend/routes/aiRoutes.js`
- **Actions:**
  - Implement `handlePivotRequest(req, res)` handling 400, 401, 403, 404, 409, 429, 502, 504.
  - Mount `router.post("/pivot", aiLimiter, optionalAuth, validate(pivotRequestSchema), handlePivotRequest)` in `aiRoutes.js`.
- **Verification:** Supertest API integration tests verifying response format and error matrix.

#### Task 1.4: Frontend Integration (`PlanTrip.jsx`)
- **Module:** `frontend/src/pages/PlanTrip.jsx`
- **Actions:**
  - Store authoritative `tripId` in component state upon initial generation: `const [tripId, setTripId] = useState(res.data.tripId)`.
  - Add inline `⚡ Pivot` button on each morning, afternoon, and evening slot.
  - Implement compact popover menu displaying the 6 pivot triggers.
  - Implement inline custom input with "Adapt Now" button for `custom` reason.
  - Implement card-level loading skeleton on the active slot while keeping surrounding days interactive.
  - Update React state surgically on HTTP 200 without reloading the entire page or regenerating other days.
  - Implement toast error banner on failure and preserve original slot text.
- **Verification:** Browser testing for double clicks, mobile viewport drawer, and offline fallback.

#### Task 1.5: Automated Test Suite & Regression Verification
- **Module:** `backend/tests/pivot.test.js`
- **Actions:**
  - Add 26+ deterministic unit and integration test cases covering happy path, 6 reasons, defensive retry, ownership rejection, and concurrency rejection.
  - Verify all 38 baseline tests in `backend/tests/` continue to pass with 0 failures.

### 2.3 Affected Files
- `backend/validators/pivotValidators.js` (NEW)
- `backend/services/pivotService.js` (NEW)
- `backend/controllers/aiController.js` (MODIFY: export pivot handler)
- `backend/routes/aiRoutes.js` (MODIFY: register `/pivot`)
- `frontend/src/pages/PlanTrip.jsx` (MODIFY: inline pivot UI & state update)
- `backend/tests/pivot.test.js` (NEW)

### 2.4 Definition of Done (DoD) — Phase 1
1. All 38 existing tests pass unchanged.
2. New Pivot test suite achieves 100% pass rate.
3. `POST /api/ai/pivot` enforces zero-trust security and trip ownership.
4. Rainy pivot with an outdoor first candidate triggers exactly one corrective retry and recovers.
5. Mutating Day 2 Afternoon leaves all other days, slots, and budget fields identical.
6. Frontend updates smoothly without full-page reload or UI flicker.

---

## 3. Phase 2: Structured Activity Schema Migration & Locking

### 3.1 Goal & Scope
Transition from prose string blocks (`morning: "..."`) to discrete structured activity entities (`activities: [Activity]`), enabling activity-level IDs, durations, categories, and the "Lock Activity" feature.

### 3.2 Task Breakdown & Work Items
1. **Schema Migration Design:**
   - Define subdocument schema `ActivitySchema` in `backend/models/Booking.js` with `id`, `title`, `period`, `durationMinutes`, `costEstimate`, `indoorOutdoor`, and `isLocked`.
   - Implement transparent migration adapter: If `trip.aiPlan.days[0].morning` is a string, read via adapter; when saved, write structured format.
2. **Activity Locking Feature:**
   - Add `isLocked: boolean` flag to each activity.
   - Update prompt assembly in `pivotService`: Locked activities are supplied as immutable constraints to Gemini ("Do NOT change Activity ID act_03, scheduled for 7:00 PM").
3. **UI Activity Card Enhancements:**
   - Replace plain text slot in `PlanTrip.jsx` with structured `ActivityCard` component featuring category badge, duration pill, and lock toggle icon (`🔒 Locked` / `🔓 Unlock`).

### 3.3 Definition of Done (DoD) — Phase 2
- Existing trips load seamlessly without database migration script failure.
- Locked activities are strictly protected during day-level pivots and replanning.

---

## 4. Phase 3: Trip Reality Score & Reality Engine

### 4.1 Goal & Scope
Implement a deterministic verification engine in Node.js that evaluates travel plans against physical reality, computing a 0–100 Trip Reality Score and surfacing actionable travel friction warnings.

> [!IMPORTANT]
> **Cardinal Architectural Rule:** Gemini must **NEVER** calculate Haversine distance, travel times, budget arithmetic, schedule overlaps, or reality scores. All calculations are pure deterministic algorithms executed server-side in Node.js.

### 4.2 Available Data & Staged Location Strategy
- **Audit:** Current Gemini responses and MongoDB trips do not contain reliable geographic coordinates (`lat`/`lng`).
- **No Coordinate Hallucination:** We do not invent coordinates.
- **Stage A (Immediate Baseline):** Evaluate time feasibility, budget arithmetic, and pace/workload. If coordinates are absent, `routeEfficiency` is reported as `null` ("Awaiting Coordinates") and weights are redistributed (Time: 40%, Budget: 35%, Pace: 25%).
- **Stage B (Provider Abstraction):** Clean `LocationProvider` interface for geocoding / Places.
- **Stage C (Transit Matrix):** Real-world transit matrices once 100% of activities possess resolved coordinates.

### 4.3 Task Breakdown & Work Items
1. **Haversine Distance & Route Engine (`distanceEngine.js`):**
   - Pure Haversine formula for coordinate-bearing activities.
   - Flag "Teleportation Anomalies" (> 40 km within adjacent same-day slots).
2. **Deterministic Time Engine (`timeEngine.js`):**
   - Canonical slot windows: Morning (240m), Afternoon (240m), Evening (180m).
   - Inter-slot buffer gap checks (60m lunch/dinner transfer buffers).
   - Slot overrun and daily schedule overload (> 540 min) detection.
3. **Budget Arithmetic Engine (`budgetEngine.js`):**
   - Deterministic cost parser handling Free, exact numbers, ranges, and unspecified text like "Moderate".
   - Budget deficit penalty scoring against allocated activity budget cap.
4. **Pace & Workload Engine (`paceEngine.js`):**
   - Daily active minutes and stops/day calculation.
   - Classification into Relaxed, Balanced, Busy, Very Busy.
5. **Scoring & Issue Prioritizer (`scoringEngine.js` & `index.js`):**
   - Weighted score aggregation (0–100) and PRD/TRD status tier mapping.
   - Reproducibility guarantee: same input strictly yields the same score.
   - Prioritized issues list with `isLocked: true` annotation for locked activities.
6. **API Route & Controller:**
   - `POST /api/ai/reality-score` with Zod validation, rate limiting, and trip ownership verification.
7. **Reality Score UI Widget:**
   - Score banner on `PlanTrip.jsx` with gauge, status badge, sub-scores, and expandable details drawer.

### 4.4 Definition of Done (DoD) — Phase 3
- Zero Gemini involvement in arithmetic or scoring.
- 0–100 reproducible Trip Reality Score returned by `POST /api/ai/reality-score`.
- Locked activities respected as immutable anchors in issue reporting.
- All 86 existing tests pass with 0 regressions, plus new Reality Engine test suites.
- Frontend production build succeeds with 0 errors.

---

## 5. Phase 4: Adaptive Day Replanning — Fix My Day (Hardened Specification)

### 5.1 Goal & Scope
Implement multi-slot day schedule compaction and overload resolution ("Fix My Day"), enabling travelers to resolve schedule overloads (> 540m active time) or cascaded travel delays (`running_late` with explicit `currentPeriod` and bounded `delayMinutes`). Operates on the strict `PLAN → VERIFY → ADAPT → VERIFY` cycle: Gemini generates replacement candidates for unlocked slots, and the Phase 3 Deterministic Reality Engine verifies that all constraints and scores pass before user confirmation and database mutation.

### 5.2 Task Breakdown & Work Items
1. **Proposal Integrity Engine (`proposalToken` & `FIX_DAY_PROPOSAL_SECRET`):**
   - Stateless HMAC-SHA256 signature using dedicated `FIX_DAY_PROPOSAL_SECRET` covering `{ purpose: "fix-day", proposalId: "<uuid-v4>", tripId, dayNumber, baseVersion, reason, currentPeriod, delayMinutes, replacementSlots, issuedAt, expiresAt }`.
   - 15-minute expiration window ($\text{expiresAt} > \text{issuedAt}$ and $\text{expiresAt} - \text{issuedAt} \le 900000$).
   - Pre-DB token verification: signature, purpose, expiration, tripId/dayNumber, reason, currentPeriod, delayMinutes, and baseVersion verified *before* database read or OCC comparison.
   - Client sends zero replacement activity content or context overrides to `/apply`; the server extracts and verifies the payload directly from the signed token.
2. **Deterministic Inputs & Validation (`fixDayValidators.js`):**
   - Support reasons: `schedule_overload`, `running_late`, and `custom`.
   - Require `currentPeriod: "morning" | "afternoon" | "evening"` and bounded `delayMinutes` ($\in [15, 240]$) for `running_late`.
   - Prior periods marked immutable past (`COMPLETED_PAST`); `currentPeriod` is strictly immutable in Phase 4 MVP regardless of lock state; only upcoming unlocked slots after `currentPeriod` are eligible for compaction.
   - Inherit full Phase 2 category enum: `["Sightseeing", "Culture", "Adventure", "Dining & Nightlife", "Relaxation", "Nature", "Shopping"]`.
3. **Replacement Targeting & Exact Activity Identity:**
   - Every replacement explicitly binds `targetActivityId` and the replacement activity.
   - `targetActivityId` MUST exist in authoritative fresh DB itinerary on target day, be unlocked, and (for `running_late`) belong to an upcoming period strictly after `currentPeriod`.
   - `replacement.id` MUST strictly equal `targetActivityId` (inherits target ID; no universal ID override); `replacement.period` MUST equal the existing target period.
   - Gemini MUST NEVER invent activity IDs; activity count cannot increase; missing periods cannot be created; non-target activities remain 100% bit-for-bit unchanged.
   - Deep bit-for-bit locked immutability: deep equality across all 10 canonical fields (`id`, `period`, `title`, `description`, `category`, `durationMinutes`, `cost`, `indoorOutdoor`, `location`, `locked`).
   - If all slots on a day are locked, abort pre-flight with HTTP 422.
4. **Deterministic Budget Policy & Legacy Slot Handling:**
   - Unknown prose ("Moderate", "Varies") and "Free" ($0) evaluated without fabricating numbers.
   - Distinguish existing vs newly introduced/worsened deficits. Existing deficits allowed; new or worsened deficits strictly rejected.
   - Legacy slots: if a day has zero eligible future replacement targets or zero adaptable slots, return deterministic HTTP 422 rather than hallucinating missing slots.
5. **Time Thresholds & Separated Feasibility Semantics:**
   - Preferred target: $\le 450\text{m}$.
   - Hard ceiling for candidate: $\le 480\text{m}$.
   - Running-late formula: $\text{AllowableFutureActiveMinutes} = \text{HardCeiling} (480\text{m}) - \text{delayMinutes} - \sum \text{PastScheduledActiveMinutes} - \text{CurrentScheduledActiveMinutes}$. System evaluates scheduled durations and never assumes elapsed progress.
   - Pre-flight 422 (`FUTURE_CAPACITY_INSUFFICIENT`): Returns HTTP 422 when unavoidable scheduled duration deterministically exceeds allowable capacity or zero eligible replacement targets exist. Feasible schedules under 60m are not automatically rejected.
   - Post-generation 502 (`PROPOSAL_VALIDATION_FAILED`): Returns HTTP 502 when candidate fails verification after single corrective retry; does not claim mathematical impossibility.
   - Warning line: $> 540\text{m}$ cleared after adaptation.
   - 5-point acceptance: (1) Locked anchors deeply intact, (2) Hard schedule met, (3) Targeted problem resolved, (4) No Reality Score regression, (5) Budget non-inflation ($\le 10\%$).
6. **Strict Apply Transaction Order:**
   - Token cryptographic verification $\rightarrow$ Fresh MongoDB fetch $\rightarrow$ Authorization $\rightarrow$ OCC version match $\rightarrow$ Candidate reconstruction $\rightarrow$ Deep lock verification $\rightarrow$ Reality verification $\rightarrow$ Atomic mutation $\rightarrow$ Final Reality Report.
7. **Frontend UI Modal (`FixDayModal.jsx` & `PlanTrip.jsx`):**
   - Triggers from Reality Score banner (`[ ⚡ Fix Day X ]`) and Day accordion headers.
   - Non-destructive diff view showing completed past slots, locked anchors, replaced slots, and score impact.
   - Atomic confirmation with signed proposal token.

### 5.3 Definition of Done (DoD) — Phase 4
- Two-step preview-and-apply workflow with 100% cryptographic proposal integrity using dedicated `FIX_DAY_PROPOSAL_SECRET`.
- Token verified prior to reading DB or trusting baseVersion.
- Client cannot manipulate replacement activity content, duration, costs, or lock states.
- Locked activities remain deeply bit-for-bit unchanged across all 10 fields.
- Hard schedule overruns are verified eliminated by Reality Engine before acceptance.
- All 123 existing tests pass with 0 regressions, plus comprehensive new Phase 4 test suite.
- Frontend production build succeeds with 0 errors.



---

## 6. Rollout & Risk Management Strategy

### 6.1 Safe Rollout Plan (Phase 1)
1. **Step 1: Dark Launch Backend**
   - Deploy `POST /api/ai/pivot` with automated tests in staging. Verify that existing `POST /api/ai` endpoints maintain zero performance regression.
2. **Step 2: Frontend Feature Flag**
   - Enable `ENABLE_ADAPTIVE_PIVOT = true` in frontend environment config.
   - Internal dogfooding: Test on 20 distinct destination types (coastal, urban, mountainous, international).
3. **Step 3: 100% General Availability (GA)**
   - Enable inline pivot buttons for all users on `PlanTrip.jsx`.

### 6.2 Rollback Strategy
- If an unhandled upstream Gemini outage or hallucination pattern occurs in production:
  - Frontend feature flag disables `⚡ Pivot` buttons and gracefully falls back to existing manual text editing (`✏️ Edit Trip`).
  - No database migration or schema rollback is required because `aiPlan` remains stored in the backward-compatible Mixed JSON format.
