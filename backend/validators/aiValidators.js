// backend/validators/aiValidators.js
const { z } = require("zod");

const aiTripSchema = z
  .object({
    prompt: z.string().trim().max(1000).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    budget: z.union([z.string(), z.number()]).optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.destination || data.prompt), {
    message: "Either a destination or a prompt is required",
    path: ["destination"],
  });

module.exports = { aiTripSchema };