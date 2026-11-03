const crypto = require("crypto");

/**
 * Validates or generates a unique correlation ID for every incoming request.
 * Sets X-Request-Id response header and attaches req.id for downstream logging.
 */
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;

const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];

  // Validate incoming ID: alphanumeric, hyphen, underscore, 8 to 64 chars
  const validId =
    typeof incomingId === "string" && REQUEST_ID_REGEX.test(incomingId)
      ? incomingId
      : crypto.randomUUID();

  req.id = validId;
  res.setHeader("X-Request-Id", validId);

  // Structured request completion logging (silenced during Jest test runs)
  if (process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID) {
    const startTime = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      console.log(
        `[${validId}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`
      );
    });
  }

  next();
};

module.exports = {
  requestIdMiddleware,
};
