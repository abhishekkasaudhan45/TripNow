// backend/middleware/rateLimiters.js
const rateLimit = require("express-rate-limit");

// Rate limiting is disabled during automated test runs so the in-memory
// counters do not cause order-dependent or concurrency test failures.
const skipInTest = () => process.env.NODE_ENV === "test";

// 🔴 Strict cap for the AI itinerary endpoint.
// Protects Google Gemini quota + backend compute.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You've hit the itinerary limit. Please try again in a few minutes.",
  },
  skip: skipInTest,
});

// 🔴 Strict cap for auth routes to prevent credential brute-forcing.
// Only failed attempts count toward the limit (skipSuccessfulRequests: true).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many attempts. Please try again in a few minutes.",
  },
  skip: skipInTest,
});

// 🔑 Dedicated rate limiter for password reset & recovery.
// Protects EmailJS quota and prevents email spam attacks.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password recovery attempts. Please try again in an hour.",
  },
  skip: skipInTest,
});

// 🌐 Dedicated rate limiter for public shared trips.
// Prevents scraping while maintaining fast access for genuine visitors.
const sharedTripLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests to shared trips. Please slow down.",
  },
  skip: skipInTest,
});

// 🟡 Loose app-wide safety net for general API traffic.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  skip: skipInTest,
});

// 💰 Dedicated rate limiter for deterministic budget calculations.
// Allows responsive client-side typing while protecting backend compute against brute-force DoS.
const budgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 calculations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many budget calculations. Please slow down.",
  },
  skip: skipInTest,
});

// 📝 Dedicated rate limiter for feedback submissions.
// Allows genuine user submissions while preventing automated spam.
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 submissions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many feedback submissions. Please try again later.",
  },
  skip: skipInTest,
});

module.exports = {
  aiLimiter,
  authLimiter,
  passwordResetLimiter,
  sharedTripLimiter,
  globalLimiter,
  budgetLimiter,
  feedbackLimiter,
};
