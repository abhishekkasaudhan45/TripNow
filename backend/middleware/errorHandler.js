const env = require("../config/env");
const { sendError } = require("../utils/response");

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // Handle payload too large (413)
  if (error.type === "entity.too.large" || error.status === 413) {
    return sendError(res, {
      statusCode: 413,
      message: "Payload too large. Please reduce the request size.",
      requestId: req.id,
    });
  }

  if (error.name === "ValidationError") {
    const fieldErrors = Object.entries(error.errors || {}).reduce(
      (result, [fieldName, fieldError]) => ({
        ...result,
        [fieldName]: fieldError.message,
      }),
      {}
    );

    return sendError(res, {
      statusCode: 400,
      message: "Validation failed",
      errors: {
        messages: Object.values(error.errors || {}).map((item) => item.message),
        fields: fieldErrors,
      },
      requestId: req.id,
    });
  }

  if (error.name === "CastError") {
    return sendError(res, {
      statusCode: 400,
      message: "Invalid request data",
      requestId: req.id,
    });
  }

  // Handle MongoDB duplicate key error (E11000) safely
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "email";
    const message = field === "email"
      ? "User with this email already exists"
      : `Duplicate value entered for ${field}`;
    return sendError(res, {
      statusCode: 400,
      message,
      requestId: req.id,
    });
  }

  if (
    error.type === "prototype.pollution.detected" ||
    (error.message && error.message.includes("forbidden prototype"))
  ) {
    return sendError(res, {
      statusCode: 400,
      message: "Invalid payload: forbidden prototype property detected.",
      requestId: req.id,
    });
  }

  if (error.type === "entity.parse.failed") {
    return sendError(res, {
      statusCode: 400,
      message: "Request body contains invalid JSON",
      requestId: req.id,
    });
  }

  // 🔒 Secure fallback for unhandled exceptions (500 Internal Server Errors)
  const statusCode = error.statusCode || error.status || 500;

  // Sanitized server-side error logging: never dumps raw credentials or request bodies
  if (statusCode === 500 && process.env.NODE_ENV !== "test") {
    console.error("🔒 Internal Server Error Intercepted:", {
      name: error.name,
      message: error.message,
      requestId: req.id,
      path: req.originalUrl,
      method: req.method,
      stack: env.isProduction ? undefined : error.stack,
    });
  }

  return sendError(res, {
    statusCode,
    // If it's a 500 error in production, strip the raw error text and send a generic message
    message: env.isProduction && statusCode === 500
      ? "Something went wrong. Please try again."
      : (error.message || "Internal server error"),
    // Mask stack trace details when running live
    stack: env.isProduction ? undefined : error.stack,
    requestId: req.id,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
