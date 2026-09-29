// backend/validators/fixDayValidators.js
const { z } = require("zod");

const ALLOWED_REASONS = ["schedule_overload", "running_late", "custom"];
const ALLOWED_PERIODS = ["morning", "afternoon", "evening"];

const fixDayPreviewSchema = z
  .object({
    tripId: z
      .string({ required_error: "tripId is required" })
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid tripId: must be a 24-character hexadecimal ObjectId"),
    dayNumber: z
      .number({ required_error: "dayNumber is required", invalid_type_error: "dayNumber must be an integer" })
      .int("dayNumber must be an integer")
      .min(1, "dayNumber must be at least 1"),
    reason: z.enum(ALLOWED_REASONS, {
      errorMap: () => ({ message: `reason must be one of: ${ALLOWED_REASONS.join(", ")}` }),
    }),
    currentPeriod: z
      .enum(ALLOWED_PERIODS, {
        errorMap: () => ({ message: `currentPeriod must be one of: ${ALLOWED_PERIODS.join(", ")}` }),
      })
      .optional()
      .nullable(),
    delayMinutes: z
      .number({ invalid_type_error: "delayMinutes must be an integer" })
      .int("delayMinutes must be an integer")
      .min(15, "delayMinutes must be at least 15 minutes")
      .max(240, "delayMinutes cannot exceed 240 minutes")
      .optional()
      .nullable(),
    customReason: z
      .string()
      .trim()
      .max(300, "customReason cannot exceed 300 characters")
      .optional()
      .nullable(),
  })
  .strict({ message: "Unrecognized client fields are not permitted" })
  .superRefine((data, ctx) => {
    if (data.reason === "running_late") {
      if (!data.currentPeriod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "currentPeriod is required when reason is 'running_late'",
          path: ["currentPeriod"],
        });
      }
      if (typeof data.delayMinutes !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "delayMinutes is required when reason is 'running_late'",
          path: ["delayMinutes"],
        });
      }
    }

    if (data.reason === "custom") {
      if (!data.customReason || data.customReason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customReason is required when reason is 'custom'",
          path: ["customReason"],
        });
      }
    }
  });

const fixDayApplySchema = z
  .object({
    tripId: z
      .string({ required_error: "tripId is required" })
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid tripId: must be a 24-character hexadecimal ObjectId"),
    dayNumber: z
      .number({ required_error: "dayNumber is required", invalid_type_error: "dayNumber must be an integer" })
      .int("dayNumber must be an integer")
      .min(1, "dayNumber must be at least 1"),
    proposalToken: z
      .string({ required_error: "proposalToken is required" })
      .trim()
      .min(10, "proposalToken cannot be empty"),
  })
  .strict({ message: "Unrecognized client fields are not permitted" });

module.exports = {
  fixDayPreviewSchema,
  fixDayApplySchema,
  ALLOWED_REASONS,
  ALLOWED_PERIODS,
};
