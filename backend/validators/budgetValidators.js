// backend/validators/budgetValidators.js
const { z } = require("zod");

/**
 * Zod validation schema for deterministic budget intelligence requests.
 * Rejects invalid, non-positive, or non-finite inputs with structured errors.
 * Ignores any client-supplied calculated values (never trust frontend math).
 */
const budgetCalculationSchema = z.object({
  totalBudget: z
    .union([z.number(), z.string()], {
      required_error: "totalBudget is required",
      invalid_type_error: "totalBudget must be a number or numeric string",
    })
    .refine(
      (val) => {
        if (typeof val === "number") {
          return Number.isFinite(val) && val > 0;
        }
        if (typeof val === "string") {
          const clean = val.replace(/[₹$€£¥,\s]/g, "").trim();
          if (!clean) return false;
          const num = Number(clean);
          return Number.isFinite(num) && num > 0;
        }
        return false;
      },
      {
        message: "totalBudget must be a finite positive number greater than 0",
      }
    ),
  days: z
    .number({
      required_error: "days is required",
      invalid_type_error: "days must be an integer",
    })
    .int("days must be an integer")
    .positive("days must be greater than 0"),
  guests: z
    .number({
      required_error: "guests is required",
      invalid_type_error: "guests must be an integer",
    })
    .int("guests must be an integer")
    .positive("guests must be greater than 0"),
  destination: z
    .string({
      required_error: "destination is required",
      invalid_type_error: "destination must be a string",
    })
    .trim()
    .min(1, "destination cannot be empty")
    .max(150, "destination name is too long"),
  currency: z
    .string()
    .trim()
    .max(10)
    .optional()
    .default("INR"),
});

module.exports = {
  budgetCalculationSchema,
};

