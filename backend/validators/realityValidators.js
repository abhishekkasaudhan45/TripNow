// backend/validators/realityValidators.js
const { z } = require("zod");

const realityScoreSchema = z
  .object({
    tripId: z
      .string({ required_error: "tripId is required" })
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid tripId: must be a 24-character hexadecimal ObjectId"),
  })
  .strict({ message: "Unrecognized client fields are not permitted" });

module.exports = {
  realityScoreSchema,
};
