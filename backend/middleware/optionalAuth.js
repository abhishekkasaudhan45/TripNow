const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");
const { AUTH_COOKIE_NAME } = require("../config/authCookie");

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    token = req.cookies[AUTH_COOKIE_NAME];
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return next();

  try {
    // 🔒 SEC-05: Enforce explicit algorithm, issuer, and audience claims
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    const user = await User.findById(decoded.id).select("-password");

    // 🔒 SEC-01: Session invalidation check after password change or reset
    if (user && user.passwordChangedAt) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        // Token was invalidated by password change -> treat caller as unauthenticated guest
        return next();
      }
    }

    req.user = user;
  } catch (_) {
    // Invalid/expired token -> fall back to guest
  }
  next();
};

module.exports = optionalAuth;
