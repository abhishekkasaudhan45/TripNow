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

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Real-time password requirement evaluations based on existing validation rules
  const hasMinLength = form.password.length >= 8;
  const hasLower = /[a-z]/.test(form.password);
  const hasUpper = /[A-Z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const hasMatch = form.confirm.length > 0 && form.password === form.confirm;

  const handleAuthSuccess = (user) => {
    const returnTo = location.state?.returnTo || location.state?.from?.pathname;
    if (returnTo && returnTo !== "/signup") {
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

    const trimmedName = (form.name || "").trim();
    if (trimmedName.length < 2) {
      setErr("Name must be at least 2 characters.");
      return;
    }
    if (!form.email || !form.email.includes("@")) {
      setErr("Please provide a valid email.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (!/[a-z]/.test(form.password)) {
      setErr("Password must include a lowercase letter.");
      return;
    }
    if (!/[A-Z]/.test(form.password)) {
      setErr("Password must include an uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setErr("Password must include a number.");
      return;
    }
    if (form.password !== form.confirm) {
      setErr("Passwords don't match.");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/signup", {
        name: trimmedName,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      const user = res.data?.data?.user || res.data?.user || {};

      // 🔒 Save non-sensitive user profile in memory/storage (token is in HttpOnly cookie)
      saveAuth({ user });
      handleAuthSuccess(user);
    } catch (e) {
      setErr(getAuthErrorMessage(e, "Registration failed. Try again."));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "14px",
    border: "1.5px solid rgba(0, 0, 0, 0.09)",
    background: "rgba(249, 250, 251, 0.92)",
    fontSize: "14px",
    color: "#111827",
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: "border-box",
    height: "44px",
  };

  return (
    <div
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

      {/* ── Right photo & brand panel (Desktop only) ── */}
      <div
        className="hidden md:flex flex-col justify-between"
        style={{
          width: "44%",
          position: "relative",
          overflow: "hidden",
          order: 2,
          borderLeft: "1px solid rgba(255, 255, 255, 0.3)",
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1000&q=85"
          alt="Scenic Mountain Lake with Travelers"
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
              "linear-gradient(200deg, rgba(139, 92, 246, 0.72) 0%, rgba(239, 68, 68, 0.60) 50%, rgba(245, 158, 11, 0.65) 100%)",
          }}
        />

        {/* Top brand header */}
        <div style={{ position: "relative", padding: "36px 40px", zIndex: 2 }}>
          <Link
            to="/"
            aria-label="TripNow Home"
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            <TripNowLogo size={36} theme="dark" />
          </Link>
        </div>

        {/* Feature proposition cards */}
        <div
          style={{
            position: "relative",
            margin: "0 auto",
            width: "84%",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 2,
          }}
        >
          {[
            ["🗺️", "Day-by-day AI itinerary with pacing engine"],
            ["💰", "Deterministic 3-tier international budget intelligence"],
            ["🍽️", "Handpicked authentic local culinary recommendations"],
            ["🏨", "Smart logistics & duration confidence checks"],
          ].map(([icon, text], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(255, 255, 255, 0.18)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                borderRadius: "14px",
                padding: "12px 16px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              }}
            >
              <span style={{ fontSize: "20px" }}>{icon}</span>
              <span style={{ color: "#ffffff", fontSize: "13px", fontWeight: 600 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Bottom caption */}
        <div
          style={{
            position: "relative",
            padding: "44px 40px",
            background: "linear-gradient(to top, rgba(17, 24, 39, 0.45) 0%, transparent 100%)",
            zIndex: 2,
          }}
        >
          <p
            style={{
              color: "rgba(255, 255, 255, 0.90)",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Join thousands of travelers planning smarter, reality-checked trips with TripNow.
          </p>
        </div>
      </div>

      {/* ── Left form panel ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          position: "relative",
          order: 1,
          overflow: "hidden",
        }}
      >
        {/* Decorative Blurred Gradient Blobs */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            left: "-60px",
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
            right: "-40px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251, 113, 133, 0.22) 0%, transparent 70%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        {/* Focused Elevated Auth Card */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "440px",
            background: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: "36px 32px",
            borderRadius: "26px",
            border: "1px solid rgba(255, 255, 255, 0.95)",
            boxShadow:
              "0 16px 48px -12px rgba(0, 0, 0, 0.12), 0 0 1px 1px rgba(255, 255, 255, 0.5)",
          }}
        >
          {/* Mobile brand header */}
          <div className="md:hidden" style={{ textAlign: "center", marginBottom: "28px" }}>
            <Link
              to="/"
              aria-label="TripNow Home"
              style={{ display: "inline-flex", textDecoration: "none" }}
            >
              <TripNowLogo size={34} />
            </Link>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "30px",
                fontWeight: 900,
                color: "#111827",
                letterSpacing: "-1px",
                lineHeight: 1.15,
                margin: "0 0 8px 0",
              }}
            >
              Start your journey ✦
            </h1>
            <p style={{ color: "#6b7280", fontSize: "14px", margin: 0, lineHeight: 1.5 }}>
              Free account — create your personalized itinerary in seconds.
            </p>
          </div>

          {/* Validation or server error message */}
          {err && (
            <div
              id="signup-error-alert"
              role="alert"
              aria-live="assertive"
              style={{
                padding: "11px 14px",
                borderRadius: "12px",
                background: "rgba(254, 242, 242, 0.95)",
                border: "1px solid rgba(252, 165, 165, 0.6)",
                color: "#dc2626",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span aria-hidden="true">⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name"
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Full Name
              </label>
              <input
                id="signup-name"
                name="name"
                className="inp"
                type="text"
                autoComplete="name"
                placeholder="Alex Morgan"
                value={form.name}
                required
                aria-required="true"
                aria-invalid={!!err && (form.name || "").trim().length < 2}
                aria-describedby={err ? "signup-error-alert" : undefined}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="signup-email"
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Email address
              </label>
              <input
                id="signup-email"
                name="email"
                className="inp"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                required
                aria-required="true"
                aria-invalid={!!err && (!form.email || !form.email.includes("@"))}
                aria-describedby={err ? "signup-error-alert" : undefined}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-password"
                  name="password"
                  className="inp"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 upper, 1 number"
                  value={form.password}
                  required
                  aria-required="true"
                  aria-invalid={!!err && form.password.length < 8}
                  aria-describedby={err ? "signup-error-alert" : "signup-password-hints"}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                  }}
                >
                  {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>

              {/* Real-time Password Requirements Checklist */}
              <div
                id="signup-password-hints"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 8px",
                  marginTop: "8px",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: hasMinLength ? "#059669" : "#6b7280", fontWeight: hasMinLength ? 700 : 500 }}>
                  <span>{hasMinLength ? "✓" : "○"}</span>
                  <span>8+ characters</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: hasUpper ? "#059669" : "#6b7280", fontWeight: hasUpper ? 700 : 500 }}>
                  <span>{hasUpper ? "✓" : "○"}</span>
                  <span>1 uppercase letter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: hasLower ? "#059669" : "#6b7280", fontWeight: hasLower ? 700 : 500 }}>
                  <span>{hasLower ? "✓" : "○"}</span>
                  <span>1 lowercase letter</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: hasNumber ? "#059669" : "#6b7280", fontWeight: hasNumber ? 700 : 500 }}>
                  <span>{hasNumber ? "✓" : "○"}</span>
                  <span>1 number</span>
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <label
                  htmlFor="signup-confirm"
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: 0,
                  }}
                >
                  Confirm Password
                </label>
                {form.confirm.length > 0 && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: hasMatch ? "#059669" : "#dc2626",
                    }}
                  >
                    {hasMatch ? "✓ Passwords match" : "✕ Passwords must match"}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-confirm"
                  name="confirmPassword"
                  className="inp"
                  type={showConfirmPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={form.confirm}
                  required
                  aria-required="true"
                  aria-invalid={!!err && form.password !== form.confirm}
                  aria-describedby={err ? "signup-error-alert" : undefined}
                  onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowConfirmPass((s) => !s)}
                  aria-label={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
                  aria-pressed={showConfirmPass}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    padding: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                  }}
                >
                  {showConfirmPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            {/* Primary Signup Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="btn-main"
              style={{
                height: "46px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "#ffffff",
                border: "none",
                fontWeight: 800,
                fontSize: "15px",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 18px rgba(239, 68, 68, 0.35)",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? <span aria-live="polite">Creating account…</span> : "Create Free Account →"}
            </button>

            {/* Google Sign-In Integration */}
            <GoogleSignInButton
              text="signup_with"
              disabled={loading}
              onSuccess={handleAuthSuccess}
              onError={(e) => setErr(e)}
              onLinkingRequired={(msg) => setErr(msg)}
            />

            {/* Terms and Privacy policy notice */}
            <p
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: "#6b7280",
                lineHeight: 1.5,
                margin: "4px 0 0 0",
              }}
            >
              By signing up you agree to our{" "}
              <Link to="/terms" style={{ color: "#b45309", fontWeight: 700, textDecoration: "none" }}>
                Terms
              </Link>{" "}
              &amp;{" "}
              <Link to="/privacy" style={{ color: "#b45309", fontWeight: 700, textDecoration: "none" }}>
                Privacy Policy
              </Link>
              .
            </p>
          </form>

          {/* Navigation to Login */}
          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "14px",
              color: "#6b7280",
              margin: "20px 0 0 0",
            }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              style={{
                color: "#f59e0b",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
