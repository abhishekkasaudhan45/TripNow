const mongoose = require("mongoose");

/**
 * Express middleware factory to validate MongoDB ObjectId route parameters.
 * Rejects invalid format immediately with 400 Bad Request before hitting the database.
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }
    next();
  };
};

module.exports = {
  validateObjectId,
};

