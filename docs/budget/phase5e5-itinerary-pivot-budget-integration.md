# TripNow Phase 5E.5 — Itinerary, Adaptive Pivot & Fix Day Budget Integration

## Executive Summary

Phase 5E.5 integrates TripNow's deterministic Budget Intelligence engine into the itinerary lifecycle, Adaptive Pivot workflows, and Fix My Day rebalancing modals while strictly preserving all existing itinerary functionality, activity locking invariants, cryptographic signatures, and concurrency safety.

A critical design boundary is enforced across the stack:
- **Deterministic Budget Intelligence**: Pure mathematical evaluation based on destination macroeconomic tier, duration, party size, and total budget. Executes 100% locally and server-side with zero Gemini calls and zero fabricated venue costs.
- **Itinerary Activity Cost Data**: Descriptive qualitative guidance (e.g., "Free", "Low", "Moderate", "High", or venue estimates). Never added into total budget calculations and never treated as verified monetary prices.

All 31 backend test suites (516 tests) and frontend test suites pass with 100% green status, zero vulnerabilities, and clean production builds.

---

## 1. Architectural Cost Data Flow & Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TripNow Cost & Budget Data Flow                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
         ┌────────────────────────────┴─────────────────────────────┐
         ▼                                                         ▼
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│   Deterministic Budget Engine     │    │   Itinerary Activity Metadata     │
│  (Pure Math / Zero AI Calls)      │    │  (Descriptive Qualitative Venue)  │
├───────────────────────────────────┤    ├───────────────────────────────────┤
│ • Inputs: destination, budget,    │    │ • Source: Gemini structured plan  │
│   days, travelers, currency       │    │ • Types: "Free", "Low", "Moderate"│
│ • Standard daily reference        │    │ • Invariants: NEVER summed into   │
│ • Daily per-person allowance      │    │   numeric total trip budget       │
│ • Group daily baseline            │    │ • Displayed as qualitative tags   │
│ • Comfort category (Low/Mod/High) │    │   and "(venue estimate)" badges   │
│ • 5-category reference breakdown  │    │ • Budget pivots prefer Free/Low   │
└─────────────────┬─────────────────┘    └─────────────────┬─────────────────┘
                  │                                        │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Initial Plan & Planning View (PlanTrip.jsx)                              │
│    - Economic Intelligence Panel provides baseline daily reference frame    │
│    - Activity cards display qualitative cost tags cleanly separated        │
│                                                                             │
│ 2. Adaptive Pivot Workflow (pivotService.js & PlanTrip.jsx)                 │
│    - Reason "budget" enforces: "STRICT RULE: cost must be free or minimal"  │
│    - Returns qualitative candidate cost (e.g. "Free")                       │
│    - Enforces NO fabricated monetary savings (zero false "saved ₹500")      │
│    - Staged plan preserved; explicit user save required                     │
│                                                                             │
│ 3. Fix My Day Workflow (fixDayService.js & PlanTrip.jsx)                    │
│    - HMAC-signed proposalToken (15m expiry, tamper-proof, strictly pre-DB)  │
│    - Preview includes deterministic budgetGuidance strip                    │
│    - Diff slots display original and replacement venue cost estimates       │
│    - Explicit "Apply Change" user confirmation preserves OCC & locks        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Points & Implementation Details

### A. Backend Fix Day Integration (`backend/services/fixDayService.js`)
1. **Deterministic Budget Guidance in Preview**:
   - `previewFixDay` calculates macroeconomic budget guidance using `calculateBudgetIntelligence` (pure math, 0 AI calls).
   - Returns `budgetGuidance` on the response payload:
     - `destinationTier`: Destination classification (e.g., `"TIER_2_RESORT"`)
     - `comfortCategory`: Evaluated comfort band (`"low"`, `"moderate"`, `"high"`)
     - `dailyPerPerson` / `perPersonDailyBudget`: Daily allowance per traveler
     - `groupDailyBudget`: Group daily budget
     - `currency`: Currency code (`"INR"`)
     - `qualitativeNote`: Explicit disclaimer that venue costs are qualitative estimates.
2. **HMAC Proposal Token Invariance**:
   - `tokenPayload` remains strictly scoped to execution claims:
     `{ purpose: "fix-day", proposalId, tripId, dayNumber, baseVersion, reason, currentPeriod, delayMinutes, replacementSlots, issuedAt, expiresAt }`.
   - `budgetGuidance` is purely informational on the response object and is **never** added to the token payload, preserving exact HMAC signature verification, expiry checks, and tamper rejection.
3. **Slot Cost Representation**:
   - Both `originalActivity` and `replacementActivity` in preview diff slots carry `cost: act.cost ?? act.costEstimate ?? "Moderate"`, enabling side-by-side qualitative comparison.

### B. Backend Adaptive Pivot Integration (`backend/services/pivotService.js`)
1. **Deterministic Budget Guidance in Pivot**:
   - `executePivot` attaches `budgetGuidance` to the candidate response using `calculateBudgetIntelligence`.
   - When `pivotReason === "budget"`, the prompt enforces:
     `REASON CONSTRAINTS (BUDGET CONCERN): Prefer: Free or very low-cost experiences... STRICT RULE: cost must be free or minimal.`
   - Qualitative guidance note informs traveler: `"Budget-conscious replacement selected. Activity costs are qualitative estimates and not deducted from numeric totals."`
2. **Zero Fabricated Savings**:
   - The engine does not emit synthetic monetary savings fields (`numericSavings`, `moneySaved`).
3. **Staged Mutation & OCC**:
   - Staged mutations remain uncommitted until explicit save.
   - Concurrency checking (`__v`) is strictly maintained.

### C. Frontend Planning View (`frontend/src/pages/PlanTrip.jsx`)
1. **Fix Day Modal Preview Banner**:
   - In Step 2 (Review Proposal), renders a compact Budget Context strip displaying daily per-person budget, comfort category, and destination tier.
   - Includes graceful fallback evaluating `calculateBudgetIntelligence` locally if viewing older/cached previews.
2. **Replacement Slot Cost Guidance**:
   - Renders replacement activity venue cost clearly labeled: `Est. Cost: <cost> (venue estimate)`.
3. **Separation of Concerns**:
   - The Budget Tab maintains clear separation between "Economic Intelligence & Viability" (deterministic panel) and "AI-Estimated Activity Cost Breakdown" (Gemini itinerary breakdown).

---

## 3. Treatment of Qualitative vs. Monetary Costs

| Cost Dimension | Representation | Source | Treatment in TripNow |
| :--- | :--- | :--- | :--- |
| **Total Trip Budget** | Numeric integer (`₹50,000`) | User Input | Used for deterministic baseline calculations, daily allowance, and sufficiency ratio. |
| **Standard Baseline** | Numeric currency (`₹3,200/day`) | Configurable Matrix | Benchmark for destination tier comfort classification. |
| **Activity Cost** | String (`"Free"`, `"Low"`, `"₹200 entrance"`) | AI Generation | Qualitative venue guidance. Never summed into totals or subtracted from total budget. |
| **Budget Pivot Alternative** | Qualitative String (`"Free"`) | Pivot Engine | Free or minimal cost alternative. Does not assert fabricated numeric savings. |
| **Fix Day Replacement** | Qualitative String (`"Moderate"`) | Fix Day Candidate | Compared descriptively with original activity in preview diff slots. |

---

## 4. Security, Concurrency & Persistence Invariants

1. **HMAC Proposal Token Security**:
   - Tokens signed with `FIX_DAY_PROPOSAL_SECRET` (HMAC-SHA256).
   - 15-minute lifetime strictly enforced; expired tokens rejected with HTTP 410 (`TOKEN_EXPIRED`).
   - Tampered payload or signature rejected with HTTP 400 (`INVALID_TOKEN`).
2. **Optimistic Concurrency Control (OCC)**:
   - Proposals bind to `baseVersion` (`trip.__v`). Concurrent trip updates reject apply requests with HTTP 409 (`CONCURRENCY_CONFLICT`).
3. **Locked Activity Immutability**:
   - Locked activities cannot be pivoted (HTTP 423) or replaced by Fix Day proposals (HTTP 422).
4. **Shared Trip Privacy**:
   - `sanitizePublicAiPlan` and `/api/shared-trip/:tripId` allow-list public fields only.
   - Creator user ID, email, billing details, proposal tokens, and private notes are strictly stripped.
5. **PDF Export Continuity**:
   - `downloadItineraryPDF` generates compact PDFs without runtime errors, correctly formatting both structured and legacy fallback itineraries.
6. **Reality Score Stability**:
   - Purely deterministic `evaluateTripReality` produces identical scores, sub-scores, and status tiers before and after Phase 5E.5.

---

## 5. Verification Matrix (15 Acceptance Criteria)

All 15 verification criteria from Phase 5E.5 are covered by automated tests in `backend/tests/phase5e5BudgetItineraryIntegration.test.js`:

| # | Acceptance Criterion | Test Name | Result |
| :-: | :--- | :--- | :---: |
| 1 | Initial generation preserves budget context | `1. Initial itinerary generation preserves budget context` | **PASS** |
| 2 | No Gemini calls for deterministic calculations | `2. No additional Gemini call for deterministic calculations` | **PASS** |
| 3 | Adaptive Pivot preserves budget inputs | `3. Adaptive Pivot preserves budget inputs` | **PASS** |
| 4 | Budget pivot does not fabricate savings | `4. Budget pivot does not fabricate monetary savings` | **PASS** |
| 5 | Qualitative costs separated from numeric budgets | `5. Qualitative activity costs remain separate from numeric budgets` | **PASS** |
| 6 | Fix Day preview shows correct budget context | `6. Fix Day preview shows correct budget context` | **PASS** |
| 7 | Fix Day apply preserves explicit approval | `7. Fix Day apply preserves explicit approval` | **PASS** |
| 8 | HMAC proposal tampering is rejected | `8. HMAC proposal tampering is rejected` | **PASS** |
| 9 | Expired proposals are rejected | `9. Expired proposals are rejected` | **PASS** |
| 10 | Locked activities remain unchanged | `10. Locked activities remain unchanged` | **PASS** |
| 11 | OCC conflicts remain correctly handled | `11. OCC conflicts remain correctly handled` | **PASS** |
| 12 | Historical bookings without budget metadata safe | `12. Historical bookings without budget metadata remain safe` | **PASS** |
| 13 | Shared-trip privacy is preserved | `13. Shared-trip privacy is preserved` | **PASS** |
| 14 | PDF export remains functional | `14. PDF export remains functional` | **PASS** |
| 15 | Reality Score outputs remain unchanged | `15. Reality Score outputs remain unchanged` | **PASS** |

---

## 6. Test Suite and Build Summary

### Backend Tests
- **Targeted Suite**: `backend/tests/phase5e5BudgetItineraryIntegration.test.js` — **15 / 15 passed**
- **Existing Fix Day Suite**: `backend/tests/fixDay.test.js` — **35 / 35 passed**
- **Existing Pivot Suite**: `backend/tests/pivot.test.js` — **28 / 28 passed**
- **Shared Trip & PDF Suites**: `sharedTripPrivacy.test.js` & `phase5d5SharedTripAndPdfMetadata.test.js` — **24 / 24 passed**
- **Full Backend Regression Suite**: `npm test --prefix backend` — **31 test suites passed, 516 / 516 tests passed (0 failures, 0 regressions)**

### Frontend Tests & Build
- **Frontend Budget Suite**: `frontend/tests/budgetIntelligence.test.mjs` — **6 / 6 passed**
- **Frontend Integration Suite**: `frontend/tests/budgetUiAndParity.test.mjs` — **18 / 18 passed**
- **Frontend Production Build**: `npm run build --prefix frontend` — **Exit 0, 394 modules transformed, 0 errors**

### Dependency Security Audits
- `npm audit --omit=dev --prefix backend` — **0 vulnerabilities**
- `npm audit --omit=dev --prefix frontend` — **0 vulnerabilities**

---

## 7. Strict Scope Restrictions Compliance

- Baseline formulas: **Unchanged**
- Activity prices: **Zero invented prices; qualitative tags preserved**
- Qualitative costs to numeric currency: **Never converted or summed**
- Extra Gemini calls for budget intelligence: **Zero**
- Booking schema: **Unchanged (no migrations)**
- Authentication & CSRF: **Unchanged**
- Activity locks & OCC: **100% verified and preserved**
- HMAC token verification: **100% verified and preserved**
- Auto-save: **Never auto-saved; explicit user action required**
- Reality Score algorithm: **Unchanged**
- Dashboard Cost Splitter: **Untouched (deferred to subsequent phase)**
- Deployments: **None triggered**

