import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  // ✅ FIX 1: Match the sessionStorage used in Login.jsx
  const token = sessionStorage.getItem("token");

  if (!token) {
    // ✅ FIX 2: Redirect to the correct professional admin login route
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;