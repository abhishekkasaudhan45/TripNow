// frontend/src/pages/SharedTrip.jsx
// Public page — no auth required.
// Route: /shared-trip/:id

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSharedTrip } from "../services/bookingService";

// ── helpers ────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
}

/**
 * Booking.aiPlan is stored as a String in MongoDB.
 * It may be raw JSON or wrapped in ```json ... ``` code fences.
 * This safely parses it into an object.
 */
function parseAiPlan(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw; // already parsed
  try {
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export default function SharedTrip() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [trip, setTrip]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [openDays, setOpenDays] = useState({ 0: true });
  const [activeTab, setActiveTab] = useState("Itinerary");

  useEffect(() => {
    getSharedTrip(id)
      .then(res => setTrip(res.data))
      .catch(() => setError("This trip link is invalid or has been removed."))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleDay = (i) => setOpenDays(p => ({ ...p, [i]: !p[i] }));

  // ✅ Correct Booking model fields
  const dest     = trip?.destination || "";
  const budget   = trip?.budget      || "";            // may be undefined — model doesn't have budget but kept for display
  const checkin  = trip?.checkin     || "";
  const checkout = trip?.checkout    || "";
  const guests   = trip?.guests      ?? 1;
  const days     = daysBetween(checkin, checkout);

  // ✅ aiPlan is a String in Booking model — must be parsed
  const aiPlan   = parseAiPlan(trip?.aiPlan);

  // ── STYLES ────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .st-root {
      min-height: 100vh;
      background: #0b0f1a;
      font-family: 'Syne', sans-serif;
      color: #e2e8f0;
      position: relative;
      overflow-x: hidden;
    }

    /* ── starfield ── */
    .st-stars {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(1px 1px at 15% 20%, rgba(255,255,255,0.55) 0%, transparent 100%),
        radial-gradient(1px 1px at 42% 55%, rgba(255,255,255,0.45) 0%, transparent 100%),
        radial-gradient(1px 1px at 70% 30%, rgba(255,255,255,0.4)  0%, transparent 100%),
        radial-gradient(1px 1px at 85% 72%, rgba(255,255,255,0.55) 0%, transparent 100%),
        radial-gradient(1px 1px at 28% 80%, rgba(255,255,255,0.3)  0%, transparent 100%),
        radial-gradient(1px 1px at 57% 10%, rgba(255,255,255,0.45) 0%, transparent 100%),
        radial-gradient(1px 1px at 92% 44%, rgba(255,255,255,0.35) 0%, transparent 100%);
    }
    .st-orb-1 {
      position: fixed; top: -20%; left: -15%;
      width: 60vw; height: 60vw; border-radius: 50%;
      background: radial-gradient(circle, rgba(245,158,11,0.11) 0%, transparent 65%);
      filter: blur(60px); pointer-events: none; z-index: 0;
      animation: stFloat 24s ease-in-out infinite;
    }
    .st-orb-2 {
      position: fixed; bottom: -20%; right: -15%;
      width: 55vw; height: 55vw; border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,0.11) 0%, transparent 65%);
      filter: blur(70px); pointer-events: none; z-index: 0;
      animation: stFloat 30s ease-in-out infinite reverse;
    }
    @keyframes stFloat {
      0%,100% { transform: translate(0,0); }
      50%      { transform: translate(3%, 5%); }
    }

    /* ── TOP CTA BANNER ── */
    .st-cta {
      position: relative; z-index: 10;
      background: linear-gradient(90deg, rgba(245,158,11,0.14) 0%, rgba(239,68,68,0.11) 100%);
      border-bottom: 1px solid rgba(245,158,11,0.18);
      padding: 12px 24px;
      display: flex; align-items: center; justify-content: center; gap: 14px;
      flex-wrap: wrap; text-align: center;
    }
    .st-cta-text { font-size: 13px; font-weight: 700; color: #fcd34d; letter-spacing: 0.02em; }
    .st-cta-btn {
      padding: 7px 20px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      border: none; border-radius: 100px;
      font-family: 'Syne', sans-serif;
      font-size: 12px; font-weight: 800; color: #fff;
      cursor: pointer; letter-spacing: 0.04em;
      box-shadow: 0 4px 16px rgba(245,158,11,0.28);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .st-cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(245,158,11,0.4); }

    /* ── WRAPPER ── */
    .st-wrap {
      position: relative; z-index: 1;
      max-width: 900px; margin: 0 auto;
      padding: 48px 20px 80px;
    }

    /* ── HERO CARD ── */
    .st-hero {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 40px 40px 36px;
      margin-bottom: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04);
    }
    .st-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 14px; border-radius: 100px;
      background: rgba(245,158,11,0.12);
      border: 1px solid rgba(245,158,11,0.28);
      font-size: 10px; font-weight: 800;
      letter-spacing: .14em; text-transform: uppercase;
      color: #fbbf24; margin-bottom: 20px;
    }
    .st-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(34px, 6vw, 58px);
      font-weight: 700; line-height: 1.05;
      color: #f8fafc; text-transform: capitalize;
      margin-bottom: 8px;
    }
    .st-title em { font-style: italic; color: #fbbf24; }
    .st-dates { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 24px; }
    .st-pills { display: flex; gap: 10px; flex-wrap: wrap; }
    .st-pill {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 16px; border-radius: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      font-size: 13px; font-weight: 600; color: #cbd5e1;
    }
    .st-pill b { font-weight: 800; color: #f8fafc; }

    /* ── MAIN PANEL ── */
    .st-panel {
      background: rgba(255,255,255,0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }

    /* ── TABS ── */
    .st-tabs {
      display: flex; gap: 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(0,0,0,0.18);
      overflow-x: auto;
    }
    .st-tab {
      padding: 14px 20px;
      font-size: 11px; font-weight: 800;
      letter-spacing: .1em; text-transform: uppercase;
      color: #334155; cursor: pointer;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      transition: color 0.2s, border-color 0.2s;
    }
    .st-tab:hover { color: #64748b; }
    .st-tab.active { color: #fbbf24; border-bottom-color: #f59e0b; }

    .st-content { padding: 28px 32px; display: flex; flex-direction: column; gap: 20px; }

    /* ── STAT CARDS ── */
    .st-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .st-stat {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px; padding: 16px; text-align: center;
    }
    .st-stat-lbl { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #334155; margin-bottom: 6px; }
    .st-stat-val { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; color: #f8fafc; }
    .st-stat-val.amber { color: #fbbf24; }
    .st-stat-val.green { color: #34d399; }
    .st-stat-val.violet { color: #c084fc; }

    /* ── SECTION LABEL ── */
    .st-sec { font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #334155; }

    /* ── DAY ACCORDION ── */
    .st-day {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px; overflow: hidden;
      transition: border-color 0.2s;
    }
    .st-day.open { border-color: rgba(245,158,11,0.22); }
    .st-day-hdr { display: flex; align-items: center; cursor: pointer; user-select: none; }
    .st-day-num {
      width: 52px; height: 52px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #334155;
      border-right: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
    }
    .st-day-num.c0 { color: #fbbf24; }
    .st-day-num.c1 { color: #34d399; }
    .st-day-num.c2 { color: #60a5fa; }
    .st-day-num.c3 { color: #c084fc; }
    .st-day-ttl { flex: 1; padding: 0 16px; font-size: 14px; font-weight: 700; color: #e2e8f0; }
    .st-day-chev { padding: 0 18px; color: #334155; font-size: 13px; transition: transform 0.3s; flex-shrink: 0; }
    .st-day-chev.open { transform: rotate(180deg); color: #fbbf24; }

    .st-day-body {
      border-top: 1px solid rgba(255,255,255,0.05);
      display: none;
      grid-template-columns: 1fr 1fr 1fr;
      background: rgba(0,0,0,0.14);
    }
    .st-day-body.open { display: grid; }
    @media (max-width: 640px) { .st-day-body.open { grid-template-columns: 1fr; } }

    .st-slot { padding: 16px; border-right: 1px solid rgba(255,255,255,0.04); }
    .st-slot:last-child { border-right: none; }
    .st-slot-lbl {
      font-size: 10px; font-weight: 800; letter-spacing: .12em;
      text-transform: uppercase; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .st-slot-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .st-slot-txt { font-size: 13px; font-weight: 500; color: #64748b; line-height: 1.65; }

    /* ── BUDGET ── */
    .st-bgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .st-brow {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
    }
    .st-brow.total { grid-column: 1/-1; border-color: rgba(52,211,153,0.22); background: rgba(52,211,153,0.05); }
    .st-bkey { font-size: 12px; font-weight: 600; color: #475569; text-transform: capitalize; }
    .st-bval { font-size: 14px; font-weight: 800; color: #34d399; }
    .st-brow.total .st-bval { font-size: 18px; }

    /* ── TIPS GRID ── */
    .st-tgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .st-tip {
      display: flex; gap: 12px; padding: 14px 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; transition: border-color 0.2s;
    }
    .st-tip:hover { border-color: rgba(245,158,11,0.18); }
    .st-tip-n { font-size: 12px; font-weight: 800; color: #334155; flex-shrink: 0; min-width: 22px; }
    .st-tip-t { font-size: 13px; font-weight: 500; color: #64748b; line-height: 1.6; }

    /* ── BOTTOM CTA ── */
    .st-bcta {
      margin-top: 28px;
      background: rgba(255,255,255,0.02);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(245,158,11,0.14);
      border-radius: 20px; padding: 40px 32px;
      text-align: center;
    }
    .st-bcta-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 30px; font-weight: 700;
      color: #f8fafc; margin-bottom: 10px;
    }
    .st-bcta-sub { font-size: 14px; font-weight: 500; color: #475569; line-height: 1.65; margin-bottom: 24px; }
    .st-bcta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 14px 32px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      border: none; border-radius: 14px;
      font-family: 'Syne', sans-serif;
      font-size: 15px; font-weight: 800; color: #fff;
      cursor: pointer; letter-spacing: .03em;
      box-shadow: 0 8px 28px rgba(245,158,11,0.28);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .st-bcta-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(245,158,11,0.38); }

    /* ── LOADING / ERROR ── */
    .st-center {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 70vh; gap: 20px; text-align: center;
    }
    .st-spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(245,158,11,0.14);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 640px) {
      .st-hero    { padding: 28px 20px 24px; }
      .st-content { padding: 20px 16px; }
      .st-stats   { grid-template-columns: 1fr 1fr; }
      .st-bgrid, .st-tgrid { grid-template-columns: 1fr; }
      .st-bcta    { padding: 28px 20px; }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="st-root">
        <div className="st-stars" />
        <div className="st-orb-1" />
        <div className="st-orb-2" />

        {/* ── Top CTA Banner ── */}
        <div className="st-cta">
          <span className="st-cta-text">✦ This AI trip was planned on TripNow</span>
          <button className="st-cta-btn" onClick={() => navigate("/signup")}>
            ✈️ Plan Your Own Trip — Free
          </button>
        </div>

        <div className="st-wrap">

          {/* ── LOADING ── */}
          {loading && (
            <div className="st-center">
              <div className="st-spinner" />
              <p style={{ color:"#334155", fontSize:"14px", fontWeight:600 }}>Loading trip…</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {!loading && error && (
            <div className="st-center">
              <div style={{ fontSize:"52px" }}>🗺️</div>
              <p style={{ color:"#f87171", fontSize:"16px", fontWeight:700 }}>{error}</p>
              <button className="st-cta-btn" style={{ marginTop:"8px" }} onClick={() => navigate("/")}>
                Go to TripNow
              </button>
            </div>
          )}

          {/* ── MAIN CONTENT ── */}
          {!loading && !error && trip && (
            <>
              {/* Hero */}
              <div className="st-hero">
                <div className="st-badge">🔗 Shared Trip</div>
                <div className="st-title">Trip to <em>{dest}</em></div>
                <div className="st-dates">{formatDate(checkin)} → {formatDate(checkout)}</div>
                <div className="st-pills">
                  <div className="st-pill">🌙 <b>{days}</b> day{days !== 1 ? "s" : ""}</div>
                  <div className="st-pill">👥 <b>{guests}</b> guest{guests !== 1 ? "s" : ""}</div>
                  {budget && <div className="st-pill">💰 <b>₹{budget}</b></div>}
                  {aiPlan  && <div className="st-pill">✦ <b>AI Generated</b></div>}
                </div>
              </div>

              {/* AI Plan panel */}
              {aiPlan ? (
                <div className="st-panel">
                  <div className="st-tabs">
                    {["Itinerary","Budget","Food & Stays","Tips"].map(t => (
                      <div key={t} className={`st-tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                        {t}
                      </div>
                    ))}
                  </div>

                  <div className="st-content">

                    {/* ── ITINERARY TAB ── */}
                    {activeTab === "Itinerary" && (
                      <>
                        <div className="st-stats">
                          <div className="st-stat">
                            <div className="st-stat-lbl">Days</div>
                            <div className="st-stat-val amber">{days}</div>
                          </div>
                          <div className="st-stat">
                            <div className="st-stat-lbl">Guests</div>
                            <div className="st-stat-val green">{guests}</div>
                          </div>
                          <div className="st-stat">
                            <div className="st-stat-lbl">Activities</div>
                            <div className="st-stat-val violet">{(aiPlan.days?.length || 0) * 3}+</div>
                          </div>
                        </div>

                        {aiPlan.bestTimeToVisit && (
                          <div style={{ padding:"12px 16px", background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.16)", borderRadius:"10px", fontSize:"13px", fontWeight:600, color:"#7dd3fc" }}>
                            🗓 Best time to visit: <strong style={{ color:"#e2e8f0" }}>{aiPlan.bestTimeToVisit}</strong>
                          </div>
                        )}

                        <div className="st-sec">Day-by-day itinerary</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                          {aiPlan.days?.map((day, i) => (
                            <div key={i} className={`st-day ${openDays[i] ? "open" : ""}`}>
                              <div className="st-day-hdr" onClick={() => toggleDay(i)}>
                                <div className={`st-day-num c${i % 4}`}>D{day.day}</div>
                                <div className="st-day-ttl">{day.title || `Day ${day.day}`}</div>
                                <div className={`st-day-chev ${openDays[i] ? "open" : ""}`}>▾</div>
                              </div>
                              <div className={`st-day-body ${openDays[i] ? "open" : ""}`}>
                                <div className="st-slot">
                                  <div className="st-slot-lbl" style={{ color:"#fbbf24" }}>
                                    <div className="st-slot-dot" style={{ background:"#f59e0b" }} />Morning
                                  </div>
                                  <div className="st-slot-txt">{day.morning}</div>
                                </div>
                                <div className="st-slot">
                                  <div className="st-slot-lbl" style={{ color:"#60a5fa" }}>
                                    <div className="st-slot-dot" style={{ background:"#60a5fa" }} />Afternoon
                                  </div>
                                  <div className="st-slot-txt">{day.afternoon}</div>
                                </div>
                                <div className="st-slot">
                                  <div className="st-slot-lbl" style={{ color:"#c084fc" }}>
                                    <div className="st-slot-dot" style={{ background:"#c084fc" }} />Evening
                                  </div>
                                  <div className="st-slot-txt">{day.evening}</div>
                                  {day.food?.length > 0 && (
                                    <div style={{ marginTop:"10px", padding:"8px 10px", background:"rgba(245,158,11,0.07)", borderRadius:"6px", border:"1px solid rgba(245,158,11,0.14)" }}>
                                      <b style={{ fontSize:"10px", color:"#fbbf24", textTransform:"uppercase", letterSpacing:"0.05em" }}>🍽️ Eats:</b>
                                      {day.food.map((f, fi) => (
                                        <div key={fi} style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>• {f}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── BUDGET TAB ── */}
                    {activeTab === "Budget" && aiPlan.budgetBreakdown && (
                      <>
                        <div className="st-sec">Budget breakdown</div>
                        <div className="st-bgrid">
                          {Object.entries(aiPlan.budgetBreakdown).map(([k, v]) => (
                            <div key={k} className={`st-brow ${k.toLowerCase().includes("total") ? "total" : ""}`}>
                              <span className="st-bkey">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                              <span className="st-bval">{v}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── FOOD & STAYS TAB ── */}
                    {activeTab === "Food & Stays" && (
                      <>
                        {aiPlan.whereToStay && (
                          <>
                            <div className="st-sec">Where to stay</div>
                            <div className="st-bgrid" style={{ marginBottom:"20px" }}>
                              <div className="st-brow" style={{ flexDirection:"column", alignItems:"flex-start", background:"rgba(245,158,11,0.05)", borderColor:"rgba(245,158,11,0.18)" }}>
                                <span className="st-bkey" style={{ color:"#fbbf24", marginBottom:"4px" }}>Budget</span>
                                <span style={{ fontSize:"13px", color:"#e2e8f0", fontWeight:600 }}>{aiPlan.whereToStay.budget}</span>
                              </div>
                              <div className="st-brow" style={{ flexDirection:"column", alignItems:"flex-start", background:"rgba(96,165,250,0.05)", borderColor:"rgba(96,165,250,0.18)" }}>
                                <span className="st-bkey" style={{ color:"#60a5fa", marginBottom:"4px" }}>Mid-Range</span>
                                <span style={{ fontSize:"13px", color:"#e2e8f0", fontWeight:600 }}>{aiPlan.whereToStay.midRange}</span>
                              </div>
                            </div>
                          </>
                        )}
                        {aiPlan.mustEat && (
                          <>
                            <div className="st-sec">Must-try local foods</div>
                            <div className="st-tgrid">
                              {aiPlan.mustEat.map((f, i) => (
                                <div key={i} className="st-tip">
                                  <div className="st-tip-n">🍜</div>
                                  <div className="st-tip-t">{f}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* ── TIPS TAB ── */}
                    {activeTab === "Tips" && aiPlan.travelTips && (
                      <>
                        <div className="st-sec">Travel tips</div>
                        <div className="st-tgrid">
                          {aiPlan.travelTips.map((tip, i) => (
                            <div key={i} className="st-tip">
                              <div className="st-tip-n">0{i + 1}</div>
                              <div className="st-tip-t">{tip}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                  </div>
                </div>
              ) : (
                /* No AI plan stored */
                <div className="st-panel">
                  <div className="st-content" style={{ alignItems:"center", justifyContent:"center", minHeight:"200px" }}>
                    <div style={{ textAlign:"center", color:"#334155", fontSize:"14px", fontWeight:600 }}>
                      <div style={{ fontSize:"40px", marginBottom:"12px" }}>📋</div>
                      This trip doesn't have a full AI itinerary saved.
                    </div>
                  </div>
                </div>
              )}

              {/* ── Bottom CTA ── */}
              <div className="st-bcta">
                <div className="st-bcta-title">Love this itinerary? ✦</div>
                <p className="st-bcta-sub">
                  TripNow uses AI to plan complete day-by-day trips — including food, stays, and budgets.<br />
                  Create yours in under 60 seconds. Free to start.
                </p>
                <button className="st-bcta-btn" onClick={() => navigate("/signup")}>
                  ✈️ Plan My AI Trip Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}