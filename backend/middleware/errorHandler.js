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

  if (error.name === "ValidationError") {
    const fieldErrors = Object.entries(error.errors).reduce(
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
        messages: Object.values(error.errors).map((item) => item.message),
        fields: fieldErrors,
      },
    });
  }

  if (error.name === "CastError") {
    return sendError(res, {
      statusCode: 400,
      message: "Invalid request data",
    });
  }

  if (error.type === "entity.parse.failed") {
    return sendError(res, {
      statusCode: 400,
      message: "Request body contains invalid JSON",
    });
  }

  // 🔒 Secure fallback for unhandled exceptions (500 Internal Server Errors)
  const statusCode = error.statusCode || 500;

  // Always log the actual stack trace server-side so you can fix bugs using Render logs
  if (statusCode === 500) {
    console.error("🔒 Internal Server Error Intercepted:", error);
  }

  return sendError(res, {
    statusCode,
    // If it's a 500 error in production, strip the raw error text and send a generic message
    message: env.isProduction && statusCode === 500
      ? "Something went wrong. Please try again."
      : (error.message || "Internal server error"),
    // Mask stack trace details when running live
    stack: env.isProduction ? undefined : error.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};