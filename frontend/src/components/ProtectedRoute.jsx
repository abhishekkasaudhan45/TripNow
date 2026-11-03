import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getUser, saveAuth, clearAuth } from "../utils/auth";
import api from "../lib/api";
import { PageSkeleton } from "./Skeletons";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const [user, setUser] = useState(getUser);
  const [loading, setLoading] = useState(!user);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/auth/me")
      .then((res) => {
        if (!isMounted) return;
        const freshUser = res.data?.data?.user || res.data?.user;
        if (freshUser) {
          setUser(freshUser);
          saveAuth({ user: freshUser });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err?.response?.status === 401) {
          clearAuth();
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 pt-20"
      >
        <PageSkeleton />
      </main>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin role check: if route requires admin, verify role
  if (requireAdmin && user.role !== "admin") {
    // Logged in as regular user trying to access /admin → send to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
