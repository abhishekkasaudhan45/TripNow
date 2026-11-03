# Phase 3C.1 — Fix Anonymous User Save Authentication Flow

**Date:** November 1, 2026  
**Auditor / Implementer:** Full-Stack Architect & Security Reviewer  
**Primary Target:** `frontend/src/pages/PlanTrip.jsx`  
**Reference Document:** `docs/pivot/phase3c-final-review.md` (Issue P3C-ISS-01)

---

## 1. Objective

During the Phase 3C Final Code-Level Audit, an issue was identified where unauthenticated users clicking the "Save Itinerary" button triggered `setShowAuthModal(true)`, but the modal dialog component was not mounted in the JSX tree.

Phase 3C.1 resolves this issue by implementing an accessible authentication prompt modal, preserving draft itineraries in React and navigation state, verifying booking ownership through the existing backend, and ensuring that saving still requires an explicit user action post-authentication.

---

## 2. Changes Implemented

### 2.1 Accessible Authentication Prompt Modal (`frontend/src/components/auth/AuthPromptModal.jsx`)
Created a dedicated, accessible authentication prompt component providing:
- **Dialog Semantics:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="auth-modal-title"`, and `aria-describedby="auth-modal-desc"`.
- **Accessible Focus Management:** Initial focus placed on the first relevant input on modal mount; focus-trap logic prevents Tab navigation from escaping to background elements.
- **Keyboard & Backdrop Controls:** `Escape` key and backdrop click invoke `onClose()` (Cancel), with full event listener cleanup on unmount.
- **Scroll Lock:** Background document scrolling disabled (`document.body.style.overflow = "hidden"`) while modal is open, restored on close.
- **Dual Inline Tabs (Log In & Create Account):**
  - Inline forms allowing seamless authentication directly within the modal.
  - Submit calls `/api/auth/login` or `/api/auth/signup`.
  - Non-sensitive user profile saved via `saveAuth({ user })`. No tokens stored in `localStorage` or `sessionStorage` (JWT remains in secure HttpOnly cookies).
  - Triggers `onAuthSuccess` to verify booking ownership without reloading the page.
- **Full-Screen Fallback Links:** Secondary navigation actions allowing users to open the dedicated `/login` or `/signup` pages with staged state preserved.
- **Cancel Action:** Prominent "Cancel (Keep Draft)" action closes the modal without altering or discarding the in-memory draft (`isDirty` remains `true`, `saveStatus` remains `"dirty"`).

### 2.2 Itinerary Page State Machine & Ownership Verification (`frontend/src/pages/PlanTrip.jsx`)
- **Modal Mounting:** Rendered `<AuthPromptModal>` controlled by `showAuthModal`.
- **Inline Auth Success (`handleAuthSuccess`):**
  - Closes the modal.
  - Verifies ownership of `tripId` via authoritative `getTripById(tripId)`.
  - Retrieves latest `booking.__v` and sets `serverVersion`.
  - Preserves staged draft in memory, sets `isDirty = true` and `saveStatus = "dirty"`.
  - **Explicit Click Required:** Does NOT auto-save; the user must click "Save Itinerary" to persist.
- **Navigation Return State Handling (`useEffect`):**
  - When returning from `/login` or `/signup` with `state?.stagedTrip` and `effectiveId`:
  - Restores pending draft (`setTripData(state.stagedTrip)`).
  - Restores target booking ID (`setTripId(effectiveId)`).
  - Calls `getTripById(effectiveId)` to verify booking ownership.
  - If booking belongs to another user, `getTripById` returns HTTP 404, setting error state and preventing unauthorized persistence.
  - If ownership succeeds, sets authoritative `serverVersion = booking.__v`, keeping status in `"dirty"` awaiting explicit save.

### 2.3 Route Redirection Handling (`Login.jsx` & `Signup.jsx`)
- Updated `frontend/src/pages/Login.jsx` and `frontend/src/pages/Signup.jsx` to inspect `location.state?.returnTo`.
- Forward `stagedTrip`, `tripId`, `destination`, and travel parameters back to `returnTo` upon successful authentication instead of defaulting unconditionally to `/dashboard`.

---

## 3. Regression & Concurrency Verification

### 3.1 New Automated Test Suite (`backend/tests/anonymousAuthSaveFlow.test.js`)
Created 7 targeted integration tests covering all required authentication and ownership invariants:

| # | Test Scenario | Verified Behavior | Status |
| :- | :--- | :--- | :---: |
| 1 | Unauthenticated user save attempt | Returns HTTP 401; DB unmutated | **PASS** |
| 2 | Authenticated user save | Returns HTTP 200; `__v` increments by 1; DB updated | **PASS** |
| 3 | Cross-user trip lookup (`GET /api/bookings/:id`) | Returns HTTP 404; ownership enforced | **PASS** |
| 4 | Cross-user trip save (`PATCH /api/bookings/:id/itinerary`) | Returns HTTP 404; unauthorized save blocked | **PASS** |
| 5 | Duplicate save prevention | Immediate duplicate with same `baseVersion` yields 409 Conflict | **PASS** |
| 6 | Login & Save flow | User logs in, verifies booking, and explicitly persists | **PASS** |
| 7 | Signup & Save flow | New user signs up, creates personal booking, and persists draft | **PASS** |

### 3.2 Regression Suite Execution
```
PASS backend/tests/bookings.test.js (5.534 s)
PASS backend/tests/anonymousAuthSaveFlow.test.js (5.747 s)
PASS backend/tests/itineraryPersistence.test.js (6.628 s)

Test Suites: 3 passed, 3 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        7.465 s
```

### 3.3 Production Frontend Build
```
npm run build --prefix frontend
✓ 387 modules transformed.
dist/assets/PlanTrip-C8-8vXuG.js  82.70 kB │ gzip: 19.93 kB
✓ built in 5.91s
```

### 3.4 Git Whitespace Check
`git diff --check` passed cleanly with 0 whitespace warnings or conflict markers.

---

## 4. Verification of Behavioral Invariants

- [x] **Authenticated user saves successfully:** Explicit click on Save Changes saves itinerary with HTTP 200 and OCC increment.
- [x] **Anonymous user sees the prompt:** Clicking Save Changes when unauthenticated opens `AuthPromptModal`.
- [x] **Cancel preserves the draft:** Closing the modal leaves `tripData` and `isDirty` intact without discarding.
- [x] **Login preserves the draft:** Both inline modal login and full-page `/login` restore `stagedTrip`.
- [x] **Signup preserves the draft:** Both inline modal signup and full-page `/signup` restore `stagedTrip`.
- [x] **Authentication return restores the correct trip:** `tripId` and `routeTripId` are restored.
- [x] **Another user's booking cannot be saved:** Backend ownership check enforces `user: req.user._id`, returning HTTP 404.
- [x] **Save still requires an explicit click:** Post-auth state is `"dirty"`; auto-persistence is disabled.
- [x] **Duplicate save requests are prevented:** Button disabled while `saving`; concurrent requests with same version return 409.
- [x] **No tokens in browser storage:** `saveAuth` only stores non-sensitive user metadata; JWT resides in HttpOnly cookies.

