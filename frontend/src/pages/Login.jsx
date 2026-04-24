import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) navigate("/dashboard");
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await login(form);

      // Safe token extraction
      const token = res.data?.data?.token;

      if (!token) {
        throw new Error("Token missing from server response");
      }

      // Store token securely
      sessionStorage.setItem("token", token);

      // Redirect to user dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Invalid email or password ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6">

      <form
        onSubmit={handleLogin}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl w-full max-w-md shadow-2xl border border-white/10"
      >
        <h2 className="text-3xl font-bold text-white text-center mb-6">
          Welcome Back ✈️
        </h2>

        {/* EMAIL INPUT */}
        <input
          type="email"
          placeholder="Email Address"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full p-3 mb-4 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
        />

        {/* PASSWORD INPUT */}
        <input
          type="password"
          placeholder="Password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full p-3 mb-4 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
        />

        {/* ERROR MESSAGE */}
        {error && (
          <p className="text-red-400 text-sm mb-4 text-center font-medium bg-red-400/10 py-2 rounded">
            {error}
          </p>
        )}

        <button 
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 rounded-lg font-bold text-black hover:scale-105 shadow-lg shadow-amber-500/20 transition duration-300 disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="text-gray-400 text-sm mt-6 text-center">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/admin/signup")}
            className="text-amber-400 cursor-pointer font-semibold hover:underline"
          >
            Sign up
          </span>
        </p>
      </form>
    </div>
  );
}

export default Login;