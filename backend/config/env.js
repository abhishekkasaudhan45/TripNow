const path = require("path");
const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const isProduction =
  (process.env.NODE_ENV || "").trim().toLowerCase() === "production";

const requiredVariables = [
  "MONGO_URI",
  "JWT_SECRET",
  "ADMIN_PASSWORD",
  "ADMIN_EMAIL",
  ...(isProduction ? ["FIX_DAY_PROPOSAL_SECRET", "CSRF_SECRET"] : []),
];
const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}`
  );
}

// 🔒 Dedicated CSRF Secret Validation
const validateCsrfSecret = () => {
  const secret = process.env.CSRF_SECRET;
  if (isProduction) {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "CSRF_SECRET must be configured in production with at least 32 characters."
      );
    }
    if (secret === process.env.JWT_SECRET) {
      throw new Error(
        "CSRF_SECRET must be independent and cannot be identical to JWT_SECRET in production."
      );
    }
    return secret;
  }
  return secret || "dev_csrf_secret_fallback_minimum_32bytes_safe_entropy";
};

const parseAllowedOrigins = () => {
  const rawOrigins = process.env.CLIENT_URL || "http://localhost:5173";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const googleAuthEnabled =
  (process.env.GOOGLE_AUTH_ENABLED || "").trim().toLowerCase() === "true";
const googleClientId = process.env.GOOGLE_CLIENT_ID
  ? process.env.GOOGLE_CLIENT_ID.trim()
  : undefined;

if (googleAuthEnabled && !googleClientId) {
  throw new Error(
    "GOOGLE_AUTH_ENABLED is set to true, but GOOGLE_CLIENT_ID is not configured."
  );
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn:
    process.env.JWT_EXPIRES_IN !== undefined
      ? process.env.JWT_EXPIRES_IN
      : "2h",
  jwtIssuer: "tripnow-api",
  jwtAudience: "tripnow-client",
  adminPassword: process.env.ADMIN_PASSWORD,
  allowedOrigins: parseAllowedOrigins(),
  // First allowed origin is treated as the canonical client URL for email links.
  clientUrl: parseAllowedOrigins()[0] || "http://localhost:5173",
  isProduction: (process.env.NODE_ENV || "").trim().toLowerCase() === "production",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  geminiFallbackModel:
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite",
  csrfSecret: validateCsrfSecret(),

  fixDayProposalSecret:
    process.env.FIX_DAY_PROPOSAL_SECRET ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : "dev_fix_day_proposal_secret_key_32bytes_minimum_safe"),

  // Cloudinary Storage (optional; falls back safely in dev/test)
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryUrl: process.env.CLOUDINARY_URL,

  // Google OAuth / GIS configuration
  googleAuthEnabled,
  googleClientId,
};
