const express = require("express");
const cors = require("cors");

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
    origin: "http://localhost:5173", // ✅ exact frontend URL
    credentials: true,              // ✅ allow cookies
  })
);

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