import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setMsg("");
    try {
      const res = await api.post("/api/auth/forgot-password", { email });
      setMsg(res.data?.message || "If an account exists, a reset link is on its way.");
      setStatus("sent");
    } catch (err) {
      // Backend intentionally returns generic success; only network errors land here.
      setMsg(err?.response?.data?.message || "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/75 p-8 shadow-xl backdrop-blur">
        <h1 className="font-serif text-3xl font-extrabold text-slate-900">Forgot password?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email and we'll send you a link to reset it.
        </p>

        {status === "sent" ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-3xl">📬</div>
            <p className="mt-2 text-sm font-medium text-emerald-800">{msg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {msg && (
              <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">⚠️ {msg}</p>
            )}
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-4 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-70"
            >
              {status === "sending" ? "Sending…" : "Send reset link →"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link to="/login" className="font-bold text-amber-600 hover:text-amber-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
