import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import jsPDF from "jspdf"; // ✅ IMPORT ADDED

/* ─────────────────────────────────────────
   Safe JSON parser
───────────────────────────────────────── */
function parseTripData(raw) {
  if (!raw) return null;

  // ✅ If already object → return directly
  if (typeof raw === "object") return raw;

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

export default function PlanTrip() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // Extract from state
  const destination = state?.destination || "";
  const budget      = state?.budget      || "";
  const startDate   = state?.checkin     || "";
  const endDate     = state?.checkout    || "";

  const dayCount = startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
      : 0;

  // React State
  const [tripData, setTripData]   = useState(null); 
  const [rawText, setRawText]     = useState("");   
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  
  // 🔥 UI Feedback States
  const [showSuccess, setShowSuccess] = useState(false); // For the Top Banner
  const [showToast, setShowToast]     = useState(false); // For the Bottom Toast

  const [openDays, setOpenDays]   = useState({ 0: true }); 
  const [activeTab, setActiveTab] = useState("Itinerary");

  // Fetch AI Data
  useEffect(() => {
    if (!state) { navigate("/"); return; }

    const fetchAI = async () => {
      try {
        setLoading(true);
        setError("");
        setShowSuccess(false);
        setShowToast(false); // Reset toast state

        const res = await api.post("/api/ai", {
          destination,
          budget,
          startDate,
          endDate,
        });

        const raw = res.data.data || "";
        setRawText(raw);

        const parsed = parseTripData(raw);
        setTripData(parsed);

        // ✅ Step 1: Show banner first
        setShowSuccess(true);

        setTimeout(() => {
          setShowSuccess(false);

          // ✅ Step 2: then show toast (sequential UX)
          setShowToast(true);

          setTimeout(() => {
            setShowToast(false);
          }, 2000);

        }, 1500);

      } catch (err) {
        console.error("AI Generation Error:", err);
        setError(
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "AI generation failed. Check your backend logs."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDay = (dayKey) => {
    setOpenDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  };

  // ✅ PDF DOWNLOAD FUNCTION
  const downloadPDF = () => {
    if (!tripData) return;

    const doc = new jsPDF();

    let y = 10;

    doc.setFontSize(16);
    doc.text(`Trip to ${destination}`, 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Dates: ${startDate} → ${endDate}`, 10, y);
    y += 10;

    doc.text(`Budget: ₹${budget}`, 10, y);
    y += 10;

    tripData.days?.forEach((day) => {
      doc.setFontSize(13);
      doc.text(`Day ${day.day}: ${day.title}`, 10, y);
      y += 6;

      doc.setFontSize(10);
      
      // Basic wrapping to prevent long text from running off the page width
      const morningText = doc.splitTextToSize(`Morning: ${day.morning}`, 180);
      doc.text(morningText, 10, y);
      y += (morningText.length * 5);

      const afternoonText = doc.splitTextToSize(`Afternoon: ${day.afternoon}`, 180);
      doc.text(afternoonText, 10, y);
      y += (afternoonText.length * 5);

      const eveningText = doc.splitTextToSize(`Evening: ${day.evening}`, 180);
      doc.text(eveningText, 10, y);
      y += (eveningText.length * 5) + 3;

      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });

    doc.save(`${destination}-trip.pdf`);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('[https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap](https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap)');
        
        /* 🌟 Bright, Airy Sunset/Ocean Gradient Background */
        .travel-vibe-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #f4f7f6;
          z-index: -1;
          overflow: hidden;
        }

        .orb-1 {
          position: absolute;
          top: -10%; left: -10%; width: 50vw; height: 50vw;
          background: radial-gradient(circle, rgba(255, 174, 92, 0.4) 0%, rgba(255,255,255,0) 70%);
          filter: blur(80px);
          animation: float 20s ease-in-out infinite;
        }

        .orb-2 {
          position: absolute;
          bottom: -20%; right: -10%; width: 60vw; height: 60vw;
          background: radial-gradient(circle, rgba(92, 218, 255, 0.4) 0%, rgba(255,255,255,0) 70%);
          filter: blur(90px);
          animation: float 25s ease-in-out infinite reverse;
        }

        .orb-3 {
          position: absolute;
          top: 30%; left: 30%; width: 40vw; height: 40vw;
          background: radial-gradient(circle, rgba(255, 153, 204, 0.3) 0%, rgba(255,255,255,0) 70%);
          filter: blur(70px);
          animation: float 22s ease-in-out infinite alternate;
        }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, 10%) scale(1.1); }
          66% { transform: translate(-5%, 5%) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }

        /* 🔥 NEW SUCCESS ANIMATIONS */
        @keyframes slideDown {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideDown {
          animation: slideDown 0.4s ease-out forwards;
        }
        
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out forwards;
        }

        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceEmoji {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        /* 🌟 Light Mode Variables */
        .plan-trip-container {
          --font-head: 'Instrument Serif', Georgia, serif;
          --font-ui: 'Space Grotesk', sans-serif;
          
          --bg: transparent;
          --surface: rgba(255, 255, 255, 0.65);
          --surface-2: rgba(255, 255, 255, 0.4);
          --surface-3: rgba(255, 255, 255, 0.8);
          --border: rgba(255, 255, 255, 0.8);
          --border-2: rgba(0, 0, 0, 0.06);
          
          --text: #1e293b;
          --muted: #64748b;
          --dim: #94a3b8;
          
          --amber: #f59e0b;
          --amber-dim: rgba(245, 158, 11, 0.15);
          --amber-text: #b45309;
          --emerald: #10b981;
          --emerald-dim: rgba(16, 185, 129, 0.15);
          --emerald-text: #047857;
          --sky: #0ea5e9;
          --sky-dim: rgba(14, 165, 233, 0.15);
          --sky-text: #0369a1;
          --violet: #8b5cf6;
          --violet-dim: rgba(139, 92, 246, 0.15);
          --rose: #f43f5e;
          --rose-dim: rgba(244, 63, 94, 0.15);

          font-family: var(--font-ui);
          color: var(--text);
          font-size: 14px;
          line-height: 1.5;
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        /* 🌟 Bright Frosted Glass Shell */
        .shell { 
          background: rgba(255, 255, 255, 0.55); 
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          width: 100%; 
          max-width: 1200px; 
          border-radius: 16px; 
          overflow: hidden; 
          border: 1px solid rgba(255, 255, 255, 0.6); 
          box-shadow: 0 20px 50px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5); 
          display: flex; 
          flex-direction: column; 
        }

        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 54px; background: var(--surface); border-bottom: 1px solid var(--border); gap: 12px; }
        .topbar-left { display: flex; align-items: center; gap: 8px; }
        .wordmark { font-family: var(--font-ui); font-weight: 700; font-size: 15px; letter-spacing: 0.02em; color: var(--text); }
        .wordmark span { color: var(--amber); }
        .divider-v { width: 1px; height: 20px; background: var(--border-2); }
        .breadcrumb { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
        .breadcrumb b { color: var(--text); font-weight: 600; }
        .topbar-right { display: flex; align-items: center; gap: 8px; }
        .tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
        .tag-amber { background: var(--amber-dim); color: var(--amber-text); border: 1px solid rgba(245, 158, 11, 0.3); }
        .tag-emerald { background: var(--emerald-dim); color: var(--emerald-text); border: 1px solid rgba(16, 185, 129, 0.3); }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--emerald); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

        .layout { display: grid; grid-template-columns: 260px 1fr; min-height: 700px; flex: 1; }
        .sidebar { background: var(--surface-2); border-right: 1px solid var(--border); padding: 24px 0; display: flex; flex-direction: column; gap: 2px; }
        .sidebar-section { padding: 0 20px 8px; margin-top: 16px; }
        .sidebar-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 12px; padding: 0 4px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer; transition: all .2s; margin: 0 8px; }
        .nav-item:hover { background: rgba(255,255,255,0.5); color: var(--text); transform: translateX(4px); }
        .nav-item.active { background: var(--surface-3); color: var(--text); font-weight: 600; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .nav-icon { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .nav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); }

        .trip-meta { margin: 16px 20px 0; padding: 16px; background: rgba(255,255,255,0.4); border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .trip-dest { font-family: var(--font-head); font-size: 24px; font-style: italic; color: var(--text); margin-bottom: 4px; text-transform: capitalize; }
        .trip-dates { font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 12px; }
        .trip-stat { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
        .trip-stat:last-child { border: none; padding-bottom: 0; }
        .trip-stat-label { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
        .trip-stat-val { font-size: 13px; font-weight: 700; color: var(--text); }

        .main { display: flex; flex-direction: column; overflow: hidden; background: transparent; }
        .page-header { padding: 24px 32px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .page-title { font-family: var(--font-head); font-size: 36px; font-weight: 400; color: var(--text); line-height: 1.1; margin-bottom: 6px; }
        .page-title span { font-style: italic; color: var(--amber-text); text-transform: capitalize; }
        .page-sub { font-size: 13px; color: var(--muted); font-weight: 500; }
        
        .alert-bar { margin: 20px 32px 0; padding: 12px 16px; background: var(--sky-dim); border-radius: 8px; border: 1px solid rgba(14, 165, 233, 0.2); display: flex; align-items: center; gap: 12px; }
        .alert-icon { width: 18px; height: 18px; border-radius: 50%; background: var(--sky); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .alert-text { font-size: 13px; font-weight: 500; color: var(--sky-text); }

        .tabs { padding: 0 32px; display: flex; gap: 8px; border-bottom: 1px solid var(--border-2); margin-top: 8px; overflow-x: auto; }
        .tab { padding: 12px 16px; font-size: 13px; font-weight: 700; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; text-transform: uppercase; letter-spacing: .06em; transition: all .2s; white-space: nowrap; }
        .tab:hover { color: var(--text); }
        .tab.active { color: var(--amber-text); border-bottom-color: var(--amber); }

        .content { flex: 1; overflow-y: auto; padding: 24px 32px; display: flex; flex-direction: column; gap: 16px; }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 768px) { .stats-row { grid-template-columns: 1fr 1fr; } }
        .stat-card { background: rgba(255,255,255,0.7); border: 1px solid var(--border); box-shadow: 0 4px 15px rgba(0,0,0,0.02); border-radius: 12px; padding: 16px; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); border-color: var(--amber-dim); }
        .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); font-weight: 700; margin-bottom: 6px; }
        .stat-val { font-size: 24px; font-weight: 700; line-height: 1; color: var(--text); }
        .stat-sub { font-size: 11px; font-weight: 500; color: var(--dim); margin-top: 4px; }

        .timeline-wrap { display: flex; flex-direction: column; gap: 12px; }
        .day-row { background: rgba(255,255,255,0.8); border: 1px solid var(--border); box-shadow: 0 4px 15px rgba(0,0,0,0.02); border-radius: 12px; overflow: hidden; transition: all .2s; }
        .day-row:hover { border-color: rgba(0,0,0,0.1); }
        .day-row.open { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
        .day-header { display: flex; align-items: center; gap: 0; cursor: pointer; padding: 0; }
        .day-num { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: var(--muted); border-right: 1px solid rgba(0,0,0,0.05); flex-shrink: 0; font-variant-numeric: tabular-nums; background: rgba(255,255,255,0.5); }
        .day-num.d1 { color: var(--amber-text); }
        .day-num.d2 { color: var(--emerald-text); }
        .day-num.d3 { color: var(--sky-text); }
        .day-num.d4 { color: var(--violet); }
        .day-title-wrap { flex: 1; padding: 0 16px; display: flex; align-items: center; gap: 12px; min-width: 0; }
        .day-title { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .day-chevron { padding: 0 20px; color: var(--dim); font-size: 14px; transition: transform .3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; }
        .day-chevron.open { transform: rotate(180deg); color: var(--amber-text); }

        .day-body { border-top: 1px solid rgba(0,0,0,0.05); display: none; grid-template-columns: 1fr 1fr 1fr; gap: 0; background: rgba(255,255,255,0.3); }
        .day-body.open { display: grid; }
        @media (max-width: 768px) { .day-body.open { grid-template-columns: 1fr; } }
        .day-slot { padding: 16px; border-right: 1px solid rgba(0,0,0,0.05); }
        .day-slot:last-child { border-right: none; }
        .slot-label { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .slot-dot { width: 6px; height: 6px; border-radius: 50%; }
        .slot-text { font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.6; margin-bottom: 8px;}

        .section-head { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-bottom: 12px; margin-top: 8px; }
        .budget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .budget-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.05); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.01); }
        .budget-key { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: capitalize; }
        .budget-val { font-size: 14px; font-weight: 700; color: var(--emerald-text); }
        .budget-total { grid-column: 1 / -1; border-color: rgba(16, 185, 129, 0.3); background: var(--emerald-dim); }
        .budget-total .budget-key { font-weight: 700; color: var(--emerald-text); }
        .budget-total .budget-val { font-size: 18px; color: var(--emerald-text); }

        .tips-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 768px) { .tips-grid { grid-template-columns: 1fr; } }
        .tip-card { background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 15px rgba(0,0,0,0.02); border-radius: 8px; padding: 14px 16px; display: flex; gap: 12px; transition: transform 0.2s; }
        .tip-card:hover { transform: translateY(-2px); border-color: var(--amber-dim); }
        .tip-num { font-size: 13px; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; min-width: 20px; }
        .tip-text { font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.6; }
        
        .loading-pulse { animation: loadPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes loadPulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `}} />

      {/* 🌟 Background Elements */}
      <div className="travel-vibe-bg">
        <div className="orb-1"></div>
        <div className="orb-2"></div>
        <div className="orb-3"></div>
      </div>

      <div className="plan-trip-container">
        
        {/* ✅ SUCCESS ANIMATION (TOP BANNER) */}
        {showSuccess && !error && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slideDown">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-xl font-bold flex items-center gap-2">
              🎉 Trip Ready!
            </div>
          </div>
        )}

        {/* ✅ TOAST MESSAGE (BOTTOM RIGHT) */}
        {showToast && !error && (
          <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
            <div className="bg-emerald-500 text-white px-5 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2">
              💾 Trip saved successfully!
            </div>
          </div>
        )}

        <div className="shell">
          <div className="topbar">
            <div className="topbar-left">
              <div className="wordmark">wander<span>.</span>ai</div>
              <div className="divider-v"></div>
              <div className="breadcrumb">
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontWeight: '600' }}>Trips</button> 
                <span style={{ color: "var(--dim)" }}>›</span>{" "}
                <b style={{textTransform: 'capitalize'}}>{destination || "New Trip"} · {dayCount} Days</b>
              </div>
            </div>
            <div className="topbar-right">
              {loading ? (
                <div className="tag tag-amber loading-pulse" style={{background: 'var(--surface-3)', border: '1px solid var(--border)'}}>Generating...</div>
              ) : (
                <>
                  <div className="tag tag-emerald"><div className="dot"></div> AI Ready</div>
                  <div className="tag tag-amber">{dayCount} Days</div>
                </>
              )}
            </div>
          </div>

          <div className="layout">
            {/* Sidebar */}
            <div className="sidebar">
              <div className="trip-meta">
                <div className="trip-dest">{destination || "Destination"}</div>
                <div className="trip-dates">{startDate} → {endDate}</div>
                <div className="trip-stat">
                  <span className="trip-stat-label">Budget</span>
                  <span className="trip-stat-val" style={{ color: "var(--emerald-text)" }}>₹{budget}</span>
                </div>
                <div className="trip-stat">
                  <span className="trip-stat-label">Days</span>
                  <span className="trip-stat-val">{dayCount}</span>
                </div>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-label">Navigation</div>
                <div className={`nav-item ${activeTab === "Itinerary" ? "active" : ""}`} onClick={() => setActiveTab("Itinerary")}>
                  <div className="nav-icon"><div className={activeTab === "Itinerary" ? "nav-dot" : ""} style={activeTab !== "Itinerary" ? { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dim)", boxShadow: 'none' } : {}}></div></div>
                  Itinerary
                </div>
                <div className={`nav-item ${activeTab === "Budget" ? "active" : ""}`} onClick={() => setActiveTab("Budget")}>
                  <div className="nav-icon"><div className={activeTab === "Budget" ? "nav-dot" : ""} style={activeTab !== "Budget" ? { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dim)", boxShadow: 'none' } : {}}></div></div>
                  Budget Breakdown
                </div>
                <div className={`nav-item ${activeTab === "Food & Stays" ? "active" : ""}`} onClick={() => setActiveTab("Food & Stays")}>
                  <div className="nav-icon"><div className={activeTab === "Food & Stays" ? "nav-dot" : ""} style={activeTab !== "Food & Stays" ? { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dim)", boxShadow: 'none' } : {}}></div></div>
                  Food & Stays
                </div>
                <div className={`nav-item ${activeTab === "Tips" ? "active" : ""}`} onClick={() => setActiveTab("Tips")}>
                  <div className="nav-icon"><div className={activeTab === "Tips" ? "nav-dot" : ""} style={activeTab !== "Tips" ? { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dim)", boxShadow: 'none' } : {}}></div></div>
                  Travel Tips
                </div>
              </div>
            </div>

            {/* Main View Area */}
            <div className="main">
              <div className="page-header">
                <div>
                  <div className="page-title">
                    Trip to <span>{destination || "Unknown"}</span>
                  </div>
                  <div className="page-sub">
                    {loading || showSuccess ? "AI is crafting your perfect itinerary..." : "Generated by AI · Complete itinerary · Ready to explore"}
                  </div>
                </div>
                
                {/* ✅ PERFECTED BUTTON CLUSTER */}
                {!loading && !error && tripData && (
                  <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0 w-full lg:w-auto">
                    
                    <button 
                      onClick={downloadPDF}
                      className="bg-white/80 px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition shadow-sm text-slate-800"
                    >
                      📄 Download PDF
                    </button>

                    <button 
                      onClick={() => navigate("/dashboard")}
                      className="bg-white/20 border border-white/30 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/30 transition shadow-sm"
                    >
                      View Dashboard
                    </button>

                    <button 
                      onClick={() => navigate("/booking", {
                        state: { destination, budget, checkin: startDate, checkout: endDate, tripData }
                      })}
                      className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-5 py-2 rounded-lg font-bold hover:scale-105 transition shadow-md"
                    >
                      ✈️ Book This Trip →
                    </button>
                    
                  </div>
                )}
              </div>

              {/* 🔄 LOADING STATE */}
              {loading && !showSuccess && (
                 <div className="content" style={{alignItems: 'center', justifyContent: 'center'}}>
                    <div style={{textAlign: 'center', color: 'var(--muted)'}}>
                        <div style={{fontSize: '48px', marginBottom: '24px'}} className="loading-pulse">🏖️</div>
                        <p style={{color: 'var(--text)', fontSize: '18px', fontWeight: '700', letterSpacing: '0.02em'}}>Curating your dream getaway...</p>
                        <p style={{marginTop: '8px', fontSize: '14px', fontWeight: '500'}}>Finding hidden gems, sunset spots, and local eats.</p>
                    </div>
                 </div>
              )}

              {/* ❌ ERROR STATE */}
              {!loading && !showSuccess && error && (
                <div className="content" style={{alignItems: 'center', justifyContent: 'center'}}>
                    <div style={{textAlign: 'center', background: 'var(--rose-dim)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.3)'}}>
                        <div style={{fontSize: '48px', marginBottom: '16px'}}>⚠️</div>
                        <p style={{color: 'var(--text)', fontSize: '16px', fontWeight: '700'}}>{error}</p>
                        <button onClick={() => navigate(-1)} style={{marginTop: '20px', background: 'var(--rose)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', letterSpacing: '0.05em'}}>Go Back</button>
                    </div>
                 </div>
              )}

              {/* 🎉 SUCCESS ANIMATION STATE (In Center before layout reveals) */}
              {showSuccess && !error && (
                <div className="content" style={{alignItems: 'center', justifyContent: 'center'}}>
                  <div style={{
                      textAlign: 'center', 
                      background: 'rgba(255,255,255,0.9)', 
                      padding: '48px', 
                      borderRadius: '24px', 
                      border: '1px solid rgba(16, 185, 129, 0.3)', 
                      boxShadow: '0 20px 40px rgba(0,0,0,0.05)', 
                      animation: 'popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                      <div style={{fontSize: '64px', marginBottom: '16px', animation: 'bounceEmoji 1.5s infinite'}}>🎉</div>
                      <h2 style={{color: 'var(--emerald-text)', fontSize: '28px', fontWeight: '800', marginBottom: '8px', fontFamily: "var(--font-head)"}}>Trip Ready!</h2>
                      <p style={{color: 'var(--muted)', fontSize: '15px', fontWeight: '500'}}>Your personalized itinerary is cooked to perfection.</p>
                  </div>
                </div>
              )}

              {/* ✅ LOADED CONTENT STATE */}
              {!loading && !showSuccess && !error && tripData && (
                <>
                  {tripData.bestTimeToVisit && activeTab === "Itinerary" && (
                    <div className="alert-bar">
                      <div className="alert-icon">
                        <svg width="10" height="10" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="4" y1="2.5" x2="4" y2="4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="5.5" r=".5" fill="#fff"/></svg>
                      </div>
                      <div className="alert-text">
                        Best time to visit: <b style={{ color: "var(--text)" }}>{tripData.bestTimeToVisit}</b>
                      </div>
                    </div>
                  )}

                  <div className="tabs">
                    {["Itinerary", "Budget", "Food & Stays", "Tips"].map(tab => (
                      <div key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                        {tab}
                      </div>
                    ))}
                  </div>

                  <div className="content" id="content">
                    
                    {/* TAB: ITINERARY */}
                    {activeTab === "Itinerary" && (
                      <>
                        <div className="stats-row">
                          <div className="stat-card">
                            <div className="stat-label">Total Days</div>
                            <div className="stat-val amber">{dayCount}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-label">Total Budget</div>
                            <div className="stat-val emerald">₹{budget}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-label">Destination</div>
                            <div className="stat-val sky" style={{fontSize: '18px', textTransform: 'capitalize'}}>{destination}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-label">Activities</div>
                            <div className="stat-val violet">{tripData.days?.length * 3 || 0}+</div>
                          </div>
                        </div>

                        <div className="section-head">Day-by-day itinerary</div>
                        <div className="timeline-wrap">
                          {tripData.days?.map((day, i) => {
                            const numClass = `d${(i % 4) + 1}`; 
                            return (
                              <div key={i} className={`day-row ${openDays[i] ? "open" : ""}`}>
                                <div className="day-header" onClick={() => toggleDay(i)}>
                                  <div className={`day-num ${numClass}`}>D{day.day}</div>
                                  <div className="day-title-wrap">
                                    <div className="day-title">{day.title || `Exploring ${destination}`}</div>
                                  </div>
                                  <div className={`day-chevron ${openDays[i] ? "open" : ""}`}>▾</div>
                                </div>
                                <div className={`day-body ${openDays[i] ? "open" : ""}`}>
                                  <div className="day-slot">
                                    <div className="slot-label" style={{color: 'var(--amber-text)'}}>
                                      <div className="slot-dot" style={{background: 'var(--amber)'}}></div>Morning
                                    </div>
                                    <div className="slot-text">{day.morning}</div>
                                  </div>
                                  <div className="day-slot">
                                    <div className="slot-label" style={{color: 'var(--sky-text)'}}>
                                      <div className="slot-dot" style={{background: 'var(--sky)'}}></div>Afternoon
                                    </div>
                                    <div className="slot-text">{day.afternoon}</div>
                                  </div>
                                  <div className="day-slot">
                                    <div className="slot-label" style={{color: 'var(--violet)'}}>
                                      <div className="slot-dot" style={{background: 'var(--violet)'}}></div>Evening
                                    </div>
                                    <div className="slot-text">{day.evening}</div>
                                    {day.food && day.food.length > 0 && (
                                      <div style={{marginTop: '12px', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)'}}>
                                        <b style={{fontSize: '10px', color:'var(--amber-text)', textTransform:'uppercase', letterSpacing: '0.05em'}}>🍽️ Evening Eats:</b>
                                        {day.food.map((f, idx) => <div key={idx} style={{fontSize: '12px', color: 'var(--text)', marginTop: '4px', fontWeight: '500'}}>• {f}</div>)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {/* TAB: BUDGET */}
                    {activeTab === "Budget" && tripData.budgetBreakdown && (
                      <>
                        <div className="section-head">Budget breakdown</div>
                        <div className="budget-grid">
                          {Object.entries(tripData.budgetBreakdown).map(([key, val]) => (
                            <div key={key} className={`budget-row ${key.toLowerCase().includes('total') ? 'budget-total' : ''}`}>
                              <span className="budget-key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="budget-val">{val}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* TAB: FOOD & STAYS */}
                    {activeTab === "Food & Stays" && (
                      <>
                        {tripData.whereToStay && (
                          <>
                            <div className="section-head">Where to Stay</div>
                            <div className="budget-grid" style={{marginBottom: '24px'}}>
                              <div className="budget-row" style={{flexDirection: 'column', alignItems: 'flex-start', background: 'var(--amber-dim)', borderColor: 'rgba(245, 158, 11, 0.3)'}}>
                                <span className="budget-key" style={{color: 'var(--amber-text)', marginBottom: '6px', fontWeight: 'bold'}}>Budget Option</span>
                                <span className="budget-val" style={{color: 'var(--text)'}}>{tripData.whereToStay.budget}</span>
                              </div>
                              <div className="budget-row" style={{flexDirection: 'column', alignItems: 'flex-start', background: 'var(--sky-dim)', borderColor: 'rgba(14, 165, 233, 0.3)'}}>
                                <span className="budget-key" style={{color: 'var(--sky-text)', marginBottom: '6px', fontWeight: 'bold'}}>Mid-Range Option</span>
                                <span className="budget-val" style={{color: 'var(--text)'}}>{tripData.whereToStay.midRange}</span>
                              </div>
                            </div>
                          </>
                        )}
                        {tripData.mustEat && (
                           <>
                            <div className="section-head">Must-Try Local Foods</div>
                            <div className="tips-grid">
                              {tripData.mustEat.map((food, i) => (
                                <div key={i} className="tip-card" style={{background: 'rgba(255,255,255,0.8)'}}>
                                  <div className="tip-num" style={{color: 'var(--rose)'}}>🍜</div>
                                  <div className="tip-text" style={{color: 'var(--text)'}}>{food}</div>
                                </div>
                              ))}
                            </div>
                           </>
                        )}
                      </>
                    )}

                    {/* TAB: TIPS */}
                    {activeTab === "Tips" && tripData.travelTips && (
                      <>
                        <div className="section-head">Important Travel Tips</div>
                        <div className="tips-grid">
                          {tripData.travelTips.map((tip, i) => (
                            <div key={i} className="tip-card">
                              <div className="tip-num">0{i + 1}</div>
                              <div className="tip-text">{tip}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ textAlign: "center", padding: "24px 0", marginTop: 'auto' }}>
                      <span style={{ fontSize: "10px", color: "var(--dim)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: ".15em" }}>
                        GENERATED BY GROQ · WANDER.AI
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}