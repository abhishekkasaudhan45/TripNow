const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const requiredVariables = [
  "MONGO_URI",
  "JWT_SECRET",
  "ADMIN_PASSWORD",
  "ADMIN_EMAIL",
];
const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}`
  );
}

const parseAllowedOrigins = () => {
  const rawOrigins = process.env.CLIENT_URL || "http://localhost:5173";

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  adminPassword: process.env.ADMIN_PASSWORD,
  allowedOrigins: parseAllowedOrigins(),
  isProduction: process.env.NODE_ENV === "production",
};
