// frontend/src/utils/auth.js
// Single source of truth for user profile storage.
// JWT tokens are stored strictly in secure HttpOnly cookies and never in browser storage.

import { clearCsrfToken } from "../lib/api.js";

export const saveAuth = ({ user }) => {
  // Clear any legacy token artifacts from storage
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");

  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }
};

export const getToken = () => null;

export const getUser = () => {
  try {
    const raw =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  clearCsrfToken();
};

/**
 * Extracts a clear, actionable user-facing error message from an API error response.
 * Safely surfaces field-level validation errors (password length/complexity, email format)
 * rather than opaque "Validation failed" banners, and handles network disconnects gracefully.
 */
export const getAuthErrorMessage = (
  err,
  defaultMsg = "An error occurred. Please try again."
) => {
  if (!err) return defaultMsg;

  // Network / server offline
  if (err.message === "Network Error" || err.code === "ERR_NETWORK" || !err.response) {
    return "Unable to connect to the server. Please check your connection and try again.";
  }

  const data = err.response?.data || err.response?.body;
  if (!data) return defaultMsg;

  // Extract granular field errors if available
  if (data.errors && typeof data.errors === "object") {
    const fields = data.errors.fields || data.errors;
    if (typeof fields === "object" && !Array.isArray(fields)) {
      const keys = Object.keys(fields);
      if (keys.length > 0 && typeof fields[keys[0]] === "string") {
        return fields[keys[0]];
      }
    }
    if (Array.isArray(data.errors.messages) && data.errors.messages.length > 0) {
      return data.errors.messages[0];
    }
  }

  if (data.message && data.message !== "Validation failed") {
    return data.message;
  }

  return defaultMsg;
};
