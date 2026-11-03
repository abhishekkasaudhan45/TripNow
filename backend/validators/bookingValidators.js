// backend/validators/bookingValidators.js
const { z } = require("zod");
const {
  ALLOWED_ACTIVITY_TYPES,
  ALLOWED_TRAVEL_MODES,
  ALLOWED_INTENSITIES,
} = require("../utils/itineraryNormalizer");

const isValidDateString = (val) => {
  if (typeof val !== "string" && !(val instanceof Date)) return false;
  const d = new Date(val);
  return !Number.isNaN(d.getTime());
};

const createBookingSchema = z
  .object({
    destination: z
      .string({ required_error: "Destination is required" })
      .trim()
      .min(1, "Destination cannot be empty")
      .max(120, "Destination cannot exceed 120 characters"),
    checkin: z
      .string({ required_error: "Check-in date is required" })
      .refine(isValidDateString, { message: "Check-in must be a valid date" }),
    checkout: z
      .string({ required_error: "Check-out date is required" })
      .refine(isValidDateString, { message: "Check-out must be a valid date" }),
    guests: z.coerce
      .number({ required_error: "Number of guests is required" })
      .int("Guests must be a whole number")
      .min(1, "At least 1 guest is required")
      .max(100, "Guests cannot exceed 100"),
    budget: z
      .union([z.string().trim(), z.number().nonnegative("Budget cannot be negative")])
      .optional()
      .nullable(),
    fullName: z.string().trim().max(100).optional().nullable(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid email")
      .optional()
      .nullable()
      .or(z.literal("")),
    phone: z.string().trim().max(30).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    dayCount: z.coerce.number().int().min(1).optional().nullable(),
    coverImage: z.string().trim().max(500).optional().nullable(),
    isShared: z.boolean().optional(),
    tripData: z.any().optional(),
    aiPlan: z.any().optional(),
    user: z.any().optional(), // stripped / overridden server-side
  })
  .refine(
    (data) => new Date(data.checkout) > new Date(data.checkin),
    {
      message: "Check-out date must be after check-in date",
      path: ["checkout"],
    }
  );

const updateBookingSchema = z
  .object({
    destination: z
      .string()
      .trim()
      .min(1, "Destination cannot be empty")
      .max(120, "Destination cannot exceed 120 characters")
      .optional(),
    checkin: z
      .string()
      .refine(isValidDateString, { message: "Check-in must be a valid date" })
      .optional(),
    checkout: z
      .string()
      .refine(isValidDateString, { message: "Check-out must be a valid date" })
      .optional(),
    guests: z.coerce
      .number()
      .int("Guests must be a whole number")
      .min(1, "At least 1 guest is required")
      .max(100, "Guests cannot exceed 100")
      .optional(),
    budget: z
      .union([z.string().trim(), z.number().nonnegative("Budget cannot be negative")])
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    fullName: z.string().trim().max(100).optional().nullable(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid email")
      .optional()
      .nullable()
      .or(z.literal("")),
    phone: z.string().trim().max(30).optional().nullable(),
    dayCount: z.coerce.number().int().min(1).optional().nullable(),
    coverImage: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.checkin && data.checkout) {
        return new Date(data.checkout) > new Date(data.checkin);
      }
      return true;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkout"],
    }
  );

const activitySchema = z
  .object({
    id: z.string().optional(),
    period: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional().nullable(),
    activityType: z
      .enum(ALLOWED_ACTIVITY_TYPES, {
        errorMap: () => ({
          message: `Invalid activityType. Allowed values: ${ALLOWED_ACTIVITY_TYPES.join(", ")}`,
        }),
      })
      .optional()
      .nullable(),
    durationMinutes: z
      .number({ invalid_type_error: "durationMinutes must be a number" })
      .int("durationMinutes must be an integer")
      .min(15, "durationMinutes must be between 15 and 720")
      .max(720, "durationMinutes must be between 15 and 720")
      .optional()
      .nullable(),
    travelMode: z
      .enum(ALLOWED_TRAVEL_MODES, {
        errorMap: () => ({
          message: `Invalid travelMode. Allowed values: ${ALLOWED_TRAVEL_MODES.join(", ")}`,
        }),
      })
      .optional()
      .nullable(),
    intensity: z
      .enum(ALLOWED_INTENSITIES, {
        errorMap: () => ({
          message: `Invalid intensity. Allowed values: ${ALLOWED_INTENSITIES.join(", ")}`,
        }),
      })
      .optional()
      .nullable(),
    cost: z.string().optional().nullable(),
    indoorOutdoor: z.string().optional().nullable(),
    location: z.any().optional().nullable(),
    locked: z.boolean().optional(),
  })
  .passthrough();

const itineraryPersistenceSchema = z.object({
  itinerary: z.union([
    z
      .string()
      .min(1, "Itinerary string cannot be empty")
      .superRefine((str, ctx) => {
        try {
          const parsed = JSON.parse(str);
          if (!parsed || typeof parsed !== "object") return;
          if (!Array.isArray(parsed.days)) return;
          parsed.days.forEach((day, dIdx) => {
            if (Array.isArray(day.activities)) {
              day.activities.forEach((act, aIdx) => {
                const res = activitySchema.safeParse(act);
                if (!res.success) {
                  res.error.issues.forEach((issue) => {
                    ctx.addIssue({
                      ...issue,
                      path: ["itinerary", "days", dIdx, "activities", aIdx, ...issue.path],
                    });
                  });
                }
              });
            }
          });
        } catch {
          // String is not JSON; let downstream handler process
        }
      }),
    z
      .object({
        days: z
          .array(
            z
              .object({
                day: z.coerce.number().int().positive("Day number must be positive"),
                title: z.string().optional(),
                morning: z.string().optional(),
                afternoon: z.string().optional(),
                evening: z.string().optional(),
                activities: z.array(activitySchema).optional(),
              })
              .passthrough()
          )
          .min(1, "Itinerary must contain at least one day"),
      })
      .passthrough(),
  ]),
  baseVersion: z.coerce
    .number({ required_error: "baseVersion is required for concurrency control" })
    .int("baseVersion must be an integer")
    .nonnegative("baseVersion must be non-negative"),
});

module.exports = {
  createBookingSchema,
  updateBookingSchema,
  itineraryPersistenceSchema,
};
