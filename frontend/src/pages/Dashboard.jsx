// frontend/src/pages/Dashboard.jsx
// NEW FEATURES:
//   ✅ Edit modal — destination, check-in, check-out, guests, budget, notes
//   ✅ Save changes via PUT /api/bookings/:id
//   ✅ Inline validation before saving
//   ✅ Success toast on save
//   ✅ Share, Delete, Undo all preserved

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTrips, deleteTrip, updateTrip } from "../services/bookingService";

// ── helpers ────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}
function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0]; // "YYYY-MM-DD" for <input type="date">
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

// ── Trip Card ──────────────────────────────────────────────────────────────
function TripCard({ trip, index, onView, onDelete, onShare, onEdit }) {
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

        {/* Top */}
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
          <h3 className="text-xl font-black tracking-tight capitalize leading-tight"
            style={{ color:"#1a1a2e", fontFamily:"'Playfair Display', serif" }}>
            {trip.destination}
          </h3>
          <p className="text-sm mt-1" style={{ color:"#6b7280" }}>
            {formatDate(trip.checkin)} → {formatDate(trip.checkout)}
          </p>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
            🗓 {days} day{days !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
            👥 {trip.guests ?? 1} guest{(trip.guests ?? 1) !== 1 ? "s" : ""}
          </div>
          {trip.budget && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background:"rgba(255,255,255,0.7)", color:"#374151" }}>
              💰 ₹{trip.budget}
            </div>
          )}
        </div>

        {/* Share button — full width row */}
        <button
          onClick={e => { e.stopPropagation(); onShare(trip._id); }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition"
          style={{ background:"rgba(245,158,11,0.1)", color:"#b45309", border:"1.5px solid rgba(245,158,11,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(245,158,11,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(245,158,11,0.1)"; }}
        >
          🔗 Share Trip Link
        </button>

        {/* Footer: edit + delete + arrow */}
        <div className="flex items-center justify-between pt-1"
          style={{ borderTop:"1px solid rgba(0,0,0,0.06)" }}>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#9ca3af" }}>
            View full plan
          </span>
          <div className="flex items-center gap-2">
            {/* ✅ Edit button */}
            <button
              onClick={e => { e.stopPropagation(); onEdit(trip); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition"
              style={{ background:"rgba(99,102,241,0.1)", color:"#4338ca", border:"1px solid rgba(99,102,241,0.25)" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(99,102,241,0.2)"}
              onMouseLeave={e => e.currentTarget.style.background="rgba(99,102,241,0.1)"}
            >
              ✏️ Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(trip._id); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 transition"
            >
              🗑 Delete
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", boxShadow:"0 2px 8px rgba(239,68,68,0.3)" }}>
              <span className="text-white text-sm">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, accent }) {
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
}

function EmptyState({ onPlan }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 rounded-3xl"
      style={{ background:"rgba(255,255,255,0.5)", border:"2px dashed rgba(0,0,0,0.10)" }}>
      <div className="text-6xl mb-5">🗺️</div>
      <h3 className="text-xl font-black mb-2" style={{ color:"#1a1a2e", fontFamily:"'Playfair Display', serif" }}>No trips yet</h3>
      <p className="text-sm mb-6" style={{ color:"#6b7280" }}>Let AI plan your first unforgettable journey</p>
      <button onClick={onPlan} className="px-6 py-3 rounded-2xl font-bold text-sm text-white"
        style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", boxShadow:"0 4px 16px rgba(239,68,68,0.3)" }}>
        ✦ Plan a Trip with AI
      </button>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────
function EditModal({ trip, onClose, onSaved }) {
  const [form, setForm] = useState({
    destination: trip.destination || "",
    checkin:     toInputDate(trip.checkin),
    checkout:    toInputDate(trip.checkout),
    guests:      String(trip.guests ?? 1),
    budget:      trip.budget || "",
    notes:       trip.notes  || "",
  });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.destination.trim()) { setErr("Destination is required."); return; }
    if (!form.checkin || !form.checkout)  { setErr("Both dates are required."); return; }
    if (new Date(form.checkout) <= new Date(form.checkin)) { setErr("Check-out must be after check-in."); return; }
    if (Number(form.guests) < 1) { setErr("At least 1 guest required."); return; }

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
      onSaved(res.data.data); // pass updated trip back
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width:"100%", padding:"10px 13px", borderRadius:"10px",
    border:"1.5px solid rgba(0,0,0,0.1)", background:"rgba(255,255,255,0.9)",
    fontSize:"14px", fontFamily:"'DM Sans',sans-serif", fontWeight:500,
    color:"#1e293b", outline:"none",
  };
  const labelStyle = { fontSize:"12px", fontWeight:700, color:"#475569", marginBottom:"5px", display:"block" };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div style={{ background:"rgba(255,255,255,0.96)", backdropFilter:"blur(24px)", borderRadius:"20px", width:"100%", maxWidth:"540px", boxShadow:"0 32px 80px rgba(0,0,0,0.18)", border:"1px solid rgba(255,255,255,0.8)", overflow:"hidden" }}>

        {/* Modal header */}
        <div style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"11px", fontWeight:800, letterSpacing:".12em", textTransform:"uppercase", color:"rgba(255,255,255,0.75)", marginBottom:"4px" }}>Edit Trip</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", fontWeight:900, color:"#fff", textTransform:"capitalize" }}>{trip.destination}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"18px", cursor:"pointer", padding:"6px 10px", fontWeight:700 }}>✕</button>
        </div>

        {/* Modal body */}
        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"16px", maxHeight:"70vh", overflowY:"auto" }}>

          {/* Destination */}
          <div>
            <label style={labelStyle}>✈️ Destination *</label>
            <input style={inputStyle} name="destination" value={form.destination} onChange={handle} placeholder="e.g. Goa, Manali, Paris" />
          </div>

          {/* Dates row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              <label style={labelStyle}>📅 Check-in *</label>
              <input style={inputStyle} type="date" name="checkin" value={form.checkin} onChange={handle} />
            </div>
            <div>
              <label style={labelStyle}>📅 Check-out *</label>
              <input style={inputStyle} type="date" name="checkout" value={form.checkout} onChange={handle} />
            </div>
          </div>

          {/* Guests + Budget row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              <label style={labelStyle}>👥 Guests *</label>
              <select style={inputStyle} name="guests" value={form.guests} onChange={handle}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} {n===1?"Person":"People"}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>💰 Budget (₹)</label>
              <input style={inputStyle} name="budget" value={form.budget} onChange={handle} placeholder="e.g. 15000" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>📝 Notes</label>
            <textarea
              style={{ ...inputStyle, resize:"vertical", minHeight:"80px" }}
              name="notes" value={form.notes} onChange={handle}
              placeholder="Any special requirements or notes..."
            />
          </div>

          {/* Error */}
          {err && (
            <div style={{ background:"rgba(244,63,94,0.08)", border:"1px solid rgba(244,63,94,0.25)", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", fontWeight:600, color:"#be123c" }}>
              ⚠️ {err}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:"flex", gap:"10px", marginTop:"4px" }}>
            <button onClick={onClose}
              style={{ flex:1, padding:"12px", borderRadius:"12px", background:"rgba(0,0,0,0.05)", border:"1.5px solid rgba(0,0,0,0.1)", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:700, color:"#374151", cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex:2, padding:"12px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", border:"none", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:800, color:"#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow:"0 4px 16px rgba(239,68,68,0.28)" }}>
              {saving ? "⏳ Saving..." : "💾 Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [deleteId, setDeleteId]   = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [undoData, setUndoData]   = useState(null);
  const [showUndo, setShowUndo]   = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showSaved, setShowSaved]   = useState(false);  // ✅ save toast
  const [editTrip, setEditTrip]     = useState(null);   // ✅ trip being edited

  useEffect(() => {
    getAllTrips()
      .then(r => setTrips(r.data?.data || []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = (id) => {
    const url = `${window.location.origin}/shared-trip/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
    });
  };

  const handleDeleteClick = (id) => { setDeleteId(id); setShowModal(true); };

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

  // ✅ Called when edit modal saves successfully
  const handleSaved = (updatedTrip) => {
    setTrips(prev => prev.map(t => t._id === updatedTrip._id ? updatedTrip : t));
    setEditTrip(null);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2500);
  };

  const filtered     = trips.filter(t => filter === "ai" ? !!t.aiPlan : filter === "manual" ? !t.aiPlan : true);
  const aiCount      = trips.filter(t => !!t.aiPlan).length;
  const totalDays    = trips.reduce((s, t) => s + daysBetween(t.checkin, t.checkout), 0);
  const destinations = new Set(trips.map(t => t.destination?.toLowerCase())).size;
  const handleView   = (trip) => navigate(`/trip/${trip._id}`, { state: trip });

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
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`, opacity:0.4 }} />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30" style={{ background:"radial-gradient(circle,#fbbf24 0%,transparent 70%)", filter:"blur(60px)" }} />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full opacity-25" style={{ background:"radial-gradient(circle,#a78bfa 0%,transparent 70%)", filter:"blur(60px)" }} />
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full opacity-20" style={{ background:"radial-gradient(circle,#fb7185 0%,transparent 70%)", filter:"blur(70px)" }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-white"
              style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)" }}>✦</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color:"#9ca3af" }}>TripNow</p>
              <p className="text-sm font-bold" style={{ color:"#111827" }}>Dashboard</p>
            </div>
          </div>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)", boxShadow:"0 4px 16px rgba(239,68,68,0.28)" }}>
            ＋ Plan New Trip
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-2"
            style={{ color:"#111827", fontFamily:"'Playfair Display',serif" }}>Your Journeys</h1>
          <p className="text-base" style={{ color:"#6b7280" }}>Every adventure you've planned, beautifully organised.</p>
        </div>

        {!loading && trips.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon="🗺️" value={trips.length} label="Total Trips"  accent="#f59e0b" />
            <StatCard icon="✦"  value={aiCount}       label="AI Plans"     accent="#a78bfa" />
            <StatCard icon="📍" value={destinations}  label="Destinations" accent="#fb7185" />
            <StatCard icon="☀️" value={totalDays}     label="Days Planned" accent="#34d399" />
          </div>
        )}

        {!loading && trips.length > 0 && (
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl mb-7"
            style={{ background:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.9)" }}>
            {[["all","All Trips"],["ai","AI Plans"],["manual","Manual"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
                style={filter === val
                  ? { background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", boxShadow:"0 2px 8px rgba(239,68,68,0.25)" }
                  : { color:"#6b7280" }
                }>{label}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="rounded-3xl p-6 animate-pulse" style={{ background:"rgba(255,255,255,0.6)", height:260 }}>
                <div className="w-12 h-12 rounded-2xl mb-4" style={{ background:"#e5e7eb" }} />
                <div className="h-4 rounded-full w-2/3 mb-3" style={{ background:"#e5e7eb" }} />
                <div className="h-3 rounded-full w-1/2" style={{ background:"#f3f4f6" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.length === 0
              ? <EmptyState onPlan={() => navigate("/")} />
              : filtered.map((trip, i) => (
                  <TripCard key={trip._id || i} trip={trip} index={i}
                    onView={handleView}
                    onDelete={handleDeleteClick}
                    onShare={handleShare}
                    onEdit={t => setEditTrip(t)}   // ✅ open edit modal
                  />
                ))
            }
          </div>
        )}

        <div className="mt-16 text-center">
          <span className="text-xs font-medium" style={{ color:"#9ca3af" }}>TripNow · AI-Powered Travel Planning</span>
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editTrip && (
        <EditModal
          trip={editTrip}
          onClose={() => setEditTrip(null)}
          onSaved={handleSaved}
        />
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
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

      {/* ── UNDO TOAST ── */}
      {showUndo && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] animate-slideUp border border-slate-700">
          <span className="text-sm font-medium">Trip deleted</span>
          <button onClick={undoDelete} className="text-amber-400 text-sm font-bold hover:text-amber-300 transition">Undo</button>
        </div>
      )}

      {/* ── LINK COPIED TOAST ── */}
      {showCopied && (
        <div className="fixed bottom-6 left-6 z-[100] animate-slideUp">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff" }}>
            <span style={{ fontSize:"18px" }}>🔗</span>
            <span className="text-sm font-bold">Link copied to clipboard!</span>
          </div>
        </div>
      )}

      {/* ── SAVED TOAST ── */}
      {showSaved && (
        <div className="fixed bottom-6 left-6 z-[100] animate-slideUp">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{ background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff" }}>
            <span style={{ fontSize:"18px" }}>💾</span>
            <span className="text-sm font-bold">Trip updated successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}