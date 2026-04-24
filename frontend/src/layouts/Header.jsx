import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-white/10 border-b border-white/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

        {/* LOGO */}
        <h1
          onClick={() => navigate("/")}
          className="text-xl font-bold text-white cursor-pointer tracking-wide"
        >
          ✈ TravelX
        </h1>

        {/* NAV LINKS */}
        <nav className="hidden md:flex gap-8 text-white font-medium">
          <span
            onClick={() => navigate("/")}
            className="cursor-pointer hover:text-amber-400 transition"
          >
            Home
          </span>

          <span
            onClick={() => navigate("/booking")}
            className="cursor-pointer hover:text-amber-400 transition"
          >
            Booking
          </span>

          <span
            onClick={() => navigate("/admin")}
            className="cursor-pointer hover:text-amber-400 transition"
          >
            Admin
          </span>
          
          <span
            onClick={() => navigate("/dashboard")}
            className="cursor-pointer hover:text-amber-400 transition"
          >
            Dashboard
          </span>
        </nav>

        {/* 🔥 AUTH BUTTONS */}
        <div className="flex gap-3">
          {!token ? (
            <>
              {/* ✅ FIXED: Now points to /admin/login */}
              <button
                onClick={() => navigate("/admin/login")}
                className="px-5 py-2 rounded-full bg-white/20 text-white font-semibold hover:bg-white/30 transition duration-300"
              >
                Login
              </button>

              {/* ✅ FIXED: Now points to /admin/signup */}
              <button
                onClick={() => navigate("/admin/signup")}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold shadow-md hover:scale-105 hover:shadow-amber-400/40 transition duration-300"
              >
                Sign Up
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="px-5 py-2 rounded-full bg-red-500 text-white font-bold shadow-md hover:bg-red-600 hover:scale-105 transition duration-300"
            >
              Logout
            </button>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;