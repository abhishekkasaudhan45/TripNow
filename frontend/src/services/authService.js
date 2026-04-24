import api from "../lib/api";

// Send login request with email and password
export const login = (data) => api.post("/api/auth/login", data);

// Send signup request with name, email, and password
export const signup = (data) => api.post("/api/auth/signup", data);