// frontend/src/pages/Dashboard.jsx
// ✅ Weather Widget       — live weather for each trip destination via open-meteo
// ✅ Cost Splitter        — split trip budget across N people, shows per-person breakdown
// ✅ User Profile         — avatar, name, email pulled from sessionStorage/localStorage
// ✅ Fix user trip filtering — trips are now fetched with userId from token (via API)
// ✅ Admin role check     — Admin Panel button only shows for role === "admin"
// ✅ Mobile Polish        — Responsive headers, buttons, and TripSkeleton grid applied!
// ✅ Performance Polish   — Added useMemo, useCallback, and React.memo to prevent re-renders
// ✅ Debounced Search     — Seamlessly search through saved trips!
// ✅ Bug Fix              — Fixed React inline style typo (justifyContent)

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTrips, deleteTrip, updateTrip } from "../services/bookingService";

import { TripSkeleton } from "../components/Skeletons";
import Search from "../components/Search";

// ── Auth helper ───────────────────────────────────────────────────────────
function getStoredUser() {
  try {
    const raw = sessionStorage.getItem("user") || localStorage.getItem("user") || "";
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function getStoredToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token") || "";
}

// ── Formatters ────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}
function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
}
function getDestinationEmoji(dest = "") {
  const d = dest.toLowerCase();
  if (["goa","beach","bali","maldives","phuket"].some(k => d.includes(k))) return "🏖️";
  if (["himalaya","manali","shimla","nepal","leh","ladakh","kashmir"].some(k => d.includes(k))) return "🏔️";
  if (["paris","london","rome","europe","france","italy"].some(k => d.includes(k))) return "🗼";
  if (["dubai","uae","abu dhabi"].some(k => d.includes(k))) return "🌇";
  if (["singapore","tokyo","japan","korea","thailand"].some(k => d.includes(k))) return "🌏";
  return "✈️";
}
const GRADIENTS = [
  "from-rose-400/20 via-orange-300/10 to-amber-400/20",
  "from-sky-400/20 via-indigo-300/10 to-violet-400/20",
  "from-emerald-400/20 via-teal-300/10 to-cyan-400/20",
  "from-fuchsia-400/20 via-pink-300/10 to-rose-400/20",
  "from-amber-400/20 via-yellow-300/10 to-lime-400/20",
  "from-indigo-400/20 via-blue-300/10 to-sky-400/20",
];

// ── Weather Widget ────────────────────────────────────────────────────────
function WeatherWidget({ destination }) {
  const [weather, setWeather] = useState(null);
  const [wErr,    setWErr]    = useState(false);

  useEffect(() => {
    if (!destination) return;
    setWeather(null); setWErr(false);

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (!data?.length) { setWErr(true); return; }
        const { lat, lon } = data[0];
        return fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=auto`
        );
      })
      .then(r => r?.json())
      .then(d => {
        if (!d?.current) { setWErr(true); return; }
        setWeather(d.current);
      })
      .catch(() => setWErr(true));
  }, [destination]);

  const wmoIcon = (code) => {
    if (code === 0) return "☀️";
    if (code <= 2)  return "⛅";
    if (code <= 9)  return "🌤️";
    if (code <= 49) return "🌫️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "❄️";
    if (code <= 82) return "🌦️";
    if (code <= 99) return "⛈️";
    return "🌡️";
  };

  if (wErr) return null;
  if (!weather) return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.5)", border:"1px solid rgba(0,0,0,0.06)" }}>
      <span style={{ fontSize:"12px", color:"#9ca3af" }}>🌡️ Loading weather…</span>
    </div>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 13px", borderRadius:"10px", background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.2)", flexWrap:"wrap" }}>
      <span style={{ fontSize:"18px" }}>{wmoIcon(weather.weathercode)}</span>
      <span style={{ fontSize:"13px", fontWeight:700, color:"#0369a1" }}>{Math.round(weather.temperature_2m)}°C</span>
      <span style={{ fontSize:"11px", color:"#6b7280" }}>💧{weather.relative_humidity_2m}% · 💨{Math.round(weather.windspeed_10m)}km/h</span>
    </div>
  );
}

// ── Cost Splitter Modal ───────────────────────────────────────────────────
function CostSplitterModal({ trip, onClose }) {
  const [people,    setPeople]    = useState(Math.max(2, Number(trip.travelers ?? trip.guests ?? 2)));
  const [budgetVal, setBudgetVal] = useState(String(trip.budget || ""));
  const [extra,     setExtra]     = useState("");

  const totalBudget = Number(budgetVal) || 0;
  const extraNum    = Number(extra)     || 0;
  const grand       = totalBudget + extraNum;
  const perPerson   = people > 0 && grand > 0 ? Math.ceil(grand / people) : 0;

  const categories = [
    { label:"Transport",     pct:0.30, icon:"🚌" },
    { label:"Accommodation", pct:0.35, icon:"🏨" },
    { label:"Food",          pct:0.20, icon:"🍽️" },
    { label:"Activities",    pct:0.10, icon:"🎯" },
    { label:"Misc",          pct:0.05, icon:"🛍️" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div style={{ background:"rgba(255,255,255,0.97)", borderRadius:"20px", width:"100%", maxWidth:"480px", boxShadow:"0 32px 80px rgba(0,0,0,0.18)", border:"1px solid rgba(255,255,255,0.8)", overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"11px", fontWeight:800, letterSpacing:".12em", textTransform:"uppercase", color:"rgba(255,255,255,0.7)", marginBottom:"4px" }}>Cost Splitter</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"20px", fontWeight:900, color:"#fff", textTransform:"capitalize" }}>{trip.destination}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"18px", cursor:"pointer", padding:"6px 10px" }}>✕</button>
        </div>
        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px", maxHeight:"75vh", overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div style={{ gridColumn:"1" }}>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".06em", display:"block", marginBottom:"6px" }}>People</label>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <button onClick={() => setPeople(p => Math.max(1, p-1))}
                  style={{ width:"28px", height:"28px", borderRadius:"6px", border:"1.5px solid rgba(0,0,0,0.1)", background:"#f8fafc", fontSize:"15px", cursor:"pointer", fontWeight:700, flexShrink:0 }}>−</button>
                <span style={{ fontSize:"18px", fontWeight:800, color:"#0369a1", minWidth:"22px", textAlign:"center" }}>{people}</span>
                <button onClick={() => setPeople(p => p+1)}
                  style={{ width:"28px", height:"28px", borderRadius:"6px", border:"1.5px solid rgba(0,0,0,0.1)", background:"#f8fafc", fontSize:"15px", cursor:"pointer", fontWeight:700, flexShrink:0 }}>+</button>
              </div>
            </div>
            <div style={{ gridColumn:"2" }}>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".06em", display:"block", marginBottom:"6px" }}>Budget (₹)</label>
              <input type="number" value={budgetVal} onChange={e => setBudgetVal(e.target.value)} placeholder="Enter amount"
                style={{ width:"100%", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid rgba(0,0,0,0.1)", background:"rgba(255,255,255,0.9)", fontSize:"13px", fontWeight:600, color:"#1e293b", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ gridColumn:"3" }}>
              <label style={{ fontSize:"11px", fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".06em", display:"block", marginBottom:"6px" }}>Extras (₹)</label>
              <input type="number" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0"
                style={{ width:"100%", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid rgba(0,0,0,0.1)", background:"rgba(255,255,255,0.9)", fontSize:"13px", fontWeight:600, color:"#1e293b", outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>

          <div style={{ background:"linear-gradient(135deg,rgba(14,165,233,0.1),rgba(139,92,246,0.1))", border:"1px solid rgba(14,165,233,0.25)", borderRadius:"14px", padding:"18px 20px", textAlign:"center" }}>
            <div style={{ fontSize:"11px", fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:".1em", marginBottom:"6px" }}>Per Person</div>
            <div style={{ fontSize:"36px", fontWeight:900, color:"#0369a1", fontFamily:"'Playfair Display',serif" }}>
              {perPerson > 0 ? `₹${perPerson.toLocaleString("en-IN")}` : "—"}
            </div>
            <div style={{ fontSize:"12px", color:"#9ca3af", marginTop:"4px" }}>
              {grand > 0 ? `₹${grand.toLocaleString("en-IN")} total ÷ ${people} people` : "Enter a budget above to calculate"}
            </div>
          </div>

          {grand > 0 && (
            <div>
              <div style={{ fontSize:"11px", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".1em", marginBottom:"10px" }}>Per-Person Breakdown</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {categories.map(({ label, pct, icon }) => {
                  const amt  = Math.round((grand * pct) / people);
                  const barW = Math.round(pct * 100);
                  return (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      <span style={{ fontSize:"15px", width:"20px", flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                          <span style={{ fontSize:"12px", fontWeight:600, color:"#374151" }}>{label}</span>
                          <span style={{ fontSize:"12px", fontWeight:700, color:"#0369a1" }}>₹{amt.toLocaleString("en-IN")}</span>
                        </div>
                        <div style={{ height:"4px", borderRadius:"4px", background:"rgba(0,0,0,0.06)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${barW}%`, background:"linear-gradient(90deg,#0ea5e9,#8b5cf6)", borderRadius:"4px" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={onClose}
            style={{ padding:"12px", borderRadius:"12px", background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)", border:"none", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:800, color:"#fff", cursor:"pointer" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Profile Panel ────────────────────────────────────────────────────
function ProfilePanel({ user: initialUser, tripCount, onClose }) {
  const [user, setUser]       = useState(initialUser);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!initialUser?.email || !initialUser?.role) {
      setFetching(true);
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          const freshUser = d?.data?.user || d?.data || d?.user || null;
          if (freshUser) {
            setUser(freshUser);
            const storage = sessionStorage.getItem("token") ? sessionStorage : localStorage;
            storage.setItem("user", JSON.stringify(freshUser));
          }
        })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [initialUser]);

  const name     = user?.name     || "Traveller";
  const email    = user?.email    || "";
  const role     = user?.role     || "user";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[200] p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"rgba(255,255,255,0.97)", borderRadius:"20px", width:"100%", maxWidth:"360px", boxShadow:"0 32px 80px rgba(0,0,0,0.18)", border:"1px solid rgba(255,255,255,0.8)", overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", padding:"28px 24px 20px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:"14px", right:"14px", background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"16px", cursor:"pointer", padding:"4px 9px" }}>✕</button>
          <div style={{ width:"60px", height:"60px", borderRadius:"18px", background:"rgba(255,255,255,0.25)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", fontWeight:900, color:"#fff", marginBottom:"12px", border:"2px solid rgba(255,255,255,0.4)" }}>
            {fetching ? "…" : initials}
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", fontWeight:900, color:"#fff" }}>{name}</div>
          <div style={{ fontSize:"13px", color:"rgba(255,255,255,0.8)", marginTop:"3px" }}>{fetching ? "Loading profile…" : (email || "No email on record")}</div>
          <span style={{ marginTop:"10px", display:"inline-flex", alignItems:"center", gap:"4px", padding:"3px 10px", borderRadius:"20px", background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.4)", fontSize:"11px", fontWeight:700, color:"#fff", letterSpacing:".06em" }}>
            {role === "admin" ? "👑 ADMIN" : "🧳 TRAVELLER"}
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
          {[
            ["Trips",  tripCount,                          "#f59e0b"],
            ["Role",   role === "admin" ? "Admin" : "User","#8b5cf6"],
            ["Status", "Active",                           "#10b981"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ padding:"16px 12px", textAlign:"center" }}>
              <div style={{ fontSize:"16px", fontWeight:800, color, fontFamily:"'Playfair Display',serif" }}>{val}</div>
              <div style={{ fontSize:"11px", color:"#9ca3af", fontWeight:600, marginTop:"2px" }}>{label}</div>
            </div>
          ))}
        </div>
        {user?._id && (
          <div style={{ padding:"12px 20px 0", display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ flex:1, padding:"10px 14px", borderRadius:"10px", background:"rgba(0,0,0,0.03)", border:"1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:"10px", fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".08em" }}>Member ID</div>
              <div style={{ fontSize:"12px", fontWeight:600, color:"#374151", marginTop:"2px", wordBreak:"break-all" }}>{String(user._id).slice(-8).toUpperCase()}</div>
            </div>
          </div>
        )}
        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:"8px" }}>
          <button onClick={handleLogout}
            style={{ padding:"12px", borderRadius:"12px", background:"rgba(239,68,68,0.08)", border:"1.5px solid rgba(239,68,68,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:700, color:"#dc2626", cursor:"pointer" }}>
            🚪 Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────
function EditModal({ trip, onClose, onSaved }) {
  const [form, setForm] = useState({
    destination: trip.destination || "",
    checkin:     toInputDate(trip.checkin),
    checkout:    toInputDate(trip.checkout),
    guests:      String(trip.guests ?? 1),
    budget:      trip.budget || "",
    notes:       trip.notes  || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.destination.trim())                                          { setErr("Destination is required."); return; }
    if (!form.checkin || !form.checkout)                                   { setErr("Both dates are required."); return; }
    if (new Date(form.checkout) <= new Date(form.checkin))                 { setErr("Check-out must be after check-in."); return; }
    if (Number(form.guests) < 1)                                           { setErr("At least 1 guest required."); return; }
    setErr(""); setSaving(true);
    try {
      const res = await updateTrip(trip._id, {
        destination: form.destination.trim(),
        checkin:  new Date(form.checkin).toISOString(),
        checkout: new Date(form.checkout).toISOString(),
        guests:   Number(form.guests),
        budget:   form.budget.trim(),
        notes:    form.notes.trim(),
      });
      onSaved(res.data.data);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  };

  const inp = { width:"100%", padding:"10px 13px", borderRadius:"10px", border:"1.5px solid rgba(0,0,0,0.1)", background:"rgba(255,255,255,0.9)", fontSize:"14px", fontFamily:"'DM Sans',sans-serif", fontWeight:500, color:"#1e293b", outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:"12px", fontWeight:700, color:"#475569", marginBottom:"5px", display:"block" };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div style={{ background:"rgba(255,255,255,0.96)", backdropFilter:"blur(24px)", borderRadius:"20px", width:"100%", maxWidth:"540px", boxShadow:"0 32px 80px rgba(0,0,0,0.18)", border:"1px solid rgba(255,255,255,0.8)", overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"11px", fontWeight:800, letterSpacing:".12em", textTransform:"uppercase", color:"rgba(255,255,255,0.75)", marginBottom:"4px" }}>Edit Trip</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", fontWeight:900, color:"#fff", textTransform:"capitalize" }}>{trip.destination}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"18px", cursor:"pointer", padding:"6px 10px", fontWeight:700 }}>✕</button>
        </div>
        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px", maxHeight:"70vh", overflowY:"auto" }}>
          <div><label style={lbl}>✈️ Destination *</label><input style={inp} name="destination" value={form.destination} onChange={handle} placeholder="e.g. Goa, Manali, Paris" /></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div><label style={lbl}>📅 Check-in *</label><input style={inp} type="date" name="checkin" value={form.checkin} onChange={handle} /></div>
            <div><label style={lbl}>📅 Check-out *</label><input style={inp} type="date" name="checkout" value={form.checkout} onChange={handle} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              <label style={lbl}>👥 Guests *</label>
              <select style={inp} name="guests" value={form.guests} onChange={handle}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} {n===1?"Person":"People"}</option>)}
              </select>
            </div>
            <div><label style={lbl}>💰 Budget (₹)</label><input style={inp} name="budget" value={form.budget} onChange={handle} placeholder="e.g. 15000" /></div>
          </div>
          <div><label style={lbl}>📝 Notes</label><textarea style={{ ...inp, resize:"vertical", minHeight:"80px" }} name="notes" value={form.notes} onChange={handle} placeholder="Any special requirements..." /></div>
          {err && <div style={{ background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.25)", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", fontWeight:600, color:"#be123c" }}>⚠️ {err}</div>}
          <div style={{ display:"flex", gap:"10px", marginTop:"4px" }}>
            <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:"12px", background:"rgba(0,0,0,0.05)", border:"1.5px solid rgba(0,0,0,0.1)", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:700, color:"#374151", cursor:"pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"12px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", border:"none", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:800, color:"#fff", cursor:saving?"not-allowed":"pointer", opacity:saving?0.7:1, boxShadow:"0 4px 16px rgba(239,68,68,0.28)" }}>
              {saving ? "⏳ Saving..." : "💾 Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trip Card (✅ Memoized for Performance) ───────────────────────────────
const TripCard = memo(function TripCard({ trip, index, onView, onDelete, onShare, onEdit, onSplit }) {
  const days  = daysBetween(trip.checkin, trip.checkout);
  const grad  = GRADIENTS[index % GRADIENTS.length];
  const emoji = getDestinationEmoji(trip.destination);
  const isAI  = !!trip.aiPlan;

  return (
    <div
      className="group relative rounded-3xl overflow-hidden cursor-pointer"
      style={{ background:"rgba(255,255,255,0.72)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.9)", boxShadow:"0 4px 24px rgba(0,0,0,0.07)", transition:"transform 0.25s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s ease" }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px) scale(1.01)"; e.currentTarget.style.boxShadow="0 16px 48px rgba(0,0,0,0.13)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.07)"; }}
      onClick={() => onView(trip)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-60 pointer-events-none`} />
      <div className="relative p-6 flex flex-col gap-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background:"rgba(255,255,255,0.8)", boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
            {emoji}
          </div>
          {isAI && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background:"rgba(251,191,36,0.15)", color:"#b45309", border:"1px solid rgba(251,191,36,0.35)" }}>
              ✦ AI Plan
            </span>
          )}
        </div>
        {/* Destination + dates */}
        <div>
          <h3 className="text-xl font-black tracking-tight capitalize leading-tight" style={{ color:"#1a1a2e", fontFamily:"'Playfair Display', serif" }}>
            {trip.destination}
          </h3>
          <p className="text-sm mt-1" style={{ color:"#6b7280" }}>
            {formatDate(trip.checkin)} → {formatDate(trip.checkout)}
          </p>
        </div>
        {/* ✅ WEATHER WIDGET inline on card */}
        <WeatherWidget destination={trip.destination} />
        {/* Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
            🗓 {days} day{days !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
            👥 {trip.guests ?? 1}
          </div>
          {trip.budget && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
              💰 ₹{trip.budget}
            </div>
          )}
        </div>
        {/* Actions row */}
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {/* Share */}
          <button onClick={e => { e.stopPropagation(); onShare(trip._id); }}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition"
            style={{ background:"rgba(245,158,11,0.1)", color:"#b45309", border:"1.5px solid rgba(245,158,11,0.3)", minWidth:"80px" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(245,158,11,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(245,158,11,0.1)"}>
            🔗 Share
          </button>
          {/* Cost Splitter */}
          <button onClick={e => { e.stopPropagation(); onSplit(trip); }}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition"
            style={{ background:"rgba(14,165,233,0.1)", color:"#0369a1", border:"1.5px solid rgba(14,165,233,0.3)", minWidth:"80px" }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(14,165,233,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(14,165,233,0.1)"}>
            ÷ Split Cost
          </button>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between pt-1" style={{ borderTop:"1px solid rgba(0,0,0,0.06)" }}>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#9ca3af" }}>View plan</span>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); onEdit(trip); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{ background:"rgba(99,102,241,0.1)", color:"#4338ca", border:"1px solid rgba(99,102,241,0.25)" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(99,102,241,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background="rgba(99,102,241,0.1)"}>
              ✏️ Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(trip._id); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 transition">
              🗑
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", boxShadow:"0 2px 8px rgba(239,68,68,0.3)" }}>
              <span className="text-white text-sm">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Stat Card (✅ Memoized for Performance) ───────────────────────────────
const StatCard = memo(function StatCard({ icon, value, label, accent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl px-5 py-4"
      style={{ background:"rgba(255,255,255,0.75)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.9)", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background:accent+"22", border:`1.5px solid ${accent}44` }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black leading-none" style={{ color:"#111827", fontFamily:"'Playfair Display', serif" }}>{value}</p>
        <p className="text-xs mt-0.5 font-medium" style={{ color:"#6b7280" }}>{label}</p>
      </div>
    </div>
  );
});

function EmptyState({ onPlan }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 rounded-3xl"
      style={{ background:"rgba(255,255,255,0.5)", border:"2px dashed rgba(0,0,0,0.10)" }}>
      <div className="text-6xl mb-5">🗺️</div>
      <h3 className="text-xl font-black mb-2" style={{ color:"#1a1a2e", fontFamily:"'Playfair Display',serif" }}>No trips yet</h3>
      <p className="text-sm mb-6" style={{ color:"#6b7280" }}>Let AI plan your first unforgettable journey</p>
      <button onClick={onPlan} className="px-6 py-3 rounded-2xl font-bold text-sm text-white"
        style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", boxShadow:"0 4px 16px rgba(239,68,68,0.3)" }}>
        ✦ Plan a Trip with AI
      </button>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();

  // ✅ USER PROFILE — read from storage
  const currentUser = getStoredUser();
  const isAdmin     = currentUser?.role === "admin";

  const [trips, setTrips]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId]       = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [undoData, setUndoData]       = useState(null);
  const [showUndo, setShowUndo]       = useState(false);
  const [showCopied, setShowCopied]   = useState(false);
  const [showSaved, setShowSaved]     = useState(false);
  const [editTrip, setEditTrip]       = useState(null);
  const [splitTrip, setSplitTrip]     = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    getAllTrips()
      .then(r => setTrips(r.data?.data || []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, []);

  // ✅ CALLBACKS: Stabilized to prevent breaking child component memoization
  const handleShare = useCallback((id) => {
    const url = `${window.location.origin}/shared-trip/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
    });
  }, []);

  const handleDeleteClick = useCallback((id) => { 
    setDeleteId(id); 
    setShowModal(true); 
  }, []);

  const handleEdit = useCallback((trip) => {
    setEditTrip(trip);
  }, []);

  const handleSplit = useCallback((trip) => {
    setSplitTrip(trip);
  }, []);

  const handleView = useCallback((trip) => {
    navigate(`/trip/${trip._id}`, { state: trip });
  }, [navigate]);

  const confirmDelete = async () => {
    try {
      const tripToDelete = trips.find(t => t._id === deleteId);
      await deleteTrip(deleteId);
      setTrips(prev => prev.filter(t => t._id !== deleteId));
      setUndoData(tripToDelete);
      setShowUndo(true);
      setTimeout(() => { setShowUndo(false); setUndoData(null); }, 4000);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setShowModal(false);
      setDeleteId(null);
    }
  };

  const undoDelete = () => {
    if (undoData) { setTrips(prev => [undoData, ...prev]); setShowUndo(false); }
  };

  const handleSaved = (updatedTrip) => {
    setTrips(prev => prev.map(t => t._id === updatedTrip._id ? updatedTrip : t));
    setEditTrip(null);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2500);
  };

  // ✅ USEMEMO: Expensive derived list filtering
  const filtered = useMemo(() => {
    return trips.filter(t => {
      // 1. Tab filter
      let matchesTab = true;
      if (filter === "ai")     matchesTab = !!t.aiPlan;
      if (filter === "manual") matchesTab = !t.aiPlan;
      
      // 2. Search query filter
      const matchesSearch = t.destination?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesTab && matchesSearch;
    });
  }, [trips, filter, searchQuery]);

  // ✅ USEMEMO: Expensive math and set calculations
  const { aiCount, totalDays, destinations } = useMemo(() => {
    const aiCount = trips.filter(t => !!t.aiPlan).length;
    const totalDays = trips.reduce((s, t) => s + daysBetween(t.checkin, t.checkout), 0);
    const destinations = new Set(trips.map(t => t.destination?.toLowerCase())).size;
    return { aiCount, totalDays, destinations };
  }, [trips]);

  // User initials for avatar
  const initials = (currentUser?.name || "U").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div className="min-h-screen"
      style={{ background:"linear-gradient(135deg,#fff7ed 0%,#fef3c7 20%,#fde8d8 40%,#fce7f3 60%,#ede9fe 80%,#e0f2fe 100%)", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        .animate-scaleIn{animation:scaleIn 0.2s ease-out forwards;}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .animate-slideUp{animation:slideUp 0.3s ease-out forwards;}
      `}</style>

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30" style={{ background:"radial-gradient(circle,#fbbf24 0%,transparent 70%)", filter:"blur(60px)" }} />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-25" style={{ background:"radial-gradient(circle,#a78bfa 0%,transparent 70%)", filter:"blur(60px)" }} />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full opacity-20" style={{ background:"radial-gradient(circle,#fb7185 0%,transparent 70%)", filter:"blur(70px)" }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-white"
              style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)" }}>✦</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color:"#9ca3af" }}>TripNow</p>
              <p className="text-sm font-bold" style={{ color:"#111827" }}>Dashboard</p>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {/* ✅ Admin Panel button — only shown to admins */}
            {isAdmin && (
              <button onClick={() => navigate("/admin")}
                style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"12px", background:"rgba(139,92,246,0.1)", border:"1.5px solid rgba(139,92,246,0.3)", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", fontWeight:700, color:"#6d28d9", cursor:"pointer" }}>
                👑 Admin Panel
              </button>
            )}

            <button onClick={() => navigate("/")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
              style={{ background:"linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)", boxShadow:"0 4px 16px rgba(239,68,68,0.28)" }}>
              ＋ New Trip
            </button>

            {/* ✅ User Profile Avatar (FIXED TYPO) */}
            <button
              onClick={() => setShowProfile(true)}
              style={{ width:"40px", height:"40px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", fontWeight:900, color:"#fff", border:"none", cursor:"pointer", boxShadow:"0 2px 8px rgba(239,68,68,0.3)", flexShrink:0 }}
              title={currentUser?.name || "Profile"}
            >
              {initials}
            </button>
          </div>
        </div>

        {/* ── Page title ── */}
        <div className="mb-8 mt-4 sm:mt-0">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none mb-2 text-gray-900 font-['Playfair_Display']">Your Journeys</h1>
          <p className="text-sm sm:text-base text-gray-500">
            {currentUser?.name ? `Welcome back, ${currentUser.name.split(" ")[0]}! ` : ""}
            Every adventure you've planned, beautifully organised.
          </p>
        </div>

        {/* ── Stats ── */}
        {!loading && trips.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon="🗺️" value={trips.length} label="Total Trips"  accent="#f59e0b" />
            <StatCard icon="✦"  value={aiCount}       label="AI Plans"     accent="#a78bfa" />
            <StatCard icon="📍" value={destinations}  label="Destinations" accent="#fb7185" />
            <StatCard icon="☀️" value={totalDays}     label="Days Planned" accent="#34d399" />
          </div>
        )}

        {/* ── FILTERS & SEARCH ── */}
        {!loading && trips.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            
            {/* Filter Tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl"
              style={{ background:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.9)" }}>
              {[["all","All Trips"],["ai","AI Plans"],["manual","Manual"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
                  style={filter === val
                    ? { background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", boxShadow:"0 2px 8px rgba(239,68,68,0.25)" }
                    : { color:"#6b7280" }
                  }>
                  {label}
                  {val !== "all" && (
                    <span style={{ marginLeft:"5px", fontSize:"11px", opacity:0.75 }}>
                      ({val === "ai" ? aiCount : trips.length - aiCount})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ✅ ADDED DEBOUNCED SEARCH */}
            <Search onSearch={(val) => setSearchQuery(val)} />
            
          </div>
        )}

        {/* ── Trip grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <TripSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.length === 0
              ? <EmptyState onPlan={() => navigate("/")} />
              : filtered.map((trip, i) => (
                  <TripCard key={trip._id || i} trip={trip} index={i}
                    onView={handleView}
                    onDelete={handleDeleteClick}
                    onShare={handleShare}
                    onEdit={handleEdit}
                    onSplit={handleSplit}   // ✅ Cost splitter
                  />
                ))
            }
          </div>
        )}

        <div className="mt-16 text-center">
          <span className="text-xs font-medium" style={{ color:"#9ca3af" }}>TripNow · AI-Powered Travel Planning</span>
        </div>
      </div>

      {/* ── MODALS & TOASTS ── */}

      {editTrip && <EditModal trip={editTrip} onClose={() => setEditTrip(null)} onSaved={handleSaved} />}

      {/* ✅ Cost Splitter Modal */}
      {splitTrip && <CostSplitterModal trip={splitTrip} onClose={() => setSplitTrip(null)} />}

      {/* ✅ User Profile Panel */}
      {showProfile && <ProfilePanel user={currentUser} tripCount={trips.length} onClose={() => setShowProfile(false)} />}

      {/* Delete confirm */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-2xl w-[90%] max-w-sm shadow-2xl animate-scaleIn border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete this trip?</h2>
            <p className="text-gray-500 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast */}
      {showUndo && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] animate-slideUp border border-slate-700">
          <span className="text-sm font-medium">Trip deleted</span>
          <button onClick={undoDelete} className="text-amber-400 text-sm font-bold hover:text-amber-300 transition">Undo</button>
        </div>
      )}

      {/* Link copied toast */}
      {showCopied && (
        <div className="fixed bottom-6 left-6 z-[100] animate-slideUp">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff" }}>
            <span style={{ fontSize:"18px" }}>🔗</span>
            <span className="text-sm font-bold">Link copied!</span>
          </div>
        </div>
      )}

      {/* Saved toast */}
      {showSaved && (
        <div className="fixed bottom-6 left-6 z-[100] animate-slideUp">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff" }}>
            <span style={{ fontSize:"18px" }}>💾</span>
            <span className="text-sm font-bold">Trip updated!</span>
          </div>
        </div>
      )}
    </div>
  );
}