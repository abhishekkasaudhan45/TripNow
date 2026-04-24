const axios = require("axios");

const generateTripFromAI = async (prompt) => {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              text: `Return JSON only:

{
  "destination": "",
  "itinerary": [
    {"day": 1, "activity": ""},
    {"day": 2, "activity": ""}
  ],
  "budget": ""
}

User: ${prompt}`,
            },
          ],
        },
      ],
    }
  );

  return response.data.candidates?.[0]?.content?.parts?.[0]?.text;
};

module.exports = { generateTripFromAI };