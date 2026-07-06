
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = await User.findById(decoded.id).select("-password");
  } catch (_) {
  }
  next();
};

module.exports = optionalAuth;