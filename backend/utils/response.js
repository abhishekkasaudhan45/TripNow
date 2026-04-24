const sendSuccess = (
  res,
  {
    statusCode = 200,
    message = "Request successful",
    data = null,
    meta,
  } = {}
) => {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta) {
    payload.meta = meta;
  }

  res.status(statusCode).json(payload);
};

const sendError = (
  res,
  { statusCode = 500, message = "Internal server error", errors, stack } = {}
) => {
  const payload = {
    success: false,
    message,
  };

  if (errors) {
    payload.errors = errors;
  }

  if (stack) {
    payload.stack = stack;
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError,
};
