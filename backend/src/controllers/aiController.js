const { generateTripFromAI } = require("../services/aiService");

const generateAITrip = async (req, res, next) => {
  try {
    const { prompt } = req.body;

    const result = await generateTripFromAI(prompt);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { generateAITrip };