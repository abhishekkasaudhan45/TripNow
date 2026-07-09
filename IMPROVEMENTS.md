# 🚀 TripNow — Production Readiness Plan

A prioritized checklist to take TripNow from "works and looks polished" to "safe for the
public to actually use." Ordered by urgency. Check items off as you go.

> **Decision (AI endpoint):** Guests can still generate itineraries (good for conversion),
> **but** the endpoint must be hard rate-limited per IP to protect the Groq quota and DB.

---

## Phase 1 — 🔴 Lock it down (do first)

Security & abuse holes that can cost money or leak data. Highest priority.

- [ ] **Rate-limit the AI endpoint** — `POST /api/ai` (`backend/routes/aiRoutes.js`) currently
      has no auth and no limit. Add `express-rate-limit` with a strict per-IP cap
      (e.g. 5 requests / 15 min for guests). Keep it open to guests but capped.
- [ ] **Global rate limiting** — add a looser app-wide limiter, plus a strict one on
      `/api/auth/login` and `/api/auth/signup` to stop brute-force.
- [ ] **Add `requireAdmin` middleware** — the `role` field is in the JWT but never checked.
      `backend/routes/adminRoutes.js:8` only uses `protect`, so **any logged-in user can
      read admin data.** Create `middleware/requireAdmin.js` and apply it to all admin routes.
- [ ] **Tighten CORS** — `backend/app.js:23` uses `origin.includes("vercel.app")`, which lets
      *anyone's* Vercel app call the API with credentials. Replace with an exact allow-list
      driven by `CLIENT_URL` env (already parsed in `config/env.js`).
- [ ] **Remove debug "X-RAY" logging** — `backend/middleware/auth.js` prints headers on every
      request. Delete it or gate behind `NODE_ENV !== "production"`.
- [ ] **Stop leaking error internals** — `authController.js:39` and `errorHandler.js:50` return
      raw `error.message` to clients on 500s. Return a generic message in production.

## Phase 2 — 🟡 Validate & harden data

- [ ] **Input validation** — add `zod` (or `express-validator`) on auth + AI routes:
      real email format, password policy (length + complexity), required-field checks.
- [ ] **Link AI trips to the user** — the `Booking` created in `aiController.js:92` has no
      `user` field, so "manage your saved trips" can't scope per user. Add a `user` ref and
      set it from `req.user` when the requester is logged in.
- [ ] **Structured logging** — replace scattered `console.log` with `pino` or `morgan`.

## Phase 3 — 🟢 Clean up the repo ✅ DONE

- [x] **Delete dead / duplicate code:**
  - `frontend/src/services/api.js` — removed (dead chain via `services/aiService.js`).
  - `frontend/src/services/aiService.js` — removed (unused `generateAI`).
  - `frontend/src/config/env.js` — removed (hardcoded localhost, unused).
  - `backend/services/aiService.js` — removed (unused Gemini code; controller uses Groq inline).
  - Empty `frontend/src/config/` and `backend/services/` dirs removed.
- [x] **Remove committed log files** — deleted the four root `*.log` files; added `*.log` to
      root `.gitignore`.
- [x] **Add `backend/.env.example`** — created, mirroring real required vars.
- [x] **Fix README inaccuracies** — removed false "httpOnly cookies" claim; corrected the env
      setup block (`MONGO_URI`, added `ADMIN_EMAIL`/`ADMIN_PASSWORD`) and pointed to `.env.example`.

## Phase 4 — 🔐 Trust & user experience ✅ DONE

- [x] **API tests** — added `backend/tests/` (auth, validation, admin authorization, password
      reset + verification); **18 tests** passing via `npm test`. Rate limiters + email sending
      auto-skip under `NODE_ENV=test`.
- [x] **Legal pages** — Privacy Policy (`/privacy`) + Terms (`/terms`), linked in footer.
      _Templates tailored to TripNow — have them reviewed for your jurisdiction._
- [x] **Password reset** — `POST /api/auth/forgot-password` + `/reset-password`. Tokens are
      random 32-byte, stored only as SHA-256 hashes with a 1-hour expiry, single-use, and
      `forgot-password` never reveals whether an email is registered. Frontend pages added.
- [x] **Email verification** — verification email sent on signup (non-blocking);
      `GET /api/auth/verify-email` + frontend page. 24-hour token.
- [x] **Email delivery** — server-side via EmailJS REST using the **private key**, so raw
      tokens never reach the browser. Config is optional (see `backend/.env.example`).
- [ ] **Consider moving JWT to httpOnly cookies** — `localStorage` tokens are XSS-stealable.
      _(Deferred — larger refactor; left for a future pass.)_

> **⚙️ Action required to enable emails:** create an EmailJS account, add two templates using
> the params `{{to_email}} {{user_name}} {{link}} {{subject}}`, then set the five `EMAILJS_*`
> vars in `backend/.env`. Until then, the flows work but emails are skipped (logged as a warning).

## Phase 5 — 📈 Growth (in progress)

- [x] **SEO + social meta** — real `<title>`, description, keywords, canonical, Open Graph, and
      Twitter Card tags added to `frontend/index.html`. ⚠️ Add an `og-image.jpg` (1200×630) to
      `frontend/public/` so link previews show an image (currently referenced but not present).
- [x] **PDF lazy-loading** — jsPDF is now dynamically imported inside the export handler.
      **PlanTrip chunk: 417 kB → 31 kB** (jsPDF only loads when "Download PDF" is clicked).
- [x] **Cold-start UX** — a "Waking up the server…" banner appears only if the Render backend is
      slow to respond on load, and disappears once it's awake (`frontend/src/App.jsx`).
- [ ] **Analytics** — _deferred by choice._ Needs a provider (Plausible / GA4) + site key.
- [ ] **Error monitoring (Sentry)** — _deferred by choice._ Needs a Sentry account + DSN.

---

## Phase 6 — 🎨 UI/UX audit + responsive (P0 + P1 done)

### P0 — correctness & trust (done)
- [x] **Admin link gated on role** — `Header.jsx` now checks `user.role === "admin"`, not just
      a token, so normal users no longer see an Admin link that 403s.
- [x] **"0 Days" bug fixed** — `PlanTrip.jsx` `dayCount` now falls back to the AI's returned
      `days.length` when a quick-plan/featured trip has no dates.
- [x] **Fake social proof removed** — CTA copy no longer claims "thousands of travellers."

### P1 — responsive foundation (done, verified live at 375/768/1280)
- [x] **Hero search responsive** — converted the fixed 5-col inline grid to Tailwind
      (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-[...]`); stacks cleanly on mobile/tablet.
- [x] **Header nav bug fixed** — an inline `display:flex` was overriding the `hidden md:flex`
      class, so the desktop nav leaked onto mobile. Removed the inline override; nav now
      collapses to the hamburger correctly.
- [x] **Verified** Header, Hero, Why cards, Featured grid, CTA, Footer, PlanTrip shell, and
      Login split-panel across mobile / tablet / desktop — no horizontal overflow anywhere.
      Production build + lint green (one pre-existing `set-state-in-effect` warning in
      `Header.jsx`, unrelated to this work).

### P2 — Hero redesign + SVG icons (done, verified live)
- [x] **Live itinerary preview** (`HeroPreview.jsx`) — an animated card below the search box that
      types out a sample day-by-day itinerary in a loop (Goa → Manali → Jaipur). No backend
      call needed; gives the visitor an instant, tangible taste of what TripNow produces.
- [x] **Cohesive SVG icon set** (`icons.jsx`) — replaced the mixed emoji (🤖💸⚡📱) in the "Why
      TripNow" section with a unified 24×24 stroke-based icon family (Route, Wallet, Bolt,
      Bookmark). Shared stroke width, caps, and color inheritance so they read as one brand.
- [x] **Minor bug fix** — fixed `fetchpriority` → `fetchPriority` React DOM warning in
      `OptimizedImage.jsx`.

### P3 — Instant demo (no signup) — next round
- [ ] Generate a real sample itinerary inline on the homepage using the Groq API directly from
      the preview card (or a "See a real plan" button).

### Image assets (done)
- [x] **OG image** — 1200×630 branded JPEG (`public/og-image.jpg`) created from the TripNow
      design system (Playfair + DM Sans, amber→red gradient, pastel background). Link previews
      on WhatsApp, LinkedIn, Twitter, and Discord will now show a rich card.
- [x] **Favicon** — replaced the default Vite logo with a TripNow ✦ mark
      (`public/favicon.svg`, amber→red gradient on rounded square). Shows in browser tabs,
      bookmarks, and mobile shortcuts.
- [ ] **Interactive map** — a `MapView` iframe already exists; a richer Leaflet/Mapbox view is
      the remaining roadmap item.

---

## Quick reference — key findings by file

| File | Issue | Phase |
|------|-------|-------|
| `backend/routes/aiRoutes.js:7` | AI route: no auth, no rate limit | 1 |
| `backend/routes/adminRoutes.js:8` | No admin role enforcement | 1 |
| `backend/app.js:23` | CORS allows any `*.vercel.app` w/ credentials | 1 |
| `backend/middleware/auth.js:6` | Verbose header logging every request | 1 |
| `backend/controllers/authController.js:39` | Leaks `error.message` to client | 1 |
| `backend/controllers/aiController.js:92` | AI Booking not linked to a user | 2 |
| `frontend/src/services/api.js` | Dead file, hardcoded localhost | 3 |
| `frontend/src/config/env.js` | Hardcoded localhost apiUrl | 3 |
| `backend/services/aiService.js` | Unused Gemini code | 3 |
| repo root `*.log` | Committed log files | 3 |
| `README.md:13` | Claims httpOnly cookies; actually localStorage | 3 |

---

_Generated as a planning artifact. Start with Phase 1 — it's the difference between a demo
and something safe to share publicly._

---

## 🔍 Full Code Quality Audit (July 2026)

### 1. FIVE-AXIS CODE REVIEW

#### Axis 1 — Routes / API (error handling, validation, uncaught promises)

| Finding | Severity | Location |
|---------|----------|----------|
| **`bookingRoutes.js` wraps entire router in `protect`** but `SharedTripRoute.js` has a separate path — no gap there, but `bookingController.js` doesn't scope `getBookingById` to the trip owner (any authed user can see any trip by ID) | 🟡 MEDIUM | `backend/routes/bookingRoutes.js:15` |
| **`SharedTripRoute.js`** has no try/catch for the DB query at line 14 (only a catch for the share-creation) | 🟡 MEDIUM | `backend/routes/SharedTripRoute.js:14` |
| **`tripController.js`** (85 lines) never uses `next(error)` — errors are handled inline. Inconsistent with the pattern used in `bookingController.js` that properly calls `next(error)`. | 🟢 LOW | `backend/controllers/tripController.js` |

#### Axis 2 — Components (long functions, duplicate logic, unclear naming)

| Finding | Severity | Location |
|---------|----------|----------|
| **`PlanTrip.jsx` — 804 lines.** Contains inline CSS definitions (~90 lines), PDF generation (~250 lines), data parsing, and UI rendering all in one file. Should be split. | 🔴 HIGH | `frontend/src/pages/PlanTrip.jsx` |
| **`Dashboard.jsx` — 799 lines.** Similar issue. Inline styles (111 `style={{}}` callouts), SVG icons duplicated inline, trip card rendering mixed with edit modal logic. | 🔴 HIGH | `frontend/src/pages/Dashboard.jsx` |
| **`SharedTrip.jsx` — 579 lines.** Same pattern: inline CSS classes, data parsing, rendering, and error handling in one file. | 🟡 MEDIUM | `frontend/src/pages/SharedTrip.jsx` |
| **`safeString()` function** — handles 5 different types and is used only in the PDF generator. Over-engineered for its scope. | 🟢 LOW | `PlanTrip.jsx:35` |

#### Axis 3 — Database Queries (N+1, missing indexes)

| Finding | Severity | Location |
|---------|----------|----------|
| **`Booking` model has only one index** — just `destination` has `index: true`. No index on `user` field despite every "my trips" query filtering by `user._id` with `sort({ createdAt: -1 })`. Every dashboard load does a full collection scan. | 🟡 MEDIUM | `backend/models/Booking.js:12` |
| **`Trip` model has zero indexes** and no `user` field at all (unused model). | 🟢 LOW | `backend/models/Trip.js` |
| **No N+1 queries found** — the app uses `find()` with projection (`select("-password")`/`.lean()`) correctly. | ✅ CLEAN | — |

#### Axis 4 — Type Safety / Implicit Coercions

| Finding | Severity | Location |
|---------|----------|----------|
| **`aiController.js:99`** `guests: 1` hardcoded even when the AI trip generated for multiple travellers. The number of guests from the request is ignored when saving an AI-generated trip. | 🟡 MEDIUM | `backend/controllers/aiController.js:99` |

#### Axis 5 — Architecture (business logic in UI)

| Finding | Severity | Location |
|---------|----------|----------|
| **PDF generation lives entirely in `PlanTrip.jsx`** — ~250 lines of imperative jsPDF code mixed with React component state. Should be a service/util. | 🟡 MEDIUM | `PlanTrip.jsx:114-362` |
| **`HeroPreview.jsx`** has a hardcoded list of sample trips (Goa/Manali/Jaipur) duplicating the data in `Home.jsx`'s `DESTINATIONS` and quick-plan arrays. If a new destination is added in one place, the preview won't match. | 🟢 LOW | `frontend/src/components/HeroPreview.jsx:10-34` |
| **`Footer.jsx` — 252 lines**, including a full inline FeedbackForm component with EmailJS integration. Could be extracted. | 🟢 LOW | `frontend/src/layouts/Footer.jsx` |

---

### 2. CODE SIMPLIFICATION

#### Files over 500 lines (Rule of 500)

| File | Lines | Recommendation |
|------|-------|----------------|
| `frontend/src/pages/PlanTrip.jsx` | **804** | Split into: `PlanTrip.jsx` (logic + state), `components/TripPDF.jsx` (PDF generation), `components/TripView.jsx` (itinerary display) |
| `frontend/src/pages/Dashboard.jsx` | **799** | Split into: `Dashboard.jsx` (layout + state), `components/TripCard.jsx` (trip card), `components/EditTripModal.jsx` (edit form) |
| `frontend/src/pages/SharedTrip.jsx` | **579** | Split into: `SharedTrip.jsx` (main view), `components/TripDisplay.jsx` (reusable itinerary display shared with PlanTrip) |

#### "Three or More" repeated patterns

| Pattern | Count | Occurrences |
|---------|-------|-------------|
| `dayCount` calculation (date diff → days) | **3×** | PlanTrip.jsx:52, Dashboard.jsx, Booking.jsx |
| `localStorage → sessionStorage` token fallback | **6×** | Header.jsx:13, Dashboard.jsx:27, Dashboard.jsx:221, Admin.jsx:16, ProtectedRoute.jsx:6, auth.js:11 |
| Gmail `mailto:` link | **2×** | Footer.jsx:22 (Email social card), Privacy.jsx, Terms.jsx |

#### Side-effect patterns (not anti-patterns, but worth noting)

| Pattern | Count | Where |
|---------|-------|-------|
| `style={{}}` inline styles | **47** in PlanTrip, **111** in Dashboard | Makes future responsive fixes harder |
| `.catch(() => {})` (silent swallows) | **3** | Dashboard.jsx:84, Dashboard.jsx:232, Dashboard.jsx:527 |

---
### 3. SECURITY AUDIT

| Finding | Severity | Detail |
|---------|----------|--------|
| **API keys in `.env` files** (not committed — ✅) | ✅ CLEAN | Backend `.env` has `GROQ_API_KEY`; frontend `.env` has `VITE_GOOGLE_MAPS_API_KEY` and `VITE_OPENWEATHER_API_KEY`. All three `.env` files are in `.gitignore`. |
| **EmailJS keys hardcoded in Footer.jsx** | 🟡 MEDIUM | `EMAILJS_PUBLIC_KEY`, `SERVICE_ID`, `TEMPLATE_ID` are plain-text strings in `Footer.jsx:3-5`. These are public keys (designed to be client-side) but the `template_id` (`template_x1hv26r`) exposes your dashboard's template naming. |
| **Auth tokens in localStorage** | 🟡 MEDIUM | Known design choice (not a bug you need to fix now, but XSS could steal tokens). Flagged in earlier phases. |
| **Backend inputs validated with Zod** | ✅ CLEAN | `backend/validators/*.js` covers signup, login, forgot/reset password, and AI trip schemas. |
| **Rate limiting on auth + AI routes** | ✅ CLEAN | Added in Phase 1. |
| **SQL/NoSQL injection risk** | ✅ CLEAN | Mongoose + Zod prevent injection by design. |
| **CORS tightened** | ✅ CLEAN | Phase 1 fixed from wildcard vercel.app to explicit allow-list. |

---

### 4. PERFORMANCE AUDIT

#### Bundle size (current)

| Chunk | Size (built) | Size (gzip) | Notes |
|------|-------------|-------------|-------|
| `PlanTrip` | 31 kB | 8.7 kB | ✅ Lazy-imported jsPDF is separate chunk |
| `jspdf` | 386 kB | 126 kB | Only loads on "Download PDF" click |
| `html2canvas` | ~4.1 MB on disk | bundled implicitly | **Is anyone actually importing this?** Not found in any source import — it may be a transitive dependency of jsPDF or an unused dep. Check `package.json` — it's listed as a dependency. If unused, removing it saves 4+ MB. |
| `Main index` | 283 kB | 90 kB | React + Router + layout |
| **Total initial** | **~315 kB** | **~99 kB** | Reasonable for a React SPA |

#### Key perf findings

| Finding | Severity | Detail |
|---------|----------|--------|
| **`html2canvas` is listed in `package.json` but `grep` shows zero imports in source** | 🟡 MEDIUM | If truly unused, removing it saves 4+ MB from `node_modules` and eliminates it from the dependency tree. Verify by deleting it and running the build + checking if `PlanTrip`/PDF or the screenshot feature breaks. |
| **`lodash.debounce`** (used once in `Search.jsx`) | 🟢 LOW | Tiny utility (~1 kB), no action needed. If you want to slim further, replace with inline `setTimeout` debounce. |
| **Images are WebP via OptimizedImage** | ✅ CLEAN | Lazy loading, width-aware URLs, `fetchPriority` support. |
| **Database missing indexes** | 🟡 MEDIUM | `Booking` model has no index on `user` field — every dashboard "my trips" query scans the entire collection. Add `user: { index: true }`. |
| **React.lazy + Suspense for all routes** | ✅ CLEAN | Code-splitting is correct. |

---

### Summary — priority fix list

| Priority | What | Where | Effort |
|----------|------|-------|--------|
| 🔴 HIGH | Split `PlanTrip.jsx` (804 lines) into 3 files | `frontend/src/pages/PlanTrip.jsx` | ~1 hr |
| 🔴 HIGH | Split `Dashboard.jsx` (799 lines) into 3 files | `frontend/src/pages/Dashboard.jsx` | ~1 hr |
| 🟡 MEDIUM | Add `user` index to `Booking` model | `backend/models/Booking.js` | 5 min |
| 🟡 MEDIUM | Remove `html2canvas` if unused | `frontend/package.json` | 5 min |
| 🟡 MEDIUM | Verify `getBookingById` scopes to trip owner | `backend/controllers/bookingController.js:47` | 15 min |
| 🟢 LOW | Extract PDF generation to service | `PlanTrip.jsx:114-362` → `backend/services/pdfService.js` | ~30 min |
| 🟢 LOW | Add try/catch to `SharedTripRoute.js` | `backend/routes/SharedTripRoute.js:14` | 5 min |
| 🟢 LOW | `dayCount` calc repeated 3× → shared utility | `utils/date.js` | 10 min |
