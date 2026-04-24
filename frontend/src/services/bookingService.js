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