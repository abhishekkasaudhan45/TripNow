const express = require("express");
const cors = require("cors");
const compression = require("compression");

const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { securityHeaders } = require("./middleware/security");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);

// ✅ FINAL CORS — allows all Vercel preview URLs + custom domains
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, Render health checks, curl)
      if (!origin) return callback(null, true);

      const isAllowed =
        origin.includes("vercel.app") ||        // ✅ ALL Vercel preview + production URLs
        origin.includes("abhishektech.me") ||   // ✅ your custom domain
        origin.includes("localhost");            // ✅ local development

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn("CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
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

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Travel API Running ✅");
});

// Health check — frontend uses this to wake up Render
app.get("/api", (req, res) => {
  res.json({ message: "API working ✅", timestamp: new Date().toISOString() });
});

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app; 