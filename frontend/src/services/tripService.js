import api from "../lib/api";

export const getTrips = () => api.get("/api/trips");
export const deleteTrip = (id) => api.delete(`/api/trips/${id}`);
export const updateTrip = (id, data) => api.put(`/api/trips/${id}`, data);
export const saveTrip = (data) => api.post("/api/trips", data);