const mongoose = require("mongoose");

const isValidDate = (value) =>
  value instanceof Date && !Number.isNaN(value.getTime());

const bookingSchema = new mongoose.Schema(
  {
    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
      validate: {
        validator: (value) => typeof value === "string" && value.trim().length > 0,
        message: "Destination cannot be empty",
      },
    },
    // ⚠️ KEPT AS 'guests' to prevent breaking your Dashboard and controllers
    guests: {
      type: Number,
      required: [true, "Number of guests is required"],
      min: [1, "At least 1 guest is required"],
      validate: {
        validator: Number.isInteger,
        message: "Guests must be a whole number",
      },
    },
    // ⚠️ KEPT AS 'checkin' to prevent breaking your frontend calculations
    checkin: {
      type: Date,
      required: [true, "Check-in date is required"],
      validate: {
        validator: isValidDate,
        message: "Check-in must be a valid date",
      },
    },
    // ⚠️ KEPT AS 'checkout' to maintain compatibility
    checkout: {
      type: Date,
      required: [true, "Check-out date is required"],
      validate: [
        {
          validator: isValidDate,
          message: "Check-out must be a valid date",
        },
        {
          validator: function (value) {
            if (!isValidDate(value) || !isValidDate(this.checkin)) return true;
            return value > this.checkin;
          },
          message: "Check-out date must be after check-in date",
        },
      ],
    },

    // ✅ NEWLY ADDED FIELDS (Safe to add)
    budget:   { type: String, default: null },
    fullName: { type: String, trim: true },
    email:    { type: String, trim: true },
    phone:    { type: String, trim: true },
    notes:    { type: String, default: null },
    dayCount: { type: Number, default: 0 },
    tripData: { type: mongoose.Schema.Types.Mixed, default: null },

    // ✅ KEPT AS MIXED/OBJECT so your JSON AI responses don't break the UI
    aiPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);