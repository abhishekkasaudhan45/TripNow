import React, { Suspense, lazy, useEffect } from "react";
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
const Dashboard  = lazy(() => import("./pages/Dashboard"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));
const NotFound   = lazy(() => import("./pages/NotFound"));

function App() {

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL;
    if (url) {
      fetch(`${url}/api`)
        .then(() => console.log("Backend awake ✅"))
        .catch(() => console.log("Backend waking up..."));
    }
  }, []);

  return (
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
          <Route path="/booking"   element={<Booking />} />
          <Route path="/plan-trip" element={<PlanTrip />} />
          <Route path="/trip/:id"  element={<PlanTrip />} />

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
  );
}

export default App;