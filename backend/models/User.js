const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false, // 🔒 SEC: Excluded by default from queries
    },
    avatar: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [
        function () {
          return !this.googleId;
        },
        "Password is required",
      ],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // 🔒 SEC-04: Excluded by default from queries
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // ── Session invalidation on password change (SEC-01) ──
    passwordChangedAt: {
      type: Date,
    },

    // ── Email verification (non-blocking) ──
    isVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpires: { type: Date, select: false },

    // ── Password reset ──
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash password before saving to MongoDB & update passwordChangedAt on existing documents
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // 🔒 SEC-01: Update timestamp on password change/reset for existing users.
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
});

// Compare input passwords with hashed database password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Sparse indexes for token lookups (ARCH-05)
// Only documents with active values are indexed, avoiding index bloat.
userSchema.index({ resetTokenHash: 1 }, { sparse: true });
userSchema.index({ verifyTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
