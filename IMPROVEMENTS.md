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
