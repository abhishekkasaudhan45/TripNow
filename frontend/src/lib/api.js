import axios from "axios";

const api = axios.create({
  // ✅ FIX: Uses the cloud URL if it exists, otherwise falls back to localhost
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

// ✅ FIX: Read from localStorage (where Login/Signup save the token)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;