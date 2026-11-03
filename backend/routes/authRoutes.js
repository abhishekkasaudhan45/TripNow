const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { authLimiter, passwordResetLimiter } = require("../middleware/rateLimiters");

// 🛡️ Phase 2 Validation Additions
const { validate } = require("../middleware/validate");
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
} = require("../validators/authValidators");

const {
  signup,
  login,
  getMe,
  logout,
  googleAuth,
  googleLink,
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

// 🌐 Google Identity Services Authentication (Rate Limited → Validated → JWT Cookie Issued)
router.post("/google", authLimiter, validate(googleAuthSchema), googleAuth);

// 🔗 Google Account Linking (Protected → Rate Limited → Validated → Linked)
router.post("/google/link", protect, authLimiter, validate(googleAuthSchema), googleLink);

// 🚪 Logout Route (Clears Auth HttpOnly Cookie)
router.post("/logout", logout);

// 🔑 Password reset (Rate Limited → Validated). Never reveals if an email exists.
router.post("/forgot-password", passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", passwordResetLimiter, validate(resetPasswordSchema), resetPassword);

// ✉️ Email verification (link from the verification email)
router.get("/verify-email", verifyEmail);

// 🔑 Private Route (Token Authenticated)
router.get("/me", protect, getMe);

module.exports = router;
