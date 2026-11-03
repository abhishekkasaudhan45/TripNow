const mongoose = require("mongoose");
const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");

const SHUTDOWN_TIMEOUT_MS = 10000; // 10s bounded timeout (Render SIGTERM grace period is 30s)

/**
 * Creates an isolated graceful shutdown handler.
 * Designed to be testable with mocked dependencies without terminating the test runner process.
 */
const createShutdownHandler = ({
  server,
  mongooseConnection = mongoose.connection,
  exitFn = process.exit,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
  logger = console,
} = {}) => {
  let isShuttingDown = false;

  return async (signal = "SIGTERM", options = {}) => {
    if (isShuttingDown) {
      logger.log(`Shutdown already in progress. Ignoring duplicate ${signal} signal.`);
      return;
    }
    isShuttingDown = true;
    logger.log(`Received ${signal}. Initiating graceful shutdown...`);

    // Determine target exit code: 0 for clean OS termination signals (SIGTERM/SIGINT),
    // 1 for uncaught exceptions, unhandled rejections, or when explicitly specified.
    const explicitExitCode =
      typeof options === "number"
        ? options
        : options && typeof options.exitCode === "number"
        ? options.exitCode
        : undefined;
    const defaultExitCode = signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1;
    const finalExitCode = explicitExitCode !== undefined ? explicitExitCode : defaultExitCode;

    // Bounded safety timeout: force process exit if in-flight requests or DB close hang
    const forceExitTimer = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
      exitFn(1);
    }, timeoutMs);
    if (forceExitTimer.unref) forceExitTimer.unref();

    try {
      // 1. Stop accepting new HTTP connections and drain in-flight requests
      if (server && typeof server.close === "function") {
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) {
              logger.error("Error closing HTTP server:", err.message);
              return reject(err);
            }
            logger.log("HTTP server closed. In-flight requests drained.");
            resolve();
          });
        });
      }

      // 2. Close MongoDB connection pool cleanly
      if (mongooseConnection && mongooseConnection.readyState !== 0) {
        await mongooseConnection.close(false);
        logger.log("MongoDB connection closed cleanly.");
      }

      clearTimeout(forceExitTimer);
      logger.log(
        finalExitCode === 0
          ? "Graceful shutdown completed successfully."
          : `Shutdown completed with status ${finalExitCode}.`
      );
      exitFn(finalExitCode);
    } catch (err) {
      clearTimeout(forceExitTimer);
      logger.error("Error occurred during graceful shutdown:", err.message);
      exitFn(1);
    }
  };
};

let server;

const startServer = async () => {
  await connectDB();
  server = app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });

  const shutdown = createShutdownHandler({ server });

  // Register signal listeners once only
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  // Register fatal error handlers to prevent silent corruption or continued zombie operation
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
    shutdown("uncaughtException", { exitCode: 1 });
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    shutdown("unhandledRejection", { exitCode: 1 });
  });

  return server;
};

// Start server automatically if executed directly (not when required in tests)
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  createShutdownHandler,
  SHUTDOWN_TIMEOUT_MS,
};
