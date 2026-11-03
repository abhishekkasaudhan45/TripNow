// frontend/src/services/bookingService.js
import api from "../lib/api";

// CREATE BOOKING
export const createBooking = (payload) =>
  api.post("/api/bookings", payload);

// ADMIN LOGIN
export const loginAdmin = (password) =>
  api.post("/api/auth/login", { password });

// GET BOOKINGS (ADMIN)
export const getAdminBookings = (tokenOrParams = {}, maybeParams = {}) => {
  const params = typeof tokenOrParams === "string" ? maybeParams : tokenOrParams;
  return api.get("/api/admin/bookings", { params });
};

// GET ALL TRIPS (Dashboard)
export const getAllTrips = async () =>
  api.get("/api/bookings");

// GET SINGLE TRIP BY ID (Authoritative full booking with aiPlan)
export const getTripById = (id) =>
  api.get(`/api/bookings/${id}`);

// DELETE TRIP
export const deleteTrip = (id) =>
  api.delete(`/api/bookings/${id}`);

// ✅ UPDATE TRIP (Edit dates, destination, guests, budget, notes)
export const updateTrip = (id, payload) =>
  api.put(`/api/bookings/${id}`, payload);

// 💾 SAVE / PERSIST ITINERARY (Phase 3C)
export const saveItinerary = (id, { itinerary, baseVersion }) =>
  api.patch(`/api/bookings/${id}/itinerary`, { itinerary, baseVersion });

// 🔒 EXPLICIT SHARING CONTROLS
export const shareTrip = (id) =>
  api.patch(`/api/bookings/${id}/share`);

export const unshareTrip = (id) =>
  api.patch(`/api/bookings/${id}/unshare`);

// PUBLIC shared trip (no auth header)
export const getSharedTrip = async (id) => {
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const res = await fetch(`${base}/api/bookings/shared/${id}`);
  if (!res.ok) throw new Error("Trip not found");
  return res.json();
};

// UPLOAD TRIP COVER IMAGE
export const uploadCoverImage = (id, file) => {
  const formData = new FormData();
  formData.append("coverImage", file);
  return api.post(`/api/bookings/${id}/cover-image`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// REMOVE TRIP COVER IMAGE
export const deleteCoverImage = (id) =>
  api.delete(`/api/bookings/${id}/cover-image`);
