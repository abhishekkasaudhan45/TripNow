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
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
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

// Hash password before saving to MongoDB
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare input passwords with hashed database password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);