// backend/models/ItineraryCache.js
const mongoose = require("mongoose");

const itineraryCacheSchema = new mongoose.Schema(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    destination: {
      type: String,
      required: true,
    },
    daysCount: {
      type: Number,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    rawText: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: "14d", // Automatically deleted by MongoDB after 14 days
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ItineraryCache", itineraryCacheSchema);