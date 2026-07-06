
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "body";
      if (!fields[key]) fields[key] = issue.message; // first error per field
    }
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: fields,
    });
  }

  req.body = result.data;
  next();
};

module.exports = { validate };