const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");
const { AUTH_COOKIE_NAME } = require("../config/authCookie");

const protect = async (req, res, next) => {
  // Suppress debug logging outside local development (production + test runs)
  const quiet = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test";

  let token;
  // 1. Primary: Extract from secure HttpOnly cookie
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    token = req.cookies[AUTH_COOKIE_NAME];
  }
  // 2. Fallback: Extract from Authorization Bearer header (transition & non-browser clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    if (!quiet) {
      console.error("🔴 REJECTED: Missing token in cookie or Authorization header.");
    }
    return res.status(401).json({
      success: false,
      message: "Not authorized, token missing",
    });
  }

  try {
    // 🔒 SEC-05: Enforce explicit algorithm, issuer, and audience claims
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      if (!quiet) {
        console.error("🔴 REJECTED: User associated with this token no longer exists.");
      }
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // 🔒 SEC-01: Session invalidation check after password change or reset
    if (req.user.passwordChangedAt) {
      const changedTimestamp = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        if (!quiet) {
          console.error("🔴 REJECTED: User recently changed password. Token invalidated.");
        }
        return res.status(401).json({
          success: false,
          message: "Not authorized, session invalidated due to password change. Please log in again.",
        });
      }
    }

    if (!quiet) {
      console.log(`✅ AUTH SUCCESS: Welcome ${req.user.email}`);
    }
    
    next();
  } catch (error) {
    if (!quiet) {
      console.error("🔴 REJECTED (CRASH):", error.message);
    }
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid or expired token",
    });
  }
};

module.exports = protect;
