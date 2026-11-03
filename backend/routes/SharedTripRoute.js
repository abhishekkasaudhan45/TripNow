// backend/routes/SharedTripRoute.js
// 🔒 PUBLIC: Unauthenticated endpoint for shared trip links
const express = require("express");
const router = express.Router();
const { getSharedTrip } = require("../controllers/Sharedtripcontroller");
const { sharedTripLimiter } = require("../middleware/rateLimiters");
const { validateObjectId } = require("../middleware/validateObjectId");

/**
 * GET /api/bookings/shared/:id
 * Public route — returns sanitized public trip data by MongoDB _id.
 * No JWT required. Strict DTO projection ensures zero PII leakage.
 * Protected by sharedTripLimiter and ObjectId format validation.
 */
router.get("/:id", sharedTripLimiter, validateObjectId("id"), getSharedTrip);

module.exports = router;
