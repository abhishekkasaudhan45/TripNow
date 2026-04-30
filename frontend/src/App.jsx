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
import NotFound   from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* ✅ ALL routes wrapped in MainLayout → Header + Footer always visible */}
      <Route element={<MainLayout />}>

        {/* Public pages */}
        <Route path="/"         element={<Home />} />
        // After /plan-trip route
<Route path="/booking" element={<PlanTrip />} />
<Route path="/booking" element={<Booking />} />

        {/* ✅ FIXED: /login and /signup (not /admin/login) */}
        <Route path="/login"    element={<Login />} />
        <Route path="/signup"   element={<Signup />} />

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

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;