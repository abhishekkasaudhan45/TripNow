# TripNow Phase 7, 7A & 7B — Production Readiness, Deployment & Security Audit Report

## 1. Executive Summary

TripNow Phase 7, Phase 7A, and Phase 7B constitute a comprehensive, read-only production-readiness audit, runtime compatibility verification, and pre-deployment configuration reconciliation of the TripNow travel platform following the completion of Phases 0–6.

This phase is strictly an audit and verification exercise. Zero application source code, cloud configurations, environment variables, DNS records, or production database configurations were modified.

### Overall Assessment
- **Automated Verification (Phase 7A Fresh Executions):**
  - **Frontend Automated Tests:** **125 / 125 passed** across 16 test suites (0 failures, 275.62ms on Node v24.19.0).
  - **Backend Automated Tests:** **632 / 632 passed** across 36 test suites (0 failures, 95.933s on Node v24.19.0).
  - **Combined Automated Tests:** **757 / 757 passed**. *(Note: These represent automated test runner executions and do not constitute live browser-based end-to-end verification or 100% code coverage).*
  - **Production Build:** Vite v7.3.7 build succeeded in **4.24s** (402 modules transformed cleanly).
- **Dependency Audit Status:**
  - **Production Dependencies (`npm audit --omit=dev`):** **0 vulnerabilities reported** across both backend and frontend client bundles (exit code 0).
  - **Development Dependencies:** Retain low and moderate audit findings (19 in backend Jest/Babel toolchain; 7 in frontend ESLint/Babel toolchain). These are non-production development dependencies.
- **Application Security Design Posture:** Strong design posture verified by test suites (session-bound CSRF, HttpOnly host-only auth cookies, strict DTO projections, prototype pollution revivers, Google ID-token audience verification). However, live deployment, browser authentication, DNS propagation, cloud provider configuration, and production database connectivity remain unverified.
- **Node.js Runtime Compatibility:** Upgraded recommendation from Node 20 (EOL) to **Node.js 24 LTS (Active LTS; v24.19.0)**.
- **Authentication Configuration Reconciliation:** Confirmed exact host-only cookie semantics, `SameSite=Lax`, and `Sec-Fetch-Site` protections. Established that `https://tripnow.abhishektech.me` is the **only** supported authenticated production frontend origin. Recommended setting `CLIENT_URL=https://tripnow.abhishektech.me`. `tripnow.vercel.app` is cross-site relative to the API and is not supported for authenticated sessions.
- **Final Verdict:** **CONDITIONALLY READY** ⚠️
  *(Automated test suites and local production builds pass. Readiness is conditional upon provisioning cloud environment variables, binding `api.tripnow.abhishektech.me` on Render, and setting `VITE_API_URL` in Vercel prior to building. Live cloud deployment and end-to-end runtime verification have not yet taken place).*

---

## 2. Node.js Runtime Compatibility Analysis (Phase 7A Verification)

### 2.1 EOL Status of Node.js 20 & LTS Landscape
The initial Phase 7 audit referenced Node.js 20.18.0. However, **Node.js 20 (Iron) reached official End-of-Life (EOL) on April 30, 2026**. Deploying an EOL runtime introduces unpatched CVE risks and cloud deprecation warnings.

Current Node.js LTS Landscape:
- **Node.js 20 (Iron):** **END-OF-LIFE** (April 2026). Ineligible for new production deployments.
- **Node.js 22 (Jod):** **Maintenance LTS** (maintenance through April 2027).
- **Node.js 24 (Krypton):** **Active LTS** (released April 2025; Active LTS status through October 2027, maintenance through April 2028).
- **Node.js 26:** Current / non-LTS developmental stream. Not recommended for production stability.

### 2.2 Local Installed Runtime Evidence
Inspection of the local development execution environment confirms:
- Installed Node.js Version: `v24.19.0`
- Installed npm Version: `11.17.0`
All 757 automated tests and the Vite production build were executed and verified against **Node.js v24.19.0**.

### 2.3 Dependency Engine Constraints
Scanning `backend/package-lock.json` and `frontend/package-lock.json` revealed key runtime constraints:
- `google-auth-library` (`^11.3.2`): Specifies `"engines": { "node": ">=22" }`. **This strictly rules out Node 20.**
- `mongodb` (`^7.1.1`) & `mongoose` (`^9.11.4`): Specify `"engines": { "node": ">=20.19.0" }`.
- `mongodb-memory-server` (`^11.3.0`): Specifies `"engines": { "node": ">=20.19.0" }`.
- `jest` (`^30.5.2`): Specifies `"engines": { "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0" }`.
- `vite` (`^7.3.7`) & `@vitejs/plugin-react` (`^5.2.0`): Specify `"engines": { "node": "^20.19.0 || >=22.12.0" }`.
- `react-router-dom` (`^7.18.5`): Specifies `"engines": { "node": ">=20.0.0" }`.

### 2.4 Upper Bound Constraint Scan
An exhaustive scan of all 341 backend packages and 193 frontend packages with engine specifications confirmed:
**Zero dependencies declare upper-bound engine restrictions that conflict with Node.js 24.**

### 2.5 Hosting Platform Compatibility
- **Render:** Fully supports configuring Node.js 24 via the `NODE_VERSION=24.19.0` (or `24.x`) environment variable or `.node-version` file.
- **Vercel:** Supports Node.js 24 runtime natively under **Project Settings > General > Node.js Version (`24.x`)**.

### 2.6 Authoritative Runtime Recommendation
**Recommend Node.js 24 LTS (`24.19.0` / `24.x`) as the unified production runtime for both Render and Vercel.**

---

## 3. Investigation of `npm audit` Exit Code 1

Both the backend and frontend package audits initially reported an exit code of 1. A deep technical investigation was performed to identify the exact causes.

### 3.1 Understanding npm audit Exit Codes
By design, the `npm audit` CLI command returns exit code 1 whenever **any** vulnerability (even 1 low or moderate severity finding in development-only tooling) is present in the dependency tree. It returns exit code 0 if and only if zero vulnerabilities are detected.

### 3.2 Backend Audit Investigation

#### A. Full Audit (`npm --prefix backend audit`)
- **Exit Code:** `1`
- **Total Vulnerabilities Reported:** 19 (3 low, 16 moderate, 0 high, 0 critical)
- **Production vs Dev Dependency Classification:**
  - **Production Dependencies:** **0 vulnerabilities**
  - **Development Dependencies:** **19 vulnerabilities (100% of findings)**
- **Vulnerable Packages:**
  1. `deepmerge` (`>=4.2.0`): Low severity (GHSA-gcqx-w48m-w2h4 — prototype poisoning in mergeObject). Transitive dependency via `jest-config` $\to$ `@jest/core` $\to$ `jest`.
  2. `glob` (`3.0.0 - 14.0.1`): Moderate severity (GHSA-3g3m-2fjr-6pw4 — AbortSignal timeout bypass). Transitive dependency via `@jest/reporters`, `jest-runtime`, `test-exclude` $\to$ `jest`.
  3. `minimatch` (`<11.0.1`): Moderate severity (GHSA-g3hv-75wg-m249 — ReDoS via globparts amplification). Transitive dependency via `glob` and `test-exclude`.
- **Patch Availability & Risk:**
  - `npm audit fix --force` offers to downgrade `jest` to `25.1.0`.
  - **WARNING:** Jest 25 is a 2020 release (5 major versions behind). Downgrading would break Jest 30 ESM support, modern Node 24 runners, and in-memory test harnesses.
- **Production Blocker Evaluation:** **NOT A PRODUCTION BLOCKER.** Jest and Babel are strictly in `devDependencies`. They are never packaged, executed, or deployed in the Render production runtime.

#### B. Production-Only Audit (`npm --prefix backend audit --omit=dev`)
- **Command:** `npm --prefix backend audit --omit=dev`
- **Exit Code:** **`0`**
- **Total Vulnerabilities:** **0** (`found 0 vulnerabilities`)
- **Conclusion:** The Render production backend has zero runtime vulnerabilities.

---

### 3.3 Frontend Audit Investigation

#### A. Full Audit (`npm --prefix frontend audit`)
- **Exit Code:** `1`
- **Total Vulnerabilities Reported:** 7 (1 low, 6 moderate, 0 high, 0 critical)
- **Production vs Dev Dependency Classification:**
  - **Production Dependencies:** **0 vulnerabilities**
  - **Development Dependencies:** **7 vulnerabilities (100% of findings)**
- **Vulnerable Packages:**
  1. `@babel/core` (`<=7.29.0`): Low severity (GHSA-4x5r-pxfx-6jf8 — sourceMappingURL comment file read). Transitive devDependency.
  2. `minimatch` (`<11.0.1`): Moderate severity (GHSA-g3hv-75wg-m249 — ReDoS via globparts amplification). Transitive via `@eslint/config-array` and `@eslint/eslintrc`.
  3. `eslint` (`>=4.1.0`): Moderate severity. Direct devDependency (`^9.39.5`).
  4. `eslint-plugin-react-refresh`: Moderate severity. Direct devDependency.
  5. `@eslint-community/eslint-utils`: Moderate severity. Transitive devDependency.
- **Production Blocker Evaluation:** **NOT A PRODUCTION BLOCKER.** ESLint and Babel development utilities are used solely during local linting (`npm run lint`). They are excluded entirely from the client Vite bundle (`dist/`).

#### B. Production-Only Audit (`npm --prefix frontend audit --omit=dev`)
- **Command:** `npm --prefix frontend audit --omit=dev`
- **Exit Code:** **`0`**
- **Total Vulnerabilities:** **0** (`found 0 vulnerabilities`)
- **Conclusion:** The client application shipped to end users via Vercel has zero runtime vulnerabilities.

---

## 4. Phase 7A Local Verification Evidence

Fresh executions of the automated test suite and production build were captured under Node.js `v24.19.0`. None of the previous phase counts were reused.

### 4.1 Frontend Automated Test Execution (Phase 7A)
- **Command:** `node --test frontend/tests/*.test.mjs`
- **Execution Date & Time:** 2026-11-03 18:34:59 IST
- **Runtime:** Node.js v24.19.0
- **Suites:** 16 passed, 16 total
- **Tests:** **125 passed, 125 total (0 failures, 0 skipped, 0 cancelled)**
- **Duration:** 275.62 ms
- *(Note: Automated unit and component integration test runner results; does not represent live browser testing).*

### 4.2 Backend Automated Test Execution (Phase 7A)
- **Command:** `npm --prefix backend test` (`jest --runInBand`)
- **Execution Date & Time:** 2026-11-03 18:35:07–18:37:07 IST
- **Runtime:** Node.js v24.19.0
- **Suites:** 36 passed, 36 total
- **Tests:** **632 passed, 632 total (0 failures, 0 snapshots)**
- **Duration:** 95.933 s
- *(Note: Automated API and integration test runner results using in-memory MongoDB; does not represent live Atlas replica set testing).*

### 4.3 Vite Production Build Execution (Phase 7A)
- **Command:** `npm --prefix frontend run build` (`vite build`)
- **Execution Date & Time:** 2026-11-03 18:37:21–18:37:28 IST
- **Runtime:** Node.js v24.19.0
- **Status:** **SUCCESS** in 4.24s
- **Module Count:** 402 modules transformed cleanly
- **Asset Summary:**
  - `dist/index.html` (2.69 kB, gzip: 1.07 kB)
  - `dist/assets/index-Dy6qk5JD.css` (68.06 kB, gzip: 11.04 kB)
  - `dist/assets/BudgetIntelligencePanel-C3Wc9VjJ.js` (47.01 kB, gzip: 11.49 kB)
  - `dist/assets/index-DGp3xF30.js` (361.37 kB, gzip: 117.54 kB)

---

## 5. DNS and Custom Domain Configuration Instructions (Phase 7A & 7B)

### 5.1 Subdomain DNS Target Verification Rules
> [!WARNING]
> **Do not guess DNS targets.** Cloud hosting platforms do not accept arbitrary hostnames. Render in particular does **not** provide a shared generic target like `cname.render.com`; each Render web service is assigned a service-specific hostname or unique verification target.

### 5.2 Required DNS Records in DNS Manager (e.g. Cloudflare, Namecheap, Route 53)
Assuming the apex/root domain zone is `abhishektech.me`:

| Record Purpose | Host / Name | Record Type | Value / Points To | Source of Value |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `api.tripnow` | `CNAME` | **Service-Specific Render Target** *(e.g. `<service-name>.onrender.com` or custom Render verification host)* | **Render Dashboard:** Web Service $\to$ Settings $\to$ Custom Domains |
| **Frontend App** | `tripnow` | `CNAME` | `cname.vercel-dns.com` *(or Vercel-provided target)* | **Vercel Dashboard:** Project $\to$ Settings $\to$ Domains |

### 5.3 Step-by-Step Dashboard Retrieval
1. **Render (Backend):**
   - Log into [Render Dashboard](https://dashboard.render.com).
   - Navigate to the TripNow Web Service $\to$ **Settings** $\to$ **Custom Domains**.
   - Click **Add Custom Domain** and enter `api.tripnow.abhishektech.me`.
   - Render displays the exact target to point your CNAME record to. Copy this value verbatim into your DNS manager.
2. **Vercel (Frontend):**
   - Log into [Vercel Dashboard](https://vercel.com).
   - Navigate to TripNow Project $\to$ **Settings** $\to$ **Domains**.
   - Enter `tripnow.abhishektech.me`.
   - Vercel specifies the required CNAME target (`cname.vercel-dns.com`) and verifies DNS propagation automatically.

---

## 6. Authentication Configuration Reconciliation (Phase 7B)

To resolve any ambiguities between Phase 6 integration documents and Phase 7 pre-deployment audits, the actual source-code implementation was audited line-by-line across all authentication layers:

### 6.1 Parameter-by-Parameter Implementation Breakdown

| Parameter | Source Code Location | Configured Value | Runtime Behavior & Security Semantics |
| :--- | :--- | :--- | :--- |
| **SameSite** | [`backend/config/authCookie.js:84`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L84) | `"lax"` | Modern browsers permit `SameSite=Lax` cookies on top-level navigation and same-site cross-origin XHR/fetch requests with `credentials: 'include'`. Browsers **withhold** `SameSite=Lax` cookies on cross-site subresource requests. |
| **Secure** | [`backend/config/authCookie.js:83`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L83) | `env.isProduction` | In production (`NODE_ENV=production`), cookie is flagged `Secure=true` (transmitted exclusively over HTTPS). In dev/test, `Secure=false` allows HTTP localhost development. |
| **HttpOnly** | [`backend/config/authCookie.js:82`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L82) | `true` | Prevents client-side scripts from reading the `token` cookie via `document.cookie`, mitigating credential theft via Cross-Site Scripting (XSS). |
| **Cookie Domain** | [`backend/config/authCookie.js:81-87`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L81-L87) | **Omitted (Host-Only)** | **Reconciliation Correction:** The `domain` property is **not set** in `authCookie.js`. Per RFC 6265 § 4.1.2.3, omitting `domain` creates a **Host-Only Cookie** restricted exclusively to the issuing host (`api.tripnow.abhishektech.me`). When the frontend at `https://tripnow.abhishektech.me` executes requests targeting `https://api.tripnow.abhishektech.me`, the destination host matches the cookie host, allowing browser delivery. |
| **Cookie Path** | [`backend/config/authCookie.js:86`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L86) | `"/"` | Cookie is scoped to all API endpoints on the issuing host. |
| **Cookie Expiration** | [`backend/config/authCookie.js:73`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L73) | `COOKIE_MAX_AGE_MS` | Dynamically parsed from `env.jwtExpiresIn` via `parseDurationToMs()`. Defaults to `2h` (7,200,000 ms), strictly synchronizing cookie lifetime with JWT validity. Logout clears the cookie via `res.clearCookie()` with identical path and attributes. |
| **Credential Handling** | [`backend/app.js:45`](file:///d:/all%20project/Travel%20Website/backend/app.js#L45)<br>[`frontend/src/lib/api.js:9`](file:///d:/all%20project/Travel%20Website/frontend/src/lib/api.js#L9) | `credentials: true`<br>`withCredentials: true` | Express CORS responds with `Access-Control-Allow-Credentials: true`. Frontend Axios instance passes ambient cookies and credentials on all cross-origin requests. |
| **CORS Origins** | [`backend/config/env.js:52-59`](file:///d:/all%20project/Travel%20Website/backend/config/env.js#L52-L59)<br>[`backend/app.js:30-47`](file:///d:/all%20project/Travel%20Website/backend/app.js#L30-L47) | `env.allowedOrigins` | Parses comma-separated `CLIENT_URL`. For authenticated production, configure strictly as `CLIENT_URL=https://tripnow.abhishektech.me`. Unlisted origins receive HTTP 403 `CORS: origin <origin> not allowed`. Non-browser tools (no Origin header) are allowed. |
| **CSRF Validation** | [`backend/middleware/csrf.js:61-89,94-164`](file:///d:/all%20project/Travel%20Website/backend/middleware/csrf.js#L61-L89,L94-L164) | HMAC-SHA256 stateless session-bound | Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) and onboarding endpoints (`/login`, `/signup`, `/forgot-password`, `/reset-password`) are exempt. Enforced on all cookie-authenticated mutating requests. Requires matching `X-CSRF-Token` header and verifies `Sec-Fetch-Site !== 'cross-site'`. |

---

## 7. Supported Production Origins Verification (Phase 7B)

The application interacts with multiple origins across production, staging, and local development. Each origin is evaluated below according to browser security boundaries:

```mermaid
graph TD
    API["Production API Host<br>https://api.tripnow.abhishektech.me"]

    subgraph Supported["Supported Authenticated Production Origin"]
        F1["https://tripnow.abhishektech.me<br>(Custom Domain Frontend)"]
        F1 -->|Same-Site: abhishektech.me<br>Sec-Fetch-Site: same-site<br>SameSite=Lax Cookie Transmitted<br>CSRF Validated| API
    end

    subgraph Preview["Unsupported for Authentication (Cross-Site)"]
        F2["https://tripnow.vercel.app<br>(Vercel Default Subdomain)"]
        F2 -.->|Cross-Site (PSL: vercel.app vs abhishektech.me)<br>Sec-Fetch-Site: cross-site (REJECTED by csrf.js)<br>SameSite=Lax Cookie Dropped by Browser| API
    end

    subgraph Dev["Local Development Only"]
        F3["http://localhost:5173<br>(Vite Dev Server)"]
        F3 -.->|Cross-Site & Plaintext HTTP<br>CORS Blocked in Prod<br>Secure=true Cookie Incompatible| API
    end
```

### 7.1 Origin Evaluation Matrix

| Origin | Purpose | Same-Origin to API? | Same-Site to API? | Browser `Sec-Fetch-Site` | Cookie Transmission | CSRF Verification | Production Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`https://tripnow.abhishektech.me`** | Primary production frontend user interface | No | **Yes** (shares `abhishektech.me`) | `same-site` | **Transmitted** (`SameSite=Lax` permitted on same-site subresources) | **Passes** (`Sec-Fetch-Site !== 'cross-site'`) | **SOLE SUPPORTED AUTHENTICATED PRODUCTION FRONTEND ORIGIN** |
| **`https://api.tripnow.abhishektech.me`** | Production backend API service | **Yes** | **Yes** | `same-origin` | **Transmitted** | N/A (Server origin) | **BACKEND API HOST** |
| **`https://tripnow.vercel.app`** | Vercel deployment preview / fallback URL | No | **No** (`vercel.app` is on Public Suffix List; registrable domain is `tripnow.vercel.app`) | `cross-site` | **Withheld** (Browsers drop `SameSite=Lax` on cross-site XHR) | **Fails** (HTTP 403 `Cross-site request rejected by Sec-Fetch-Site`) | **NOT SUPPORTED FOR AUTHENTICATED SESSIONS** (Omitted from recommended production `CLIENT_URL`) |
| **`http://localhost:5173`** | Local development Vite frontend | No | **No** (Scheme and host mismatch) | `cross-site` | **Withheld** (Browser blocks `Secure=true` cookie over HTTP) | **Fails** (CORS 403 and CSRF 403) | **LOCAL DEV ONLY** (Must target local backend `http://localhost:5000`) |

### 7.2 Source Inspection for Vercel Origin Dependencies
An exhaustive search of all backend and frontend code confirmed:
- Zero features, endpoints, or routes require `tripnow.vercel.app`.
- In `backend/config/env.js`, `clientUrl` is set to `parseAllowedOrigins()[0]`, which is used in `backend/controllers/passwordController.js` to construct email verification and password reset links (`${env.clientUrl}/verify-email...`). Setting `CLIENT_URL=https://tripnow.abhishektech.me` ensures all transactional email links point to the authenticating production domain.
- **Known Limitation:** If a user accesses the default Vercel preview domain (`https://tripnow.vercel.app`), they will experience HTTP 403 CSRF rejections and missing authentication cookies upon attempting to log in, register, or create bookings. All user traffic must be directed to `https://tripnow.abhishektech.me`.

---

## 8. Complete Environment Variable Inventory (Phase 7B)

The table below reflects all environment variables actively read by the codebase across [`backend/config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js), [`frontend/src/lib/api.js`](file:///d:/all%20project/Travel%20Website/frontend/src/lib/api.js), and [`frontend/src/components/auth/GoogleSignInButton.jsx`](file:///d:/all%20project/Travel%20Website/frontend/src/components/auth/GoogleSignInButton.jsx):

| Variable Name | Required / Optional | Scope | Secret? | Production Purpose / Description | Recommended Configuration Location |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **`NODE_ENV`** | **Required** | Backend | No | Enables production runtime mode: enforces `secure: true` cookies, masks stack traces in error handler, enables strict CSRF secret checks. | Render Web Service > Environment |
| **`NODE_VERSION`** | **Required** | Backend | No | Instructs Render to execute Node.js 24 (`24.19.0`). Prevents defaulting to legacy or EOL runtimes. | Render Web Service > Environment |
| **`PORT`** | Optional | Backend | No | HTTP server listen port. Render automatically injects `PORT`; code falls back to `5000`. | Render Web Service > Environment |
| **`MONGO_URI`** | **Required** | Backend | **YES** | MongoDB Atlas connection string (`mongodb+srv://...`). Server exits with code 1 if connection fails in production. | Render Web Service > Environment (Secret) |
| **`JWT_SECRET`** | **Required** | Backend | **YES** | Cryptographic key used for HS256 signing and verification of user JWT tokens. Must be $\ge 32$ characters. | Render Web Service > Environment (Secret) |
| **`JWT_EXPIRES_IN`** | Optional | Backend | No | Token lifetime string (e.g. `"2h"`, `"7d"`). Synchronizes auth cookie `maxAge`. Defaults to `"2h"`. | Render Web Service > Environment |
| **`CSRF_SECRET`** | **Required (Prod)**| Backend | **YES** | Cryptographic key used for HMAC-SHA256 session-bound CSRF token issuance and verification. Must be $\ge 32$ chars and distinct from `JWT_SECRET`. Server crashes on startup if missing. | Render Web Service > Environment (Secret) |
| **`FIX_DAY_PROPOSAL_SECRET`** | **Required (Prod)**| Backend | **YES** | Cryptographic key used for signing itinerary fix proposals in the pivot engine. Server crashes on startup if missing in production. | Render Web Service > Environment (Secret) |
| **`ADMIN_EMAIL`** | **Required** | Backend | No | Bootstrap admin user email. Server crashes on startup if missing. | Render Web Service > Environment |
| **`ADMIN_PASSWORD`** | **Required** | Backend | **YES** | Bootstrap admin user password. Server crashes on startup if missing. | Render Web Service > Environment (Secret) |
| **`CLIENT_URL`** | **Required** | Backend | No | Allowed CORS origin for the authenticated frontend (`https://tripnow.abhishektech.me`). Used to generate email verification and password reset links. | Render Web Service > Environment |
| **`GEMINI_API_KEY`** | **Required (AI)** | Backend | **YES** | Google AI Studio API key used by `@google/genai` to generate personalized itineraries. | Render Web Service > Environment (Secret) |
| **`GEMINI_MODEL`** | Optional | Backend | No | Primary Gemini model identifier (defaults to `gemini-3.6-flash`; automatically falls back to `gemini-3.5-flash-lite`). | Render Web Service > Environment |
| **`GOOGLE_AUTH_ENABLED`** | Optional | Backend | No | Feature flag (`true`/`false`) controlling Google OAuth sign-in endpoint activation. | Render Web Service > Environment |
| **`GOOGLE_CLIENT_ID`** | Conditional | Backend | No | Google OAuth 2.0 Client ID. Mandatory if `GOOGLE_AUTH_ENABLED=true`. Used to verify `aud` claim on Google ID tokens. | Render Web Service > Environment |
| **`CLOUDINARY_CLOUD_NAME`** | Optional | Backend | No | Cloudinary account name for trip image storage. Safe in-memory fallback if omitted. | Render Web Service > Environment |
| **`CLOUDINARY_API_KEY`** | Optional | Backend | **YES** | Cloudinary API key. | Render Web Service > Environment (Secret) |
| **`CLOUDINARY_API_SECRET`** | Optional | Backend | **YES** | Cloudinary API secret. | Render Web Service > Environment (Secret) |
| **`CLOUDINARY_URL`** | Optional | Backend | **YES** | Alternative unified Cloudinary connection string. | Render Web Service > Environment (Secret) |
| **`VITE_API_URL`** | **Required (Build)**| Frontend| No | **CRITICAL BUILD-TIME VARIABLE:** Base URL for Axios and API client requests. Replaced statically by Vite during `npm run build`. Set to `https://api.tripnow.abhishektech.me`. | Vercel Project > Settings > Environment Variables |
| **`VITE_GOOGLE_CLIENT_ID`** | Optional (Build)| Frontend| No | Public Google OAuth Client ID rendered by Google Identity Services button. Baked into static bundle by Vite. | Vercel Project > Settings > Environment Variables |

---

## 9. Verified Hosting Configuration Requirements (Render & Vercel)

### 9.1 Render Configuration (Backend Web Service)
- **Service Type:** Web Service
- **Environment:** Node
- **Root Directory:** `backend`
- **Build Command:** `npm install --omit=dev` (or `npm ci --omit=dev`)
- **Start Command:** `npm start` (executes `node server.js`)
- **Runtime Version:** Configure `NODE_VERSION=24.19.0` (or `24.x`) in Environment settings.
- **Port:** Dynamically assigned via `process.env.PORT` (code binds to `process.env.PORT || 5000`).
- **Health Check Path:** `/` (returns HTTP 200 with text `"Travel API Running ✅"`).
- **Custom Domain:** `api.tripnow.abhishektech.me`
- **Dashboard Verification Required:** Obtain the exact, service-specific DNS target from the Render Dashboard under **Settings > Custom Domains**.

### 9.2 Vercel Configuration (Frontend Project)
- **Framework Preset:** `Vite`
- **Root Directory:** `frontend`
- **Node.js Version:** `24.x` (configured in Vercel Project Settings > General > Node.js Version).
- **Build Command:** `npm run build` (executes `vite build`).
- **Output Directory:** `dist`
- **Custom Domain:** `tripnow.abhishektech.me`
- **SPA Rewrites:** Controlled via repository file [`frontend/vercel.json`](file:///d:/all%20project/Travel%20Website/frontend/vercel.json) (`/(.*) -> /`).
- **Dashboard Verification Required:** Confirm Vercel DNS CNAME target (`cname.vercel-dns.com` or custom apex records) under **Settings > Domains**.

---

## 10. Updated Risk Register

| Finding ID | Severity | Category | Affected Component | Technical Evidence | Potential Impact | Remediation | Cloud Access Required? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RISK-01** | **CRITICAL** | Custom Domains / CSRF | [`backend/middleware/csrf.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/csrf.js#L82), [`backend/config/authCookie.js`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L81) | `cross-site` rejected; `SameSite=Lax` dropped across different sites | If deployed using default `onrender.com` domain, all logins, signups, and bookings fail with HTTP 403. | Bind `api.tripnow.abhishektech.me` on Render with CNAME record. | **Yes (DNS & Render Dashboard)** |
| **RISK-02** | **CRITICAL** | Build Configuration | [`frontend/src/lib/api.js`](file:///d:/all%20project/Travel%20Website/frontend/src/lib/api.js#L3) | Vite bakes `import.meta.env.VITE_API_URL` at build time | If `VITE_API_URL` is omitted in Vercel prior to build, client falls back to `localhost:5000`. | Set `VITE_API_URL=https://api.tripnow.abhishektech.me` in Vercel before building. | **Yes (Vercel Project Settings)** |
| **RISK-03** | **HIGH** | Secrets Configuration | [`backend/config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js#L34-L48) | Lines 34–48 enforce `CSRF_SECRET` and `FIX_DAY_PROPOSAL_SECRET` in prod | Backend immediately crashes on startup if secrets are missing, `< 32` chars, or identical to `JWT_SECRET`. | Generate distinct 64-character random hex secrets and set in Render environment. | **Yes (Render Environment Settings)** |
| **RISK-04** | **HIGH** | CORS Configuration | [`backend/config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js#L14), [`backend/app.js`](file:///d:/all%20project/Travel%20Website/backend/app.js#L30) | `CLIENT_URL` controls allowed CORS origins | If `CLIENT_URL` does not match the frontend domain, all browser API calls are rejected with 403. | Set `CLIENT_URL=https://tripnow.abhishektech.me` in Render. | **Yes (Render Environment Settings)** |
| **RISK-05** | **MEDIUM** | Runtime Environment | [`backend/package.json`](file:///d:/all%20project/Travel%20Website/backend/package.json) | Node 20 is EOL; `google-auth-library` requires `node >= 22` | Unpatched runtime vulnerabilities; legacy runtime fallback risk. | Set `NODE_VERSION=24.19.0` (or `24.x`) in Render environment settings and Vercel project settings. | **Yes (Render & Vercel Settings)** |
| **RISK-06** | **MEDIUM** | Observability | [`backend/app.js`](file:///d:/all%20project/Travel%20Website/backend/app.js#L80) | Root endpoints return 200 without pinging MongoDB Atlas | Render health checks may report healthy even if the database cluster connection is down. | Monitor MongoDB Atlas cluster metrics independently via Atlas console alerts. | No code changes required immediately. |
| **RISK-07** | **LOW** | External API | [`backend/services/geminiClient.js`](file:///d:/all%20project/Travel%20Website/backend/services/geminiClient.js) | Gemini SDK calls rely on default network timeout | Potential socket starvation under severe upstream latency. | Add explicit 25-second AbortController signal in future optimization cycle. | No immediate blocker. |

---

## 11. Final Production Readiness Verdict

### **CONDITIONALLY READY** ⚠️

### Authoritative Summary:
1. **Automated Verification Status:**
   - All 757 automated tests passed (125 frontend across 16 suites, 632 backend across 36 suites).
   - Vite 7.3.7 production bundle compiles cleanly in 4.24s.
   - Production dependency audit (`npm audit --omit=dev`) reported zero findings across backend and frontend.
   - Development dependencies retain 19 findings in backend (Jest/Babel) and 7 findings in frontend (ESLint/Babel).
   - **Important Scope Limitation:** These results reflect automated test suites and production build scripts executed locally under Node.js v24.19.0. Live cloud deployment, browser-based end-to-end sessions, DNS resolution, provider settings, and production database connectivity remain unverified until deployment.
2. **Deployment Prerequisites (Action Items for User in Cloud Consoles):**
   - **Prerequisite 1:** Add custom domain `api.tripnow.abhishektech.me` in Render and create the dashboard-provided CNAME record in DNS.
   - **Prerequisite 2:** Configure `VITE_API_URL=https://api.tripnow.abhishektech.me` in Vercel before triggering the production build.
   - **Prerequisite 3:** Provision backend environment variables in Render (`NODE_ENV=production`, `NODE_VERSION=24.19.0`, `CLIENT_URL=https://tripnow.abhishektech.me`, `MONGO_URI`, `JWT_SECRET`, `CSRF_SECRET`, `FIX_DAY_PROPOSAL_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`).
   - **Prerequisite 4:** Add `https://tripnow.abhishektech.me` to Authorized JavaScript Origins in Google Cloud Console.

Refer to [`docs/production-readiness/production-environment-checklist.md`](file:///d:/all%20project/Travel%20Website/docs/production-readiness/production-environment-checklist.md) for the complete, step-by-step deployment runbook.
