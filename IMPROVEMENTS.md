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

## Phase 3 — 🟢 Clean up the repo

- [ ] **Delete dead / duplicate code:**
  - `frontend/src/services/api.js` — hardcoded `localhost`, unused (pages import `lib/api.js`).
  - `frontend/src/config/env.js` — hardcoded `apiUrl: "http://localhost:5000"`, misleading.
  - `backend/services/aiService.js` — unused Gemini code; controller uses Groq inline.
- [ ] **Remove committed log files** — `backend-dev.log`, `backend-dev.err.log`,
      `frontend-dev.log`, `frontend-dev.err.log` from repo root; add `*.log` to root `.gitignore`.
- [ ] **Add `backend/.env.example`** — mirror the frontend example so setup is reproducible.
- [ ] **Fix README inaccuracies** — it claims "httpOnly cookies," but auth actually uses
      Bearer tokens in `localStorage`. Update the docs to match reality (or change the impl).

## Phase 4 — 🔐 Trust & user experience

- [ ] **Password reset** flow (email token).
- [ ] **Email verification** on signup.
- [ ] **Legal pages** — Privacy Policy + Terms (required once you store emails/passwords).
- [ ] **API tests** — `jest` + `supertest` + `mongodb-memory-server` are already installed but
      no tests exist. Cover auth, AI rate limit, and admin authorization.
- [ ] **Consider moving JWT to httpOnly cookies** — `localStorage` tokens are XSS-stealable.

## Phase 5 — 📈 Growth (after it's safe)

- [ ] SEO meta tags + Open Graph / Twitter cards for shareable links.
- [ ] Basic analytics (Plausible / GA) + error monitoring (Sentry).
- [ ] Better Render cold-start UX (the frontend already pings `/api` to wake it — surface a
      friendly "warming up" state).
- [ ] Roadmap features: PDF export (`jspdf` is already a dependency) + interactive map.

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
