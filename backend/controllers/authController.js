const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

// 🔥 FIXED: Converted MongoDB ObjectId to a clean string
const generateToken = (id, role) => {
  return jwt.sign({ id: id.toString(), role }, env.jwtSecret, { expiresIn: "30d" });
};

// @desc    Register a new user (Sign Up)
// @route   POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Please provide all required fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    // Create user in MongoDB
    const user = await User.create({ name, email, password });

    // Generate Token safely
    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
    });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server Error during signup" });
  }
};

// @desc    Authenticate user (Login)
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Generate Token safely
    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server Error during login" });
  }
};

module.exports = { signup, login };