# TripNow Phase 5B.1 — Google Sign-In Architecture Audit & Implementation Blueprint

## Document Metadata
- **Phase**: TripNow Phase 5B.1
- **Role**: Senior Authentication Architect, Google OAuth/OIDC Security Engineer, Node.js/React Full-Stack Engineer
- **Status**: ARCHITECTURE AUDIT COMPLETE — READY FOR APPROVAL
- **Target Implementation**: Phase 5B
- **Prerequisites**: Phase 5A Approved (23/23 test suites passing, 377/377 tests passing, clean Vite build, zero vulnerabilities)

---

## 1. Existing Architecture Findings

TripNow employs a decoupled, production-grade authentication and session model:

1. **Frontend**: React 19 + Vite deployed to Vercel (`tripnow.abhishektech.me`).
2. **Backend**: Node.js + Express 5 deployed to Render (`api.tripnow.abhishektech.me`).
3. **Database**: MongoDB Atlas with Mongoose 9 models.
4. **Session & Token Storage**:
   - Authentication tokens are **never** stored in browser `localStorage` or `sessionStorage`.
   - The backend signs a JWT with `HS256`, `jwtIssuer: "tripnow-api"`, `jwtAudience: "tripnow-client"`, and a configurable duration (default `2h`).
   - The JWT is transmitted in a secure, host-only `HttpOnly` cookie named `token` (`secure: isProduction`, `sameSite: "lax"`, `path: "/"`).
   - Frontend `saveAuth` only stores non-sensitive user metadata (`{ id, name, email, role }`). `getToken()` strictly returns `null`.
5. **CSRF Protection**:
   - Double-submit session-bound HMAC CSRF tokens (`salt.hmac`) generated via `backend/middleware/csrf.js` using `CSRF_SECRET`.
   - For unauthenticated users, tokens are tied to `${salt}:anon`.
   - For authenticated users, tokens are cryptographically bound to `${salt}:${authToken}`.
   - Axios request interceptor attaches `X-CSRF-Token` to all mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
   - When authentication state changes (`login`, `signup`, `logout`), the frontend response interceptor clears the cached CSRF token via `clearCsrfToken()`.
6. **Rate Limiting**:
   - Auth endpoints are protected by `authLimiter` (`10` attempts per `15 minutes`, `skipSuccessfulRequests: true`).
7. **Baseline State**:
   - 23/23 backend test suites passing (377/377 tests).
   - Frontend production build compiles cleanly without errors or warnings.
   - Zero production vulnerabilities across backend and frontend dependencies (`npm audit --omit=dev`).

---

## 2. Recommended Google Authentication Flow

We evaluate and recommend the official **Google Identity Services (GIS)** ID Token (OIDC Credential) flow.

### Why Google Identity Services (GIS) ID Token Flow?
- Eliminates OAuth 2.0 authorization code exchange round-trips and backend client secret management for browser logins.
- The browser authenticates directly with Google's secure modal/popup, yielding a cryptographically signed Google ID token (JWT) containing verified claims (`sub`, `email`, `email_verified`, `name`, `picture`).
- Zero reliance on Google Access Tokens for TripNow sessions: TripNow verifies the Google ID token once, then immediately issues its own standard TripNow JWT in an HttpOnly cookie.
- React 19 Compatible: GIS is loaded via the official Google client script (`https://accounts.google.com/gsi/client`), bypassing third-party wrapper library peer-dependency conflicts with React 19.

### End-to-End Workflow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as TripNow Frontend (React 19)
    participant Google as Google Identity Services (GIS)
    participant Backend as TripNow API (Node.js/Express)
    participant DB as MongoDB Atlas

    User->>Frontend: Clicks "Continue with Google"
    Frontend->>Google: Opens GIS popup authentication
    Google->>User: Prompts for Google account consent
    User->>Google: Approves authentication
    Google-->>Frontend: Returns ID token (JWT credential)
    Frontend->>Backend: POST /api/auth/google { idToken } + X-CSRF-Token
    Note over Backend: 1. Validate Google ID token signature with Google JWKS<br/>2. Verify aud == GOOGLE_CLIENT_ID<br/>3. Verify iss == accounts.google.com<br/>4. Verify exp > now<br/>5. Verify email_verified == true
    alt Account exists with matching googleId
        Backend->>DB: Find user by googleId
        DB-->>Backend: Return User
    else Existing account has matching email, no googleId
        Backend-->>Frontend: 409 Conflict: ACCOUNT_EXISTS_LINKING_REQUIRED<br/>(User must authenticate with password to link Google ID)
    else No account exists with googleId or email
        Backend->>DB: User.create({ name, email, googleId, isVerified: true })
        DB-->>Backend: Return new User
    end
    Backend->>Backend: Generate TripNow JWT (HS256)
    Backend-->>Frontend: 200/201 OK + Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax
    Frontend->>Frontend: clearCsrfToken() & saveAuth({ user })
    Frontend->>User: Redirects to intended destination (e.g. /dashboard or staged trip)
```

### Detailed Backend Verification Steps
1. **Verification Library**: The backend uses the official `google-auth-library` (`OAuth2Client.prototype.verifyIdToken`).
2. **Signature & Key Rotation**: Automatically fetches and caches Google's public JSON Web Key Sets (JWKS) from `https://www.googleapis.com/oauth2/v3/certs`.
3. **Issuer (`iss`)**: Validates that `iss` is `"https://accounts.google.com"` or `"accounts.google.com"`.
4. **Audience (`aud`)**: Validates that `aud` strictly equals the configured `GOOGLE_CLIENT_ID`.
5. **Expiration (`exp`)**: Enforces that the token is not expired, with standard clock-skew tolerance.
6. **Subject Identifier (`sub`)**: Extracts the stable, immutable Google numeric user ID (`sub`).
7. **Email Verification (`email_verified`)**: Requires `payload.email_verified === true`. If `false`, rejects the request with HTTP 400.

---

## 3. User Model & Schema Changes

The current `backend/models/User.js` requires a `password` on every document:
```javascript
password: {
  type: String,
  required: [true, "Password is required"],
  minlength: 6,
  select: false,
}
```

### Smallest Safe Schema Modification

```javascript
// backend/models/User.js additions

// 1. Immutable Google Subject ID
googleId: {
  type: String,
  unique: true,
  sparse: true,
  select: false, // 🔒 SEC: Do not leak in general user queries
},

// 2. Conditionally required password
password: {
  type: String,
  required: function () {
    // Password is only mandatory if the user has no linked Google account
    return !this.googleId;
  },
  minlength: 6,
  select: false,
},

// 3. Optional user avatar/picture from Google
avatar: {
  type: String,
  trim: true,
},
```

### Hook & Method Hardening
1. **Pre-Save Password Hashing**:
   ```javascript
   userSchema.pre("save", async function () {
     if (!this.isModified("password") || !this.password) return;
     const salt = await bcrypt.genSalt(10);
     this.password = await bcrypt.hash(this.password, salt);
     if (!this.isNew) {
       this.passwordChangedAt = new Date();
     }
   });
   ```
2. **Password Verification Guard**:
   ```javascript
   userSchema.methods.matchPassword = async function (enteredPassword) {
     if (!this.password) return false;
     return await bcrypt.compare(enteredPassword, this.password);
   };
   ```
3. **Index Optimization**:
   ```javascript
   userSchema.index({ googleId: 1 }, { sparse: true });
   ```

### Why this design is minimally invasive and non-breaking:
- Existing password users have `googleId: undefined`. Because `!this.googleId` evaluates to `true`, `password` remains strictly required for all local registrations.
- Existing tests and validations continue to pass without any modification.
- The `sparse: true` index prevents null collisions in MongoDB.

---

## 4. Critical Account-Linking Security

### The Threat: Automatic Account Takeover (Pre-hijacking)
If an application automatically links a Google identity to an existing account purely because `payload.email === existingUser.email`:
- An attacker could register an account on TripNow using `victim@gmail.com` before the victim signs up.
- Or an attacker with temporary control of an unverified corporate domain could trigger an automatic takeover of an existing TripNow account.
- **Rule**: Never automatically attach a Google identity to an existing password-protected account based solely on an email string match.

### Explicit Linking Rules Matrix

| Scenario | State in DB | Google Token Claims | Action Taken | HTTP Status |
|---|---|---|---|---|
| **1. Known Google User** | Account exists with matching `googleId` | Valid `sub` matching DB | Authenticate immediately, issue TripNow JWT cookie | `200 OK` |
| **2. New User** | Neither `googleId` nor `email` in DB | `email_verified: true` | Create new account with `googleId`, `email`, `name`, `isVerified: true`, issue JWT cookie | `201 Created` |
| **3. Existing Password User (Unlinked)** | Account exists with `email`, but `googleId` is null/different | Valid `sub` & matching `email` | **Refuse automatic merge**. Require password login to link | `409 Conflict` (`ACCOUNT_EXISTS_LINKING_REQUIRED`) |
| **4. Unverified Google Email** | Any | `email_verified: false` | **Reject immediately**. Do not trust unverified emails | `400 Bad Request` (`UNVERIFIED_EMAIL`) |
| **5. Authenticated Linking** | User logged in via password, calls `/api/auth/google/link` | Valid `sub`, `email` matches active user | Set `user.googleId = sub`, save document | `200 OK` |
| **6. Duplicate Google Identity** | Another user already has that `googleId` | Same `sub` on different `_id` | **Reject linking**. Prevent identity collision | `409 Conflict` (`GOOGLE_ID_ALREADY_LINKED`) |

### Email Enumeration Mitigation
- Returning `ACCOUNT_EXISTS_LINKING_REQUIRED` does **not** create an open email enumeration vulnerability.
- A client can only receive this response by submitting a **cryptographically signed Google ID token** issued by Google for that exact email address. An attacker cannot query arbitrary emails without controlling the underlying Google accounts.

---

## 5. Feature-Gated Configuration

Google Sign-In must be completely optional and safely disabled when configuration is absent.

### Configuration Schema (`backend/config/env.js`)

| Variable | Type | Environment | Requirement | Default |
|---|---|---|---|---|
| `GOOGLE_AUTH_ENABLED` | Boolean string (`"true"` / `"false"`) | Dev, CI, Prod | Optional | `"false"` |
| `GOOGLE_CLIENT_ID` | String | Dev, CI, Prod | Required **only** if `GOOGLE_AUTH_ENABLED=true` | `undefined` |
| `VITE_GOOGLE_CLIENT_ID` | String | Frontend (Vite) | Optional | `undefined` |

### Startup Validation Logic
```javascript
const googleAuthEnabled =
  (process.env.GOOGLE_AUTH_ENABLED || "").trim().toLowerCase() === "true";
const googleClientId = process.env.GOOGLE_CLIENT_ID
  ? process.env.GOOGLE_CLIENT_ID.trim()
  : undefined;

if (googleAuthEnabled) {
  if (!googleClientId) {
    throw new Error(
      "GOOGLE_AUTH_ENABLED is set to 'true', but GOOGLE_CLIENT_ID is not configured."
    );
  }
}
```

### Deterministic Feature Behavior
1. **Local Development (No credentials)**:
   - `GOOGLE_AUTH_ENABLED` is unset or `"false"`.
   - Server starts immediately without errors.
   - Frontend safely hides or disables the Google button.
2. **CI / Automated Testing**:
   - `GOOGLE_AUTH_ENABLED` is unset or `"false"`.
   - All 23 test suites and 377 existing tests run cleanly with zero mocking requirements.
3. **Controlled Endpoint Response when Disabled**:
   - If a request is sent to `POST /api/auth/google` while `googleAuthEnabled === false`:
     ```json
     {
       "success": false,
       "code": "GOOGLE_AUTH_DISABLED",
       "message": "Google authentication is not enabled on this server."
     }
     ```
     Status: `503 Service Unavailable`.
4. **Production Configuration**:
   - Production deployments set `GOOGLE_AUTH_ENABLED=true` and provide `GOOGLE_CLIENT_ID`.
   - If `GOOGLE_AUTH_ENABLED=true` but `GOOGLE_CLIENT_ID` is omitted, the backend fails fast at boot.

---

## 6. Security Threats and Mitigations

| Threat | Attack Scenario | Mitigation Strategy |
|---|---|---|
| **Token Forgery / Spoofing** | Attacker crafts a fake JWT with arbitrary `sub` or `email`. | Backend uses `google-auth-library` to cryptographically verify signature against Google's public JWKS certificates. |
| **Audience Mismatch (Cross-App Token Reuse)** | Attacker uses a valid ID token obtained from a different Google OAuth app. | Backend enforces `audience === env.googleClientId`. Tokens issued for other apps are rejected. |
| **Token Replay / Expiration** | Attacker re-uses an intercepted Google ID token after expiration. | Backend checks `payload.exp > Math.floor(Date.now() / 1000)`. |
| **CSRF on Google Endpoint** | Cross-site malicious post triggering unintended authentication. | 1. Mutating requests require `X-CSRF-Token`.<br/>2. Origin and `Sec-Fetch-Site` checks reject unauthorized cross-origin requests.<br/>3. `clearCsrfToken()` purges unauthenticated tokens post-login. |
| **Pre-hijacking / Account Takeover** | Attacker creates a password account with victim's email, waiting for victim to sign in via Google. | Automatic linking is strictly forbidden. Password confirmation required to link existing accounts (`409 Conflict`). |
| **Unverified Email Attack** | Attacker uses a custom domain Google Workspace account with an unverified alias. | Backend rejects any token where `payload.email_verified !== true`. |
| **Credential Exposure** | Google tokens or secrets leaked in frontend storage or logs. | 1. Zero client secret required for ID token flow.<br/>2. Google ID tokens are never stored in `localStorage` or `sessionStorage`.<br/>3. TripNow session relies solely on standard `HttpOnly` cookie. |
| **Clickjacking / Framing** | Attacker embeds TripNow in an iframe to trick user into Google auth. | Enterprise security headers: `X-Frame-Options: DENY`, `frame-ancestors 'none'`. |
| **Brute Force / DoS** | Automated bots flooding `/api/auth/google` with random tokens. | Route is wrapped in `authLimiter` (10 failed attempts / 15 min per IP). |

---

## 7. Frontend UI Plan

### Placement
The "Continue with Google" action should appear consistently across all three authentication entry points:
1. `frontend/src/pages/Login.jsx` (below form, separated by clean `"OR"` divider).
2. `frontend/src/pages/Signup.jsx` (below form, separated by clean `"OR"` divider).
3. `frontend/src/components/auth/AuthPromptModal.jsx` (inline in the modal for seamless trip-saving auth).

### Button Specification
- Visual standard compliant with Google Identity Guidelines:
  - White background, `1px solid rgba(0,0,0,0.12)` border, `14px` font size.
  - Multi-colored Google "G" SVG icon (`18px x 18px`).
  - Text: `"Continue with Google"`.
  - Font: `'DM Sans', sans-serif`, weight `600`.
- Component: `frontend/src/components/auth/GoogleSignInButton.jsx`.

### UX State Machine

```
[Idle] ── User Clicks ──> [Google Popup]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Popup Closed / Cancelled]          [Token Received]
            │                                 │
      Display Notice                          ▼
                                   [Backend Calling / Loading]
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            [200/201 Success]         [409 Linking Req]         [Error / 503]
                    │                         │                         │
            Save Profile &            Prompt Password to         Display Error
            Navigate to Trip          Link Account               Banner
```

### State Details
- **Loading State**: Button displays a subtle spinner with `"Connecting to Google..."` and disables form inputs.
- **Popup Closed / Cancelled**: User closing the popup without signing in triggers a gentle, non-blocking toast or banner: `"Google sign-in was cancelled."`
- **Popup Blocked**: If browser popup blockers prevent opening the window, prompt: `"Popup was blocked. Please allow popups for TripNow."`
- **Configuration Unavailable**: If `VITE_GOOGLE_CLIENT_ID` is omitted or feature is disabled, the button is cleanly hidden without rendering layout artifacts.
- **Linking Prompt UX**: If `409 Conflict` (`ACCOUNT_EXISTS_LINKING_REQUIRED`) is returned, the UI shifts focus to the password field with a clear notification:
  > *"An account with this email already exists. Please enter your password to sign in and link your Google account."*
- **Draft & Route Preservation**: Retains `location.state.stagedTrip`, `location.state.tripId`, and `returnTo` so users returning from Google auth seamlessly restore their unsaved itinerary!

---

## 8. Backend API Plan

### 1. Public Authentication Route: `POST /api/auth/google`
- **Access**: Public
- **Rate Limit**: `authLimiter`
- **Validation Schema**:
  ```javascript
  const googleAuthSchema = z.object({
    idToken: z.string().min(1, "Google ID token is required"),
  });
  ```
- **Handler Flow**:
  1. Check `env.googleAuthEnabled`. If `false`, return `503 Service Unavailable`.
  2. Validate request body against `googleAuthSchema`.
  3. Verify `idToken` via `googleClient.verifyIdToken({ idToken, audience: env.googleClientId })`.
  4. Extract `{ sub, email, email_verified, name, picture } = payload`.
  5. Check `email_verified === true`. If `false`, return `400 Bad Request`.
  6. Look up user by `googleId: sub`.
     - If found: generate TripNow JWT, set cookie, return `200 OK`.
  7. If not found by `googleId`, look up user by `email: email.toLowerCase()`.
     - If found: return `409 Conflict` (`ACCOUNT_EXISTS_LINKING_REQUIRED`).
  8. If not found by `googleId` or `email`:
     - Create user:
       ```javascript
       const user = await User.create({
         name: name || email.split("@")[0],
         email: email.toLowerCase(),
         googleId: sub,
         avatar: picture,
         isVerified: true,
       });
       ```
     - Generate TripNow JWT, set cookie, return `201 Created`.

### 2. Authenticated Account Linking Route: `POST /api/auth/google/link`
- **Access**: Private (`protect` middleware, requires valid session cookie)
- **CSRF**: Strictly enforced (`X-CSRF-Token` + origin verification)
- **Rate Limit**: `authLimiter`
- **Handler Flow**:
  1. Verify `idToken` via Google client.
  2. Verify that verified Google email matches authenticated `req.user.email`.
  3. Check if another user already has this `googleId`:
     ```javascript
     const existing = await User.findOne({ googleId: sub, _id: { $ne: req.user._id } });
     if (existing) {
       return res.status(409).json({
         success: false,
         code: "GOOGLE_ID_ALREADY_LINKED",
         message: "This Google account is already linked to another TripNow profile.",
       });
     }
     ```
  4. Set `req.user.googleId = sub`.
  5. If `!req.user.isVerified && email_verified`, set `req.user.isVerified = true`.
  6. If `picture && !req.user.avatar`, set `req.user.avatar = picture`.
  7. Save user, return `200 OK` with updated profile.

---

## 9. Testing Plan

### Automated Test Suite: `backend/tests/googleAuth.test.js`
All tests will run in-memory using `MongoMemoryServer` and mock `google-auth-library` so no external network calls or real Google credentials are required in CI.

| # | Test Scenario | Mock Input | Expected Outcome |
|---|---|---|---|
| 1 | Feature disabled | `env.googleAuthEnabled = false` | `503 Service Unavailable`, `code: GOOGLE_AUTH_DISABLED` |
| 2 | New user registration | Valid ID token, new email | `201 Created`, user created with `isVerified: true`, `token` HttpOnly cookie set |
| 3 | Returning Google user | Valid ID token, existing `googleId` | `200 OK`, `token` HttpOnly cookie set, user returned |
| 4 | Existing password user collision | Valid ID token, email matches password user | `409 Conflict`, `code: ACCOUNT_EXISTS_LINKING_REQUIRED`, no cookie set |
| 5 | Authenticated account link | Valid cookie + valid ID token with matching email | `200 OK`, `user.googleId` updated in DB |
| 6 | Linking collision | ID token `sub` already linked to another account | `409 Conflict`, `code: GOOGLE_ID_ALREADY_LINKED` |
| 7 | Unverified email | ID token with `email_verified: false` | `400 Bad Request`, `code: UNVERIFIED_EMAIL` |
| 8 | Invalid signature / malformed token | Mock `verifyIdToken` throws error | `401 Unauthorized`, `message: "Invalid or expired Google token"` |
| 9 | Audience mismatch | Token audience does not match `GOOGLE_CLIENT_ID` | `401 Unauthorized` |
| 10 | Missing ID token | `{}` empty body | `400 Bad Request` validation failure |
| 11 | Cookie security attributes | Inspect `set-cookie` header | Contains `HttpOnly`, `SameSite=Lax`, `Path=/` |
| 12 | CSRF token invalidation | Check frontend interceptor contract | `clearCsrfToken()` called on `/api/auth/google` success |
| 13 | Rate limiting enforcement | 11 failed attempts | 11th request rejected with `429 Too Many Requests` |
| 14 | Regression check | Password signup, login, reset, and bookings | 100% existing tests continue to pass |

---

## 10. Exact Files Expected to Change

### Backend
1. `backend/package.json`: Add dependency `google-auth-library`.
2. `backend/config/env.js`: Add `googleAuthEnabled` and `googleClientId` validation.
3. `backend/models/User.js`: Add `googleId` (unique, sparse), conditional `password` requirement, and `avatar`.
4. `backend/validators/authValidators.js`: Add `googleAuthSchema`.
5. `backend/controllers/authController.js`: Add `googleAuth` and `googleLink` controller methods.
6. `backend/routes/authRoutes.js`: Register `POST /google` and `POST /google/link`.
7. `backend/middleware/csrf.js`: Add `/api/auth/google` to unauthenticated exempt paths.
8. `backend/.env.example`: Document `GOOGLE_AUTH_ENABLED` and `GOOGLE_CLIENT_ID`.
9. `backend/tests/googleAuth.test.js`: New 14-test verification suite.

### Frontend
1. `frontend/index.html`: Pre-connect to `https://accounts.google.com` (or load GIS client asynchronously).
2. `frontend/src/lib/api.js`: Add `/api/auth/google` to `clearCsrfToken()` URL triggers in response interceptor.
3. `frontend/src/components/auth/GoogleSignInButton.jsx`: New reusable GIS button component.
4. `frontend/src/pages/Login.jsx`: Mount `GoogleSignInButton` with divider.
5. `frontend/src/pages/Signup.jsx`: Mount `GoogleSignInButton` with divider.
6. `frontend/src/components/auth/AuthPromptModal.jsx`: Mount `GoogleSignInButton` with divider.
7. `frontend/.env.example`: Document `VITE_GOOGLE_CLIENT_ID`.

---

## 11. Rollback Strategy

1. **Zero-Code Operational Kill-Switch**:
   - In Render dashboard, set `GOOGLE_AUTH_ENABLED=false` (or remove `GOOGLE_AUTH_ENABLED`).
   - The backend immediately disables the Google authentication endpoint, returning HTTP 503 without requiring a redeployment or restart downtime.
2. **Database Rollback Safety**:
   - `googleId` is configured with `sparse: true`. Existing password accounts are unaffected.
   - Removing the Google integration code does not break any existing database records or indexes.
3. **Code Rollback**:
   - Clean `git revert` of the Phase 5B implementation branch cleanly restores Phase 5A baseline.

---

## 12. Remaining Decisions Requiring User Input

Before implementing Phase 5B, the following design decisions are submitted for approval:

1. **Google Identity Services (GIS) UI Style**:
   - *Option A (Recommended)*: Explicit branded button (`"Continue with Google"`) rendered directly in Login, Signup, and AuthModal.
   - *Option B*: Automatic Google One Tap prompt appearing in the top-right corner on page load.
   - *Architect recommendation*: Option A. One Tap can conflict with modal focus traps, trigger ad-blocker false positives, and confuse users on mobile.
2. **Account Linking Confirmation UX**:
   - When an unlinked password user attempts Google Sign-In, the system responds with `ACCOUNT_EXISTS_LINKING_REQUIRED`.
   - *Option A (Recommended)*: Redirect them to the standard password login form with an informative banner: *"An account with this email already exists. Please log in with your password to link your Google account."* Once authenticated, automatically prompt to complete the link.
   - *Option B*: Prompt for password in an immediate secondary popup dialog.
   - *Architect recommendation*: Option A. Maximizes code reuse, avoids duplicate modal state, and leverages existing battle-tested login logic.
3. **Avatar Synchronization**:
   - *Option A (Recommended)*: Store Google avatar URL in `user.avatar` and display in `Header.jsx`.
   - *Option B*: Discard avatar URL and continue displaying initials.
   - *Architect recommendation*: Option A. Improves personalized user experience with zero performance impact.

