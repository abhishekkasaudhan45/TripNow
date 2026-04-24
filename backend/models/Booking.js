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
    guests: {
      type: Number,
      required: [true, "Number of guests is required"],
      min: [1, "At least 1 guest is required"],
      validate: {
        validator: Number.isInteger,
        message: "Guests must be a whole number",
      },
    },
    checkin: {
      type: Date,
      required: [true, "Check-in date is required"],
      validate: {
        validator: isValidDate,
        message: "Check-in must be a valid date",
      },
    },
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
    // ✅ Optional field — stores AI-generated trip plan
    aiPlan: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);