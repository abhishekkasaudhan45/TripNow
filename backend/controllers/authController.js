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
    // 🪵 Log full error detail server-side on Render/terminal
    console.error("🔒 Signup Internal Error:", error);
    
    // 🛡️ Sanitized client-facing message (No internals leaked)
    return res.status(500).json({ 
      success: false, 
      message: "Something went wrong. Please try again." 
    });
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
    // 🪵 Log full error detail server-side on Render/terminal
    console.error("🔒 Login Internal Error:", error);
    
    // 🛡️ Sanitized client-facing message (No internals leaked)
    return res.status(500).json({ 
      success: false, 
      message: "Something went wrong. Please try again." 
    });
  }
};

// ✅ ADDED: Get current logged in user details
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    // req.user is set by the 'protect' middleware
    const user = await User.findById(req.user._id).select("-password").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      }
    });
  } catch (error) {
    // 🪵 Log full error detail server-side on Render/terminal
    console.error("🔒 GetMe Internal Error:", error);
    
    // 🛡️ Sanitized client-facing message (No internals leaked)
    return res.status(500).json({ 
      success: false, 
      message: "Something went wrong. Please try again." 
    });
  }
};

module.exports = { signup, login, getMe };