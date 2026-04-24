const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const protect = async (req, res, next) => {
  // 🔍 X-RAY LOGS: Let's see exactly what is hitting the server!
  console.log("-----------------------------------------");
  console.log(`🛡️ AUTH MIDDLEWARE TRIGGERED FOR: ${req.method} ${req.originalUrl}`);
  console.log("📨 INCOMING HEADERS:", req.headers.authorization ? req.headers.authorization : "❌ NO AUTH HEADER FOUND!");
  
  const authHeader = req.headers.authorization;

  // 1. Silent Check (Now Loud)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("🔴 REJECTED: Missing or malformed Authorization header.");
    console.log("-----------------------------------------");
    return res.status(401).json({
      success: false,
      message: "Not authorized, token missing",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    
    // 2. Decode Token
    const decoded = jwt.verify(token, env.jwtSecret);
    
    // 3. Find User
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      console.error("🔴 REJECTED: User associated with this token no longer exists.");
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    console.log(`✅ AUTH SUCCESS: Welcome ${req.user.email}`);
    console.log("-----------------------------------------");
    next();
  } catch (error) {
    console.error("🔴 REJECTED (CRASH):", error.message);
    console.log("-----------------------------------------");
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid or expired token",
    });
  }
};

module.exports = protect;