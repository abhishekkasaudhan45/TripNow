import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

// Layouts & Security (NOT lazy loaded so the shell loads instantly)
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageSkeleton } from "./components/Skeletons";

// 🚀 LAZY LOADED PAGES (Optimizes initial load time)
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
  return (
    // 🛡️ ACCESSIBLE SUSPENSE WRAPPER (Creamy Theme Background)
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
        {/* Public Shared Trip Route */}
        <Route path="/shared-trip/:id" element={<SharedTrip />} />

        {/* ✅ ALL routes below wrapped in MainLayout → Header + Footer always visible */}
        <Route element={<MainLayout />}>

          {/* Public pages */}
          <Route path="/"          element={<Home />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/signup"    element={<Signup />} />
          <Route path="/booking"   element={<Booking />} />
          
          {/* AI trip planner */}
          <Route path="/plan-trip" element={<PlanTrip />} />
          <Route path="/trip/:id"  element={<PlanTrip />} />

          {/* Dashboard — protected (Any logged in user) */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* ✅ Admin — protected (Strictly requireAdmin) */}
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}><Admin /></ProtectedRoute>
          } />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;