import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    // 1. Grab the token
    const token = sessionStorage.getItem("token");
    
    // 2. Loudly log what it found
    console.log("[API Interceptor] Token found in storage:", token ? "YES" : "NO");

    // 3. Safely attach it
    if (token) {
      // Ensure the headers object exists before assigning
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      console.log("[API Interceptor] Header attached:", config.headers.Authorization);
    } else {
      console.warn("[API Interceptor] No token to attach!");
    }

    return config;
  },
  (error) => {
    console.error("[API Interceptor] Request setup error:", error);
    return Promise.reject(error);
  }
);

export default api;