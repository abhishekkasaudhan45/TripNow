import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  // ✅ FIX: Check localStorage first (Login.jsx saves here), then sessionStorage as fallback
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  if (!token) {
    // ✅ FIX: Redirect to /login (not /admin/login which doesn't exist)
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;