// frontend/src/services/bookingService.js
import api from "../lib/api";

// CREATE BOOKING
export const createBooking = (payload) =>
  api.post("/api/bookings", payload);

// ADMIN LOGIN
export const loginAdmin = (password) =>
  api.post("/api/auth/login", { password });

// GET BOOKINGS (ADMIN)
export const getAdminBookings = (token, params = {}) =>
  api.get("/api/admin/bookings", {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });

// GET ALL TRIPS (Dashboard)
export const getAllTrips = async () =>
  api.get("/api/bookings");

// DELETE TRIP
export const deleteTrip = (id) =>
  api.delete(`/api/bookings/${id}`);

// ✅ UPDATE TRIP (Edit dates, destination, guests, budget, notes)
export const updateTrip = (id, payload) =>
  api.put(`/api/bookings/${id}`, payload);

// PUBLIC shared trip (no auth header)
export const getSharedTrip = async (id) => {
  const res = await fetch(`http://localhost:5000/api/bookings/shared/${id}`);
  if (!res.ok) throw new Error("Trip not found");
  return res.json();
};