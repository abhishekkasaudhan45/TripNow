# TripNow Phase 5D.3 — Pivot, Fix Day & Locked Activity Metadata Preservation

**Implementation Status:** Complete & Verified  
**Date:** November 1, 2026  
**Role:** Senior Node.js Backend Engineer, AI Itinerary Engineer, Application Security Engineer  
**Project:** TripNow AI Travel Planner  

---

## 1. Overview & Objectives

Phase 5D.3 extends the canonical activity metadata contract (`activityType`, `durationMinutes`, `travelMode`, `intensity`) established in Phase 5D.2 across all dynamic itinerary mutation workflows:
- **Adaptive & Custom Pivot** (`backend/services/pivotService.js`)
- **Fix My Day (Preview & Apply)** (`backend/services/fixDayService.js`)
- **Activity Locking & Itinerary Persistence Immutability** (`backend/controllers/bookingController.js` and `backend/services/fixDayService.js`)
- **Deterministic Reality Engine Compatibility** (`backend/services/realityEngine/index.js`)

All enhancements maintain 100% backward compatibility for historical itineraries with missing/null metadata, cryptographically enforce HMAC token integrity without changing token secrets, and preserve optimistic concurrency control (`__v`).

---

## 2. Implementation Summary

### A. Adaptive & Custom Pivot (`backend/services/pivotService.js`)
1. **Canonical Schema Integration (`PIVOT_CANDIDATE_SCHEMA`):**
   - Added canonical fields: `activityType` (enum from `ALLOWED_ACTIVITY_TYPES`), `durationMinutes` (integer minutes), `travelMode` (enum from `ALLOWED_TRAVEL_MODES`), `intensity` (enum from `ALLOWED_INTENSITIES`), `cost` (string).
   - Preserved `estimatedDurationMinutes` and `costEstimate` in properties for backward compatibility.
2. **Prompt Instructions (`buildPivotPrompt`):**
   - Instructed Gemini on selecting canonical `activityType`, venue duration `durationMinutes` (15–720), transit mode `travelMode`, exertion `intensity`, and expense `cost`.
   - Updated constraint rules (e.g. running late, low energy, budget) to refer to `durationMinutes` and `cost`.
3. **Defensive Validation & Single Retry (`validateCandidateSemantics`):**
   - Evaluates duration: prioritizes `durationMinutes` with safe fallback to `estimatedDurationMinutes`.
   - Evaluates cost: accepts `cost` with fallback to `costEstimate`.
   - Missing metadata remains optional/nullable without failing candidate validation or fabricating arbitrary defaults.
4. **Surgical Mutation & Synchronization (`executePivot`):**
   - Safely normalizes `activityType`, `travelMode`, and `intensity` via canonical helpers (`normalizeActivityType`, `normalizeTravelMode`, `normalizeIntensity`).
   - Normalizes duration and ensures `durationInferred: false` on replaced activities.
   - Preserves target activity `id` (stable identity) and updates legacy period blocks (`title — description`).
   - Maintains dual field synchronization (`durationMinutes` <-> `estimatedDurationMinutes`, `cost` <-> `costEstimate`) on the returned candidate replacement so existing frontend and tests receive both format keys transparently.

### B. Fix Day Preview & Apply (`backend/services/fixDayService.js`)
1. **Candidate Schema (`FIX_DAY_CANDIDATE_SCHEMA`):**
   - Added `activityType`, `travelMode`, and `intensity` to the structured output schema alongside `durationMinutes` and `cost`.
2. **Candidate Simulation (`validateCandidate`):**
   - Normalizes proposed metadata before simulating candidate in the target day and executing the Reality Engine.
3. **HMAC Proposal Token Integrity (`previewFixDay`):**
   - Replaced slot in proposal payload now includes `activityType`, `durationMinutes`, `travelMode`, and `intensity`.
   - Entire payload is cryptographically bound to `FIX_DAY_PROPOSAL_SECRET` via HMAC-SHA256 (`signProposalToken`).
   - Any tampering with metadata fields invalidates the cryptographic signature (`verifyProposalToken` pre-DB check).
   - Preview remains strictly non-persistent until explicit Apply.
4. **Preview Diff Slots (`previewFixDay`):**
   - `slots` array provides `originalActivity`, `replacementActivity`, and unchanged activities with normalized metadata fields (`activityType`, `durationMinutes`, `travelMode`, `intensity`).
5. **Apply Persistence (`applyFixDay`):**
   - Surgically applies normalized metadata to `clonedDay.activities[actIndex]` and persists atomically to MongoDB with OCC (`__v`).
   - Preserves exact target activity ID and period.

### C. Locked Activity Immutability
1. **Deep Immutability Comparator (`fixDayService.js:isLockedActivityUnchanged`):**
   - Expanded comparison fields to include: `id`, `period`, `title`, `description`, `category`, `activityType`, `durationMinutes`, `travelMode`, `intensity`, `cost`, `indoorOutdoor`, and `locked`.
   - Safely handles historical activities where metadata is missing/undefined: `(orig[field] ?? null) !== (candidate[field] ?? null)`.
2. **Itinerary Persistence Save (`bookingController.js:updateItinerary`):**
   - Compares incoming activity metadata against locked activities in authoritative database state.
   - If an attempt is made to modify `title`, `description`, `period`, `category`, `activityType`, `durationMinutes`, `travelMode`, or `intensity` on a locked activity, immediately returns `HTTP 423 Locked`.
   - Historical locked activities without metadata can be re-saved as long as their metadata remains unaltered.

### D. Reality Engine Compatibility
- No recalibration performed.
- All existing inputs to `realityEngine` (`durationMinutes`, `cost`, `location`, `locked`) remain intact and unmutated.

---

## 3. Automated Verification

A dedicated automated test suite was created in `backend/tests/phase5d3PivotFixDayMetadata.test.js` covering all 18 mandated scenarios:

| Category | Test Case | Status |
|---|---|---|
| **Pivot** | 1. Adaptive Pivot preserves valid metadata (`activityType`, `durationMinutes`, `travelMode`, `intensity`) | **PASS** |
| **Pivot** | 2. Custom Pivot preserves valid metadata | **PASS** |
| **Pivot** | 3. Canonical `durationMinutes` field is used and prioritized | **PASS** |
| **Pivot** | 4. Legacy `estimatedDurationMinutes` conversion remains compatible | **PASS** |
| **Pivot** | 5. Missing metadata remains optional (normalizes to null, no fabricated defaults) | **PASS** |
| **Pivot** | 6. Invalid metadata is handled safely (invalid enums normalize to null) | **PASS** |
| **Fix Day** | 7. Preview includes metadata in diff slots (`originalActivity`, `replacementActivity`) | **PASS** |
| **Fix Day** | 8. HMAC proposal payload retains metadata and validates cryptographically | **PASS** |
| **Fix Day** | 9. Apply persists metadata to `Booking.aiPlan` in database | **PASS** |
| **Fix Day** | 10. Invalid or tampered proposal tokens with modified metadata are rejected | **PASS** |
| **Fix Day** | 11. Expired proposal tokens remain rejected | **PASS** |
| **Fix Day** | 12. Preview does not persist changes before Apply | **PASS** |
| **Locking** | 13. Locked activity metadata cannot be modified via itinerary persistence | **PASS** |
| **Locking** | 14. Historical locked activities without metadata remain valid | **PASS** |
| **Locking** | 15. Unlocked activities can be updated within validation rules | **PASS** |
| **Locking** | 16. Optimistic concurrency remains intact (stale `baseVersion` fails with 409) | **PASS** |
| **Locking** | 17. Activity IDs remain stable where required across Pivot and Fix Day | **PASS** |
| **Reality** | 18. Existing Reality Score calculations remain green with metadata | **PASS** |

### Test Suite Execution Results
- `backend/tests/phase5d3PivotFixDayMetadata.test.js`: **18/18 PASS**
- `backend/tests/activityMetadataContract.test.js`: **19/19 PASS**
- `backend/tests/pivot.test.js`: **28/28 PASS**
- `backend/tests/fixDay.test.js`: **35/35 PASS**
- `backend/tests/lock.test.js`: **15/15 PASS**
- `backend/tests/realityApi.test.js`: **9/9 PASS**
- `backend/tests/geminiClientAndAiService.test.js`: **16/16 PASS**
- **Complete Backend Test Suite:** **27/27 test suites passed, 446/446 tests passed (100% green)**
- **Backend Dependency Audit:** `npm audit --omit=dev --prefix backend` &rarr; **0 vulnerabilities**
- **Git Diff Hygiene:** `git diff --check` &rarr; **Clean (0 errors)**

---

## 4. Scope Compliance & Invariants

- **Database Safety:** Zero database migrations executed; zero production records modified. Persisted transparently in `Booking.aiPlan` (Mongoose Mixed type).
- **Security & Cryptography:** HMAC proposal token signing with `FIX_DAY_PROPOSAL_SECRET` preserved; no fallback to `JWT_SECRET`; timing-safe verification intact.
- **Concurrency:** Optimistic Concurrency Control (`__v`) strictly preserved across Pivot auto-persist, Fix Day Apply, and Itinerary Save.
- **Immutability:** Locked activity metadata cannot be mutated through Pivot, Fix Day, or manual save.
- **Deferred to Phase 5D.4 / 5D.5:** Frontend metadata badges, Dashboard, Shared-trip sanitizer, and PDF export.

