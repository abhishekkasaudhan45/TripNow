const express = require("express");
const router = express.Router();
const { createTrip, getTrips, deleteTrip } = require("../controllers/tripController");
const { updateTrip } = require("../controllers/tripController");
const protect = require("../middleware/auth");


router.get("/", protect, getTrips);
router.post("/", protect, createTrip);
router.put("/:id", protect, updateTrip);
router.delete("/:id", protect, deleteTrip);

module.exports = router;
