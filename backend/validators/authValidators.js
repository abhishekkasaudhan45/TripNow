// backend/validators/authValidators.js
const { z } = require("zod");

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().email("Please provide a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, "Invalid reset token"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};