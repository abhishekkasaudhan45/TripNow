const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl && !import.meta.env.DEV) {
  throw new Error("Missing VITE_API_URL environment variable");
}

export const env = {
  apiUrl: "http://localhost:5000",
};
