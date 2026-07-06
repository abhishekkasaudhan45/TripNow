const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiters");

// 🛡️ Phase 2 Validation Additions
const { validate } = require("../middleware/validate");
const { signupSchema, loginSchema } = require("../validators/authValidators");

const {
  signup,
  login,
  getMe,
} = require("../controllers/authController");

// 🔐 Public Registration Route (Rate Limited → Data Validated → Account Created)
router.post("/signup", authLimiter, validate(signupSchema), signup);

// 🔐 Public Login Route (Rate Limited → Credentials Validated → Token Issued)
router.post("/login", authLimiter, validate(loginSchema), login);

// 🔑 Private Route (Token Authenticated)
router.get("/me", protect, getMe);

module.exports = router;