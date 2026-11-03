const crypto = require("crypto");
const env = require("../config/env");
const { AUTH_COOKIE_NAME } = require("../config/authCookie");

/**
 * Generates an unpredictable, session-bound CSRF token.
 * Token structure: <16-byte-hex-salt>.<hmac-sha256-signature>
 * 
 * - Unpredictable: unique 128-bit random salt per token issuance (defeats BREACH / timing attacks).
 * - Session-Bound: HMAC covers both salt and the client's HttpOnly auth token.
 * - Stateless: zero server-side storage required.
 */
const generateCsrfToken = (authToken) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const payload = `${salt}:${authToken || "anon"}`;
  const hmac = crypto
    .createHmac("sha256", env.csrfSecret)
    .update(payload)
    .digest("hex");

  return `${salt}.${hmac}`;
};

/**
 * Verifies a client-provided CSRF token using timing-safe HMAC validation.
 */
const verifyCsrfToken = (clientToken, authToken) => {
  if (!clientToken || typeof clientToken !== "string") {
    return false;
  }

  const parts = clientToken.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, providedHmac] = parts;
  if (!salt || !providedHmac || salt.length !== 32 || providedHmac.length !== 64) {
    return false;
  }

  const payload = `${salt}:${authToken || "anon"}`;
  const expectedHmac = crypto
    .createHmac("sha256", env.csrfSecret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedHmac, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
  } catch (_) {
    return false;
  }
};

/**
 * Defense-in-depth: Validates Origin and Sec-Fetch-Site headers.
 */
const validateOriginAndFetchSite = (req) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // 1. Origin header check (primary)
  if (origin) {
    if (origin === "null" || !env.allowedOrigins.includes(origin)) {
      return { valid: false, reason: `Origin ${origin} is not allowed` };
    }
  } else if (referer) {
    // 2. Referer fallback check (when Origin omitted by browser policy)
    try {
      const refererOrigin = new URL(referer).origin;
      if (!env.allowedOrigins.includes(refererOrigin)) {
        return { valid: false, reason: `Referer origin ${refererOrigin} is not allowed` };
      }
    } catch (_) {
      return { valid: false, reason: "Malformed Referer header" };
    }
  }

  // 3. Sec-Fetch-Site check
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request rejected by Sec-Fetch-Site" };
  }

  return { valid: true };
};

/**
 * Express middleware enforcing CSRF protection on cookie-authenticated requests.
 */
const csrfProtection = (req, res, next) => {
  // 1. Safe HTTP methods (RFC 7231) are idempotent and read-only
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // 2. Explicitly exempted pre-authentication lifecycle endpoints
  // Note: /api/auth/logout is NOT exempted; cookie-authenticated logout requires CSRF validation.
  const rawPath = (req.originalUrl ? req.originalUrl.split("?")[0] : req.path || "").replace(/\/+$/, "");
  const EXEMPT_PATHS = [
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ];
  if (EXEMPT_PATHS.includes(rawPath)) {
    return next();
  }

  // 3. Inspect authentication mechanism
  const hasAuthCookie = Boolean(req.cookies && req.cookies[AUTH_COOKIE_NAME]);
  const hasBearerHeader = Boolean(req.headers.authorization && req.headers.authorization.startsWith("Bearer "));
  const isGoogleAuthEndpoint = rawPath === "/api/auth/google";

  // 🔒 STRICT CSRF ENFORCEMENT:
  // Enforced whenever:
  // 1. An auth cookie is present (ambient browser credentials active).
  // 2. OR the request targets /api/auth/google (enforcing anonymous session CSRF bootstrap).
  if (hasAuthCookie || isGoogleAuthEndpoint) {
    // A. Origin & Fetch Metadata Check (Defense-in-depth)
    const originCheck = validateOriginAndFetchSite(req);
    if (!originCheck.valid) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: ${originCheck.reason}`,
        code: "CSRF_ORIGIN_INVALID",
      });
    }

    // B. Cryptographic CSRF Token Check
    const clientToken = req.headers["x-csrf-token"];
    if (!clientToken) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: CSRF token missing from request header",
        code: "CSRF_TOKEN_MISSING",
      });
    }

    const authToken = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;
    const isValid = verifyCsrfToken(clientToken, authToken);
    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID",
      });
    }

    return next();
  }

  // 4. Non-browser Bearer-authenticated client (cURL, tests, CLI)
  // Browsers do not attach Authorization Bearer headers on ambient cross-origin requests.
  if (hasBearerHeader) {
    return next();
  }

  // 5. Unauthenticated mutating request on a protected route -> fall through to downstream auth middleware (401)
  return next();
};

/**
 * Controller to issue a CSRF token.
 * Route: GET /api/csrf-token
 */
const getCsrfTokenHandler = (req, res) => {
  const authToken = req.cookies?.[AUTH_COOKIE_NAME] || null;
  const csrfToken = generateCsrfToken(authToken);

  return res.status(200).json({
    success: true,
    csrfToken,
  });
};

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
  validateOriginAndFetchSite,
  csrfProtection,
  getCsrfTokenHandler,
};
