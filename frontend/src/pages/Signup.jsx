import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../services/authService";

function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) navigate("/dashboard");
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      return setError("Passwords do not match ❌");
    }

    setLoading(true);

    try {
      // 1. Send data to backend to create user
      const res = await signup({
        name: form.name,
        email: form.email,
        password: form.password,
      });

      // 2. Extract real token from response
      const token = res.data?.data?.token;

      if (!token) {
        throw new Error("Token missing from server response");
      }

      // 3. Save token & instantly log them in
      sessionStorage.setItem("token", token);
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to create account ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* LEFT IMAGE */}
      <div className="hidden md:flex w-1/2 bg-cover bg-center shadow-2xl z-10"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e')" }}
      />

      {/* RIGHT FORM */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-6">

        {/* PREMIUM GLASS CARD */}
        <form 
          onSubmit={handleSubmit} 
          className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl w-full max-w-md shadow-2xl border border-white/10"
        >

          <h2 className="text-3xl font-bold text-white text-center mb-6">
            Create Account 🌍
          </h2>

          <input 
            type="text"
            placeholder="Full Name" 
            required
            className="w-full p-3 mb-3 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input 
            type="email"
            placeholder="Email Address" 
            required
            className="w-full p-3 mb-3 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input 
            type="password" 
            placeholder="Password"
            required
            className="w-full p-3 mb-3 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <input 
            type="password" 
            placeholder="Confirm Password"
            required
            className="w-full p-3 mb-4 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />

          {/* ERROR MESSAGE */}
          {error && (
            <p className="text-red-400 text-sm mb-4 text-center font-medium bg-red-400/10 py-2 rounded">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 rounded-lg font-bold text-black hover:scale-105 transition shadow-lg shadow-amber-500/20 duration-300 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>

          <p className="text-gray-400 text-sm mt-6 text-center">
            Already have an account?{" "}
            <span 
              onClick={() => navigate("/admin/login")} 
              className="text-amber-400 cursor-pointer font-semibold hover:underline transition"
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Signup;