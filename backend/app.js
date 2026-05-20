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

// ✅ UPDATED CORS — includes all your frontend URLs
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://trip-now-rosy.vercel.app",      // your vercel URL
        "https://tripnow.abhishektech.me",        // your custom subdomain
        "https://abhishektech.me",                // root domain just in case
        process.env.CLIENT_URL,                   // from Render env vars
      ].filter(Boolean);

      // Allow Postman, Render health checks, curl (no origin header)
      if (!origin || allowed.includes(origin)) {
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