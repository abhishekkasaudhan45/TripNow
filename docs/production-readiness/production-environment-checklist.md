# TripNow — Production Environment Deployment Checklist

This operational checklist must be completed by the DevOps / Infrastructure engineer before flipping production traffic to TripNow.
All items are formatted as actionable verification steps.

> [!NOTE]
> **Pre-Deployment Verification Scope:**
> Automated test suites have passed (757/757 combined automated tests) and production dependency audits reported zero findings (`npm audit --omit=dev`). However, live cloud deployment, real browser-based authentication, DNS propagation, cloud provider settings, and production database connectivity remain unverified until executed in production.

---

## 1. Vercel Frontend Deployment

- [ ] **Project Framework Preset:** Configured as `Vite` (Build command: `npm run build`, Output directory: `dist`).
- [ ] **Root Directory:** Set to `frontend` (if deploying from repository root).
- [ ] **Node.js Runtime Version:** Set **Node.js Version** to `24.x` in Vercel Project Settings > General > Node.js Version *(Active LTS; Node 20 is End-of-Life)*.
- [ ] **SPA Rewrites:** Verify [`frontend/vercel.json`](file:///d:/all%20project/Travel%20Website/frontend/vercel.json) rewrite rule (`/(.*) -> /`) is active so deep links (`/plan-trip`, `/booking`, `/shared-trip/:id`) do not 404 on refresh.
- [ ] **Build-Time Environment Variables (CRITICAL):**
  - [ ] `VITE_API_URL` is set to `https://api.tripnow.abhishektech.me` in Vercel Project Settings **BEFORE** triggering the build. *(Note: Vite replaces this statically at build time; omitting it causes the client bundle to fall back to `http://localhost:5000`).*
  - [ ] `VITE_GOOGLE_CLIENT_ID` is set to the authorized Google OAuth Client ID (if Google Sign-In is enabled).
- [ ] **Source Maps:** Confirm production source maps are disabled (Vite default) to protect client source code.
- [ ] **Custom Domain:** Add `tripnow.abhishektech.me` to Vercel Domains and verify SSL/TLS certificate issuance.

---

## 2. Render Backend Deployment

- [ ] **Service Type:** Web Service (Node.js runtime).
- [ ] **Root Directory:** Set to `backend`.
- [ ] **Build Command:** Configured as `npm install --omit=dev` or `npm ci --omit=dev`.
- [ ] **Start Command:** Configured as `npm start` (`node server.js`).
- [ ] **Node.js Runtime Version:** Add an environment variable `NODE_VERSION=24.19.0` (or `24.x`) in Render environment settings. *(Node 20 is End-of-Life as of April 2026; Node 24 is the active LTS release matching verified test and build environments).*
- [ ] **Port Binding:** Confirm server reads `process.env.PORT` dynamically injected by Render.
- [ ] **Health Check Path:** Set Health Check Path to `/` (returns HTTP 200 `Travel API Running ✅`).
- [ ] **Auto-Deploy:** Set to deploy from `main` branch upon approved merge.
- [ ] **Custom Domain:** Add `api.tripnow.abhishektech.me` to Render Custom Domains and configure CNAME DNS record.

---

## 3. Custom Domains & DNS Configuration

> [!IMPORTANT]
> **DNS Target Rule:** Never guess or fabricate DNS targets. Render generates a unique service-specific DNS target per web service. Always retrieve the exact target value from each provider's dashboard before creating records in your DNS manager (e.g. Cloudflare, Namecheap, Route 53).

- [ ] **DNS Zone Assumption:** Assumes apex/zone domain is `abhishektech.me`.
- [ ] **Frontend Record (Vercel):**
  - **Type:** `CNAME`
  - **Host / Name:** `tripnow` (or FQDN `tripnow.abhishektech.me.`)
  - **Points to / Target:** `cname.vercel-dns.com` *(or exact target shown in Vercel Project Settings > Domains)*.
  - **TTL:** Auto or 300 seconds.
- [ ] **Backend Record (Render):**
  - **Type:** `CNAME`
  - **Host / Name:** `api.tripnow` (or FQDN `api.tripnow.abhishektech.me.`)
  - **Points to / Target:** **Obtain directly from Render Dashboard** under **Web Service > Settings > Custom Domains**. *(Render assigns a service-specific target such as `<service-name>.onrender.com` or custom verification hostname. Render does NOT use a generic `cname.render.com`).*
  - **TTL:** Auto or 300 seconds.
- [ ] **DNS Propagation Verification:**
  - [ ] `nslookup tripnow.abhishektech.me` or `dig +short CNAME tripnow.abhishektech.me` resolves to Vercel.
  - [ ] `nslookup api.tripnow.abhishektech.me` or `dig +short CNAME api.tripnow.abhishektech.me` resolves to Render.
- [ ] **SSL/TLS Certificates:** Confirm both hostnames have active HTTPS certificates with automatic renewals.

---

## 4. CORS, Cookies & CSRF Protection (Hard Prerequisites)

- [ ] **Allowed Origins (`CLIENT_URL`):**
  - [ ] Backend environment variable `CLIENT_URL` configured strictly as:
    `CLIENT_URL=https://tripnow.abhishektech.me`
- [ ] **Supported Authentication Origin Verification (Phase 7B Final):**
  - [ ] **`https://tripnow.abhishektech.me`:** The **sole supported authenticated production frontend origin**. Evaluates as `same-site` to `api.tripnow.abhishektech.me`; passes `Sec-Fetch-Site !== 'cross-site'` check and allows `SameSite=Lax` host-only cookie delivery.
  - [ ] **`https://api.tripnow.abhishektech.me`:** Dedicated backend API host.
  - [ ] **`https://tripnow.vercel.app`:** **Not supported for authenticated sessions.** Because `vercel.app` is on the Public Suffix List, requests from `tripnow.vercel.app` evaluate as cross-site to `abhishektech.me`; browsers withhold `SameSite=Lax` cookies on cross-site XHR and `csrf.js` rejects mutating requests with HTTP 403. It is not included in the recommended production `CLIENT_URL`.
  - [ ] **Local Frontend (`http://localhost:5173`):** Must use the local backend (`http://localhost:5000`), not the production API.
- [ ] **Auth Cookie Settings:**
  - [ ] `NODE_ENV=production` ensures `secure: true` and `sameSite: "lax"`.
  - [ ] `httpOnly: true` prevents XSS token extraction.
  - [ ] Host-only cookie (domain omitted in Set-Cookie) restricts cookie scope to `api.tripnow.abhishektech.me`.
- [ ] **CSRF Independent Secret:**
  - [ ] `CSRF_SECRET` is set to an independent, high-entropy 32+ character string distinct from `JWT_SECRET`.

---

## 5. Google OAuth 2.0 & Identity Services

- [ ] **Google Cloud Console Credentials:**
  - [ ] Open Google Cloud Console > APIs & Services > Credentials.
  - [ ] Authorized JavaScript Origins must include:
    - `https://tripnow.abhishektech.me`
    - `https://api.tripnow.abhishektech.me`
    - *(Local development: `http://localhost:5173`)*
- [ ] **Backend Client ID:**
  - [ ] `GOOGLE_AUTH_ENABLED=true` set in Render environment.
  - [ ] `GOOGLE_CLIENT_ID` set in Render matching Google Cloud Console.
- [ ] **Frontend Client ID:**
  - [ ] `VITE_GOOGLE_CLIENT_ID` set in Vercel matching `GOOGLE_CLIENT_ID`.
- [ ] **Anti-Account Takeover:**
  - [ ] Confirm `ACCOUNT_EXISTS_LINKING_REQUIRED` 409 error prompts password authentication when linking existing accounts.

---

## 6. MongoDB Atlas Database Safety

- [ ] **Network Access (IP Access List):**
  - [ ] Add Render outbound IP addresses or enable `0.0.0.0/0` with strict credential authentication.
- [ ] **Database User:**
  - [ ] Dedicated production database user with `readWrite` access restricted exclusively to the `tripnow` database.
- [ ] **Connection String:**
  - [ ] `MONGO_URI` in Render formatted as `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/tripnow?retryWrites=true&w=majority`.
- [ ] **Automated Backups:**
  - [ ] Enable Continuous Cloud Backups (Point-in-Time Recovery) in MongoDB Atlas.
- [ ] **Indexes:**
  - [ ] Verify production indexes on `bookings` (`{ user: 1, createdAt: -1 }`, `{ isShared: 1 }`) and `users` (`{ email: 1 }`, `{ googleId: 1 }`).

---

## 7. Google Gemini AI API Configuration

- [ ] **API Key:** Valid Gemini API key from Google AI Studio configured in `GEMINI_API_KEY`.
- [ ] **API Key Quota & Billing:** Confirm pay-as-you-go or tier quota is active to prevent unexpected `429 RESOURCE_EXHAUSTED` errors during user spikes.
- [ ] **Model Selection:** `GEMINI_MODEL=gemini-3.6-flash` (code automatically falls back to `gemini-3.5-flash-lite`).

---

## 8. Secrets & Environment Variables Inventory

| Variable Name | Required / Optional | Scope | Secret? | Production Purpose / Description | Recommended Location |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Required** | Backend | No | Enables production runtime mode: enforces `secure: true` cookies, masks stack traces in error handler. | Render Environment |
| `NODE_VERSION` | **Required** | Backend | No | Instructs Render to execute Node.js 24 (`24.19.0`). | Render Environment |
| `PORT` | Optional | Backend | No | HTTP server listen port. Injected dynamically by Render. | Render Environment |
| `MONGO_URI` | **Required** | Backend | **YES** | MongoDB Atlas connection string (`mongodb+srv://...`). | Render Environment (Secret) |
| `JWT_SECRET` | **Required** | Backend | **YES** | Cryptographic key used for HS256 signing of user JWT tokens ($\ge 32$ chars). | Render Environment (Secret) |
| `JWT_EXPIRES_IN` | Optional | Backend | No | Token lifetime string (defaults to `"2h"`). Synchronizes auth cookie `maxAge`. | Render Environment |
| `CSRF_SECRET` | **Required (Prod)**| Backend | **YES** | Cryptographic key used for HMAC-SHA256 CSRF token issuance ($\ge 32$ chars, distinct from `JWT_SECRET`). | Render Environment (Secret) |
| `FIX_DAY_PROPOSAL_SECRET`| **Required (Prod)**| Backend | **YES** | Cryptographic key used for signing itinerary fix proposals in the pivot engine. | Render Environment (Secret) |
| `ADMIN_EMAIL` | **Required** | Backend | No | Bootstrap admin user email. | Render Environment |
| `ADMIN_PASSWORD` | **Required** | Backend | **YES** | Bootstrap admin user password. | Render Environment (Secret) |
| `CLIENT_URL` | **Required** | Backend | No | Canonical allowed CORS origin for the authenticated frontend (`https://tripnow.abhishektech.me`). Used for email verification and password reset links. | Render Environment |
| `GEMINI_API_KEY` | **Required (AI)** | Backend | **YES** | Google AI Studio API key used by `@google/genai` to generate personalized itineraries. | Render Environment (Secret) |
| `GEMINI_MODEL` | Optional | Backend | No | Primary Gemini model identifier (defaults to `gemini-3.6-flash`). | Render Environment |
| `GOOGLE_AUTH_ENABLED` | Optional | Backend | No | Feature flag (`true`/`false`) controlling Google OAuth sign-in endpoint activation. | Render Environment |
| `GOOGLE_CLIENT_ID` | Conditional | Backend | No | Google OAuth 2.0 Client ID (mandatory if `GOOGLE_AUTH_ENABLED=true`). | Render Environment |
| `CLOUDINARY_*` | Optional | Backend | **YES** | Cloudinary media upload credentials (falls back to in-memory storage if omitted). | Render Environment (Secret) |
| `VITE_API_URL` | **Required (Build)**| Frontend| No | **CRITICAL BUILD-TIME VARIABLE:** Base URL for Axios and API client requests (`https://api.tripnow.abhishektech.me`). Must be set before triggering Vercel build. | Vercel Environment |
| `VITE_GOOGLE_CLIENT_ID` | Optional (Build)| Frontend| No | Public Google OAuth Client ID rendered by Google Identity Services button. | Vercel Environment |

---

## 9. Observability, Monitoring & Operations

- [ ] **Uptime Ping:** Setup external uptime monitoring (e.g. UptimeRobot, BetterStack) targeting `https://api.tripnow.abhishektech.me/` and `https://tripnow.abhishektech.me`.
- [ ] **Log Retention:** Verify Render dashboard log streaming is enabled.
- [ ] **Error Monitoring:** Recommend configuring Sentry on frontend and backend for real-time unhandled exception capture.

---

## 10. Deployment Smoke Test & Verification Steps

- [ ] 1. Open `https://tripnow.abhishektech.me`. Verify Concept 06 logo and favicon load without errors.
- [ ] 2. Perform search: select destination, valid dates, travelers, and budget. Verify dynamic hero background loads.
- [ ] 3. Generate itinerary on `/plan-trip`. Confirm Reality Score renders with backend-provided values.
- [ ] 4. Test login and signup with password on `https://tripnow.abhishektech.me`. Verify password checklist and HttpOnly auth cookie issuance.
- [ ] 5. Test Google Sign-In button on `https://tripnow.abhishektech.me`. Confirm ID token verification and cookie session creation.
- [ ] 6. Save a trip to `/booking`. Confirm booking appears on `/dashboard`.
- [ ] 7. Generate a shared trip link (`/shared-trip/:id`). Open in Incognito window; confirm trip loads without requiring auth and no private user details are exposed.
- [ ] 8. Hard refresh deep link (e.g. `https://tripnow.abhishektech.me/plan-trip`). Verify page renders without 404.
