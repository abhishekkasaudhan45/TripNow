import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Booking() {
  const { state } = useLocation();
  const navigate  = useNavigate();

  const destination = state?.destination || "";
  const budget      = state?.budget      || "";
  const startDate   = state?.checkin     || state?.startDate || "";
  const endDate     = state?.checkout    || state?.endDate   || "";
  const tripData    = state?.tripData    || null;

  const dayCount = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
    : 0;

  const [form, setForm]         = useState({ fullName:"", email:"", phone:"", travelers:"1", notes:"" });
  const [status, setStatus]     = useState("idle");
  const [errMsg, setErrMsg]     = useState("");
  const [bookingId, setBookingId] = useState(null);

  const noState = !destination;
  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone) {
      setErrMsg("Please fill in your name, email, and phone."); return;
    }
    setErrMsg(""); setStatus("loading");

    try {
      // ✅ FIX: Always ensure valid dates before sending
      // If no dates provided, use today + tomorrow as safe defaults
      const today    = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const safeCheckin  = startDate ? new Date(startDate)  : today;
      const safeCheckout = endDate   ? new Date(endDate)    : tomorrow;

      // ✅ FIX: Ensure checkout is always after checkin
      const finalCheckout = safeCheckout > safeCheckin
        ? safeCheckout
        : new Date(safeCheckin.getTime() + 86400000); // checkin + 1 day

      const payload = {
        destination,
        guests:   Number(form.travelers),
        checkin:  safeCheckin.toISOString(),
        checkout: finalCheckout.toISOString(),
        budget,
        dayCount,
        fullName: form.fullName,
        email:    form.email,
        phone:    form.phone,
        notes:    form.notes,
        aiPlan:   tripData || null,
      };

      const res = await api.post("/api/bookings", payload);
      setBookingId(res.data?.data?._id || "CONFIRMED");
      setStatus("success");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "Booking failed. Please try again.";
      setErrMsg(msg);
      setStatus("error");
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
    .bk-root { min-height:100vh; background:linear-gradient(160deg,#fff7ed 0%,#fef3c7 20%,#fde8d8 40%,#fce7f3 65%,#ede9fe 100%); position:relative; overflow:hidden; font-family:'DM Sans',sans-serif; color:#1e293b; display:flex; flex-direction:column; align-items:center; padding:48px 20px 80px; }
    .bk-orb { position:fixed; border-radius:50%; filter:blur(70px); pointer-events:none; z-index:0; }
    .bk-orb-1 { top:-10%; left:-10%; width:50vw; height:50vw; background:radial-gradient(circle,rgba(255,174,92,0.28) 0%,transparent 70%); }
    .bk-orb-2 { bottom:-15%; right:-8%; width:55vw; height:55vw; background:radial-gradient(circle,rgba(167,139,250,0.22) 0%,transparent 70%); }
    .bk-card { position:relative; z-index:1; width:100%; max-width:820px; background:rgba(255,255,255,0.75); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.9); border-radius:24px; box-shadow:0 24px 60px rgba(0,0,0,0.08); overflow:hidden; }
    .bk-hero { background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%); padding:32px 36px 28px; position:relative; }
    .bk-hero-back { position:absolute; top:20px; left:20px; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.35); color:#fff; border-radius:8px; padding:6px 14px; font-size:13px; font-weight:700; cursor:pointer; backdrop-filter:blur(8px); transition:background 0.2s; font-family:'DM Sans',sans-serif; }
    .bk-hero-back:hover { background:rgba(255,255,255,0.32); }
    .bk-hero-label { font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,0.75); margin-bottom:8px; margin-top:28px; }
    .bk-hero-title { font-family:'Playfair Display',serif; font-size:36px; font-weight:900; color:#fff; line-height:1.1; text-transform:capitalize; }
    .bk-hero-title em { font-style:italic; }
    .bk-hero-pills { display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
    .bk-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); border-radius:100px; font-size:12px; font-weight:700; color:#fff; }
    .bk-body { padding:32px 36px; display:flex; flex-direction:column; gap:26px; }
    .bk-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .bk-stat { background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.06); border-radius:14px; padding:14px 16px; text-align:center; }
    .bk-stat-label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; margin-bottom:4px; }
    .bk-stat-val { font-size:20px; font-weight:800; color:#1e293b; }
    .bk-stat-val.amber { color:#b45309; }
    .bk-stat-val.green { color:#047857; }
    .bk-stat-val.sky { color:#0369a1; font-size:15px; text-transform:capitalize; }
    .bk-section-title { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#94a3b8; margin-bottom:14px; }
    .bk-form { display:flex; flex-direction:column; gap:14px; }
    .bk-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .bk-field { display:flex; flex-direction:column; gap:6px; }
    .bk-label { font-size:12px; font-weight:700; color:#475569; letter-spacing:.03em; }
    .bk-input,.bk-textarea,.bk-select { padding:11px 14px; background:rgba(255,255,255,0.85); border:1.5px solid rgba(0,0,0,0.09); border-radius:12px; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:500; color:#1e293b; outline:none; transition:border-color 0.2s,box-shadow 0.2s; }
    .bk-input:focus,.bk-textarea:focus,.bk-select:focus { border-color:#f59e0b; box-shadow:0 0 0 3px rgba(245,158,11,0.14); }
    .bk-textarea { resize:vertical; min-height:80px; }
    .bk-divider { height:1px; background:rgba(0,0,0,0.06); }
    .bk-total-row { display:flex; justify-content:space-between; align-items:center; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.22); border-radius:14px; padding:16px 20px; }
    .bk-total-label { font-size:13px; font-weight:700; color:#047857; }
    .bk-total-val { font-size:22px; font-weight:800; color:#047857; }
    .bk-error { background:rgba(244,63,94,0.08); border:1px solid rgba(244,63,94,0.22); border-radius:12px; padding:12px 16px; font-size:13px; font-weight:600; color:#be123c; }
    .bk-cta { width:100%; padding:15px; background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%); border:none; border-radius:14px; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:800; color:#fff; cursor:pointer; box-shadow:0 6px 20px rgba(239,68,68,0.28); transition:transform 0.15s,box-shadow 0.15s,opacity 0.15s; }
    .bk-cta:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 28px rgba(239,68,68,0.36); }
    .bk-cta:disabled { opacity:0.65; cursor:not-allowed; }
    .bk-success { position:relative; z-index:1; width:100%; max-width:500px; background:rgba(255,255,255,0.82); backdrop-filter:blur(24px); border:1px solid rgba(255,255,255,0.9); border-radius:28px; box-shadow:0 24px 60px rgba(0,0,0,0.08); padding:52px 40px; text-align:center; animation:bkPopIn 0.5s cubic-bezier(0.16,1,0.3,1); }
    @keyframes bkPopIn { 0%{transform:scale(0.85);opacity:0;} 100%{transform:scale(1);opacity:1;} }
    .bk-success-icon { font-size:60px; margin-bottom:18px; animation:bkBounce 1.8s ease-in-out infinite; }
    @keyframes bkBounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-12px);} }
    .bk-success-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:900; color:#047857; margin-bottom:10px; }
    .bk-success-sub { font-size:14px; color:#64748b; line-height:1.65; }
    .bk-booking-id { display:inline-block; margin-top:14px; padding:6px 18px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.28); border-radius:100px; font-size:12px; font-weight:800; color:#047857; word-break:break-all; }
    .bk-success-actions { display:flex; gap:12px; margin-top:28px; }
    .bk-btn-dash { flex:1; padding:12px; background:linear-gradient(135deg,#f59e0b,#ef4444); border:none; border-radius:12px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; color:#fff; cursor:pointer; transition:transform 0.15s; }
    .bk-btn-dash:hover { transform:translateY(-1px); }
    .bk-btn-home { flex:1; padding:12px; background:rgba(255,255,255,0.85); border:1.5px solid rgba(0,0,0,0.1); border-radius:12px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; color:#374151; cursor:pointer; }
    .bk-btn-home:hover { background:#fff; }
    .bk-empty { position:relative; z-index:1; width:100%; max-width:480px; background:rgba(255,255,255,0.80); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.9); border-radius:28px; box-shadow:0 20px 50px rgba(0,0,0,0.07); padding:52px 36px; text-align:center; }
    .bk-empty-icon { font-size:56px; margin-bottom:18px; }
    .bk-empty-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:900; color:#111827; margin-bottom:10px; }
    .bk-empty-sub { font-size:14px; color:#6b7280; line-height:1.65; margin-bottom:24px; }
    .bk-empty-btn { display:inline-flex; align-items:center; gap:8px; padding:13px 28px; background:linear-gradient(135deg,#f59e0b,#ef4444); border:none; border-radius:14px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:800; color:#fff; cursor:pointer; box-shadow:0 4px 18px rgba(239,68,68,0.28); transition:transform 0.18s; }
    .bk-empty-btn:hover { transform:translateY(-2px); }
    @media(max-width:600px) { .bk-hero{padding:28px 20px 22px;} .bk-body{padding:22px 18px;} .bk-summary{grid-template-columns:1fr 1fr;} .bk-row{grid-template-columns:1fr;} .bk-hero-title{font-size:26px;} .bk-success{padding:40px 24px;} }
  `;

  // ── No state: direct URL visit ─────────────────────────────────────────
  if (noState) return (
    <>
      <style>{css}</style>
      <div className="bk-root">
        <div className="bk-orb bk-orb-1" /><div className="bk-orb bk-orb-2" />
        <div className="bk-empty">
          <div className="bk-empty-icon">✈️</div>
          <div className="bk-empty-title">Plan a Trip First</div>
          <p className="bk-empty-sub">Use our AI Planner to generate your itinerary, then confirm your booking here.</p>
          <button className="bk-empty-btn" onClick={() => navigate("/")}>✦ Start Planning →</button>
        </div>
      </div>
    </>
  );

  // ── Success ────────────────────────────────────────────────────────────
  if (status === "success") return (
    <>
      <style>{css}</style>
      <div className="bk-root">
        <div className="bk-orb bk-orb-1" /><div className="bk-orb bk-orb-2" />
        <div className="bk-success">
          <div className="bk-success-icon">🎉</div>
          <div className="bk-success-title">Booking Confirmed!</div>
          <p className="bk-success-sub">Your trip to <strong style={{textTransform:"capitalize"}}>{destination}</strong> is booked! Details sent to <strong>{form.email}</strong>.</p>
          {bookingId && <div className="bk-booking-id">Booking ID: {bookingId}</div>}
          <div className="bk-success-actions">
            <button className="bk-btn-dash" onClick={() => navigate("/dashboard")}>📋 My Trips</button>
            <button className="bk-btn-home" onClick={() => navigate("/")}>🏠 Go Home</button>
          </div>
        </div>
      </div>
    </>
  );

  // ── Main form ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="bk-root">
        <div className="bk-orb bk-orb-1" /><div className="bk-orb bk-orb-2" />
        <div className="bk-card">
          <div className="bk-hero">
            <button className="bk-hero-back" onClick={() => navigate(-1)}>← Back</button>
            <div className="bk-hero-label">Review & Confirm</div>
            <div className="bk-hero-title">Trip to <em>{destination}</em></div>
            <div className="bk-hero-pills">
              {startDate && <span className="bk-pill">📅 {startDate} → {endDate}</span>}
              {dayCount > 0 && <span className="bk-pill">🌙 {dayCount} Days</span>}
              {budget && <span className="bk-pill">💰 ₹{budget}</span>}
            </div>
          </div>

          <div className="bk-body">
            <div>
              <div className="bk-section-title">Trip Summary</div>
              <div className="bk-summary">
                <div className="bk-stat"><div className="bk-stat-label">Duration</div><div className="bk-stat-val amber">{dayCount || "—"} Days</div></div>
                <div className="bk-stat"><div className="bk-stat-label">Budget</div><div className="bk-stat-val green">₹{Number(budget||0).toLocaleString("en-IN")}</div></div>
                <div className="bk-stat"><div className="bk-stat-label">Destination</div><div className="bk-stat-val sky">{destination}</div></div>
              </div>
            </div>

            <div className="bk-divider" />

            <div>
              <div className="bk-section-title">Traveller Details</div>
              <div className="bk-form">
                <div className="bk-row">
                  <div className="bk-field">
                    <label className="bk-label">Full Name *</label>
                    <input className="bk-input" name="fullName" placeholder="e.g. Arjun Sharma" value={form.fullName} onChange={handleChange} />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">Email Address *</label>
                    <input className="bk-input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
                  </div>
                </div>
                <div className="bk-row">
                  <div className="bk-field">
                    <label className="bk-label">Phone Number *</label>
                    <input className="bk-input" name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">No. of Travellers</label>
                    <select className="bk-select" name="travelers" value={form.travelers} onChange={handleChange}>
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n===1?"Person":"People"}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bk-field">
                  <label className="bk-label">Special Requests / Notes</label>
                  <textarea className="bk-textarea" name="notes" placeholder="Dietary needs, accessibility, or special requests..." value={form.notes} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="bk-divider" />

            <div className="bk-total-row">
              <span className="bk-total-label">💰 Total Budget</span>
              <span className="bk-total-val">₹{Number(budget||0).toLocaleString("en-IN")}</span>
            </div>

            {(errMsg || status === "error") && (
              <div className="bk-error">⚠️ {errMsg || "Something went wrong."}</div>
            )}

            <button className="bk-cta" onClick={handleSubmit} disabled={status==="loading"}>
              {status === "loading" ? "⏳ Confirming…" : "✈️ Confirm Booking"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}