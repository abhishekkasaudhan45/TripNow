// backend/middleware/rateLimiters.js
const rateLimit = require("express-rate-limit");

// Rate limiting is disabled during automated tests so the shared in-memory
// counter (tests run in a single process via --runInBand) can't cause flaky,
// order-dependent failures.
const skipInTest = () => process.env.NODE_ENV === "test";

// 🔴 Strict cap for the AI itinerary endpoint.
// Guests are still allowed, but capped hard per IP to protect the Groq quota + DB.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                    // 5 itinerary generations per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "You've hit the itinerary limit. Please try again in a few minutes.",
  },
  skip: skipInTest,
});

// 🔴 Strict cap for auth routes to stop brute-force on login/signup.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                       // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // only failed attempts count toward the limit
  message: {
    message: "Too many attempts. Please try again in a few minutes.",
  },
  skip: skipInTest,
});

// 🟡 Loose app-wide safety net for everything else.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
  skip: skipInTest,
});

module.exports = { aiLimiter, authLimiter, globalLimiter };