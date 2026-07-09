import axios from "axios";

const api = axios.create({
  // ✅ FIX: Uses the cloud URL if it exists, otherwise falls back to localhost
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

// Read from either storage — Login saves to sessionStorage, some flows use localStorage.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;