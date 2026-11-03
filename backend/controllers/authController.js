const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const env = require("../config/env");
const { issueVerificationEmail } = require("./passwordController");
const {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} = require("../config/authCookie");

// 🔒 SEC-02 & SEC-05: Centralized token generation with configured lifetime, issuer, and audience
const generateToken = (id, role) => {
  return jwt.sign(
    { id: id.toString(), role },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      algorithm: "HS256",
    }
  );
};

// @desc    Register a new user (Sign Up)
// @route   POST /api/auth/signup
const signup = async (req, res, next) => {
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

    // Best-effort verification email — never block signup if email fails.
    try {
      await issueVerificationEmail(user);
    } catch (mailError) {
      console.error("✉️  Verification email failed (non-blocking):", mailError.message);
    }

    // Generate Token safely
    const token = generateToken(user._id, user.role);

    // Set secure HttpOnly cookie (never exposed to browser JavaScript)
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
    });

  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error("User with this email already exists");
      duplicateError.statusCode = 400;
      return next(duplicateError);
    }
    next(error);
  }
};

// @desc    Authenticate user (Login)
// @route   POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password" });
    }

    // 🔒 SEC-04: Explicitly project password hash for credential comparison
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Generate Token safely
    const token = generateToken(user._id, user.role);

    // Set secure HttpOnly cookie (never exposed to browser JavaScript)
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user: { id: user._id, name: user.name, email: user.email, role: user.role } },
    });

  } catch (error) {
    next(error);
  }
};

// ✅ ADDED: Get current logged in user details
// @route   GET /api/auth/me
const getMe = async (req, res, next) => {
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
    next(error);
  }
};

// @desc    Logout user / clear auth cookie
// @route   POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// Google OAuth verification client
let googleClientInstance = null;
const getGoogleClient = () => {
  if (!googleClientInstance && env.googleClientId) {
    googleClientInstance = new OAuth2Client(env.googleClientId);
  }
  return googleClientInstance;
};

const verifyGoogleIdToken = async (idToken) => {
  if (!env.googleClientId) {
    const error = new Error("Google Client ID is not configured on the server.");
    error.statusCode = 500;
    throw error;
  }

  const client = getGoogleClient() || new OAuth2Client(env.googleClientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    const error = new Error("Failed to extract payload from Google token.");
    error.statusCode = 401;
    throw error;
  }

  // Validate accepted issuers
  const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
  if (!validIssuers.includes(payload.iss)) {
    const error = new Error("Invalid token issuer.");
    error.statusCode = 401;
    throw error;
  }

  // Validate exact configured audience
  if (payload.aud !== env.googleClientId) {
    const error = new Error("Invalid token audience.");
    error.statusCode = 401;
    throw error;
  }

  // Validate token expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp <= now) {
    const error = new Error("Google token has expired.");
    error.statusCode = 401;
    throw error;
  }

  // Validate stable subject identifier
  if (!payload.sub || typeof payload.sub !== "string") {
    const error = new Error("Invalid Google subject identifier.");
    error.statusCode = 401;
    throw error;
  }

  // Validate verified email claim
  if (!payload.email_verified) {
    const error = new Error("Google account email is not verified.");
    error.statusCode = 400;
    error.code = "UNVERIFIED_EMAIL";
    throw error;
  }

  return payload;
};

// @desc    Authenticate with Google (Sign Up or Log In)
// @route   POST /api/auth/google
const googleAuth = async (req, res, next) => {
  try {
    if (!env.googleAuthEnabled) {
      return res.status(503).json({
        success: false,
        code: "GOOGLE_AUTH_DISABLED",
        message: "Google authentication is not enabled on this server.",
      });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch (verifyError) {
      return res.status(verifyError.statusCode || 401).json({
        success: false,
        code: verifyError.code || "INVALID_GOOGLE_TOKEN",
        message: verifyError.message || "Invalid or expired Google token",
      });
    }

    const { sub, email, name, picture } = payload;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Existing Google user match
    let user = await User.findOne({ googleId: sub });
    if (user) {
      if (picture && !user.avatar) {
        user.avatar = picture;
        await user.save().catch(() => {});
      }

      const token = generateToken(user._id, user.role);
      res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
        },
      });
    }

    // 2. Existing password user collision: DO NOT automatically link (anti-takeover)
    const existingUserWithEmail = await User.findOne({ email: normalizedEmail });
    if (existingUserWithEmail) {
      return res.status(409).json({
        success: false,
        code: "ACCOUNT_EXISTS_LINKING_REQUIRED",
        message:
          "An account with this email already exists. Please log in with your password to link your Google account.",
      });
    }

    // 3. New user registration
    try {
      user = await User.create({
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId: sub,
        avatar: picture || undefined,
        isVerified: true,
      });
    } catch (createError) {
      if (createError.code === 11000) {
        return res.status(409).json({
          success: false,
          code: "ACCOUNT_EXISTS_LINKING_REQUIRED",
          message:
            "An account with this email already exists. Please log in with your password.",
        });
      }
      return next(createError);
    }

    const token = generateToken(user._id, user.role);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Explicitly link Google identity to active authenticated user account
// @route   POST /api/auth/google/link
const googleLink = async (req, res, next) => {
  try {
    if (!env.googleAuthEnabled) {
      return res.status(503).json({
        success: false,
        code: "GOOGLE_AUTH_DISABLED",
        message: "Google authentication is not enabled on this server.",
      });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch (verifyError) {
      return res.status(verifyError.statusCode || 401).json({
        success: false,
        code: verifyError.code || "INVALID_GOOGLE_TOKEN",
        message: verifyError.message || "Invalid or expired Google token",
      });
    }

    const normalizedGoogleEmail = payload.email.trim().toLowerCase();
    if (normalizedGoogleEmail !== req.user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_MISMATCH",
        message: "Google account email does not match your active TripNow account email.",
      });
    }

    const existingLinked = await User.findOne({
      googleId: payload.sub,
      _id: { $ne: req.user._id },
    });
    if (existingLinked) {
      return res.status(409).json({
        success: false,
        code: "GOOGLE_ID_ALREADY_LINKED",
        message: "This Google account is already linked to another TripNow profile.",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.googleId = payload.sub;
    if (!user.isVerified) {
      user.isVerified = true;
    }
    if (payload.picture && !user.avatar) {
      user.avatar = payload.picture;
    }

    try {
      await user.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        return res.status(409).json({
          success: false,
          code: "GOOGLE_ID_ALREADY_LINKED",
          message: "This Google account is already linked to another TripNow profile.",
        });
      }
      return next(saveError);
    }

    return res.status(200).json({
      success: true,
      message: "Google account linked successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  getMe,
  logout,
  generateToken,
  googleAuth,
  googleLink,
  verifyGoogleIdToken,
};
