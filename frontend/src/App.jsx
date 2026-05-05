import { Routes, Route } from "react-router-dom";
import MainLayout     from "./layouts/MainLayout";
import Home           from "./pages/Home";
import Booking        from "./pages/Booking";
import Admin          from "./pages/Admin";
import PlanTrip       from "./pages/PlanTrip";
import Login          from "./pages/Login";
import Signup         from "./pages/Signup";
import Dashboard      from "./pages/Dashboard";
import SharedTrip     from "./pages/SharedTrip";
import NotFound       from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Routes WITH Header + Footer */}
      <Route element={<MainLayout />}>
        <Route path="/"            element={<Home />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/signup"      element={<Signup />} />
        <Route path="/plan-trip"   element={<PlanTrip />} />
        <Route path="/trip/:id"    element={<PlanTrip />} />
        <Route path="/booking"     element={<Booking />} />
        <Route path="/booking/:id" element={<Booking />} />

        {/* Dashboard — protected via ProtectedRoute */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* ✅ FIX: Admin has its OWN token check inside — no double-wrap needed */}
        <Route path="/admin" element={<Admin />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Shared trip — no header/footer, fully public */}
      <Route path="/shared-trip/:id" element={<SharedTrip />} />
    </Routes>
  );
}

export default App;