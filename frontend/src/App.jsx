import { Routes, Route } from "react-router-dom"; 
import Home from "./pages/Home";
import Booking from "./pages/Booking";
import Admin from "./pages/Admin";
import PlanTrip from "./pages/PlanTrip";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Signup from "./pages/Signup";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Booking Routes */}
      <Route path="/booking" element={<Booking />} />
      <Route path="/booking/:id" element={<Booking />} />

      {/* Admin & Auth Routes */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } 
      />

      {/* User Feature Routes */}
<Route path="/plan-trip" element={<PlanTrip />} />      
      {/* Protected User Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;