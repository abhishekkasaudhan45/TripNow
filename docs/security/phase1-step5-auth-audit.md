# TripNow — Phase 1 Step 5: Authentication & Authorization Security Audit

**Document:** `docs/security/phase1-step5-auth-audit.md`  
**Role:** Senior Application Security Engineer  
**Date:** October 31, 2026  
**Scope:** Complete read-only audit of authentication lifecycle, session management, authorization, IDOR boundaries, password recovery, and token revocation.  
**Baseline Status:** 15 test suites passing (242/242 tests), frontend production build passing.

---

## 1. Executive Summary

A comprehensive read-only security audit of TripNow's authentication, authorization, and session architecture was conducted following the completion of Phase 1 Steps 1–4. 

The audit examined the full authentication lifecycle across signup, login, logout, `/me`, password recovery, email verification, ownership checks, role-based access control, CSRF protections, and cookie handling.

### Key Positive Findings
- **Server-Side Database Role Validation:** Protected routes do not blindly trust the `role` embedded in the JWT payload. The `protect` middleware ([`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js)) re-queries `User.findById(decoded.id)` fresh on each request. Consequently, administrative demotions or account deletions take effect immediately on the next incoming request.
- **Robust Password Reset Token Architecture:** Password reset tokens use cryptographically secure 32-byte entropy (`crypto.randomBytes(32)`). Only the SHA-256 hash of the token is persisted in MongoDB ([`backend/controllers/passwordController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/passwordController.js)), preventing token exposure via database dumps. Tokens are single-use, strictly expired after 1 hour, and cleared upon successful password update.
- **Strict Cookie & Anti-CSRF Precedence:** The session cookie is `HttpOnly`, `SameSite=Lax`, host-only, and conditionally `Secure` in production. Mutating requests carrying the cookie strictly require an HMAC-SHA256 CSRF token cryptographically bound to that session. An attacker cannot bypass CSRF protection by injecting a dummy Authorization Bearer header.
- **Ownership Verification on Private Resources:** Bookings ([`backend/controllers/bookingController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/bookingController.js)) and saved trips ([`backend/controllers/tripController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/tripController.js)) enforce backend query-level scoping (`{ _id: id, user: req.user._id }`), ensuring User A cannot read, edit, share, or delete User B's itineraries.

### Key Vulnerabilities & Security Gaps Identified
- **High:** **Lack of JWT Revocation on Password Reset / Password Change.** When a user resets or changes their password, previously issued JWTs remain valid for up to 30 days. In an account takeover recovery scenario, an attacker who previously obtained a token retains access after the legitimate user changes their password.
- **High:** **Discrepancy Between Configured JWT Lifetime (`2h`) and Hardcoded Token Issuance (`30d`).** `env.jwtExpiresIn` defaults to `"2h"` (and is configured in deployment environments), but `authController.js` hardcodes `expiresIn: "30d"`, creating an unnecessarily large window of exposure for access tokens and giving operators a false sense of security.
- **Medium:** **Account Enumeration on User Registration (`/api/auth/signup`).** Registration returns HTTP 400 with `"User with this email already exists"`, enabling email harvesting against the platform.
- **Medium:** **`password` Field Not Excluded by Default in Schema (`select: false` Missing).** While current controllers explicitly use `.select("-password")` or manual destructuring, `password` lacks `select: false` in `models/User.js`. Any future query returning the raw Mongoose document risks leaking the bcrypt hash.
- **Medium:** **Missing JWT `issuer` (`iss`) and `audience` (`aud`) Claims.** Tokens lack semantic cryptographic domain boundaries, allowing cross-service token reuse if the secret is ever shared.
- **Low:** **Lack of Account Suspension / Deactivation Mechanism.** The `User` model lacks an `isActive` or `isBlocked` flag, preventing administrators from temporarily disabling compromised accounts.
- **Low:** **Unauthenticated Guest Trip Tampering Window.** Guest itineraries have `booking.user === null`. In `pivotService.js` and `lockService.js`, the check `if (trip.user)` is bypassed when `user` is null, allowing anyone with knowledge of a guest `tripId` to pivot or lock activities before an account claims it.

---

## 2. Files and Routes Inspected

### Backend Codebase
- **Models:**
  - [`backend/models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js) (User schema, bcrypt hashing hooks, password comparison methods)
  - [`backend/models/Booking.js`](file:///d:/all%20project/Travel%20Website/backend/models/Booking.js) (Authoritative trip and itinerary model, ownership references)
  - [`backend/models/Trip.js`](file:///d:/all%20project/Travel%20Website/backend/models/Trip.js) (Legacy trip model, user ownership references)
- **Controllers:**
  - [`backend/controllers/authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js) (`signup`, `login`, `getMe`, `logout`, token generation)
  - [`backend/controllers/passwordController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/passwordController.js) (`forgotPassword`, `resetPassword`, `verifyEmail`, token hashing)
  - [`backend/controllers/bookingController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/bookingController.js) (CRUD operations, ownership scoping, sharing controls)
  - [`backend/controllers/tripController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/tripController.js) (User trip CRUD, ownership scoping, field allowlisting)
  - [`backend/controllers/Sharedtripcontroller.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/Sharedtripcontroller.js) (Public shared trip serialization, privacy DTO projection)
  - [`backend/controllers/aiController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/aiController.js) (AI generation, reality scoring, pivot, activity lock, fix-day)
- **Middleware & Services:**
  - [`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js) (Cookie-first JWT verification, database user lookup)
  - [`backend/middleware/optionalAuth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/optionalAuth.js) (Non-blocking auth extraction for guest/user AI endpoints)
  - [`backend/middleware/requireAdmin.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/requireAdmin.js) (Role authorization gate)
  - [`backend/middleware/csrf.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/csrf.js) (HMAC CSRF verification, origin/fetch metadata checks)
  - [`backend/middleware/rateLimiters.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/rateLimiters.js) (`authLimiter`, `passwordResetLimiter`, `sharedTripLimiter`)
  - [`backend/middleware/validateObjectId.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/validateObjectId.js) (ObjectId parameter validation)
  - [`backend/middleware/payloadSecurity.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/payloadSecurity.js) (Content-Type, prototype pollution, NoSQL query operator protection)
  - [`backend/middleware/security.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/security.js) (Helmet CSP, HSTS, CORS)
  - [`backend/services/pivotService.js`](file:///d:/all%20project/Travel%20Website/backend/services/pivotService.js) (`loadTripAndAuthorize`, AI pivot logic)
  - [`backend/services/lockService.js`](file:///d:/all%20project/Travel%20Website/backend/services/lockService.js) (Activity lock toggles, ownership check)
  - [`backend/services/fixDayService.js`](file:///d:/all%20project/Travel%20Website/backend/services/fixDayService.js) (Day proposal preview and application authorization)
- **Configuration & Validators:**
  - [`backend/config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js) (Environment variable resolution, production validation)
  - [`backend/config/authCookie.js`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js) (Cookie configuration and clearing attributes)
  - [`backend/validators/authValidators.js`](file:///d:/all%20project/Travel%20Website/backend/validators/authValidators.js) (Zod schemas for signup, login, password recovery)

### Frontend Codebase
- [`frontend/src/utils/auth.js`](file:///d:/all%20project/Travel%20Website/frontend/src/utils/auth.js) (Client user profile storage, token extraction stub)
- [`frontend/src/lib/api.js`](file:///d:/all%20project/Travel%20Website/frontend/src/lib/api.js) (Axios interceptor, CSRF header attachment, retry logic)
- [`frontend/src/components/ProtectedRoute.jsx`](file:///d:/all%20project/Travel%20Website/frontend/src/components/ProtectedRoute.jsx) (Client-side routing guard, `/api/auth/me` verification)
- [`frontend/src/pages/Login.jsx`](file:///d:/all%20project/Travel%20Website/frontend/src/pages/Login.jsx) & [`frontend/src/pages/Signup.jsx`](file:///d:/all%20project/Travel%20Website/frontend/src/pages/Signup.jsx) (Credentials handling)
- [`frontend/src/pages/Admin.jsx`](file:///d:/all%20project/Travel%20Website/frontend/src/pages/Admin.jsx) (Admin panel authentication handling)

---

## 3. Findings Matrix

| Finding ID | Severity | Category | Status | Summary |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **HIGH** | Session Revocation | **Confirmed Vulnerability** | Password reset/change does not invalidate existing active JWTs. |
| **SEC-02** | **HIGH** | Session Lifecycle | **Confirmed Vulnerability** | Hardcoded 30-day token lifetime ignores configured `JWT_EXPIRES_IN` (2h). |
| **SEC-03** | **MEDIUM** | Information Disclosure | **Confirmed Vulnerability** | Registration endpoint exposes account existence via explicit error message. |
| **SEC-04** | **MEDIUM** | Defensive Hardening | **Potential Risk** | `User` schema does not declare `select: false` on `password`. |
| **SEC-05** | **MEDIUM** | Cryptographic Claims | **Potential Risk** | JWT signatures lack `issuer` (`iss`) and `audience` (`aud`) validation claims. |
| **SEC-06** | **LOW** | Account Management | **Potential Risk** | No account suspension (`isActive`) attribute to disable rogue accounts. |
| **SEC-07** | **LOW** | Authorization Scope | **Potential Risk** | Unauthenticated guest itineraries (`trip.user === null`) can be altered by any visitor. |
| **SEC-08** | **LOW** | Schema Validation | **Potential Risk** | Zod authentication schemas lack `.strict()`, allowing unrecognized payload fields. |
| **SEC-09** | **INFORMATIONAL**| Architecture Review | **Confirmed Safe** | Server re-checks database role on every request; demotions are instantaneous. |
| **SEC-10** | **INFORMATIONAL**| Architecture Review | **Confirmed Safe** | Reset tokens are SHA-256 hashed in database and single-use with 1-hour expiry. |

---

## 4. Detailed Findings & Evidence

### SEC-01 [HIGH]: Lack of JWT Revocation on Password Reset / Password Change
- **Classification:** Confirmed Vulnerability
- **Affected Files:**
  - [`backend/controllers/passwordController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/passwordController.js#L68-L101) (lines 68–101)
  - [`backend/models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js#L4-L37) (lines 4–37)
  - [`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js#L30-L50) (lines 30–50)
- **Evidence:**
  In [`passwordController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/passwordController.js):
  ```javascript
  // resetPassword controller
  user.password = password;
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  ```
  In [`models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js):
  The `User` schema has no timestamp field such as `passwordChangedAt` or integer field such as `tokenVersion`.
  In [`middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js):
  ```javascript
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  req.user = await User.findById(decoded.id).select("-password");
  if (!req.user) { ... }
  next();
  ```
- **Exploit Scenario:**
  1. An attacker gains access to a user's session token (e.g. from an unlocked workstation, browser session theft, or compromised device).
  2. The legitimate user detects unauthorized activity and performs a password reset via `/api/auth/forgot-password` and `/api/auth/reset-password`.
  3. The legitimate user's password changes successfully in MongoDB.
  4. The attacker continues making requests with their existing JWT. Because `auth.js` only checks `jwt.verify()` signature and verifies `User.findById(decoded.id)` exists, the attacker remains fully authenticated for up to 30 days despite the password change.
- **Recommended Remediation:**
  1. Add `passwordChangedAt: { type: Date }` to `userSchema`.
  2. In `User.js`, update `passwordChangedAt = new Date(Date.now() - 1000)` inside the `pre("save")` hook whenever `this.isModified("password")`.
  3. In `auth.js`, after verifying the signature, check:
     ```javascript
     if (req.user.passwordChangedAt) {
       const changedTimestamp = parseInt(req.user.passwordChangedAt.getTime() / 1000, 10);
       if (decoded.iat < changedTimestamp) {
         return res.status(401).json({
           success: false,
           message: "User recently changed password. Please log in again.",
         });
       }
     }
     ```

---

### SEC-02 [HIGH]: Discrepancy Between Configured JWT Lifetime (`2h`) and Hardcoded Token Issuance (`30d`)
- **Classification:** Confirmed Vulnerability
- **Affected Files:**
  - [`backend/controllers/authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js#L12-L14) (lines 12–14)
  - [`backend/config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js#L66) (line 66)
  - [`backend/config/authCookie.js`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js#L4) (line 4)
- **Evidence:**
  In [`config/env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js):
  ```javascript
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  ```
  In [`controllers/authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js):
  ```javascript
  const generateToken = (id, role) => {
    return jwt.sign({ id: id.toString(), role }, env.jwtSecret, { expiresIn: "30d" });
  };
  ```
- **Exploit Scenario / Operational Risk:**
  - 30 days is excessive for a stateless access token without refresh token rotation. If an access token leaks (via logs, client compromise, or backup inspection), the blast radius spans 720 hours.
  - Operators setting `JWT_EXPIRES_IN=2h` in production environment variables are under the false impression that tokens expire in 2 hours, while the application actually issues 30-day tokens.
- **Recommended Remediation:**
  - Change `generateToken` in `authController.js` to strictly respect `env.jwtExpiresIn`.
  - Align cookie max age (`COOKIE_MAX_AGE_MS`) with the token lifetime or implement a short-lived access token + rotated refresh token strategy if 30-day persistent login is a core business requirement.

---

### SEC-03 [MEDIUM]: Account Enumeration on User Registration (`/api/auth/signup`)
- **Classification:** Confirmed Vulnerability
- **Affected Files:**
  - [`backend/controllers/authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js#L26-L29) (lines 26–29)
- **Evidence:**
  In [`authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js):
  ```javascript
  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: "User with this email already exists" });
  }
  ```
- **Exploit Scenario:**
  An adversary targeting an individual or organization can submit a list of corporate/personal emails to `POST /api/auth/signup`. For existing users, the server responds with `"User with this email already exists"`. For non-existent users, it responds with 201 Created or validation failure. This allows an attacker to build an enumeration database of registered accounts.
- **Recommended Remediation:**
  - While many B2C web apps allow registration enumeration to prompt users to log in, high-assurance security standards recommend either:
    1. Returning a generic response (e.g., `"Account registration processed. Please check your email to continue."`) and sending an email indicating the account already exists.
    2. Or applying strict IP-based and target-based rate limiting on `/signup` (our newly hardened `authLimiter` restricts attempts to 10 per 15 minutes, which provides defense-in-depth mitigation).

---

### SEC-04 [MEDIUM]: `password` Field Not Excluded by Default in Mongoose User Schema
- **Classification:** Potential Risk
- **Affected Files:**
  - [`backend/models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js#L16-L20) (lines 16–20)
- **Evidence:**
  In [`models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js):
  ```javascript
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
  },
  ```
  `verifyTokenHash` and `resetTokenHash` correctly specify `select: false`. However, `password` does not.
- **Risk Assessment:**
  Existing controllers currently defend against this manually (e.g. `User.findById(...).select("-password")` in `auth.js` and manual projection in `authController.js`). However, this relies on every future route developer remembering to explicitly suppress `password`. Any unprojected query (`User.findById(id)` or `User.find()`) returned in a future API endpoint would inadvertently expose bcrypt hashes.
- **Recommended Remediation:**
  Update `password` in `userSchema` to include `select: false`:
  ```javascript
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
    select: false,
  },
  ```
  In `authController.js:login`, explicitly include the password for comparison: `User.findOne({ email }).select("+password")`.

---

### SEC-05 [MEDIUM]: Missing JWT `issuer` (`iss`) and `audience` (`aud`) Claims
- **Classification:** Potential Risk
- **Affected Files:**
  - [`backend/controllers/authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js#L12-L14) (lines 12–14)
  - [`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js#L30-L33) (lines 30–33)
  - [`backend/middleware/optionalAuth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/optionalAuth.js#L16-L18) (lines 16–18)
- **Evidence:**
  `jwt.sign()` in `authController.js` only provides `{ id, role }` without `issuer` or `audience` options.
  `jwt.verify()` in `auth.js` only specifies `{ algorithms: ["HS256"] }`.
- **Risk Assessment:**
  Without `iss` and `aud`, tokens lack cryptographic domain tagging. If `JWT_SECRET` is ever shared or reused across another microservice or internal tool, a token generated for one application would be blindly trusted by TripNow.
- **Recommended Remediation:**
  Specify `issuer: "tripnow-api"` and `audience: "tripnow-client"` in `jwt.sign()` and enforce both during `jwt.verify()`.

---

### SEC-06 [LOW]: Lack of Account Suspension / Deactivation Mechanism
- **Classification:** Potential Risk
- **Affected Files:**
  - [`backend/models/User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js)
  - [`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js)
- **Evidence:**
  The `User` model tracks `isVerified` and `role`, but contains no `isActive`, `isBlocked`, or `status` property.
- **Risk Assessment:**
  If an administrator discovers a rogue or compromised account, there is no way to disable login or API access other than permanently deleting the user record from the database.
- **Recommended Remediation:**
  Add `isActive: { type: Boolean, default: true }` to `userSchema`. In `auth.js`, verify `if (!req.user.isActive) return res.status(403).json({ success: false, message: "Account is suspended" });`.

---

### SEC-07 [LOW]: Unauthenticated Guest Trip Tampering Window
- **Classification:** Potential Risk
- **Affected Files:**
  - [`backend/services/pivotService.js`](file:///d:/all%20project/Travel%20Website/backend/services/pivotService.js#L58-L63) (lines 58–63)
  - [`backend/services/lockService.js`](file:///d:/all%20project/Travel%20Website/backend/services/lockService.js#L18-L22) (lines 18–22)
  - [`backend/services/fixDayService.js`](file:///d:/all%20project/Travel%20Website/backend/services/fixDayService.js#L210-L214) (lines 210–214)
- **Evidence:**
  ```javascript
  // If the trip belongs to a user, caller must match
  if (trip.user) {
    const callerId = user?._id ? user._id.toString() : null;
    if (!callerId || trip.user.toString() !== callerId) {
      throw new PivotError("You are not authorized to modify this trip", 403);
    }
  }
  ```
  When a guest generates an itinerary without logging in, `trip.user` is `null`. The authorization guard `if (trip.user)` evaluates to `null` (falsy) and skips validation entirely.
- **Risk Assessment:**
  Anyone possessing a guest `tripId` (such as via shoulder surfing, shared browser history, or sequential enumeration if UUIDs were predictable) could execute pivots or lock activities on that guest's itinerary before it is saved to an account.
- **Recommended Remediation:**
  For unauthenticated guest sessions, set an ephemeral signed guest cookie or token when the trip is generated, and verify that guest token in `pivotService`/`lockService` when `trip.user` is null.

---

### SEC-08 [LOW]: Zod Authentication Schemas Lack `.strict()`
- **Classification:** Potential Risk
- **Affected Files:**
  - [`backend/validators/authValidators.js`](file:///d:/all%20project/Travel%20Website/backend/validators/authValidators.js#L4-L33) (lines 4–33)
- **Evidence:**
  `signupSchema`, `loginSchema`, `forgotPasswordSchema`, and `resetPasswordSchema` do not call `.strict()`.
- **Risk Assessment:**
  Controllers mitigate this by explicitly destructuring required fields (`const { name, email, password } = req.body`), preventing mass assignment. However, unexpected extra properties pass through the validation middleware without being stripped or rejected.
- **Recommended Remediation:**
  Add `.strict()` to all auth Zod schemas so requests with unexpected fields are rejected with HTTP 400.

---

## 5. Confirmed Safe Architecture Controls

### SEC-09 [INFORMATIONAL]: Instantaneous Administrative Role Revocation
- **Evidence:** [`backend/middleware/auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js#L33) line 33 and [`backend/middleware/requireAdmin.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/requireAdmin.js) line 3.
- **Finding:** While the JWT payload contains `role`, `requireAdmin` does NOT check `decoded.role`. It checks `req.user.role`, which is fetched fresh from MongoDB via `User.findById(decoded.id)`. If an administrator demotes a user from `"admin"` to `"user"`, access to `/api/admin/*` is revoked **instantly on their next request** without waiting for the JWT to expire.

### SEC-10 [INFORMATIONAL]: Modern Password Reset Token Hashing
- **Evidence:** [`backend/controllers/passwordController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/passwordController.js#L11-L15) lines 11–15 and lines 76–80.
- **Finding:** Reset tokens are generated via `crypto.randomBytes(32)` (256 bits of entropy). Only the SHA-256 hash is persisted in MongoDB (`resetTokenHash`). When the user submits their reset link, the server computes `crypto.createHash("sha256").update(token).digest("hex")` and performs a lookup with an expiry check (`resetTokenExpires: { $gt: new Date() }`). Once used, the hash and expiry are immediately cleared.

### SEC-11 [INFORMATIONAL]: CSRF Binding & Strict Precedence
- **Evidence:** [`backend/middleware/csrf.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/csrf.js#L114-L151).
- **Finding:** If an authentication cookie is present, ambient browser credentials are active. The middleware strictly enforces Origin/Fetch-Metadata verification and cryptographic session-bound HMAC validation. An attacker cannot bypass CSRF protection by including an arbitrary Authorization Bearer header when an auth cookie is present.

---

## 6. Recommended Prioritized Action Plan

```
Priority 1 (High):
├── SEC-01: Add passwordChangedAt to User model & check decoded.iat in auth.js (Session Revocation)
└── SEC-02: Align generateToken with env.jwtExpiresIn and cookie maxAge (Token Lifespan)

Priority 2 (Medium):
├── SEC-04: Add select: false to password in User schema; use .select("+password") in login (Schema Defense)
├── SEC-05: Configure issuer and audience in jwt.sign and jwt.verify (Domain Tagging)
└── SEC-03: Address signup enumeration based on product privacy requirements (Target Enumeration)

Priority 3 (Low):
├── SEC-06: Add isActive flag to User model and auth middleware (Account Suspension)
├── SEC-08: Add .strict() to Zod auth schemas (Mass Assignment Defense)
└── SEC-07: Bind guest trip modifications to an ephemeral session (Guest Trip Integrity)
```

---

## 7. Recommended Test Specifications for Phase 1 Step 5 Implementation

When approved for implementation, the following targeted automated regression tests should be added to [`backend/tests/auth.test.js`](file:///d:/all%20project/Travel%20Website/backend/tests/auth.test.js) and [`backend/tests/cookieAuth.test.js`](file:///d:/all%20project/Travel%20Website/backend/tests/cookieAuth.test.js):

1. **Password Reset Session Invalidation Test:**
   - Sign up a user and obtain token $T_1$.
   - Successfully execute password reset via `/api/auth/reset-password`.
   - Issue an authenticated request to `/api/auth/me` using token $T_1$.
   - *Assert:* Request returns HTTP 401 Unauthorized with `"User recently changed password"`.
   - Log in with the new password to obtain token $T_2$.
   - *Assert:* Token $T_2$ succeeds with HTTP 200.
2. **JWT Expiration & Lifetime Alignment Test:**
   - Call `authController.generateToken()` or inspect the decoded payload of a newly issued login token.
   - *Assert:* Token expiration (`exp - iat`) matches `env.jwtExpiresIn` rather than hardcoded 30 days.
3. **Password Default Exclusion Test:**
   - Perform a clean `User.findById(user._id).lean()` query without projection.
   - *Assert:* `user.password` is `undefined`.
4. **JWT Issuer & Audience Verification Test:**
   - Issue a request with a JWT containing an invalid `iss` or `aud`.
   - *Assert:* `auth.js` rejects with HTTP 401.
5. **Account Suspension Test:**
   - Set `user.isActive = false` in the database.
   - Issue an authenticated request to `/api/auth/me`.
   - *Assert:* Request is rejected with HTTP 403 Forbidden.
6. **Zod Strict Schema Test:**
   - Send `POST /api/auth/signup` with an unrecognized field (`{ ...user, hackerProperty: true }`).
   - *Assert:* Validator returns HTTP 400 Bad Request.

---

## 8. Audit Sign-Off

The read-only audit was completed and approved for remediation in Phase 1 Step 5A.
- Approved for implementation: SEC-01, SEC-02, SEC-04, SEC-05.
- Deferred (outside current scope): SEC-03, SEC-06, SEC-07, SEC-08.

---

## 9. Implementation & Verification (Step 5A)

### Approved Scope Implemented

| ID | Issue | Remediation Applied | Files Changed |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Lack of JWT revocation on password change/reset | Added `passwordChangedAt` to `User` model, updated `pre("save")` hook to set timestamp on password modification (`!this.isNew`), and added `iat < passwordChangedAt` invalidation checks in `auth.js` and `optionalAuth.js`. | [`User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js), [`auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js), [`optionalAuth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/optionalAuth.js) |
| **SEC-02** | Hardcoded 30d JWT lifetime ignoring `JWT_EXPIRES_IN` | Replaced hardcoded `"30d"` with `env.jwtExpiresIn` in `authController.generateToken`. Added safe duration-to-ms parser (`parseDurationToMs`) to keep cookie `maxAge` synchronized with token expiration. | [`authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js), [`authCookie.js`](file:///d:/all%20project/Travel%20Website/backend/config/authCookie.js) |
| **SEC-04** | Password hash not excluded by default | Added `select: false` to `password` in `User.js`. Added explicit `.select("+password")` in `authController.js:login` so authentication functions normally while arbitrary database queries exclude password hashes by default. | [`User.js`](file:///d:/all%20project/Travel%20Website/backend/models/User.js), [`authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js) |
| **SEC-05** | Missing JWT `iss` and `aud` claims | Defined `jwtIssuer: "tripnow-api"` and `jwtAudience: "tripnow-client"` in `env.js`. Embedded claims into all tokens in `generateToken`, and enforced verification in `auth.js` and `optionalAuth.js`. | [`env.js`](file:///d:/all%20project/Travel%20Website/backend/config/env.js), [`authController.js`](file:///d:/all%20project/Travel%20Website/backend/controllers/authController.js), [`auth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/auth.js), [`optionalAuth.js`](file:///d:/all%20project/Travel%20Website/backend/middleware/optionalAuth.js) |

### Deferred Scope (Unchanged)
- **SEC-03 (Signup Account Enumeration):** Deferred pending product decision on generic vs specific registration error feedback.
- **SEC-06 (Account Deactivation `isActive`):** Deferred; no schema or authorization flags introduced.
- **SEC-07 (Guest Trip Tampering Window):** Deferred to guest session hardening roadmap.
- **SEC-08 (Zod Schema `.strict()`):** Deferred to API input validation hardening phase.

### Security Posture: Before vs After

| Dimension | Before Step 5A | After Step 5A |
| :--- | :--- | :--- |
| **Session Revocation** | Tokens remained valid for 30 days even if user reset password during an active account takeover. | Tokens issued prior to password reset/change are immediately rejected (HTTP 401). |
| **Access Token Lifespan** | Hardcoded to 30 days regardless of `env.jwtExpiresIn`. | Respects configurable `env.jwtExpiresIn` (defaults to 2h) with synchronized cookie `maxAge`. |
| **Credential Defense-in-Depth** | `User.password` returned in queries unless manually excluded with `.select("-password")`. | `User.password` excluded by default (`select: false`); requires explicit `.select("+password")`. |
| **Token Domain Isolation** | Tokens lacked issuer and audience; vulnerable to cross-service replay if secrets were shared. | Tokens strictly validated against `iss: "tripnow-api"` and `aud: "tripnow-client"`. |
| **Legacy User Compatibility** | N/A | Users without `passwordChangedAt` authenticate safely without false rejections. |

### Test Verification Results

1. **Targeted Authentication Regression Suite (`tests/auth.test.js`, `tests/password.test.js`, `tests/cookieAuth.test.js`):**
   - **Result:** 3/3 suites passed, 40/40 tests passed.
   - Verified session invalidation on password reset (SEC-01).
   - Verified legacy user without `passwordChangedAt` support (SEC-01).
   - Verified `passwordChangedAt` not populated on initial signup (SEC-01).
   - Verified token expiration matches `env.jwtExpiresIn` and cookie alignment (SEC-02).
   - Verified default exclusion of `password` in queries and `.select("+password")` login retrieval (SEC-04).
   - Verified JWT issuer and audience enforcement, and rejection of invalid issuer, audience, missing claims, or forged signatures (SEC-05).

2. **Security Middleware & CSRF Suites (`tests/securityMiddleware.test.js`, `tests/csrf.test.js`, `tests/sharedTripPrivacy.test.js`):**
   - **Result:** 3/3 suites passed, 71/71 tests passed.

3. **Full Backend Test Suite:**
   - **Result:** 15/15 test suites passed, 255/255 tests passed.

4. **Frontend Production Build:**
   - **Result:** Vite v7.3.1 build succeeded with 0 errors (`dist/` generated cleanly in 4.66s).


