const axios = require("axios");
const Booking = require("../models/Booking");

const generateAITrip = async (req, res) => {
  try {
    const { prompt, destination, budget, startDate, endDate } = req.body;

    if (!destination && !prompt) {
      return res.status(400).json({ message: "Trip details are required" });
    }

    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ message: "GROQ_API_KEY not set in backend/.env" });
    }

    const finalPrompt = prompt || `
You are an expert travel guide. Create a DETAILED day-by-day travel itinerary.

Destination: ${destination}
Dates: ${startDate} to ${endDate}
Budget: ₹${budget}

Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "destination": "${destination}",
  "days": [
    {
      "day": 1,
      "title": "Day theme title",
      "morning": "Specific morning activity with real place name",
      "afternoon": "Specific afternoon activity with real place name",
      "evening": "Specific evening activity with real place name",
      "food": ["Dish 1 at specific restaurant/area", "Dish 2 at specific place"]
    }
  ],
  "mustEat": ["Local dish 1 - description", "Local dish 2 - description"],
  "budgetBreakdown": {
    "accommodation": "₹X per night",
    "foodPerDay": "₹X",
    "transport": "₹X",
    "activities": "₹X",
    "total": "₹X"
  },
  "travelTips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4"],
  "whereToStay": {
    "budget": "Hotel name + area + approx price",
    "midRange": "Hotel name + area + approx price"
  },
  "bestTimeToVisit": "Short description"
}`;

    console.log("🚀 Calling Groq API...");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",  // Free, fast, very smart
        messages: [
          {
            role: "system",
            content: "You are an expert travel planner. Always respond with valid JSON only. No markdown, no backticks, no extra text."
          },
          {
            role: "user",
            content: finalPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        timeout: 30000,
      }
    );

    let text = response.data?.choices?.[0]?.message?.content || "";

    // Strip markdown fences just in case
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    console.log("✅ Groq responded successfully");

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const savedTrip = await Booking.create({
      destination: destination || "AI Generated",
      guests: 1,
      checkin: startDate ? new Date(startDate) : today,
      checkout: endDate ? new Date(endDate) : tomorrow,
      aiPlan: text,
    });

    res.json({ success: true, data: text, tripId: savedTrip._id });

  } catch (error) {
    const errDetail = error.response?.data?.error || error.message;
    console.error("🔥 AI ERROR:", JSON.stringify(errDetail, null, 2));
    res.status(500).json({
      message: errDetail?.message || "AI generation failed",
      error: errDetail,
    });
  }
};

module.exports = { generateAITrip };