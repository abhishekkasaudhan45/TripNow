const crypto = require("crypto");
const User = require("../models/User");
const env = require("../config/env");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../utils/email");

// Generate a raw token (goes in the email link) + its SHA-256 hash (stored in DB).
// Only the hash is persisted, so a database leak can't be used to reset accounts.
const makeToken = () => {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
};

const hashToken = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

// Fire a verification email for a freshly created user. Best-effort:
// failures are logged inside the email util and never block signup.
const issueVerificationEmail = async (user) => {
  const { raw, hash } = makeToken();
  user.verifyTokenHash = hash;
  user.verifyTokenExpires = new Date(Date.now() + ONE_DAY);
  await user.save();

  const link = `${env.clientUrl}/verify-email?token=${raw}`;
  await sendVerificationEmail({ toEmail: user.email, toName: user.name, link });
};

// @desc    Request a password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond identically — never reveal whether an email is registered.
    if (user) {
      const { raw, hash } = makeToken();
      user.resetTokenHash = hash;
      user.resetTokenExpires = new Date(Date.now() + ONE_HOUR);
      await user.save();

      const link = `${env.clientUrl}/reset-password?token=${raw}`;
      await sendPasswordResetEmail({
        toEmail: user.email,
        toName: user.name,
        link,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, a reset link is on its way.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset the password using a valid token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const hash = hashToken(token);

    const user = await User.findOne({
      resetTokenHash: hash,
      resetTokenExpires: { $gt: new Date() },
    }).select("+resetTokenHash +resetTokenExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    // The pre-save hook hashes the new password.
    user.password = password;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated. You can now sign in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify an email address
// @route   GET /api/auth/verify-email?token=...
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Verification token is missing." });
    }

    const hash = hashToken(token);
    const user = await User.findOne({
      verifyTokenHash: hash,
      verifyTokenExpires: { $gt: new Date() },
    }).select("+verifyTokenHash +verifyTokenExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This verification link is invalid or has expired.",
      });
    }

    user.isVerified = true;
    user.verifyTokenHash = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Email verified successfully. Thank you!" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  issueVerificationEmail,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
