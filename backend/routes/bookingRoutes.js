const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { validateObjectId } = require("../middleware/validateObjectId");
const { validate } = require("../middleware/validate");
const {
  createBookingSchema,
  updateBookingSchema,
  itineraryPersistenceSchema,
} = require("../validators/bookingValidators");

const {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBooking,
  updateItinerary,
  deleteBooking,
  shareBooking,
  unshareBooking,
  uploadCoverImage,
  deleteCoverImage,
} = require("../controllers/bookingController");
const { uploadCoverImageMiddleware } = require("../middleware/upload");

// 🔒 All routes here are scoped to the user's personal operations
router.use(protect);

// POST   /api/bookings      -> Create a personal itinerary entry (Zod Validated)
// GET    /api/bookings/mine -> Load user dashboard history (Projected Fields)
router.route("/")
  .post(validate(createBookingSchema), createBooking)
  .get(getMyBookings);

// PATCH  /api/bookings/:id/share   -> Explicitly enable public sharing
// PATCH  /api/bookings/:id/unshare -> Explicitly disable public sharing
router.patch("/:id/share", validateObjectId("id"), shareBooking);
router.patch("/:id/unshare", validateObjectId("id"), unshareBooking);

// POST   /api/bookings/:id/cover-image -> Upload or replace trip cover photo (Multipart, Magic Bytes Validated)
// DELETE /api/bookings/:id/cover-image -> Remove trip cover photo
router.route("/:id/cover-image")
  .all(validateObjectId("id"))
  .post(uploadCoverImageMiddleware, uploadCoverImage)
  .delete(deleteCoverImage);

// PATCH  /api/bookings/:id/itinerary -> Persist updated itinerary with OCC and lock invariants (Phase 3C)
router.patch(
  "/:id/itinerary",
  validateObjectId("id"),
  validate(itineraryPersistenceSchema),
  updateItinerary
);

// GET    /api/bookings/:id  -> Load a specific saved trip summary
// PUT    /api/bookings/:id  -> Update specific trip configurations (Zod Strict Validated)
// DELETE /api/bookings/:id  -> Remove a trip from database logs
router.route("/:id")
  .all(validateObjectId("id"))
  .get(getBookingById)
  .put(validate(updateBookingSchema), updateBooking)
  .delete(deleteBooking);

module.exports = router;
