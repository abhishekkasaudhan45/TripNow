import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  // ✅ FIX: Check localStorage (consistent with Login/Signup save location)
  const token = localStorage.getItem("token");

  if (!token) {
    // ✅ FIX: Redirect to /login not /admin/login
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;