const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiters");

// 🛡️ Phase 2 Validation Additions
const { validate } = require("../middleware/validate");
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validators/authValidators");

const {
  signup,
  login,
  getMe,
} = require("../controllers/authController");

const {
  forgotPassword,
  resetPassword,
  verifyEmail,
} = require("../controllers/passwordController");

// 🔐 Public Registration Route (Rate Limited → Data Validated → Account Created)
router.post("/signup", authLimiter, validate(signupSchema), signup);

// 🔐 Public Login Route (Rate Limited → Credentials Validated → Token Issued)
router.post("/login", authLimiter, validate(loginSchema), login);

// 🔑 Password reset (Rate Limited → Validated). Never reveals if an email exists.
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

// ✉️ Email verification (link from the verification email)
router.get("/verify-email", verifyEmail);

// 🔑 Private Route (Token Authenticated)
router.get("/me", protect, getMe);

module.exports = router;