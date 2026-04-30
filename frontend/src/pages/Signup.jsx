import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ name:"", email:"", password:"", confirm:"" });
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
    setErr(""); setLoading(true);
    try {
      // ✅ FIX: backend route is /api/auth/signup (not /register)
      const res = await api.post("/api/auth/signup", {
        name: form.name, email: form.email, password: form.password,
      });
      const token = res.data?.data?.token || res.data?.token;
      if (!token) throw new Error("No token received");
      // ✅ Save to localStorage — consistent with api.js interceptor
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(res.data?.data?.user || {}));
      navigate("/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.message || "Registration failed. Try again.");
    } finally { setLoading(false); }
  }

  const inputStyle = { width:"100%", padding:"12px 15px", borderRadius:"13px", border:"1.5px solid rgba(0,0,0,0.10)", background:"rgba(255,255,255,0.82)", fontSize:"14px", color:"#111827", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" };

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

      {/* ── Right: Photo panel ── */}
      <div className="hidden md:flex flex-col justify-between" style={{ width:"42%", position:"relative", overflow:"hidden", order:2 }}>
        <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=85" alt=""
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(200deg,rgba(167,139,250,0.72) 0%,rgba(239,68,68,0.58) 50%,rgba(245,158,11,0.62) 100%)" }} />
        {/* Feature cards */}
        <div style={{ position:"absolute", top:"28%", left:"50%", transform:"translateX(-50%)", width:"82%", display:"flex", flexDirection:"column", gap:"10px" }}>
          {[["🗺️","Day-by-day AI itinerary"],["💰","Smart budget planning"],["🍽️","Local food picks"],["🏨","Hotel suggestions"]].map(([icon,text],i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"11px", background:"rgba(255,255,255,0.17)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.28)", borderRadius:"13px", padding:"11px 15px" }}>
              <span style={{ fontSize:"18px" }}>{icon}</span>
              <span style={{ color:"#fff", fontSize:"13px", fontWeight:600 }}>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ position:"relative", padding:"36px 40px" }}>
          <Link to="/" style={{ display:"inline-flex", alignItems:"center", gap:"10px", textDecoration:"none" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"11px", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>✦</div>
            <span style={{ fontWeight:800, color:"#fff", fontSize:"18px" }}>TripNow</span>
          </Link>
        </div>
        <div style={{ position:"relative", padding:"40px" }}>
          <p style={{ color:"rgba(255,255,255,0.78)", fontSize:"14px", lineHeight:1.65 }}>
            Join <strong style={{ color:"#fff" }}>travellers</strong> planning smarter trips with AI.
          </p>
        </div>
      </div>

      {/* ── Left: Form ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(160deg,#fff7ed 0%,#fef3c7 25%,#fde8d8 50%,#fce7f3 75%,#ede9fe 100%)", padding:"40px 24px", position:"relative", order:1 }}>
        <div style={{ position:"absolute", top:"-60px", left:"-60px", width:"280px", height:"280px", borderRadius:"50%", background:"radial-gradient(circle,rgba(251,191,36,0.25) 0%,transparent 70%)", filter:"blur(50px)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"-40px", right:"-40px", width:"240px", height:"240px", borderRadius:"50%", background:"radial-gradient(circle,rgba(251,113,133,0.2) 0%,transparent 70%)", filter:"blur(50px)", pointerEvents:"none" }} />

        <div style={{ position:"relative", width:"100%", maxWidth:"420px" }}>
          <div className="md:hidden" style={{ textAlign:"center", marginBottom:"28px" }}>
            <Link to="/" style={{ display:"inline-flex", alignItems:"center", gap:"8px", textDecoration:"none" }}>
              <div style={{ width:"34px", height:"34px", borderRadius:"11px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", color:"#fff" }}>✦</div>
              <span style={{ fontWeight:800, color:"#111827", fontSize:"18px" }}>TripNow</span>
            </Link>
          </div>

          <div style={{ marginBottom:"28px" }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"32px", fontWeight:900, color:"#111827", letterSpacing:"-1px", lineHeight:1.1, marginBottom:"7px" }}>
              Start your journey ✦
            </h1>
            <p style={{ color:"#6b7280", fontSize:"15px" }}>Free account — no credit card needed.</p>
          </div>

          {err && (
            <div style={{ padding:"11px 15px", borderRadius:"13px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#dc2626", fontSize:"13px", fontWeight:600, marginBottom:"16px", display:"flex", alignItems:"center", gap:"8px" }}>
              ⚠️ {err}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"13px" }}>
            {/* Name */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>Full Name</label>
              <input className="inp" type="text" placeholder="Abhishek Kumar" value={form.name} required
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>Email address</label>
              <input className="inp" type="email" placeholder="you@example.com" value={form.email} required
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>Password</label>
              <div style={{ position:"relative" }}>
                <input className="inp" type={showPass ? "text" : "password"} placeholder="Min 6 characters" value={form.password} required
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ ...inputStyle, paddingRight:"42px" }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"15px", color:"#9ca3af" }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>Confirm Password</label>
              <input className="inp" type="password" placeholder="Repeat password" value={form.confirm} required
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} style={inputStyle} />
            </div>

            <button type="submit" disabled={loading} className="btn-main"
              style={{ padding:"13px", borderRadius:"14px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", border:"none", fontWeight:800, fontSize:"15px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 18px rgba(239,68,68,0.28)", marginTop:"4px" }}>
              {loading ? "Creating account…" : "Create Free Account →"}
            </button>

            <p style={{ textAlign:"center", fontSize:"11px", color:"#9ca3af", lineHeight:1.5 }}>
              By signing up you agree to our Terms & Privacy Policy.
            </p>
          </form>

          <p style={{ textAlign:"center", marginTop:"20px", fontSize:"14px", color:"#6b7280" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color:"#f59e0b", fontWeight:700, textDecoration:"none" }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}