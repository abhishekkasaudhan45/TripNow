// frontend/src/utils/auth.js
// Single source of truth for auth storage.
// Import these helpers in Login.jsx, Signup.jsx, and Header.jsx
// instead of calling localStorage directly.

export const saveAuth = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token") || null;

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
};