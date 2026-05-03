import { Routes, Route } from "react-router-dom";

// Layout
import MainLayout from "./layouts/MainLayout";

// Pages
import Home       from "./pages/Home";
import Booking    from "./pages/Booking";
import Admin      from "./pages/Admin";
import PlanTrip   from "./pages/PlanTrip";
import Login      from "./pages/Login";
import Signup     from "./pages/Signup";
import Dashboard  from "./pages/Dashboard";
import SharedTrip from "./pages/SharedTrip"; // ✅ NEW
import NotFound   from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/*
        ✅ /shared-trip/:id is OUTSIDE MainLayout on purpose.
        Shared pages have no nav/footer — clean standalone view
        optimised for external visitors and viral sharing.
      */}
      <Route path="/shared-trip/:id" element={<SharedTrip />} />

      {/* All other routes wrapped in MainLayout → Header + Footer */}
      <Route element={<MainLayout />}>

        {/* Public pages */}
        <Route path="/"          element={<Home />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/signup"    element={<Signup />} />

        {/* Booking confirmation */}
        <Route path="/booking"   element={<Booking />} />

        {/* AI trip planner */}
        <Route path="/plan-trip" element={<PlanTrip />} />
        <Route path="/trip/:id"  element={<PlanTrip />} />

        {/* Dashboard — protected */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* Admin — protected */}
        <Route path="/admin" element={
          <ProtectedRoute><Admin /></ProtectedRoute>
        } />

        {/* 404 fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;