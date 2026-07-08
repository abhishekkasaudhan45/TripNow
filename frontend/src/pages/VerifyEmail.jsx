import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMsg("This verification link is missing its token.");
      return;
    }
    let active = true;
    api
      .get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!active) return;
        setStatus("success");
        setMsg(res.data?.message || "Email verified successfully. Thank you!");
      })
      .catch((err) => {
        if (!active) return;
        setStatus("error");
        setMsg(err?.response?.data?.message || "This verification link is invalid or has expired.");
      });
    return () => { active = false; };
  }, [token]);

  const icon = status === "success" ? "✅" : status === "error" ? "⚠️" : "⏳";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/75 p-8 text-center shadow-xl backdrop-blur">
        <div className="text-4xl">{icon}</div>
        <h1 className="mt-4 font-serif text-2xl font-extrabold text-slate-900">
          {status === "verifying" ? "Verifying your email…" : "Email verification"}
        </h1>
        {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}

        {status !== "verifying" && (
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5"
          >
            Continue to sign in →
          </Link>
        )}
      </div>
    </div>
  );
}
