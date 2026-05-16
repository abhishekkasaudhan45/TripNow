const express = require("express");
const cors = require("cors");
const compression = require("compression"); // ✅ 1. IMPORT COMPRESSION

const apiRoutes = require("./routes");

const { notFound, errorHandler } = require("./middleware/errorHandler");
const { securityHeaders } = require("./middleware/security");

const app = express();

// Security
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);

// CORS
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [
        "http://localhost:5173",
        process.env.CLIENT_URL, // ✅ This dynamically loads your Vercel URL from your .env later!
      ].filter(Boolean);
      
      // Allow requests with no origin (like Postman or Render health checks)
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ allow cookies
  })
);

// ✅ 2. ADD COMPRESSION MIDDLEWARE HERE
// (After security/CORS, but before body parsing and routing)
app.use(compression({
  level: 6,              // good default
  threshold: 1024,       // only compress >1KB
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// Body parser
app.use(express.json());

// Root test
app.get("/", (req, res) => {
  res.send("Travel API Running ✅");
});

// ✅ MAIN API ROUTE
app.use("/api", apiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;