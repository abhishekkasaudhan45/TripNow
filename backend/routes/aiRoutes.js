const express = require("express");
const { generateAITrip } = require("../controllers/aiController");

const router = express.Router();

// POST /api/ai
router.post("/", generateAITrip);

module.exports = router;