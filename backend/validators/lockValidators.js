// backend/validators/lockValidators.js
const { z } = require("zod");

const lockActivitySchema = z
  .object({
    tripId: z
      .string({ required_error: "tripId is required" })
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid tripId: must be a 24-character hexadecimal ObjectId"),
    activityId: z
      .string({ required_error: "activityId is required" })
      .trim()
      .min(1, "activityId cannot be empty")
      .max(100, "activityId cannot exceed 100 characters"),
    locked: z.boolean({
      required_error: "locked status is required (boolean: true or false)",
      invalid_type_error: "locked must be a boolean",
    }),
  })
  .strict({ message: "Unrecognized client fields are not permitted" });

module.exports = {
  lockActivitySchema,
};
