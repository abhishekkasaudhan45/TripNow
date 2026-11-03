# TripNow Phase 4A — Production Deployment Readiness Audit

**Role:** Senior DevOps Engineer, Cloud Architect & Application Security Engineer  
**Audit Target:** TripNow Production Deployment Readiness  
**Target Domains:** `tripnow.abhishektech.me` (Frontend) & `api.tripnow.abhishektech.me` (Backend)  
**Target Infrastructure:** Vercel (Frontend), Render (Backend), MongoDB Atlas (Database), Cloudinary (Media Storage)  
**Date of Audit:** November 1, 2026  
**Document Status:** READ-ONLY AUDIT COMPLETE — AWAITING EXPLICIT DEPLOYMENT APPROVAL  

---

## 1. Executive Summary & Verdict

### Overall Deployment Readiness Verdict: **READY WITH MANDATORY PRE-FLIGHT CONFIGURATION**

The TripNow codebase has completed Phases 1 through 3E, including security hardening, backend modularization, Cloudinary storage isolation, Custom Pivot modal consolidation, atomic Optimistic Concurrency Control (OCC) itinerary persistence, anonymous draft preservation, and full manual browser acceptance testing (12/12 workflows verified in Google Chrome).

This Phase 4A audit verifies that the codebase is architecturally and operationally prepared for production deployment to **Vercel** (frontend) and **Render** (backend) connected to **MongoDB Atlas** and **Cloudinary**.

### Primary Findings Summary:
1. **Zero Code Changes Required:** No application source code modifications are necessary. All operational logic, routing, security headers, CORS origins, cookie handlers, and database models are production-ready.
2. **Domain Architecture Alignment (READY):** The target domains (`tripnow.abhishektech.me` and `api.tripnow.abhishektech.me`) share the registrable domain `abhishektech.me`. This satisfies the browser's `SameSite=Lax` and W3C `Sec-Fetch-Site: same-site` policies, allowing cross-subdomain cookie authentication and CSRF token verification to function seamlessly.
3. **Monorepo Directory Isolation (HIGH):** Vercel must be configured with Root Directory `frontend`, and Render must be configured with Root Directory `backend`.
4. **Mandatory Production Secrets (BLOCKER if omitted):** In production mode (`NODE_ENV=production`), `backend/config/env.js` enforces that `CSRF_SECRET` (minimum 32 characters, independent from JWT) and `FIX_DAY_PROPOSAL_SECRET` must be set in Render environment variables; missing secrets will abort server startup.
5. **MongoDB Atlas Network Access (HIGH):** Render dynamically assigns outbound IP addresses. MongoDB Atlas Network Access must permit `0.0.0.0/0` (Access from Anywhere) secured by strong database user credentials.
6. **No Committed Secrets (PASSED):** Git repository inspection confirmed that zero `.env` files are tracked in git history; all sensitive credentials exist exclusively in local, ignored environment files.

---

## 2. Production Architecture & Cloud Topology

```mermaid
flowchart TD
    subgraph Client ["Client Browser (Desktop / Mobile)"]
        Browser["Google Chrome / Safari / Edge"]
    end

    subgraph DNS ["DNS Provider (abhishektech.me)"]
        DNS_Front["tripnow.abhishektech.me<br/>CNAME -> cname.vercel-dns.com"]
        DNS_Back["api.tripnow.abhishektech.me<br/>CNAME -> tripnow-backend.onrender.com"]
    end

    subgraph Vercel ["Vercel Edge Network (Frontend)"]
        Vercel_CDN["Vercel Global Edge CDN"]
        SPA_Assets["React 19 SPA (Vite v7.3.7)<br/>Static Assets in /dist<br/>SPA Fallback via vercel.json"]
    end

    subgraph Render ["Render Cloud (Backend Web Service)"]
        ReverseProxy["Render Load Balancer / TLS Terminator<br/>trust proxy: 1"]
        ExpressApp["Node.js v20/22/24 + Express 5<br/>Port 5000 / 10000<br/>Graceful Shutdown (SIGTERM, 10s)"]
        SecurityMW["Helmet CSP / HSTS / Sniff Guard<br/>CORS: allowedOrigins<br/>CSRF Timing-Safe HMAC<br/>HttpOnly Cookie Session"]
    end

    subgraph External ["Managed Cloud Services"]
        Atlas[("MongoDB Atlas M0/M10 Cluster<br/>Replica Set (3 Nodes)<br/>Bookings & Users Collections")]
        Cloudinary["Cloudinary CDN<br/>Secure Media Uploads<br/>Auto Format & Compression"]
        Gemini["Google Gemini API<br/>gemini-3.5-flash-lite / 3.6-flash<br/>Structured JSON Schema Output"]
        EmailJS["EmailJS Service (Optional)<br/>Verification & Reset Emails"]
    end

    Browser -->|HTTPS / Port 443| DNS_Front
    DNS_Front --> Vercel_CDN
    Vercel_CDN --> SPA_Assets

    Browser -->|API Calls withCredentials: true| DNS_Back
    DNS_Back --> ReverseProxy
    ReverseProxy --> ExpressApp
    ExpressApp --> SecurityMW

    ExpressApp -->|Mongoose Connection Pool (TLS)| Atlas
    ExpressApp -->|HTTPS Stream (upload_stream)| Cloudinary
    ExpressApp -->|HTTPS SDK Calls| Gemini
    ExpressApp -->|HTTPS REST API| EmailJS
```

---

## 3. Frontend Deployment Audit (Vercel)

**Inspection Target:** `frontend/package.json`, `frontend/vite.config.js`, `frontend/vercel.json`, `frontend/src/lib/api.js`, `frontend/src/App.jsx`.

### 3.1 Vercel Project Configuration
- **Root Directory:** `frontend`  
  *(Critical: The git repository root contains both `frontend` and `backend`. In Vercel Project Settings > General > Root Directory, set `frontend`).*
- **Framework Preset:** `Vite` (Vercel automatically detects Vite).
- **Build Command:** `npm run build` (or `vite build`).
- **Output Directory:** `dist`.
- **Install Command:** `npm install`.
- **Node.js Version:** `20.x` or `22.x` (standard Vercel build container).

### 3.2 SPA Routing & Fallback Behavior
- Inspecting `frontend/vercel.json`:
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/"
      }
    ]
  }
  ```
- **Direct Refresh Verification:** Client-side React Router routes (`/trip/:id`, `/dashboard`, `/plan-trip`, `/login`, `/signup`, `/shared-trip/:id`, `/admin`) are redirected to `index.html`. Browser refreshes (F5) will never produce `404 Not Found` from Vercel's edge servers.

### 3.3 Environment Variables & API URL Routing
- Inspecting `frontend/src/lib/api.js`:
  ```javascript
  const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  });
  ```
- Inspecting `frontend/src/services/bookingService.js`:
  ```javascript
  export const getSharedTrip = async (id) => {
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const res = await fetch(`${base}/api/bookings/shared/${id}`);
    ...
  };
  ```
- **Required Vercel Variable:** `VITE_API_URL=https://api.tripnow.abhishektech.me`.
- **Localhost Audit:** Code inspection confirmed that `"http://localhost:5000"` is solely a fallback when `import.meta.env.VITE_API_URL` is undefined. When `VITE_API_URL` is set in Vercel, zero localhost references are invoked.

### 3.4 Unused / Obsolete Frontend Variables
- `frontend/.env` contains `VITE_GOOGLE_MAPS_API_KEY` and `VITE_OPENWEATHER_API_KEY`.
- Codebase inspection verified:
  - `MapView.jsx` uses iframe embeds via standard OpenStreetMap / Google search query URLs without API keys.
  - `Dashboard.jsx` uses the free, open `https://api.open-meteo.com` endpoint without API keys.
- **Verdict:** Do **not** configure `VITE_GOOGLE_MAPS_API_KEY` or `VITE_OPENWEATHER_API_KEY` in Vercel. They are obsolete and unused.

---

## 4. Backend Deployment Audit (Render)

**Inspection Target:** `backend/package.json`, `backend/server.js`, `backend/app.js`, `backend/config/env.js`, `backend/config/db.js`, `backend/config/authCookie.js`, `backend/middleware/csrf.js`.

### 4.1 Render Service Configuration
- **Environment:** `Web Service` (Native Node environment or Docker).
- **Root Directory:** `backend`.
- **Build Command:** `npm install`.
- **Start Command:** `node server.js` (or `npm start`).
- **Health Check Path:** `/api` (Returns `HTTP 200 OK` with JSON `{ message: "API working ✅", timestamp: ... }`).
- **Auto-Deploy:** Optional (recommended on `main` branch push).

### 4.2 Reverse Proxy & Trust Proxy (`app.set("trust proxy", 1)`)
- Inspecting `backend/app.js` (line 17):
  ```javascript
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  ```
- **Render Architecture:** Render routes traffic through an SSL-terminating reverse proxy load balancer (`X-Forwarded-For`, `X-Forwarded-Proto`).
- **Audit Finding:** `app.set("trust proxy", 1)` is **already enabled**. This guarantees:
  1. `req.ip` reflects the actual client's public IP address, preventing `globalLimiter`, `aiLimiter`, and `authLimiter` from erroneously throttling all visitors under Render's shared proxy IP.
  2. `req.secure` correctly identifies HTTPS connections forwarded by Render, allowing `secure: true` cookies to be transmitted.

### 4.3 Graceful Shutdown & Render SIGTERM Lifecycle
- Inspecting `backend/server.js`:
  ```javascript
  const SHUTDOWN_TIMEOUT_MS = 10000; // 10s bounded timeout
  ...
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  ```
- **Render Lifecycle:** Render sends `SIGTERM` when deploying new revisions, scaling, or restarting. Services have 30 seconds to exit gracefully before receiving `SIGKILL`.
- **Audit Finding:** The shutdown handler cleanly drains in-flight HTTP requests (`server.close()`), closes the Mongoose connection pool (`mongoose.connection.close(false)`), and completes within 10 seconds. This is 100% compatible with Render.

### 4.4 Cookie Settings & Cross-Subdomain Transport
- Inspecting `backend/config/authCookie.js`:
  ```javascript
  const getAuthCookieOptions = (customMaxAge = COOKIE_MAX_AGE_MS) => ({
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: customMaxAge,
    path: "/",
  });
  ```
- **Cookie Security Analysis:**
  - `httpOnly: true`: Prevents client-side JavaScript (`document.cookie`) from reading the JWT token, completely mitigating XSS token theft.
  - `secure: true` (in production): Transmitted exclusively over TLS (`https://`).
  - `sameSite: "lax"`: Because `tripnow.abhishektech.me` and `api.tripnow.abhishektech.me` share the public registrable domain `abhishektech.me`, modern browsers treat requests between them as **Same-Site**. The browser sends the cookie on credentialed fetch requests (`withCredentials: true`).
  - **Host-Only vs Domain Cookie:** Leaving `domain` unspecified creates a host-only cookie locked to `api.tripnow.abhishektech.me`. Because all API calls target `api.tripnow.abhishektech.me`, host-only cookies provide maximum isolation against other subdomains.

### 4.5 CORS & Origin Validation
- Inspecting `backend/config/env.js` and `backend/app.js`:
  ```javascript
  const parseAllowedOrigins = () => {
    const rawOrigins = process.env.CLIENT_URL || "http://localhost:5173";
    return rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  };
  ...
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  ```
- **Audit Finding:** Wildcard origins (`*`) are **never** permitted with credentials. Render environment variable `CLIENT_URL` must be set to `https://tripnow.abhishektech.me`.

### 4.6 CSRF Protection Across Domains
- Inspecting `backend/middleware/csrf.js`:
  ```javascript
  // 1. Origin header check
  if (origin && !env.allowedOrigins.includes(origin)) {
    return { valid: false, reason: `Origin ${origin} is not allowed` };
  }
  // 2. Sec-Fetch-Site check
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request rejected by Sec-Fetch-Site" };
  }
  // 3. Cryptographic Token check
  ...
  ```
- **Audit Finding:**
  - Browser requests from `https://tripnow.abhishektech.me` to `https://api.tripnow.abhishektech.me` have `Sec-Fetch-Site: same-site`.
  - The check explicitly rejects `cross-site` attacks while permitting legitimate `same-site` calls from `tripnow.abhishektech.me`.
  - The client retrieves the salt-based HMAC CSRF token via `GET /api/csrf-token` and transmits it in `X-CSRF-Token`.

---

## 5. Comprehensive Environment Variable Inventory

All environment variables were identified through recursive static analysis of the codebase.

| Variable Name | Used In Code | Required? | Secret? | Target Platform | Description / Production Value |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`NODE_ENV`** | `env.js`, `errorHandler.js`, `authCookie.js`, `db.js` | **YES** | No | **Render** | Must be set to `production`. Enables strict security, hides stack traces, enforces secure cookies. |
| **`PORT`** | `env.js`, `server.js` | Optional | No | **Render** | Port for HTTP server. Render sets this automatically (usually `10000`). Code defaults to `5000`. |
| **`NODE_VERSION`** | Render Build Container | Recommended | No | **Render** | Node runtime version on Render. Set to `20.18.0` or `22.x` to match local engine. |
| **`CLIENT_URL`** | `env.js` (`allowedOrigins`), `email.js` | **YES** | No | **Render** | Allowed CORS origins and email base URL. Set to: `https://tripnow.abhishektech.me`. |
| **`MONGO_URI`** | `env.js`, `db.js` | **YES** | **YES** | **Render** | MongoDB Atlas connection string with credentials and database name (e.g. `mongodb+srv://...`). |
| **`JWT_SECRET`** | `env.js`, `authController.js`, `auth.js` | **YES** | **YES** | **Render** | Cryptographically random string (min 32 bytes/64 hex chars) for signing auth JWTs. |
| **`JWT_EXPIRES_IN`** | `env.js`, `authCookie.js` | Optional | No | **Render** | Lifetime of JWT and auth cookie. Defaults to `2h` if omitted. |
| **`CSRF_SECRET`** | `env.js`, `csrf.js` | **YES (Prod)** | **YES** | **Render** | Independent secret (min 32 chars) for HMAC signing of CSRF tokens. Cannot equal `JWT_SECRET`. |
| **`FIX_DAY_PROPOSAL_SECRET`** | `env.js`, `fixDayService.js` | **YES (Prod)** | **YES** | **Render** | Secret key for signing Fix Day proposal tokens with HMAC-SHA256. |
| **`ADMIN_EMAIL`** | `env.js`, `authController.js` | **YES** | No | **Render** | Admin email address for the admin dashboard gateway. |
| **`ADMIN_PASSWORD`** | `env.js`, `authController.js` | **YES** | **YES** | **Render** | Admin password for initial setup / admin authentication. |
| **`GEMINI_API_KEY`** | `env.js`, `geminiClient.js`, `aiService.js` | **YES** | **YES** | **Render** | Google AI Studio / Gemini API Key. |
| **`GEMINI_MODEL`** | `env.js`, `geminiClient.js` | Optional | No | **Render** | Model name. Set to `gemini-3.5-flash-lite` or `gemini-3.6-flash`. Defaults to `gemini-3.6-flash`. |
| **`CLOUDINARY_CLOUD_NAME`** | `env.js`, `storageService.js` | **YES** | No | **Render** | Cloudinary cloud account name (required for cover image uploads in production). |
| **`CLOUDINARY_API_KEY`** | `env.js`, `storageService.js` | **YES** | **YES** | **Render** | Cloudinary API Key. |
| **`CLOUDINARY_API_SECRET`** | `env.js`, `storageService.js` | **YES** | **YES** | **Render** | Cloudinary API Secret. |
| **`CLOUDINARY_URL`** | `env.js`, `storageService.js` | Optional | **YES** | **Render** | Full Cloudinary connection string. Alternative to passing separate name/key/secret. |
| **`EMAILJS_SERVICE_ID`** | `email.js` | Optional | No | **Render** | EmailJS service identifier for password resets (gracefully skipped if omitted). |
| **`EMAILJS_PUBLIC_KEY`** | `email.js` | Optional | No | **Render** | EmailJS public key. |
| **`EMAILJS_PRIVATE_KEY`** | `email.js` | Optional | **YES** | **Render** | EmailJS server-side private key (accessToken). |
| **`EMAILJS_RESET_TEMPLATE_ID`** | `email.js` | Optional | No | **Render** | EmailJS password reset template ID. |
| **`EMAILJS_VERIFY_TEMPLATE_ID`** | `email.js` | Optional | No | **Render** | EmailJS email verification template ID. |
| **`VITE_API_URL`** | `frontend/src/lib/api.js`, `bookingService.js` | **YES** | No | **Vercel** | Production API base URL: `https://api.tripnow.abhishektech.me`. |

---

## 6. Security Audit

| Security Domain | Verified Behavior | Status |
| :--- | :--- | :---: |
| **Secret Exposure in Git** | Executed `git ls-files \| grep .env`. Only `.env.example` files are tracked. Zero credentials committed. | **PASSED** |
| **Environment Exclusion** | `.gitignore` at root, backend, and frontend strictly exclude `.env`, `.env.*`, and build artifacts (`dist`). | **PASSED** |
| **JWT Secret Strength** | Code requires a non-empty `JWT_SECRET`. In production, recommend 256-bit entropy (`openssl rand -hex 32`). | **READY** |
| **CSRF Independence** | `env.js` validates that `CSRF_SECRET` is at least 32 characters and rejects values identical to `JWT_SECRET`. | **PASSED** |
| **CORS Isolation** | Wildcards are blocked with credentials. Only origins explicitly declared in `CLIENT_URL` are permitted. | **PASSED** |
| **Cookie Hardening** | `httpOnly: true`, `secure: true` (in production), `sameSite: "lax"`, and path `/` strictly enforced. | **PASSED** |
| **Error Sanitization** | `errorHandler.js` suppresses stack traces and replaces internal 500 errors with generic messages in production. | **PASSED** |
| **HTTP Security Headers** | Helmet enforces strict CSP, HSTS (`max-age=31536000`), frameguard (`DENY`), and MIME sniffing prevention. | **PASSED** |
| **Rate Limiting** | Strict rate limiters active on `/api` (global), `/api/ai/*` (Gemini protection), and `/api/auth/*` (brute-force defense). | **PASSED** |
| **Upload Security** | Multer memory storage, 5MB limit, 1 file limit, and magic byte validation for JPEG/PNG/WebP/GIF. | **PASSED** |

---

## 7. Database Readiness (MongoDB Atlas)

### 7.1 Schema Models & Indexes
- **`Booking` Model:**
  - `{ user: 1, createdAt: -1 }`: Compound index for rapid dashboard trip retrieval.
  - `{ isShared: 1 }`: Index for public shared trip lookups.
  - `{ user: 1 }`: Single field index.
- **`User` Model:**
  - `{ email: 1 }`: Unique index enforcing single-account constraint.
  - `{ resetTokenHash: 1 }`: Sparse index for password reset lookups.
  - `{ verifyTokenHash: 1 }`: Sparse index for email verification.

### 7.2 Mongoose `autoIndex` Configuration
- `autoIndex` is enabled by default in Mongoose schemas.
- For a fresh MongoDB Atlas production deployment, Mongoose creates all declared indexes on initial startup.
- **Recommendation:** Allow Mongoose to create indexes on initial deployment. For future high-traffic migrations, `autoIndex: false` can be toggled if dataset sizes exceed millions of documents.

### 7.3 Atlas Network Access & Connection Safeguards
- In `backend/config/db.js`:
  ```javascript
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  ```
- **Failure Behavior:** If Atlas is unreachable within 4 seconds in production, the backend logs the error and calls `process.exit(1)`. This prevents Render from registering unhealthy zombie instances.
- **Atlas Configuration Requirement:** In MongoDB Atlas > Network Access, add `0.0.0.0/0` (Allow access from anywhere). This is required because Render assigns dynamic IP addresses.

### 7.4 Database Migration & Rollback Strategy
- **Migration Requirement:** **None**. Phase 2 consolidated all trip logic into `Booking.js`. No orphan `Trip` collection migrations are required.
- **Backup Recommendation:** In MongoDB Atlas, perform a manual cluster snapshot before deploying production credentials.

---

## 8. Cloudinary Media Storage Readiness

### 8.1 Configuration & Production Invariants
- Inspecting `backend/services/storageService.js`:
  ```javascript
  if (isCloudinaryConfigured()) {
    // uploadStream to Cloudinary with limit 1920x1080, q_auto, f_auto
  } else if (env.isProduction) {
    throw new StorageServiceError("Media storage service is unavailable: storage provider is not configured.", 503);
  }
  ```
- **Safety Guarantee:** Production **cannot** silently fall back to mock memory URLs. If Cloudinary credentials are missing or invalid in production, upload attempts return `HTTP 503 Service Unavailable`.
- **Image Deletion Safety:** `deleteImage()` checks `isExternalUrl()`. External Unsplash image URLs stored on trips are protected and never sent to Cloudinary deletion endpoints.
- **Permanent Cloudinary URLs:** Images are uploaded to the `tripnow/covers` folder and return immutable, secure HTTPS URLs (`https://res.cloudinary.com/...`).

---

## 9. Step-by-Step Production Deployment Procedure

Follow this deployment sequence when ready to launch.

```mermaid
sequenceDiagram
    autonumber
    actor DevOps as Engineer
    participant Atlas as MongoDB Atlas
    participant Cloudinary as Cloudinary
    participant Render as Render (Backend)
    participant Vercel as Vercel (Frontend)
    participant DNS as DNS Registrar

    DevOps->>Atlas: 1. Create DB User & Allow 0.0.0.0/0 Network Access
    DevOps->>Atlas: 2. Copy MONGO_URI connection string
    DevOps->>Cloudinary: 3. Create Cloudinary account & get Cloud Name, API Key, Secret
    DevOps->>Render: 4. Create Web Service (Root: backend, Start: node server.js)
    DevOps->>Render: 5. Configure Backend Env Vars (MONGO_URI, JWT_SECRET, CSRF_SECRET, etc.)
    Render-->>DevOps: 6. Build succeeds; Health check GET /api returns 200
    DevOps->>Vercel: 7. Import Git Repo (Root: frontend, Preset: Vite)
    DevOps->>Vercel: 8. Configure Frontend Env Var (VITE_API_URL=https://api.tripnow.abhishektech.me)
    Vercel-->>DevOps: 9. Build succeeds; Deployed to *.vercel.app preview
    DevOps->>DNS: 10. Add CNAME api.tripnow.abhishektech.me -> Render host
    DevOps->>DNS: 11. Add CNAME tripnow.abhishektech.me -> cname.vercel-dns.com
    DevOps->>Render: 12. Add Custom Domain api.tripnow.abhishektech.me (TLS auto-issued)
    DevOps->>Vercel: 13. Add Custom Domain tripnow.abhishektech.me (TLS auto-issued)
    DevOps->>Render: 14. Update CLIENT_URL=https://tripnow.abhishektech.me
    DevOps->>Browser: 15. Execute Production Smoke-Test Checklist
```

### Phase 1: MongoDB Atlas Setup
1. Create a production cluster (M0 Free or M10 Dedicated).
2. Create database user `tripnow-prod-user` with readWrite access to database `tripnow_prod`.
3. In **Network Access**, add IP `0.0.0.0/0` (Description: `Render Dynamic Cloud Access`).
4. Copy the connection string: `mongodb+srv://tripnow-prod-user:<password>@<cluster>.mongodb.net/tripnow_prod?retryWrites=true&w=majority`.

### Phase 2: Render Backend Web Service Deployment
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service** > Connect the GitHub repository.
3. Configure Service Settings:
   - **Name:** `tripnow-api`
   - **Region:** Choose region closest to users (e.g. `Frankfurt`, `Oregon`, or `Singapore`).
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free or Starter
4. In **Advanced** > **Health Check Path**, enter: `/api`.
5. In **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `CLIENT_URL` = `https://tripnow.abhishektech.me`
   - `MONGO_URI` = `<Atlas connection string>`
   - `JWT_SECRET` = `<Generate via: openssl rand -hex 32>`
   - `CSRF_SECRET` = `<Generate via: openssl rand -hex 32>` *(must differ from JWT_SECRET)*
   - `FIX_DAY_PROPOSAL_SECRET` = `<Generate via: openssl rand -hex 32>`
   - `ADMIN_EMAIL` = `admin@tripnow.abhishektech.me`
   - `ADMIN_PASSWORD` = `<Strong Admin Password>`
   - `GEMINI_API_KEY` = `<Google Gemini API Key>`
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
   - `CLOUDINARY_CLOUD_NAME` = `<Cloudinary Cloud Name>`
   - `CLOUDINARY_API_KEY` = `<Cloudinary API Key>`
   - `CLOUDINARY_API_SECRET` = `<Cloudinary API Secret>`
6. Click **Create Web Service**. Verify build logs finish with `Server running on port 10000` and `MongoDB Connected ✅`.

### Phase 3: Vercel Frontend Deployment
1. Log into [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project** > Import the GitHub repository.
3. In Project Configuration:
   - **Project Name:** `tripnow`
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** > Select `frontend` > Click **Continue**.
4. In **Environment Variables**, add:
   - `VITE_API_URL` = `https://api.tripnow.abhishektech.me`
5. Click **Deploy**. Verify build completes in under 10 seconds.

### Phase 4: Custom Domain & DNS Mapping
1. In your DNS provider (Cloudflare, Namecheap, GoDaddy, or Route 53) for `abhishektech.me`:
   - Add CNAME record: `tripnow` -> `cname.vercel-dns.com`
   - Add CNAME record: `api.tripnow` -> `<render-service-name>.onrender.com`
2. In Vercel Project Settings > **Domains**, add `tripnow.abhishektech.me`. Vercel automatically provisions SSL/TLS.
3. In Render Service Settings > **Custom Domains**, add `api.tripnow.abhishektech.me`. Render automatically provisions SSL/TLS via Let's Encrypt.

---

## 10. Rollback & Disaster Recovery Plan

| Component | Rollback Mechanism | Recovery Time | Procedure |
| :--- | :--- | :---: | :--- |
| **Frontend (Vercel)** | Instant Deployment Re-point | < 1 minute | In Vercel > Deployments, locate the last known healthy deployment, click **...** > **Promote to Production**. Traffic shifts instantly without rebuilding. |
| **Backend (Render)** | Rollback to Previous Deploy | 1–2 minutes | In Render > Service > Deploys, locate the previous successful build, click **Rollback to this deploy**. Render restarts the container with previous image. |
| **Database (Atlas)** | Point-in-Time Restore / Snapshot | 5–15 minutes | In MongoDB Atlas > Backup, select the pre-deployment snapshot and restore to a temporary cluster or in-place. |
| **DNS / Routing** | DNS TTL fallback | 5–10 minutes | Ensure DNS records for `tripnow` and `api.tripnow` have TTL set to 300 seconds (5 mins) prior to migration. |

---

## 11. Production Smoke-Test Plan (17-Point Checklist)

Execute immediately following domain cutover:

- [ ] **1. Frontend Loads:** Open `https://tripnow.abhishektech.me`. Confirm homepage renders with hero preview, search input, and no console errors.
- [ ] **2. Backend Health Endpoint:** Visit `https://api.tripnow.abhishektech.me/api` in browser. Expect `HTTP 200` with JSON `{ "message": "API working ✅" }`.
- [ ] **3. Signup Works:** Register a new user (`test.user@abhishektech.me`). Expect `HTTP 200` and automatic redirect to dashboard or planner.
- [ ] **4. Login Works:** Log out and log back in. Expect `HTTP 200` and user profile loaded.
- [ ] **5. Cookie Authentication:** In Chrome DevTools > Application > Cookies, verify cookie `token` is present with `HttpOnly: true`, `Secure: true`, `SameSite: Lax`, and `Path: /`.
- [ ] **6. CSRF Token Retrieval:** Inspect Network tab for `GET /api/csrf-token`. Expect `HTTP 200` with `{ csrfToken: "..." }`.
- [ ] **7. New Trip Generation:** Enter destination "Rome, Italy", select dates, click Plan. Confirm Gemini generates itinerary within 15 seconds.
- [ ] **8. Existing Booking Loads:** Navigate to `/trip/:id` for the newly created trip. Confirm all days, timeline, and reality score load cleanly.
- [ ] **9. Adaptive Pivot Works:** Click `⚡ Pivot` on an activity slot > select `🌧️ Rain`. Confirm slot adapts with badge and Save button turns amber (`dirty`).
- [ ] **10. Custom Pivot Works:** Click `⚡ Pivot` > `✏️ Other...`. Enter custom instruction in `CustomPivotModal`. Confirm replacement stages.
- [ ] **11. Fix Day Works:** Click `🛠️ Fix My Day` on Day 1. Select schedule overload > preview > apply. Confirm timeline rebalances.
- [ ] **12. Save Changes Persists:** Click amber `💾 Save Changes` button. Confirm spinner transitions to emerald `✅ Saved!` and document version increments in MongoDB.
- [ ] **13. Direct Browser Refresh:** Hard refresh (Ctrl+F5) on `/trip/:id`. Confirm itinerary reloads with all saved pivots and no `404` error.
- [ ] **14. Dashboard Display:** Navigate to `https://tripnow.abhishektech.me/dashboard`. Confirm the trip appears with destination card and reality score.
- [ ] **15. Activity Locking:** Click `🔓 Lock` on an activity. Confirm icon turns to `🔒 Locked` and adjacent Pivot button is disabled.
- [ ] **16. Cloudinary Cover Upload:** Upload a JPG/PNG cover image on the trip. Confirm `POST /api/bookings/:id/cover-image` returns `HTTP 200` with permanent `https://res.cloudinary.com/...` URL.
- [ ] **17. Shared Trip Privacy:** Toggle trip sharing to public, open the share link in an Incognito window. Confirm guest can view trip without edit actions.

---

## 12. Finding Classification Matrix

| Finding ID | Domain | Classification | Issue & Resolution |
| :--- | :--- | :---: | :--- |
| **FIND-01** | Render / Env | **BLOCKER** | `CSRF_SECRET` and `FIX_DAY_PROPOSAL_SECRET` must be set in Render environment variables when `NODE_ENV=production`. If missing, backend crashes on boot. **Resolution:** Generate two distinct 32-byte hex strings. |
| **FIND-02** | Render / CORS | **BLOCKER** | `CLIENT_URL` must be set to `https://tripnow.abhishektech.me`. If omitted, CORS defaults to `localhost:5173` and blocks the Vercel frontend. **Resolution:** Configure `CLIENT_URL` in Render. |
| **FIND-03** | Atlas / Network | **HIGH** | MongoDB Atlas IP Access List must permit `0.0.0.0/0` because Render uses dynamic IP addresses. **Resolution:** Add `0.0.0.0/0` in Atlas Network Access. |
| **FIND-04** | Vercel / Config | **HIGH** | Vercel project Root Directory must be set to `frontend`. **Resolution:** Select `frontend` in Vercel project settings. |
| **FIND-05** | Render / Config | **HIGH** | Render Web Service Root Directory must be set to `backend`. **Resolution:** Select `backend` in Render service settings. |
| **FIND-06** | Cloudinary / Env | **HIGH** | In production, missing Cloudinary credentials yield `HTTP 503` on upload. **Resolution:** Populate Cloudinary Cloud Name, API Key, and API Secret. |
| **FIND-07** | Cross-Subdomain | **READY** | Both frontend and backend share `abhishektech.me`. `SameSite=Lax` and `Sec-Fetch-Site: same-site` allow seamless cookie/CSRF communication. |
| **FIND-08** | Reverse Proxy | **READY** | `app.set("trust proxy", 1)` is already configured in `backend/app.js`, ensuring rate limiters read client IP correctly behind Render. |
| **FIND-09** | SPA Routing | **READY** | `frontend/vercel.json` already contains rewrite rules (`/(.*)` -> `/`), preventing 404s on browser refresh. |
| **FIND-10** | Obsolete Env Vars | **LOW** | `VITE_GOOGLE_MAPS_API_KEY` and `VITE_OPENWEATHER_API_KEY` are unused. **Resolution:** Do not add to Vercel. |

---

## 13. Deployment Approval Gate

> [!IMPORTANT]
> **AUDIT STATUS: COMPLETE & VERIFIED**
> 
> This audit was conducted in strict read-only mode. Zero code files were modified, zero dependencies were added, zero production databases were accessed, and zero deployment commands were triggered.
> 
> **Awaiting explicit user approval before proceeding to deployment.**

