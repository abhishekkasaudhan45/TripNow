// backend/validators/pivotValidators.js
const { z } = require("zod");

const ALLOWED_BLOCKS = ["morning", "afternoon", "evening"];
const ALLOWED_REASONS = ["rain", "low_energy", "budget", "running_late", "closed", "custom"];

const pivotRequestSchema = z
  .object({
    tripId: z
      .string({ required_error: "tripId is required" })
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid tripId: must be a 24-character hexadecimal ObjectId"),
    activityId: z.string().trim().max(100).optional(),
    dayNumber: z
      .number({ invalid_type_error: "dayNumber must be an integer" })
      .int("dayNumber must be an integer")
      .min(1, "dayNumber must be at least 1")
      .optional(),
    block: z.enum(ALLOWED_BLOCKS, {
      errorMap: () => ({ message: `block must be one of: ${ALLOWED_BLOCKS.join(", ")}` }),
    }).optional(),
    pivotReason: z.enum(ALLOWED_REASONS, {
      errorMap: () => ({ message: `pivotReason must be one of: ${ALLOWED_REASONS.join(", ")}` }),
    }),
    customReason: z
      .string()
      .trim()
      .max(300, "customReason cannot exceed 300 characters")
      .optional()
      .nullable(),
  })
  .strict({ message: "Unrecognized client fields are not permitted" })
  .superRefine((data, ctx) => {
    if (!data.activityId) {
      if (data.dayNumber === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "dayNumber is required",
          path: ["dayNumber"],
        });
      }
      if (!data.block) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "block is required",
          path: ["block"],
        });
      }
    }
    if (data.pivotReason === "custom") {
      if (!data.customReason || data.customReason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customReason is required when pivotReason is 'custom'",
          path: ["customReason"],
        });
      }
    }
  });

module.exports = {
  pivotRequestSchema,
  ALLOWED_BLOCKS,
  ALLOWED_REASONS,
};
