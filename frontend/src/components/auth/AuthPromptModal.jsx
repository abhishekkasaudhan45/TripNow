// frontend/src/components/auth/AuthPromptModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../lib/api";
import { saveAuth, getAuthErrorMessage } from "../../utils/auth";
import GoogleSignInButton from "./GoogleSignInButton";

export default function AuthPromptModal({
  isOpen,
  onClose,
  tripId,
  stagedTrip,
  destination = "",
  onAuthSuccess,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const modalRef = useRef(null);
  const initialInputRef = useRef(null);

  // Reset state and manage focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLoading(false);
      setForm({ name: "", email: "", password: "", confirm: "" });

      const timer = setTimeout(() => {
        initialInputRef.current?.focus();
      }, 50);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, mode]);

  // Handle Escape key and focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        onClose();
        return;
      }

      // Accessible Focus Trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleInlineSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    // Basic frontend validations
    if (!form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup") {
      const trimmedName = (form.name || "").trim();
      if (trimmedName.length < 2) {
        setError("Name must be at least 2 characters.");
        return;
      }
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (!/[a-z]/.test(form.password)) {
        setError("Password must include a lowercase letter.");
        return;
      }
      if (!/[A-Z]/.test(form.password)) {
        setError("Password must include an uppercase letter.");
        return;
      }
      if (!/[0-9]/.test(form.password)) {
        setError("Password must include a number.");
        return;
      }
      if (form.password !== form.confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      setLoading(true);

      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "login"
          ? { email: form.email.trim().toLowerCase(), password: form.password }
          : { name: (form.name || "").trim(), email: form.email.trim().toLowerCase(), password: form.password };

      const res = await api.post(endpoint, payload);
      const user = res.data?.data?.user || res.data?.user || {};

      // 🔒 Save non-sensitive user profile metadata in localStorage.
      // JWT auth token is stored strictly in secure HttpOnly cookies.
      saveAuth({ user });

      if (typeof onAuthSuccess === "function") {
        await onAuthSuccess(user);
      }
    } catch (err) {
      setError(
        getAuthErrorMessage(
          err,
          mode === "login"
            ? "Invalid email or password. Please try again."
            : "Registration failed. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToFullAuth = (targetPath) => {
    if (loading) return;
    onClose();
    navigate(targetPath, {
      state: {
        returnTo: location.pathname,
        stagedTrip,
        tripId,
        destination,
      },
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex="-1"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ animation: "scaleIn 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
              🔒 Authentication Required
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Close authentication modal"
              className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors text-lg font-bold"
            >
              ✕
            </button>
          </div>
          <h2 id="auth-modal-title" className="text-xl font-bold text-gray-900 tracking-tight">
            Sign In to Save Changes
          </h2>
          <p id="auth-modal-desc" className="text-xs text-gray-600 mt-1 leading-relaxed">
            Please log in or create an account to save this itinerary to your personal trip vault.
            Your unsaved draft will be preserved.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-100 bg-gray-50/80 p-1 m-4 mb-2 rounded-xl" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "login"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            disabled={loading}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "signup"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <span className="text-base font-bold leading-none">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleInlineSubmit} className="p-6 pt-3 space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
              <input
                ref={mode === "signup" ? initialInputRef : null}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Traveler"
                disabled={loading}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
            <input
              ref={mode === "login" ? initialInputRef : null}
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              disabled={loading}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="••••••••"
                disabled={loading}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin text-sm">⏳</span>
                  <span>{mode === "login" ? "Logging in..." : "Creating account..."}</span>
                </>
              ) : (
                <span>{mode === "login" ? "Log In & Continue" : "Create Account & Continue"}</span>
              )}
            </button>

            <GoogleSignInButton
              text={mode === "login" ? "signin_with" : "signup_with"}
              disabled={loading}
              onSuccess={async (user) => {
                if (typeof onAuthSuccess === "function") {
                  await onAuthSuccess(user);
                }
              }}
              onError={(err) => setError(err)}
              onLinkingRequired={(msg) => {
                setMode("login");
                setError(msg);
              }}
            />

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel (Keep Draft)
            </button>
          </div>
        </form>

        {/* Footer Deep-links */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500 flex items-center justify-between">
          <span>Prefer full screen?</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleNavigateToFullAuth("/login")}
              disabled={loading}
              className="text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
            >
              Go to Login Page
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleNavigateToFullAuth("/signup")}
              disabled={loading}
              className="text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
            >
              Go to Sign Up Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

