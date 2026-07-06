const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const protect = async (req, res, next) => {
  const isProd = process.env.NODE_ENV === "production";
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (!isProd) {
      console.error("🔴 REJECTED: Missing or malformed Authorization header.");
    }
    return res.status(401).json({
      success: false,
      message: "Not authorized, token missing",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    
    
    const decoded = jwt.verify(token, env.jwtSecret);
    
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      if (!isProd) {
        console.error("🔴 REJECTED: User associated with this token no longer exists.");
      }
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (!isProd) {
      console.log(`✅ AUTH SUCCESS: Welcome ${req.user.email}`);
    }
    
    next();
  } catch (error) {
    if (!isProd) {
      console.error("🔴 REJECTED (CRASH):", error.message);
    }
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid or expired token",
    });
  }
};

module.exports = protect;