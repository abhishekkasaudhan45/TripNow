

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import jsPDF from "jspdf";

// 🌍 MAP IMPORTS
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// ✅ BUG 3 FIXED: regex had a literal newline in the middle of the string
function parseTripData(raw) {
  if (!raw) return null;
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
  const navigate  = useNavigate();

  const destination = state?.destination || "";
  const budget      = state?.budget      || "";
  const startDate   = state?.checkin     || "";
  const endDate     = state?.checkout    || "";

  const dayCount = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
    : 0;

  const [tripData, setTripData]         = useState(null);
  const [editMode, setEditMode]         = useState(false);
  const [editableTrip, setEditableTrip] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [showSuccess, setShowSuccess]   = useState(false);
  const [showToast, setShowToast]       = useState(false);
  const [openDays, setOpenDays]         = useState({ 0: true });
  const [activeTab, setActiveTab]       = useState("Itinerary");

  // 🌍 MAP STATE — default center of India
  const [mapCoords, setMapCoords] = useState([20.5937, 78.9629]);

  useEffect(() => {
    if (!state) { navigate("/"); return; }

    const fetchAI = async () => {
      try {
        setLoading(true);
        setError("");
        setShowSuccess(false);
        setShowToast(false);

        const res = await api.post("/api/ai", { destination, budget, startDate, endDate });
        const raw = res.data.data || "";
        const parsed = parseTripData(raw);
        setTripData(parsed);
        setShowSuccess(true);

        // ✅ BUG 6 FIXED: template literal URL was broken with $ outside backtick
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.length > 0) {
              setMapCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            }
          })
          .catch(() => {}); // silently ignore geocode failures

        setTimeout(() => {
          setShowSuccess(false);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }, 1500);
      } catch (err) {
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

  useEffect(() => {
    if (tripData) {
      setEditableTrip(JSON.parse(JSON.stringify(tripData)));
    }
  }, [tripData]);

  const toggleDay = (dayKey) =>
    setOpenDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));

  // 📄 PREMIUM PDF GENERATOR
  const downloadPDF = () => {
    if (!tripData) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, H = 297;
    const ml = 18, mr = 18, contentW = W - ml - mr;

    const hex = (h) => {
      const r = parseInt(h.slice(1,3),16)/255;
      const g = parseInt(h.slice(3,5),16)/255;
      const b = parseInt(h.slice(5,7),16)/255;
      return [r,g,b];
    };
    const setFill   = (h) => doc.setFillColor(...hex(h));
    const setStroke = (h) => doc.setDrawColor(...hex(h));
    const setColor  = (h) => doc.setTextColor(...hex(h));

    let y = 0;
    const newPageIfNeeded = (need = 20) => {
      if (y + need > H - 16) { doc.addPage(); y = 20; }
    };

    // ── COVER PAGE ────────────────────────────────────────────────────
    setFill("#0f172a"); doc.rect(0,0,W,H,"F");
    setFill("#1e3a5f"); doc.rect(0,0,W,H/2,"F");
    setFill("#f59e0b"); doc.circle(W-30, 30, 40,"F");
    setFill("#ef4444"); doc.circle(W-10, 60, 20,"F");
    setFill("#0ea5e9"); doc.circle(20, H-40, 30,"F");
    setFill("#0f172a");
    doc.setGState(new doc.GState({ opacity: 0.7 }));
    doc.rect(0,0,W,H,"F");
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFont("helvetica","bold"); doc.setFontSize(9); setColor("#f59e0b");
    doc.text("WANDER.AI · PERSONALIZED TRAVEL PLAN", ml, 30);

    doc.setFontSize(48); setColor("#ffffff");
    doc.text(destination.toUpperCase(), ml, 65, { maxWidth: contentW });

    setStroke("#f59e0b"); doc.setLineWidth(1);
    doc.line(ml, 74, ml+60, 74);

    doc.setFontSize(13); setColor("#94a3b8"); doc.setFont("helvetica","normal");
    doc.text(`${startDate}  →  ${endDate}   ·   ${dayCount} Days   ·   ₹${budget}`, ml, 84);

    doc.setFontSize(10); setColor("#64748b");
    doc.text("Your AI-crafted adventure awaits. Every moment, planned to perfection.", ml, H-30, { maxWidth: contentW });

    setFill("#1e293b"); doc.rect(0, H-14, W, 14,"F");
    doc.setFontSize(8); setColor("#475569");
    doc.text("Generated by wander.ai", ml, H-5);
    doc.text("Page 1", W-mr, H-5, { align:"right" });

    // ── PAGE HEADER HELPER ────────────────────────────────────────────
    const pageHeader = (pageNum) => {
      setFill("#0f172a"); doc.rect(0,0,W,14,"F");
      doc.setFontSize(8); setColor("#64748b"); doc.setFont("helvetica","normal");
      doc.text("WANDER.AI · " + destination.toUpperCase(), ml, 9);
      doc.text(`Page ${pageNum}`, W-mr, 9, { align:"right" });
      y = 22;
    };

    const sectionTitle = (text, color="#f59e0b") => {
      newPageIfNeeded(18);
      doc.setFontSize(8); setColor(color); doc.setFont("helvetica","bold");
      doc.text(text.toUpperCase(), ml, y);
      y += 2;
      setStroke(color); doc.setLineWidth(0.4);
      doc.line(ml, y, ml+contentW, y);
      y += 7;
    };

    // ── PAGE 2: ITINERARY ─────────────────────────────────────────────
    doc.addPage();
    pageHeader(2);

    // Summary stat card
    setFill("#f8fafc"); setStroke("#e2e8f0"); doc.setLineWidth(0.3);
    doc.roundedRect(ml, y, contentW, 26, 3, 3, "FD");
    const cols = contentW / 4;
    const stats = [
      ["DESTINATION", destination.toUpperCase(), "#0ea5e9"],
      ["DURATION",    `${dayCount} Days`,         "#f59e0b"],
      ["BUDGET",      `₹${budget}`,               "#10b981"],
      ["ACTIVITIES",  `${(tripData.days?.length||0)*3}+`, "#8b5cf6"],
    ];
    stats.forEach(([label, val, color], i) => {
      const cx = ml + cols*i + cols/2;
      doc.setFontSize(7); setColor("#94a3b8"); doc.setFont("helvetica","bold");
      doc.text(label, cx, y+8, { align:"center" });
      doc.setFontSize(13); setColor(color); doc.setFont("helvetica","bold");
      doc.text(val, cx, y+20, { align:"center" });
      if (i < 3) { setStroke("#e2e8f0"); doc.setLineWidth(0.3); doc.line(ml+cols*(i+1), y+4, ml+cols*(i+1), y+22); }
    });
    y += 34;

    if (tripData.bestTimeToVisit) {
      setFill("#eff6ff"); setStroke("#bfdbfe");
      doc.roundedRect(ml, y, contentW, 11, 2, 2, "FD");
      doc.setFontSize(8); setColor("#1d4ed8"); doc.setFont("helvetica","bold");
      doc.text("Best time to visit: ", ml+4, y+7);
      doc.setFont("helvetica","normal"); setColor("#1e40af");
      doc.text(tripData.bestTimeToVisit, ml+42, y+7);
      y += 18;
    }

    sectionTitle("Day-by-Day Itinerary");
    const dayColors = ["#f59e0b","#10b981","#0ea5e9","#8b5cf6","#ef4444","#f97316"];

    tripData.days?.forEach((day, i) => {
      const color = dayColors[i % dayColors.length];
      const morningLines   = doc.splitTextToSize(day.morning   || "", contentW-30);
      const afternoonLines = doc.splitTextToSize(day.afternoon || "", contentW-30);
      const eveningLines   = doc.splitTextToSize(day.evening   || "", contentW-30);
      const cardH = 18 + (morningLines.length + afternoonLines.length + eveningLines.length)*5 + 20;

      newPageIfNeeded(cardH);

      setFill("#f8fafc"); setStroke("#e2e8f0"); doc.setLineWidth(0.3);
      doc.roundedRect(ml, y, contentW, cardH, 3, 3, "FD");
      setFill(color);
      doc.roundedRect(ml, y, 5, cardH, 2, 2, "F");
      doc.rect(ml+2, y, 3, cardH, "F");
      doc.roundedRect(ml+10, y+5, 22, 9, 2, 2, "F");
      doc.setFontSize(8); setColor("#ffffff"); doc.setFont("helvetica","bold");
      doc.text(`DAY ${day.day}`, ml+21, y+11, { align:"center" });
      doc.setFontSize(12); setColor("#0f172a"); doc.setFont("helvetica","bold");
      doc.text(day.title || `Exploring ${destination}`, ml+36, y+12, { maxWidth: contentW-50 });

      let dy = y + 22;
      const slotColor = ["#b45309","#0369a1","#6d28d9"];
      const slotLabel = ["MORNING","AFTERNOON","EVENING"];
      const slotTexts = [morningLines, afternoonLines, eveningLines];

      slotTexts.forEach((lines, si) => {
        doc.setFontSize(7); setColor(slotColor[si]); doc.setFont("helvetica","bold");
        doc.text(slotLabel[si], ml+10, dy);
        dy += 5;
        doc.setFontSize(9); setColor("#334155"); doc.setFont("helvetica","normal");
        doc.text(lines, ml+10, dy);
        dy += lines.length * 5 + 4;
      });

      y += cardH + 6;
    });

    // ── PAGE 3: BUDGET ────────────────────────────────────────────────
    if (tripData.budgetBreakdown) {
      doc.addPage();
      pageHeader(3);
      sectionTitle("Budget Breakdown", "#10b981");

      Object.entries(tripData.budgetBreakdown).forEach(([key, val]) => {
        const isTotal = key.toLowerCase().includes("total");
        newPageIfNeeded(14);
        setFill(isTotal ? "#d1fae5" : "#f8fafc");
        setStroke(isTotal ? "#6ee7b7" : "#e2e8f0");
        doc.setLineWidth(0.3);
        doc.roundedRect(ml, y, contentW, 11, 2, 2, "FD");
        doc.setFontSize(9);
        doc.setFont("helvetica", isTotal ? "bold" : "normal");
        setColor(isTotal ? "#065f46" : "#334155");
        doc.text(key.replace(/([A-Z])/g," $1").trim(), ml+5, y+7.5);
        doc.setFont("helvetica","bold");
        setColor(isTotal ? "#047857" : "#10b981");
        doc.text(String(val), W-mr-3, y+7.5, { align:"right" });
        y += 13;
      });
    }

    // ── PAGE 4: FOOD & STAYS ──────────────────────────────────────────
    if (tripData.whereToStay || tripData.mustEat) {
      doc.addPage();
      pageHeader(4);

      if (tripData.whereToStay) {
        sectionTitle("Where to Stay", "#0ea5e9");
        [
          ["BUDGET OPTION",    tripData.whereToStay.budget,   "#fef3c7","#92400e"],
          ["MID-RANGE OPTION", tripData.whereToStay.midRange, "#e0f2fe","#0c4a6e"],
        ].forEach(([label, text, bg, fg]) => {
          if (!text) return;
          const lines = doc.splitTextToSize(text, contentW-16);
          newPageIfNeeded(16+lines.length*5);
          setFill(bg); setStroke("#e2e8f0"); doc.setLineWidth(0.3);
          doc.roundedRect(ml, y, contentW, 10+lines.length*5, 2, 2, "FD");
          doc.setFontSize(7); setColor(fg); doc.setFont("helvetica","bold");
          doc.text(label, ml+5, y+6);
          doc.setFontSize(9); setColor("#1e293b"); doc.setFont("helvetica","normal");
          doc.text(lines, ml+5, y+13);
          y += 14+lines.length*5;
        });
        y += 4;
      }

      if (tripData.mustEat?.length) {
        sectionTitle("Must-Try Local Foods", "#ef4444");
        const cols2 = Math.floor(contentW/2) - 4;
        tripData.mustEat.forEach((food, i) => {
          if (i % 2 === 0) { newPageIfNeeded(18); if (i > 0) y += 2; }
          const xOff = ml + (i%2)*(cols2+8);
          const lines = doc.splitTextToSize(food, cols2-18);
          setFill("#fff7ed"); setStroke("#fed7aa"); doc.setLineWidth(0.3);
          doc.roundedRect(xOff, y, cols2, 8+lines.length*5, 2, 2, "FD");
          doc.setFontSize(9); setColor("#ef4444"); doc.setFont("helvetica","bold");
          doc.text("~", xOff+4, y+7);
          doc.setFontSize(9); setColor("#431407"); doc.setFont("helvetica","normal");
          doc.text(lines, xOff+12, y+7);
          if (i%2===1 || i===tripData.mustEat.length-1) y += 10+lines.length*5;
        });
      }
    }

    // ── PAGE 5: TIPS ──────────────────────────────────────────────────
    if (tripData.travelTips?.length) {
      doc.addPage();
      pageHeader(5);
      sectionTitle("Essential Travel Tips", "#8b5cf6");

      tripData.travelTips.forEach((tip, i) => {
        const lines = doc.splitTextToSize(tip, contentW-22);
        newPageIfNeeded(12+lines.length*5);
        setFill("#faf5ff"); setStroke("#ddd6fe"); doc.setLineWidth(0.3);
        doc.roundedRect(ml, y, contentW, 8+lines.length*5, 2, 2, "FD");
        setFill("#8b5cf6");
        doc.circle(ml+8, y+5.5, 4, "F");
        doc.setFontSize(8); setColor("#ffffff"); doc.setFont("helvetica","bold");
        doc.text(String(i+1).padStart(2,"0"), ml+8, y+7.5, { align:"center" });
        doc.setFontSize(9); setColor("#3b0764"); doc.setFont("helvetica","normal");
        doc.text(lines, ml+16, y+7);
        y += 10+lines.length*5;
      });
    }

    doc.save(`${destination}-wander-ai-trip.pdf`);
  };

  // ─────────────────────────────── JSX ──────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        .travel-vibe-bg { position:fixed; top:0; left:0; width:100vw; height:100vh; background:#f4f7f6; z-index:-1; overflow:hidden; }
        .orb-1 { position:absolute; top:-10%; left:-10%; width:50vw; height:50vw; background:radial-gradient(circle,rgba(255,174,92,0.4) 0%,rgba(255,255,255,0) 70%); filter:blur(80px); animation:float 20s ease-in-out infinite; }
        .orb-2 { position:absolute; bottom:-20%; right:-10%; width:60vw; height:60vw; background:radial-gradient(circle,rgba(92,218,255,0.4) 0%,rgba(255,255,255,0) 70%); filter:blur(90px); animation:float 25s ease-in-out infinite reverse; }
        .orb-3 { position:absolute; top:30%; left:30%; width:40vw; height:40vw; background:radial-gradient(circle,rgba(255,153,204,0.3) 0%,rgba(255,255,255,0) 70%); filter:blur(70px); animation:float 22s ease-in-out infinite alternate; }
        @keyframes float { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(5%,10%) scale(1.1)} 66%{transform:translate(-5%,5%) scale(0.9)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes slideDown { 0%{opacity:0;transform:translate(-50%,-20px)} 100%{opacity:1;transform:translate(-50%,0)} }
        .animate-slideDown { animation:slideDown 0.4s ease-out forwards; }
        @keyframes slideUp { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
        .animate-slideUp { animation:slideUp 0.4s ease-out forwards; }
        @keyframes popIn { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes bounceEmoji { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        /* ✅ BUG 4 FIXED: missing pulse keyframe */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes loadPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .loading-pulse { animation:loadPulse 2s infinite; }

        .plan-trip-container {
          --font-head:'Playfair Display',Georgia,serif;
          --font-ui:'Space Grotesk',sans-serif;
          --surface:rgba(255,255,255,0.65); --surface-2:rgba(255,255,255,0.4); --surface-3:rgba(255,255,255,0.8);
          --border:rgba(255,255,255,0.8); --border-2:rgba(0,0,0,0.06);
          --text:#1e293b; --muted:#64748b; --dim:#94a3b8;
          --amber:#f59e0b; --amber-dim:rgba(245,158,11,0.15); --amber-text:#b45309;
          --emerald:#10b981; --emerald-dim:rgba(16,185,129,0.15); --emerald-text:#047857;
          --sky:#0ea5e9; --sky-dim:rgba(14,165,233,0.15); --sky-text:#0369a1;
          --violet:#8b5cf6; --violet-dim:rgba(139,92,246,0.15);
          --rose:#f43f5e; --rose-dim:rgba(244,63,94,0.15);
          font-family:var(--font-ui); color:var(--text); font-size:14px; line-height:1.5;
          min-height:100vh; padding:20px; display:flex; justify-content:center; position:relative; z-index:1;
        }

        .shell { background:rgba(255,255,255,0.55); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); width:100%; max-width:1200px; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.6); box-shadow:0 20px 50px rgba(0,0,0,0.05); display:flex; flex-direction:column; }

        .topbar { display:flex; align-items:center; justify-content:space-between; padding:0 20px; height:54px; background:var(--surface); border-bottom:1px solid var(--border); gap:12px; }
        .topbar-left { display:flex; align-items:center; gap:8px; }
        .wordmark { font-family:var(--font-ui); font-weight:700; font-size:15px; letter-spacing:0.02em; color:var(--text); }
        .wordmark span { color:var(--amber); }
        .divider-v { width:1px; height:20px; background:var(--border-2); }
        .breadcrumb { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:6px; }
        .breadcrumb b { color:var(--text); font-weight:600; }
        .topbar-right { display:flex; align-items:center; gap:8px; }
        .tag { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:6px; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
        .tag-amber { background:var(--amber-dim); color:var(--amber-text); border:1px solid rgba(245,158,11,0.3); }
        .tag-emerald { background:var(--emerald-dim); color:var(--emerald-text); border:1px solid rgba(16,185,129,0.3); }
        /* ✅ BUG 4 FIXED: .dot now has animation referencing the pulse keyframe above */
        .dot { width:6px; height:6px; border-radius:50%; background:var(--emerald); animation:pulse 2s infinite; }

        .layout { display:grid; grid-template-columns:260px 1fr; min-height:700px; flex:1; }
        .sidebar { background:var(--surface-2); border-right:1px solid var(--border); padding:24px 0; display:flex; flex-direction:column; gap:2px; }
        .sidebar-section { padding:0 20px 8px; margin-top:16px; }
        .sidebar-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--dim); margin-bottom:12px; padding:0 4px; }
        .nav-item { display:flex; align-items:center; gap:12px; padding:9px 16px; border-radius:8px; font-size:13px; font-weight:500; color:var(--muted); cursor:pointer; transition:all .2s; margin:0 8px; }
        .nav-item:hover { background:rgba(255,255,255,0.5); color:var(--text); transform:translateX(4px); }
        .nav-item.active { background:var(--surface-3); color:var(--text); font-weight:600; }

        .trip-meta { margin:16px 20px 0; padding:16px; background:rgba(255,255,255,0.4); border-radius:12px; border:1px solid var(--border); }
        .trip-dest { font-family:var(--font-head); font-size:24px; font-style:italic; color:var(--text); margin-bottom:4px; text-transform:capitalize; }
        .trip-dates { font-size:12px; font-weight:500; color:var(--muted); margin-bottom:12px; }
        .trip-stat { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04); }
        .trip-stat:last-child { border:none; padding-bottom:0; }
        .trip-stat-label { font-size:11px; color:var(--muted); font-weight:600; letter-spacing:.05em; text-transform:uppercase; }
        .trip-stat-val { font-size:13px; font-weight:700; color:var(--text); }

        .main { display:flex; flex-direction:column; overflow:hidden; }
        .page-header { padding:24px 32px 20px; border-bottom:1px solid var(--border); display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .page-title { font-family:var(--font-head); font-size:36px; font-weight:400; color:var(--text); line-height:1.1; margin-bottom:6px; }
        .page-title span { font-style:italic; color:var(--amber-text); text-transform:capitalize; }
        .page-sub { font-size:13px; color:var(--muted); font-weight:500; }

        .btn-cluster { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:4px; }
        .btn-pdf { padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.85); color:#1e293b; border:1.5px solid rgba(0,0,0,0.1); font-family:var(--font-ui); transition:transform 0.15s,box-shadow 0.15s; }
        .btn-pdf:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.1); }
        .btn-dashboard { padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.7); color:#334155; border:1.5px solid rgba(0,0,0,0.12); font-family:var(--font-ui); transition:transform 0.15s,background 0.15s; }
        .btn-dashboard:hover { background:rgba(255,255,255,0.95); transform:translateY(-1px); }
        /* ✅ BUG 5 FIXED: added missing font-family to btn-book */
        .btn-book { padding:8px 20px; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer; background:linear-gradient(135deg,#f59e0b,#ef4444); color:#fff; border:none; box-shadow:0 4px 16px rgba(239,68,68,0.3); font-family:var(--font-ui); transition:transform 0.15s,box-shadow 0.15s; }
        .btn-book:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(239,68,68,0.4); }

        .tabs { padding:0 32px; display:flex; gap:8px; border-bottom:1px solid var(--border-2); margin-top:8px; overflow-x:auto; }
        .tab { padding:12px 16px; font-size:13px; font-weight:700; cursor:pointer; color:var(--muted); border-bottom:2px solid transparent; margin-bottom:-1px; text-transform:uppercase; letter-spacing:.06em; transition:all .2s; white-space:nowrap; }
        .tab.active { color:var(--amber-text); border-bottom-color:var(--amber); }

        .content { flex:1; overflow-y:auto; padding:24px 32px; display:flex; flex-direction:column; gap:16px; }
        .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        @media(max-width:768px){ .stats-row{grid-template-columns:1fr 1fr;} .layout{grid-template-columns:1fr;} }
        .stat-card { background:rgba(255,255,255,0.7); border:1px solid var(--border); border-radius:12px; padding:16px; transition:transform 0.2s; }
        .stat-card:hover { transform:translateY(-2px); }
        .stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:700; margin-bottom:6px; }
        .stat-val { font-size:24px; font-weight:700; line-height:1; }

        .day-row { background:rgba(255,255,255,0.8); border:1px solid var(--border); border-radius:12px; overflow:hidden; transition:all .2s; margin-bottom:12px; }
        .day-row.open { border-color:rgba(245,158,11,0.4); box-shadow:0 8px 24px rgba(0,0,0,0.06); }
        .day-header { display:flex; align-items:center; cursor:pointer; }
        .day-num { width:56px; height:56px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; border-right:1px solid rgba(0,0,0,0.05); background:rgba(255,255,255,0.5); flex-shrink:0; }
        .day-num.d1{color:var(--amber-text)} .day-num.d2{color:var(--emerald-text)} .day-num.d3{color:var(--sky-text)} .day-num.d4{color:var(--violet)}
        .day-title-wrap { flex:1; padding:0 16px; display:flex; align-items:center; }
        .day-title { font-size:15px; font-weight:700; color:var(--text); }
        .day-chevron { padding:0 20px; color:var(--dim); font-size:14px; transition:transform .3s; flex-shrink:0; }
        .day-chevron.open { transform:rotate(180deg); color:var(--amber-text); }
        .day-body { border-top:1px solid rgba(0,0,0,0.05); display:none; grid-template-columns:1fr 1fr 1fr; background:rgba(255,255,255,0.3); }
        .day-body.open { display:grid; }
        @media(max-width:768px){ .day-body.open{grid-template-columns:1fr;} }
        .day-slot { padding:16px; border-right:1px solid rgba(0,0,0,0.05); }
        .day-slot:last-child { border-right:none; }
        .slot-label { font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
        .slot-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .slot-text { font-size:13px; font-weight:500; color:var(--text); line-height:1.6; }

        .section-head { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); margin-bottom:12px; margin-top:8px; }
        .budget-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:600px){ .budget-grid{grid-template-columns:1fr;} }
        .budget-row { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.05); border-radius:8px; }
        .budget-total { grid-column:1/-1; border-color:rgba(16,185,129,0.3); background:var(--emerald-dim); }

        /* Leaflet z-index fix */
        .leaflet-container { z-index: 1; }
      `}} />

      <div className="travel-vibe-bg">
        <div className="orb-1" /><div className="orb-2" /><div className="orb-3" />
      </div>

      <div className="plan-trip-container">

        {showSuccess && !error && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slideDown">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-xl font-bold flex items-center gap-2">
              🎉 Trip Ready!
            </div>
          </div>
        )}

        {showToast && !error && (
          <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
            <div className="bg-emerald-500 text-white px-5 py-3 rounded-lg shadow-xl font-bold flex items-center gap-2">
              💾 Trip saved successfully!
            </div>
          </div>
        )}

        <div className="shell">
          {/* ── Topbar ── */}
          <div className="topbar">
            <div className="topbar-left">
              <div className="wordmark">wander<span>.</span>ai</div>
              <div className="divider-v" />
              <div className="breadcrumb">
                <button
                  onClick={() => navigate(-1)}
                  style={{ background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontWeight:"600", fontFamily:"var(--font-ui)" }}
                >
                  Trips
                </button>
                <span style={{ color:"var(--dim)" }}>›</span>
                <b style={{ textTransform:"capitalize" }}>{destination || "New Trip"} · {dayCount} Days</b>
              </div>
            </div>
            <div className="topbar-right">
              {loading
                ? <div className="tag tag-amber loading-pulse" style={{ background:"var(--surface-3)", border:"1px solid var(--border)" }}>Generating...</div>
                : <>
                    <div className="tag tag-emerald"><div className="dot" /> AI Ready</div>
                    <div className="tag tag-amber">{dayCount} Days</div>
                  </>
              }
            </div>
          </div>

          <div className="layout">
            {/* ── Sidebar ── */}
            <div className="sidebar">
              <div className="trip-meta">
                <div className="trip-dest">{destination || "Destination"}</div>
                <div className="trip-dates">{startDate} → {endDate}</div>
                <div className="trip-stat">
                  <span className="trip-stat-label">Budget</span>
                  <span className="trip-stat-val" style={{ color:"var(--emerald-text)" }}>₹{budget}</span>
                </div>
                <div className="trip-stat">
                  <span className="trip-stat-label">Days</span>
                  <span className="trip-stat-val">{dayCount}</span>
                </div>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-label">Navigation</div>
                {["Itinerary","Map","Budget","Food & Stays","Tips"].map(tab => (
                  <div
                    key={tab}
                    className={`nav-item ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    <div className="nav-icon">
                      <div style={{ width:"6px", height:"6px", borderRadius:"50%", background: activeTab === tab ? "var(--amber)" : "var(--dim)" }} />
                    </div>
                    {tab}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Main content ── */}
            <div className="main">
              <div className="page-header">
                <div>
                  <div className="page-title">Trip to <span>{destination || "Unknown"}</span></div>
                  <div className="page-sub">
                    {loading || showSuccess
                      ? "AI is crafting your perfect itinerary..."
                      : "Generated by AI · Complete itinerary · Ready to explore"}
                  </div>
                </div>

                {!loading && !error && tripData && (
                  <div className="btn-cluster">
                    <button className="btn-pdf" onClick={downloadPDF}>📄 Download PDF</button>
                    <button className="btn-dashboard" onClick={() => navigate("/dashboard")}>📋 View Dashboard</button>
                    <button className="btn-dashboard" onClick={() => setEditMode(!editMode)}>
                      {editMode ? "❌ Cancel" : "✏️ Edit Trip"}
                    </button>
                    {editMode && (
                      <button className="btn-book" onClick={() => { setTripData(editableTrip); setEditMode(false); }}>
                        💾 Save Changes
                      </button>
                    )}
                    {!editMode && (
                      <button
                        className="btn-book"
                        onClick={() => navigate("/booking", {
                          state: { destination, budget, checkin: startDate, checkout: endDate, tripData }
                        })}
                      >
                        ✈️ Book This Trip →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Loading */}
              {loading && !showSuccess && (
                <div className="content" style={{ alignItems:"center", justifyContent:"center" }}>
                  <div style={{ textAlign:"center", color:"var(--muted)" }}>
                    <div style={{ fontSize:"48px", marginBottom:"24px" }} className="loading-pulse">🏖️</div>
                    <p style={{ color:"var(--text)", fontSize:"18px", fontWeight:"700" }}>Curating your dream getaway...</p>
                    <p style={{ marginTop:"8px", fontSize:"14px" }}>Finding hidden gems, sunset spots, and local eats.</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {!loading && !showSuccess && error && (
                <div className="content" style={{ alignItems:"center", justifyContent:"center" }}>
                  <div style={{ textAlign:"center", background:"var(--rose-dim)", padding:"24px", borderRadius:"12px", border:"1px solid rgba(244,63,94,0.3)" }}>
                    <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚠️</div>
                    <p style={{ color:"var(--text)", fontSize:"16px", fontWeight:"700" }}>{error}</p>
                    <button
                      onClick={() => navigate(-1)}
                      style={{ marginTop:"20px", background:"var(--rose)", color:"#fff", border:"none", padding:"10px 20px", borderRadius:"6px", cursor:"pointer", fontWeight:"600", fontFamily:"var(--font-ui)" }}
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              )}

              {/* Success splash */}
              {showSuccess && !error && (
                <div className="content" style={{ alignItems:"center", justifyContent:"center" }}>
                  <div style={{ textAlign:"center", background:"rgba(255,255,255,0.9)", padding:"48px", borderRadius:"24px", border:"1px solid rgba(16,185,129,0.3)", boxShadow:"0 20px 40px rgba(0,0,0,0.05)", animation:"popIn 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
                    <div style={{ fontSize:"64px", marginBottom:"16px", animation:"bounceEmoji 1.5s infinite" }}>🎉</div>
                    <h2 style={{ color:"var(--emerald-text)", fontSize:"28px", fontWeight:"800", marginBottom:"8px" }}>Trip Ready!</h2>
                    <p style={{ color:"var(--muted)", fontSize:"15px" }}>Your personalized itinerary is cooked to perfection.</p>
                  </div>
                </div>
              )}

              {/* Main tabs + content */}
              {!loading && !showSuccess && !error && tripData && (
                <>
                  <div className="tabs">
                    {["Itinerary","Map","Budget","Food & Stays","Tips"].map(tab => (
                      <div key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                        {tab}
                      </div>
                    ))}
                  </div>

                  <div className="content">

                    {/* ── MAP TAB ── ✅ BUG 1 & 2 FIXED: completely rewritten MapContainer JSX */}
                    {activeTab === "Map" && (
                      <div style={{ height:"500px", borderRadius:"16px", overflow:"hidden", border:"1px solid rgba(0,0,0,0.1)", boxShadow:"0 10px 30px rgba(0,0,0,0.05)" }}>
                        <MapContainer
                          center={mapCoords}
                          zoom={12}
                          style={{ width:"100%", height:"100%" }}
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                          />
                          <Marker position={mapCoords}>
                            <Popup>
                              <div style={{ textAlign:"center", fontFamily:"sans-serif" }}>
                                <b style={{ color:"#b45309" }}>{destination}</b>
                                <br />Your adventure starts here!
                              </div>
                            </Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                    )}

                    {/* ── ITINERARY TAB ── */}
                    {activeTab === "Itinerary" && (
                      <>
                        <div className="stats-row">
                          <div className="stat-card"><div className="stat-label">Total Days</div><div className="stat-val" style={{color:"var(--amber-text)"}}>{dayCount}</div></div>
                          <div className="stat-card"><div className="stat-label">Total Budget</div><div className="stat-val" style={{color:"var(--emerald-text)"}}>₹{budget}</div></div>
                          <div className="stat-card"><div className="stat-label">Destination</div><div className="stat-val" style={{fontSize:"18px",textTransform:"capitalize",color:"var(--sky-text)"}}>{destination}</div></div>
                          <div className="stat-card"><div className="stat-label">Activities</div><div className="stat-val" style={{color:"var(--violet)"}}>{(tripData.days?.length||0)*3}+</div></div>
                        </div>

                        <div className="section-head">Day-by-day itinerary</div>

                        {tripData.days?.map((day, i) => (
                          <div key={i} className={`day-row ${openDays[i] ? "open" : ""}`}>
                            <div className="day-header" onClick={() => !editMode && toggleDay(i)}>
                              <div className={`day-num d${(i % 4) + 1}`}>D{day.day}</div>
                              <div className="day-title-wrap">
                                {editMode ? (
                                  <input
                                    value={editableTrip?.days[i]?.title || ""}
                                    onChange={(e) => {
                                      const updated = JSON.parse(JSON.stringify(editableTrip));
                                      updated.days[i].title = e.target.value;
                                      setEditableTrip(updated);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ background:"rgba(255,255,255,0.7)", padding:"4px 12px", borderRadius:"6px", width:"100%", border:"1px solid #d1d5db", fontWeight:"700", outline:"none", fontFamily:"var(--font-ui)" }}
                                  />
                                ) : (
                                  <div className="day-title">{day.title || `Exploring ${destination}`}</div>
                                )}
                              </div>
                              <div className={`day-chevron ${openDays[i] ? "open" : ""}`}>▾</div>
                            </div>

                            <div className={`day-body ${openDays[i] ? "open" : ""}`}>
                              {[
                                { key:"morning",   label:"Morning",   dot:"var(--amber)",  text:"var(--amber-text)" },
                                { key:"afternoon", label:"Afternoon", dot:"var(--sky)",    text:"var(--sky-text)"   },
                                { key:"evening",   label:"Evening",   dot:"var(--violet)", text:"var(--violet)"     },
                              ].map(({ key, label, dot, text }) => (
                                <div key={key} className="day-slot">
                                  <div className="slot-label" style={{ color: text }}>
                                    <div className="slot-dot" style={{ background: dot }} />
                                    {label}
                                  </div>
                                  {editMode ? (
                                    <textarea
                                      value={editableTrip?.days[i]?.[key] || ""}
                                      onChange={(e) => {
                                        const updated = JSON.parse(JSON.stringify(editableTrip));
                                        updated.days[i][key] = e.target.value;
                                        setEditableTrip(updated);
                                      }}
                                      style={{ background:"rgba(255,255,255,0.7)", padding:"8px", borderRadius:"6px", width:"100%", border:"1px solid #d1d5db", fontSize:"13px", minHeight:"80px", outline:"none", resize:"vertical", fontFamily:"var(--font-ui)" }}
                                    />
                                  ) : (
                                    <div className="slot-text">{day[key]}</div>
                                  )}
                                  {!editMode && key === "evening" && day.food?.length > 0 && (
                                    <div style={{ marginTop:"12px", padding:"10px", background:"rgba(245,158,11,0.1)", borderRadius:"6px", border:"1px solid rgba(245,158,11,0.2)" }}>
                                      <b style={{ fontSize:"10px", color:"var(--amber-text)", textTransform:"uppercase", letterSpacing:"0.05em" }}>🍽️ Evening Eats:</b>
                                      {day.food.map((f, fi) => (
                                        <div key={fi} style={{ fontSize:"12px", color:"var(--text)", marginTop:"4px", fontWeight:"500" }}>• {f}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* ── BUDGET TAB ── */}
                    {activeTab === "Budget" && tripData.budgetBreakdown && (
                      <>
                        <div className="section-head">Budget breakdown</div>
                        <div className="budget-grid">
                          {Object.entries(tripData.budgetBreakdown).map(([key, val]) => (
                            <div key={key} className={`budget-row ${key.toLowerCase().includes("total") ? "budget-total" : ""}`}>
                              <span style={{ textTransform:"capitalize", fontWeight:"600", color:"var(--muted)" }}>
                                {key.replace(/([A-Z])/g," $1").trim()}
                              </span>
                              <span style={{ fontWeight:"700", color:"var(--emerald-text)" }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── FOOD & STAYS TAB ── */}
                    {activeTab === "Food & Stays" && (
                      <>
                        {tripData.whereToStay && (
                          <>
                            <div className="section-head">Where to Stay</div>
                            <div className="budget-grid" style={{ marginBottom:"24px" }}>
                              <div className="budget-row" style={{ flexDirection:"column", alignItems:"flex-start", background:"var(--amber-dim)", borderColor:"rgba(245,158,11,0.3)" }}>
                                <span style={{ color:"var(--amber-text)", marginBottom:"6px", fontWeight:"bold" }}>Budget Option</span>
                                <span style={{ color:"var(--text)" }}>{tripData.whereToStay.budget}</span>
                              </div>
                              <div className="budget-row" style={{ flexDirection:"column", alignItems:"flex-start", background:"var(--sky-dim)", borderColor:"rgba(14,165,233,0.3)" }}>
                                <span style={{ color:"var(--sky-text)", marginBottom:"6px", fontWeight:"bold" }}>Mid-Range Option</span>
                                <span style={{ color:"var(--text)" }}>{tripData.whereToStay.midRange}</span>
                              </div>
                            </div>
                          </>
                        )}
                        {tripData.mustEat?.length > 0 && (
                          <>
                            <div className="section-head">Must-Try Local Foods</div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                              {tripData.mustEat.map((food, i) => (
                                <div key={i} style={{ background:"rgba(255,255,255,0.7)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:"8px", padding:"14px 16px", display:"flex", gap:"12px" }}>
                                  <span style={{ fontSize:"16px" }}>🍜</span>
                                  <span style={{ fontSize:"13px", fontWeight:"500", color:"var(--text)" }}>{food}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* ── TIPS TAB ── */}
                    {activeTab === "Tips" && tripData.travelTips?.length > 0 && (
                      <>
                        <div className="section-head">Essential Travel Tips</div>
                        <div style={{ display:"grid", gap:"12px" }}>
                          {tripData.travelTips.map((tip, i) => (
                            <div key={i} style={{ background:"rgba  (255,255,255,0.7)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:"8px", padding:"14px 16px", display:"flex", gap:"12px" }}>
                              <div style={{ fontWeight:"800", color:"var(--muted)", flexShrink:0 }}>0{i+1}</div>
                              <div style={{ fontWeight:"500", color:"var(--text)", lineHeight:"1.6" }}>{tip}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ textAlign:"center", padding:"24px 0", marginTop:"auto" }}>
                      <span style={{ fontSize:"10px", color:"var(--dim)", fontWeight:700, letterSpacing:".15em" }}>
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