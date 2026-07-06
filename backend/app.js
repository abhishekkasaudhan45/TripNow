const express = require("express");
const cors = require("cors");
const compression = require("compression");

const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { securityHeaders } = require("./middleware/security");
const { globalLimiter } = require("./middleware/rateLimiters");

const app = express();

app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(securityHeaders);

// 🔒 STRICTOR CORS — Parsee comma-separated URLs from your environment variables
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (curl/Postman) and same-origin requests with no Origin header.
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("🔒 CORS blocked unauthorized origin:", origin);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

app.use(express.json({ limit: "10kb" }));
app.get("/", (req, res) => {
  res.send("Travel API Running ✅");
});

app.get("/api", (req, res) => {
  res.json({ message: "API working ✅", timestamp: new Date().toISOString() });
});

app.use("/api", globalLimiter);

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;