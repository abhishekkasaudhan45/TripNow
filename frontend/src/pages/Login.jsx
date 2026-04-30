import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      // ✅ FIX: correct endpoint /api/auth/login
      const res = await api.post("/api/auth/login", form);
      const token = res.data?.data?.token || res.data?.token;
      if (!token) throw new Error("No token received");
      // ✅ Save to localStorage so ProtectedRoute + api.js interceptor both find it
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(res.data?.data?.user || {}));
      navigate("/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.message || "Invalid email or password");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", display:"flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        .inp { transition: border-color 0.2s, box-shadow 0.2s; }
        .inp:focus { outline:none; border-color:rgba(245,158,11,0.7)!important; box-shadow:0 0 0 3px rgba(245,158,11,0.15)!important; }
        .btn-main { transition:transform 0.18s,box-shadow 0.18s; }
        .btn-main:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(239,68,68,0.42)!important; }
        .btn-main:disabled { opacity:0.7; cursor:not-allowed; }
      `}</style>

      {/* ── Left: Photo panel ── */}
      <div className="hidden md:flex flex-col justify-between" style={{ width:"44%", position:"relative", overflow:"hidden" }}>
        <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85" alt=""
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg,rgba(245,158,11,0.72) 0%,rgba(239,68,68,0.62) 50%,rgba(167,139,250,0.52) 100%)" }} />
        <div style={{ position:"relative", padding:"36px 40px" }}>
          <Link to="/" style={{ display:"inline-flex", alignItems:"center", gap:"10px", textDecoration:"none" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"11px", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>✦</div>
            <span style={{ fontWeight:800, color:"#fff", fontSize:"18px" }}>TripNow</span>
          </Link>
        </div>
        <div style={{ position:"relative", padding:"40px" }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(26px,3vw,40px)", fontWeight:900, color:"#fff", lineHeight:1.15, marginBottom:"12px", letterSpacing:"-1px" }}>
            "Every journey<br />begins with a<br /><em>single step."</em>
          </h2>
          <p style={{ color:"rgba(255,255,255,0.72)", fontSize:"14px" }}>Plan yours today with AI.</p>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(160deg,#fff7ed 0%,#fef3c7 30%,#fce7f3 70%,#ede9fe 100%)", padding:"40px 24px", position:"relative" }}>
        <div style={{ position:"absolute", top:"-60px", right:"-60px", width:"280px", height:"280px", borderRadius:"50%", background:"radial-gradient(circle,rgba(251,191,36,0.28) 0%,transparent 70%)", filter:"blur(50px)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"-40px", left:"-40px", width:"240px", height:"240px", borderRadius:"50%", background:"radial-gradient(circle,rgba(167,139,250,0.22) 0%,transparent 70%)", filter:"blur(50px)", pointerEvents:"none" }} />

        <div style={{ position:"relative", width:"100%", maxWidth:"400px" }}>
          {/* Mobile logo */}
          <div className="md:hidden" style={{ textAlign:"center", marginBottom:"32px" }}>
            <Link to="/" style={{ display:"inline-flex", alignItems:"center", gap:"8px", textDecoration:"none" }}>
              <div style={{ width:"34px", height:"34px", borderRadius:"11px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", color:"#fff" }}>✦</div>
              <span style={{ fontWeight:800, color:"#111827", fontSize:"18px" }}>TripNow</span>
            </Link>
          </div>

          <div style={{ marginBottom:"32px" }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"34px", fontWeight:900, color:"#111827", letterSpacing:"-1px", lineHeight:1.1, marginBottom:"7px" }}>
              Welcome back 👋
            </h1>
            <p style={{ color:"#6b7280", fontSize:"15px" }}>Sign in to access your saved trips.</p>
          </div>

          {err && (
            <div style={{ padding:"11px 15px", borderRadius:"13px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#dc2626", fontSize:"13px", fontWeight:600, marginBottom:"18px", display:"flex", alignItems:"center", gap:"8px" }}>
              ⚠️ {err}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"15px" }}>
            {/* Email */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"6px" }}>Email address</label>
              <input className="inp" type="email" placeholder="you@example.com" value={form.email} required
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                style={{ width:"100%", padding:"12px 15px", borderRadius:"13px", border:"1.5px solid rgba(0,0,0,0.10)", background:"rgba(255,255,255,0.82)", fontSize:"14px", color:"#111827", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }} />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"6px" }}>Password</label>
              <div style={{ position:"relative" }}>
                <input className="inp" type={showPass ? "text" : "password"} placeholder="••••••••" value={form.password} required
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ width:"100%", padding:"12px 42px 12px 15px", borderRadius:"13px", border:"1.5px solid rgba(0,0,0,0.10)", background:"rgba(255,255,255,0.82)", fontSize:"14px", color:"#111827", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"16px", color:"#9ca3af" }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-main"
              style={{ padding:"13px", borderRadius:"14px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", border:"none", fontWeight:800, fontSize:"15px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 18px rgba(239,68,68,0.28)", marginTop:"4px" }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <p style={{ textAlign:"center", marginTop:"24px", fontSize:"14px", color:"#6b7280" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color:"#f59e0b", fontWeight:700, textDecoration:"none" }}>Create one free →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}