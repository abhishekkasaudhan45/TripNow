import { Navigate, useLocation } from "react-router-dom";

function getStoredAuth() {
  // Admin login saves to sessionStorage, Signup saves to localStorage
  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    "";

  let user = null;
  try {
    const raw =
      sessionStorage.getItem("user") ||
      localStorage.getItem("user") ||
      "";
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }

  return { token, user };
}

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { token, user } = getStoredAuth();
  const location = useLocation();

  // Not logged in → redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ Admin role check: if route requires admin, verify role
  if (requireAdmin && user?.role !== "admin") {
    // Logged in as regular user trying to access /admin → send to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}