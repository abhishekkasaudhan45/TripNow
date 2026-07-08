import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageSkeleton } from "./components/Skeletons";

const Home       = lazy(() => import("./pages/Home"));
const Booking    = lazy(() => import("./pages/Booking"));
const Admin      = lazy(() => import("./pages/Admin"));
const PlanTrip   = lazy(() => import("./pages/PlanTrip"));
const Login      = lazy(() => import("./pages/Login"));
const Signup     = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail    = lazy(() => import("./pages/VerifyEmail"));
const Dashboard  = lazy(() => import("./pages/Dashboard"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));
const Privacy    = lazy(() => import("./pages/Privacy"));
const Terms      = lazy(() => import("./pages/Terms"));
const NotFound   = lazy(() => import("./pages/NotFound"));

function App() {

  // Render's free tier sleeps after inactivity; the first request can take
  // ~30–50s. We ping /api on load and only show a banner if it's slow to wake.
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL;
    if (!url) return;

    const slowTimer = setTimeout(() => setWarming(true), 2500);
    fetch(`${url}/api`)
      .catch(() => {})
      .finally(() => {
        clearTimeout(slowTimer);
        setWarming(false);
      });

    return () => clearTimeout(slowTimer);
  }, []);

  return (
    <>
      {warming && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            padding: "9px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: "13px",
            fontWeight: 600, color: "#78350f",
            background: "linear-gradient(90deg,#fde68a,#fca5a5)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          }}
        >
          <span
            style={{
              width: "14px", height: "14px", borderRadius: "50%",
              border: "2px solid rgba(120,53,15,0.35)", borderTopColor: "#78350f",
              display: "inline-block", animation: "tn-spin 0.8s linear infinite",
            }}
          />
          Waking up the server… first load can take up to a minute.
          <style>{`@keyframes tn-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      <Suspense
      fallback={
        <main
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 pt-20"
        >
          <PageSkeleton />
        </main>
      }
    >
      <Routes>
        <Route path="/shared-trip/:id" element={<SharedTrip />} />

        <Route element={<MainLayout />}>
          <Route path="/"          element={<Home />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/signup"    element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/verify-email"    element={<VerifyEmail />} />
          <Route path="/booking"   element={<Booking />} />
          <Route path="/plan-trip" element={<PlanTrip />} />
          <Route path="/trip/:id"  element={<PlanTrip />} />
          <Route path="/privacy"   element={<Privacy />} />
          <Route path="/terms"     element={<Terms />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}><Admin /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}

export default App;