const { sendSuccess } = require("../utils/response");

const getHealth = (req, res) => {
  sendSuccess(res, {
    message: "API is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
};

module.exports = {
  getHealth,
};
