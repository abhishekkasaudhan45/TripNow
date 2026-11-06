// frontend/src/pages/Login.jsx
// Redirects based on user role — admin → /admin, user → /dashboard
// Auth token is stored in HttpOnly cookie; user metadata saved via saveAuth

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../lib/api";
import { saveAuth, getAuthErrorMessage } from "../utils/auth";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import TripNowLogo from "../components/common/TripNowLogo";

function IconEye({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleAuthSuccess = (user) => {
    const returnTo = location.state?.returnTo || location.state?.from?.pathname;
    if (user.role === "admin") {
      navigate("/admin", { replace: true });
    } else if (returnTo && returnTo !== "/login") {
      navigate(returnTo, {
        replace: true,
        state: {
          stagedTrip: location.state?.stagedTrip,
          tripId: location.state?.tripId,
          destination: location.state?.destination,
          budget: location.state?.budget,
          checkin: location.state?.checkin,
          checkout: location.state?.checkout,
        },
      });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = (form.email || "").trim().toLowerCase();
    if (!trimmedEmail) {
      setErr("Please provide your email address.");
      return;
    }
    if (!form.password) {
      setErr("Please provide your password.");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", {
        email: trimmedEmail,
        password: form.password,
      });
      const user = res.data?.data?.user || res.data?.user || {};

      // 🔒 Save non-sensitive user profile in memory/storage (token is in HttpOnly cookie)
      saveAuth({ user });
      handleAuthSuccess(user);
    } catch (e) {
      setErr(getAuthErrorMessage(e, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden flex flex-col md:flex-row"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        minHeight: "100vh",
        display: "flex",
        background:
          "linear-gradient(160deg, #fff7ed 0%, #fef3c7 25%, #fde8d8 50%, #fce7f3 75%, #ede9fe 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        .inp { transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease; }
        .inp:focus { outline:none; border-color:rgba(245,158,11,0.8)!important; box-shadow:0 0 0 3px rgba(245,158,11,0.22)!important; background:rgba(255,255,255,0.98)!important; }
        .btn-main { transition:transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease; }
        .btn-main:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(239,68,68,0.42)!important; }
        .btn-main:active:not(:disabled) { transform:translateY(0); }
        .btn-main:disabled { opacity:0.65; cursor:not-allowed; }
        .toggle-btn:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .inp, .btn-main, .toggle-btn, a {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      {/* ── Left photo & brand panel (Desktop only) ── */}
      <div
        className="hidden md:flex flex-col justify-between h-full"
        style={{
          width: "44%",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(255, 255, 255, 0.3)",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&q=85"
          alt="Scenic Tropical Coastline at Sunset"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(245, 158, 11, 0.76) 0%, rgba(239, 68, 68, 0.65) 50%, rgba(139, 92, 246, 0.58) 100%)",
          }}
        />

        {/* Top brand header */}
        <div style={{ position: "relative", padding: "28px 36px", zIndex: 2 }}>
          <Link
            to="/"
            aria-label="TripNow Home"
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            <TripNowLogo size={36} theme="dark" />
          </Link>
        </div>

        {/* Bottom inspirational caption */}
        <div
          className="pb-12 lg:pb-16 mb-4 lg:mb-6"
          style={{
            position: "relative",
            padding: "24px 36px 48px",
            background: "linear-gradient(to top, rgba(17, 24, 39, 0.45) 0%, transparent 100%)",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              fontSize: "11px",
              fontWeight: 700,
              color: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
            ✦ Next-Gen Travel Engine
          </div>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(24px, 2.2vw, 34px)",
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.15,
              marginBottom: "10px",
              letterSpacing: "-1px",
            }}
          >
            &ldquo;Every journey
            <br />
            begins with a
            <br />
            <em style={{ fontStyle: "italic", color: "#fef3c7" }}>single step.&rdquo;</em>
          </h2>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.88)",
              fontSize: "13px",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Plan yours with deterministic budget intelligence and feasibility scoring.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative Blurred Gradient Blobs */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-60px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251, 191, 36, 0.30) 0%, transparent 70%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-40px",
            left: "-40px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167, 139, 250, 0.24) 0%, transparent 70%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        {/* Focused Elevated Auth Card */}
        <div
          className="border border-slate-200/80 shadow-xl rounded-2xl p-6 lg:p-7 bg-white/95 backdrop-blur-sm relative w-full max-w-[400px]"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "400px",
          }}
        >
          {/* Mobile brand header */}
          <div className="md:hidden" style={{ textAlign: "center", marginBottom: "16px" }}>
            <Link
              to="/"
              aria-label="TripNow Home"
              style={{ display: "inline-flex", textDecoration: "none" }}
            >
              <TripNowLogo size={34} />
            </Link>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "26px",
                fontWeight: 900,
                color: "#111827",
                letterSpacing: "-1px",
                lineHeight: 1.15,
                margin: "0 0 6px 0",
              }}
            >
              Welcome back 👋
            </h1>
            <p style={{ color: "#6b7280", fontSize: "13px", margin: 0, lineHeight: 1.45 }}>
              Sign in to manage your trips, bookings, and custom itineraries.
            </p>
          </div>

          {/* Validation or server error message */}
          {err && (
            <div
              id="login-error-alert"
              role="alert"
              aria-live="assertive"
              style={{
                padding: "8px 12px",
                borderRadius: "12px",
                background: "rgba(254, 242, 242, 0.95)",
                border: "1px solid rgba(252, 165, 165, 0.6)",
                color: "#dc2626",
                fontSize: "12.5px",
                fontWeight: 600,
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span aria-hidden="true">⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Email field */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Email address
              </label>
              <input
                id="login-email"
                name="email"
                className="inp"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                required
                aria-required="true"
                aria-invalid={!!err}
                aria-describedby={err ? "login-error-alert" : undefined}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  border: "1.5px solid rgba(0, 0, 0, 0.09)",
                  background: "rgba(249, 250, 251, 0.92)",
                  fontSize: "13.5px",
                  color: "#111827",
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: "border-box",
                  height: "40px",
                }}
              />
            </div>

            {/* Password field */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: 0,
                  }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{
                    color: "#f59e0b",
                    fontWeight: 700,
                    fontSize: "11.5px",
                    textDecoration: "none",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  name="password"
                  className="inp"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  required
                  aria-required="true"
                  aria-invalid={!!err}
                  aria-describedby={err ? "login-error-alert" : undefined}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 40px 8px 12px",
                    borderRadius: "12px",
                    border: "1.5px solid rgba(0, 0, 0, 0.09)",
                    background: "rgba(249, 250, 251, 0.92)",
                    fontSize: "13.5px",
                    color: "#111827",
                    fontFamily: "'DM Sans', sans-serif",
                    boxSizing: "border-box",
                    height: "40px",
                  }}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    padding: "5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                  }}
                >
                  {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            {/* Primary Login Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="btn-main"
              style={{
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "#ffffff",
                border: "none",
                fontWeight: 800,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 18px rgba(239, 68, 68, 0.35)",
                marginTop: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? <span aria-live="polite">Signing in…</span> : "Sign In →"}
            </button>

            {/* Google Sign-In Integration */}
            <GoogleSignInButton
              text="signin_with"
              disabled={loading}
              onSuccess={handleAuthSuccess}
              onError={(e) => setErr(e)}
              onLinkingRequired={(msg) => setErr(msg)}
            />
          </form>

          {/* Navigation to Signup */}
          <p
            style={{
              textAlign: "center",
              marginTop: "16px",
              fontSize: "13px",
              color: "#6b7280",
              margin: "16px 0 0 0",
            }}
          >
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              style={{
                color: "#f59e0b",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
