const express = require("express");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const { csrfProtection } = require("./middleware/csrf");

const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { securityHeaders } = require("./middleware/security");
const { requestIdMiddleware } = require("./middleware/requestId");
const { payloadSecurity } = require("./middleware/payloadSecurity");
const { globalLimiter } = require("./middleware/rateLimiters");

const app = express();

app.set("trust proxy", 1);

app.disable("x-powered-by");

// 1. Request correlation ID + structured request logging
app.use(requestIdMiddleware);

// 2. Enterprise HTTP Security Headers (Helmet CSP, HSTS, frameguard, etc.)
app.use(securityHeaders);

// 3. Strict CORS — Validated allowed origins from env config
const allowedOrigins = env.allowedOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (curl/Postman) and same-origin requests with no Origin header.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("🔒 CORS blocked unauthorized origin:", origin);
        const err = new Error(`CORS: origin ${origin} not allowed`);
        err.statusCode = 403;
        return callback(err);
      }
    },
    credentials: true,
  })
);

// 4. HTTP Compression
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// 5. JSON Body Parser with 50kb limit (accommodates rich multi-day itineraries)
// Includes reviver preventing prototype pollution attacks at parse-time
app.use(
  express.json({
    limit: "50kb",
    reviver: (key, value) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        const err = new Error("Invalid payload: forbidden prototype property detected.");
        err.statusCode = 400;
        err.type = "prototype.pollution.detected";
        throw err;
      }
      return value;
    },
  })
);

// 6. Payload Security: Content-Type enforcement, prototype pollution defense, query param sanitization
app.use(payloadSecurity);

// 7. Cookie Parser for HttpOnly Auth Cookie
app.use(cookieParser());

// 8. CSRF Protection Middleware
app.use(csrfProtection);

// Root endpoints
app.get("/", (req, res) => {
  res.send("Travel API Running ✅");
});

app.get("/api", (req, res) => {
  res.json({ message: "API working ✅", timestamp: new Date().toISOString() });
});

// 9. Global Rate Limiter
app.use("/api", globalLimiter);

// 10. API Routes
app.use("/api", apiRoutes);

// 11. Error Handling Pipeline
app.use(notFound);
app.use(errorHandler);

module.exports = app;
