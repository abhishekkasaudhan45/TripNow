const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    // 👇 Added to link the trip to a specific user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    destination: {
      type: String,
      required: true,
    },
    budget: String,

    itinerary: [
      {
        day: Number,
        activity: String,
      },
    ],

    rawResponse: String, // original AI text (optional)

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);