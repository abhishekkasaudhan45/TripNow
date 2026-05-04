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
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

// ✅ GET ALL AI TRIPS
export const getAllTrips = async () => {
  return await api.get("/api/bookings");
};

// 🗑️ DELETE TRIP
export const deleteTrip = (id) => {
  return api.delete(`/api/bookings/${id}`);
};

// ✅ NEW — fetch a single trip publicly (no auth header sent)
// Uses native fetch so the Axios auth interceptor is bypassed entirely
// frontend/src/services/bookingService.js
export const getSharedTrip = async (id) => {
  const res = await fetch(`http://localhost:5000/api/bookings/shared/${id}`);
  if (!res.ok) throw new Error("Trip not found");
  return res.json();
};