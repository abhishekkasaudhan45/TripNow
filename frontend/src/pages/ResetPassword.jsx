import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | done

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }

    setStatus("saving");
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setStatus("done");
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (e2) {
      setErr(e2?.response?.data?.message || "This reset link is invalid or has expired.");
      setStatus("idle");
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/75 p-8 text-center shadow-xl backdrop-blur">
          <div className="text-3xl">🔗</div>
          <p className="mt-3 text-sm text-slate-700">
            This reset link is missing its token. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block font-bold text-amber-600 hover:text-amber-700"
          >
            Request a new link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/75 p-8 shadow-xl backdrop-blur">
        <h1 className="font-serif text-3xl font-extrabold text-slate-900">Set a new password</h1>

        {status === "done" ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-sm font-medium text-emerald-800">
              Password updated! Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <p className="text-xs text-slate-500">
              Must be 8+ characters with an uppercase letter, a lowercase letter, and a number.
            </p>
            {err && (
              <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">⚠️ {err}</p>
            )}
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-4 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {status === "saving" ? "Saving…" : "Update password →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
