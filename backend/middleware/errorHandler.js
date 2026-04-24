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

  return sendError(res, {
    statusCode: error.statusCode || 500,
    message: error.message || "Internal server error",
    stack: env.isProduction ? undefined : error.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
