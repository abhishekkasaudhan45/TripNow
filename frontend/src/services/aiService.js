import api from "./api";


export const generateAI = (payload) => api.post("/api/ai", payload);