const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "Anonymous Traveller",
      maxLength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxLength: [200, "Email cannot exceed 200 characters"],
    },
    category: {
      type: String,
      enum: {
        values: ["Bug", "Feature Request", "Experience", "Other"],
        message: "{VALUE} is not a valid feedback category",
      },
      default: "Experience",
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5",
      },
    },
    message: {
      type: String,
      required: [true, "Feedback message is required"],
      trim: true,
      minLength: [3, "Feedback message must be at least 3 characters"],
      maxLength: [2000, "Feedback message cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "resolved"],
      default: "new",
    },
    emailNotificationSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Feedback", feedbackSchema);

