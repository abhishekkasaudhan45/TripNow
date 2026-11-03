const env = require("./env");

const AUTH_COOKIE_NAME = "token";
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours default (7,200,000 ms)

/**
 * Safely parses duration strings (e.g. "2h", "30d", "15m", "60s", or positive ms numbers)
 * into milliseconds. Aligns cookie maxAge with JWT expiration.
 * - If duration is absent (undefined or null), returns documented default of 2 hours.
 * - If duration is invalid, zero, negative, NaN/Infinity, or has unsupported units, throws an Error
 *   to fail fast during application startup rather than silently using an unintended fallback.
 */
const parseDurationToMs = (duration) => {
  // Absent configuration: return documented default of 2h
  if (duration === undefined || duration === null) {
    return DEFAULT_DURATION_MS;
  }

  // Handle numeric milliseconds
  if (typeof duration === "number") {
    if (Number.isNaN(duration) || !Number.isFinite(duration)) {
      throw new Error(`Invalid JWT duration: numeric duration must be a finite number, received ${duration}`);
    }
    if (duration <= 0) {
      throw new Error(`Invalid JWT duration: numeric duration must be greater than 0, received ${duration}`);
    }
    return duration;
  }

  // Duration must be a string
  if (typeof duration !== "string") {
    throw new Error(`Invalid JWT duration: expected string or positive number, received ${typeof duration}`);
  }

  const trimmed = duration.trim();
  if (!trimmed) {
    throw new Error("Invalid JWT duration: duration string cannot be empty");
  }

  if (trimmed.startsWith("-")) {
    throw new Error(`Invalid JWT duration: duration cannot be negative, received "${duration}"`);
  }

  const match = trimmed.match(/^(\d+)\s*([a-zA-Z]+)?$/);
  if (!match) {
    throw new Error(
      `Invalid JWT duration format: "${duration}". Expected format like "2h", "30d", "15m", "60s".`
    );
  }

  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new Error(`Invalid JWT duration: duration value must be greater than 0, received "${duration}"`);
  }

  const unit = (match[2] || "s").toLowerCase();
  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(
        `Invalid JWT duration unit "${unit}" in "${duration}". Supported units are: s (seconds), m (minutes), h (hours), d (days).`
      );
  }
};

const COOKIE_MAX_AGE_MS = parseDurationToMs(env.jwtExpiresIn);

/**
 * Returns options for setting the authentication HttpOnly cookie.
 * In production: Secure=true, SameSite=Lax, HttpOnly=true, Path=/ (host-only)
 * In development/test: Secure=false to allow HTTP localhost requests.
 * maxAge strictly aligns with configured JWT lifetime.
 */
const getAuthCookieOptions = (customMaxAge = COOKIE_MAX_AGE_MS) => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  maxAge: customMaxAge,
  path: "/",
});

/**
 * Returns options for clearing the authentication cookie upon logout.
 * Attributes (path, sameSite, secure, httpOnly) must match the issuance options.
 */
const getClearAuthCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
});

module.exports = {
  AUTH_COOKIE_NAME,
  COOKIE_MAX_AGE_MS,
  parseDurationToMs,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
};
