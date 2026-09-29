// frontend/src/pages/PlanTrip.jsx
// ✅ BUGS FIXED & UPGRADES:
//   1. PDF Theme: Premium Creamy White (#FDFBF7) & Warm Gold.
//   2. PDF Layout: Compressed aggressively to strictly 2-3 pages maximum.
//   3. PDF Safety: safeString() prevents NaN coordinate crashes.
//   4. MapView Component: Using Custom iframe MapView with dynamic destination. Removed dead Leaflet code.
//   5. Skeletons: Added Premium TripSkeleton for loading states.

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { downloadItineraryPDF } from "../utils/pdf";

// 🔥 IMPORT YOUR CUSTOM MAP COMPONENT
import MapView from "../components/MapView";

// ✅ ADDED SKELETON IMPORT
import { TripSkeleton } from "../components/Skeletons";

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

// 🔥 BULLETPROOF DATA PARSER FOR PDF
const safeString = (val) => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? Object.values(v).join(' ') : v).join(", ");
  if (typeof val === "object") return Object.values(val).join(", ");
  return String(val);
};

export default function PlanTrip() {
  const { state } = useLocation();
  const navigate  = useNavigate();

  const destination = state?.destination || "";
  const budget      = state?.budget      || "";
  const startDate   = state?.checkin     || "";
  const endDate     = state?.checkout    || "";

  const [tripData, setTripData]         = useState(null);
  const [tripId, setTripId]             = useState(state?.tripId || state?.bookingId || state?._id || null);
  const [activePivotMenu, setActivePivotMenu] = useState(null);
  const [pivotLoading, setPivotLoading]       = useState({});
  const [lockLoading, setLockLoading]         = useState({});
  const [customReasonInput, setCustomReasonInput] = useState("");
  const [showCustomModal, setShowCustomModal]     = useState(false);
  const [pivotTarget, setPivotTarget]             = useState(null);
  const [pivotError, setPivotError]               = useState(null);
  const [adaptedBadges, setAdaptedBadges]         = useState({});
  const [editMode, setEditMode]         = useState(false);
  const [editableTrip, setEditableTrip] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [showSuccess, setShowSuccess]   = useState(false);
  const [showToast, setShowToast]       = useState(false);
  const [openDays, setOpenDays]         = useState({ 0: true });
  const [activeTab, setActiveTab]       = useState("Itinerary");

  // 🌟 Phase 3: Reality Score State & Fetcher
  const [realityReport, setRealityReport] = useState(null);
  const [realityLoading, setRealityLoading] = useState(false);
  const [showRealityModal, setShowRealityModal] = useState(false);

  // 🛠️ Phase 4: Fix My Day State (day-level adaptive rebalancing)
  const [showFixDayModal, setShowFixDayModal]       = useState(false);
  const [fixDayTarget, setFixDayTarget]             = useState(null); // { dayNumber }
  const [fixDayReason, setFixDayReason]             = useState("schedule_overload");
  const [fixDayCurrentPeriod, setFixDayCurrentPeriod] = useState("morning");
  const [fixDayDelay, setFixDayDelay]               = useState(30);
  const [fixDayCustom, setFixDayCustom]             = useState("");
  const [fixDayPreview, setFixDayPreview]           = useState(null); // full server proposal
  const [fixDayLoading, setFixDayLoading]           = useState(false);
  const [fixDayApplying, setFixDayApplying]         = useState(false);
  const [fixDayError, setFixDayError]               = useState(null); // in-modal error (banner is hidden behind modal)

  const fetchRealityScore = async (idToUse = tripId) => {
    if (!idToUse) return;
    try {
      setRealityLoading(true);
      const res = await api.post("/api/ai/reality-score", { tripId: idToUse });
      if (res.data?.success) {
        setRealityReport(res.data.data);
      }
    } catch (err) {
      console.warn("Reality score fetch skipped:", err?.response?.data?.message || err.message);
    } finally {
      setRealityLoading(false);
    }
  };

  // Day count: derive from the selected dates, but fall back to the number of
  // days the AI actually returned (quick-plan/featured trips have no dates).
  const dayCount = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
    : (Array.isArray(tripData?.days) ? tripData.days.length : 0);

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
        if (res.data.tripId) {
          setTripId(res.data.tripId);
          fetchRealityScore(res.data.tripId);
        }
        setShowSuccess(true);

        setTimeout(() => {
          setShowSuccess(false);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }, 1500);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
          "AI generation failed. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tripId && !realityReport && !realityLoading) {
      fetchRealityScore(tripId);
    }
  }, [tripId]);

  useEffect(() => {
    if (tripData) {
      setEditableTrip(JSON.parse(JSON.stringify(tripData)));
    }
  }, [tripData]);

  const handleTriggerPivot = async (dayNumber, block, reason, customText = "") => {
    const slotKey = `d${dayNumber}-${block}`;
    if (!tripId) {
      setPivotError("Trip ID not available. Please save this trip first or refresh.");
      setTimeout(() => setPivotError(null), 4000);
      return;
    }

    try {
      setPivotLoading((prev) => ({ ...prev, [slotKey]: true }));
      setActivePivotMenu(null);
      setShowCustomModal(false);
      setPivotError(null);

      const payload = {
        tripId,
        dayNumber: Number(dayNumber),
        block,
        pivotReason: reason,
      };
      if (reason === "custom") {
        payload.customReason = customText || "Custom adaptation requested";
      }

      const res = await api.post("/api/ai/pivot", payload);
      const data = res.data?.data;

      if (data?.formattedBlock) {
        setTripData((prev) => {
          if (!prev || !prev.days) return prev;
          const updatedDays = prev.days.map((d) => {
            if (Number(d.day) === Number(dayNumber)) {
              const updatedDay = { ...d, [block]: data.formattedBlock };
              if (Array.isArray(d.activities) && data.replacement) {
                updatedDay.activities = d.activities.map((a) => {
                  if (a.period === block || (data.activityId && a.id === data.activityId)) {
                    return {
                      ...a,
                      title: data.replacement.title,
                      description: data.replacement.description,
                      category: data.replacement.category,
                      durationMinutes: data.replacement.estimatedDurationMinutes,
                      cost: data.replacement.costEstimate,
                      indoorOutdoor: data.replacement.indoorOutdoor,
                    };
                  }
                  return a;
                });
              }
              return updatedDay;
            }
            return d;
          });
          return { ...prev, days: updatedDays };
        });

        const badgeLabels = {
          rain: "🌧️ Adapted for Rain",
          low_energy: "🥱 Adapted for Low Energy",
          budget: "💰 Adapted for Budget",
          running_late: "⏰ Adapted for Running Late",
          closed: "🚫 Venue Replaced",
          custom: "✏️ Custom Adaptation",
        };

        setAdaptedBadges((prev) => ({
          ...prev,
          [slotKey]: badgeLabels[reason] || "⚡ Adapted",
        }));

        // 🌟 Recalculate Reality Score deterministically after pivot
        fetchRealityScore(tripId);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Unable to find a suitable replacement right now. Your original plan was kept.";
      setPivotError(msg);
      setTimeout(() => setPivotError(null), 5000);
    } finally {
      setPivotLoading((prev) => ({ ...prev, [slotKey]: false }));
      setCustomReasonInput("");
      setPivotTarget(null);
    }
  };

  const getActivityForSlot = (day, period) => {
    if (Array.isArray(day?.activities)) {
      const found = day.activities.find((a) => a.period === period || a.id?.includes(period));
      if (found) return found;
    }
    const defaultId = `d${day?.day || 1}-${period}-01`;
    const text = day?.[period] || "";
    const parts = text.includes(" — ") ? text.split(" — ") : text.includes(" - ") ? text.split(" - ") : [text, ""];
    return {
      id: defaultId,
      period,
      title: parts[0]?.trim() || "Activity",
      description: parts.slice(1).join(" — ")?.trim() || parts[0]?.trim() || "",
      category: period === "evening" ? "Dining & Nightlife" : "Sightseeing",
      durationMinutes: 120,
      cost: "Moderate",
      indoorOutdoor: "Mixed",
      locked: false,
    };
  };

  const handleToggleLock = async (dayNumber, period) => {
    if (!tripId) {
      setPivotError("Trip ID not available. Please save this trip or refresh.");
      setTimeout(() => setPivotError(null), 4000);
      return;
    }

    const day = tripData?.days?.find((d) => Number(d.day) === Number(dayNumber));
    if (!day) return;

    const activity = getActivityForSlot(day, period);
    const activityId = activity.id || `d${dayNumber}-${period}-01`;
    const newLockedState = !Boolean(activity.locked);
    const slotKey = `d${dayNumber}-${period}`;

    try {
      setLockLoading((prev) => ({ ...prev, [slotKey]: true }));
      setPivotError(null);

      const res = await api.post("/api/ai/activity/lock", {
        tripId,
        activityId,
        locked: newLockedState,
      });

      if (res.data?.success) {
        setTripData((prev) => {
          if (!prev || !prev.days) return prev;
          const updatedDays = prev.days.map((d) => {
            if (Number(d.day) === Number(dayNumber)) {
              let updatedActs = Array.isArray(d.activities) ? [...d.activities] : [];
              const actIdx = updatedActs.findIndex((a) => a.id === activityId || a.period === period);
              if (actIdx !== -1) {
                updatedActs[actIdx] = { ...updatedActs[actIdx], locked: newLockedState };
              } else {
                updatedActs.push({ ...activity, locked: newLockedState });
              }
              return { ...d, activities: updatedActs };
            }
            return d;
          });
          return { ...prev, days: updatedDays };
        });

        // 🌟 Recalculate Reality Score deterministically after lock toggle
        fetchRealityScore(tripId);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update activity lock. Please try again.";
      setPivotError(msg);
      setTimeout(() => setPivotError(null), 4000);
    } finally {
      setLockLoading((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  // ─────────────── Phase 4: Fix My Day ───────────────
  const getFixDayEligibility = (day) => {
    let activities = [];
    if (Array.isArray(day?.activities) && day.activities.length > 0) {
      // Use the authoritative structured model directly — it mirrors the
      // backend normalizer, which allows >3 activities and multiple per period.
      activities = day.activities;
    } else {
      // Legacy fallback: one activity per populated period block.
      activities = ["morning", "afternoon", "evening"]
        .map((p) => {
          const text = day?.[p];
          return typeof text === "string" && text.trim().length > 0
            ? getActivityForSlot(day, p)
            : null;
        })
        .filter(Boolean);
    }
    const unlockedCount = activities.filter((a) => !a.locked).length;
    if (activities.length < 2) {
      return { eligible: false, reason: "Fix My Day needs at least 2 activities on this day." };
    }
    if (unlockedCount === 0) {
      return { eligible: false, reason: "All activities are locked. Unlock one to use Fix My Day." };
    }
    return { eligible: true, reason: "Rebalance this day when plans change" };
  };

  const isFixDayFormValid = () => {
    if (fixDayReason === "running_late") {
      const d = Number(fixDayDelay);
      return (fixDayCurrentPeriod === "morning" || fixDayCurrentPeriod === "afternoon") &&
        Number.isInteger(d) && d >= 15 && d <= 240;
    }
    if (fixDayReason === "custom") {
      const t = (fixDayCustom || "").trim();
      return t.length > 0 && t.length <= 300;
    }
    return true; // schedule_overload requires no extra fields
  };

  const closeFixDayModal = () => {
    setShowFixDayModal(false);
    setFixDayTarget(null);
    setFixDayReason("schedule_overload");
    setFixDayCurrentPeriod("morning");
    setFixDayDelay(30);
    setFixDayCustom("");
    setFixDayPreview(null);
    setFixDayError(null);
    setFixDayLoading(false);
    setFixDayApplying(false);
  };
  // FIXDAY_HANDLERS_OPEN
  const openFixDayModal = (day) => {
    if (!tripId) {
      setPivotError("Trip ID not available. Please save this trip or refresh.");
      setTimeout(() => setPivotError(null), 4000);
      return;
    }
    setFixDayTarget({ dayNumber: Number(day.day) });
    setFixDayReason("schedule_overload");
    setFixDayCurrentPeriod("morning");
    setFixDayDelay(30);
    setFixDayCustom("");
    setFixDayPreview(null);
    setFixDayError(null);
    setShowFixDayModal(true);
  };

  const handleFixDayFailure = (err) => {
    const status = err?.response?.status;
    const backendMsg = err?.response?.data?.message;
    // 403/404 close the modal and surface via the global banner
    if (status === 403 || status === 404) {
      closeFixDayModal();
      setPivotError(backendMsg || (status === 403
        ? "You're not authorized to modify this trip."
        : "This trip or day is no longer available."));
      setTimeout(() => setPivotError(null), 5000);
      return;
    }
    // Everything else keeps the modal open (its backdrop hides the banner)
    if (status === 400) {
      setFixDayPreview(null);
      setFixDayError("This request was invalid or the proposal is no longer valid. Please generate a new preview.");
    } else if (status === 409) {
      setFixDayPreview(null);
      setFixDayError("Your itinerary changed after this preview. Generate a new preview.");
    } else if (status === 410) {
      setFixDayPreview(null);
      setFixDayError("This preview expired. Generate a new preview.");
    } else if (status === 422) {
      setFixDayError(backendMsg || "This day can't be adapted for that reason.");
    } else if (status === 423) {
      setFixDayError(backendMsg || "A locked activity prevents this change. Unlock it or choose another day.");
    } else if (status === 429) {
      setFixDayError(backendMsg || "Too many requests right now. Please wait a moment and try again.");
    } else if (status === 502) {
      setFixDayError("Couldn't generate a valid alternative. Your plan is unchanged.");
    } else if (status === 504) {
      setFixDayError("The AI service timed out. Please try again.");
    } else {
      setFixDayError(backendMsg || "Something went wrong. Your plan is unchanged.");
    }
  };
  // FIXDAY_HANDLERS_ASYNC
  const handleFixDayPreview = async () => {
    if (!tripId || !fixDayTarget) {
      setFixDayError("Trip ID not available. Please save this trip or refresh.");
      return;
    }
    const dayNumber = Number(fixDayTarget.dayNumber);
    const payload = { tripId, dayNumber, reason: fixDayReason };
    if (fixDayReason === "running_late") {
      payload.currentPeriod = fixDayCurrentPeriod;
      payload.delayMinutes = Number(fixDayDelay);
    } else if (fixDayReason === "custom") {
      payload.customReason = (fixDayCustom || "").trim();
    }
    try {
      setFixDayLoading(true);
      setFixDayError(null);
      const res = await api.post("/api/ai/fix-day/preview", payload);
      if (res.data?.success) {
        setFixDayPreview(res.data.data); // store the entire server proposal
      } else {
        setFixDayError("Unable to generate a preview. Please try again.");
      }
    } catch (err) {
      handleFixDayFailure(err);
    } finally {
      setFixDayLoading(false);
    }
  };
  // FIXDAY_HANDLERS_APPLY
  const handleFixDayApply = async () => {
    if (!tripId || !fixDayTarget || !fixDayPreview?.proposalToken) return;
    const dayNumber = Number(fixDayTarget.dayNumber);
    try {
      setFixDayApplying(true);
      setFixDayError(null);
      // Apply sends ONLY the signed token — never replacement content.
      const res = await api.post("/api/ai/fix-day/apply", {
        tripId,
        dayNumber,
        proposalToken: fixDayPreview.proposalToken,
      });
      if (res.data?.success) {
        const data = res.data.data;
        setTripData((prev) => {
          if (!prev || !Array.isArray(prev.days)) return prev;
          // Match by day number, NEVER by array index.
          const updatedDays = prev.days.map((d) =>
            Number(d.day) === Number(data.dayNumber) ? data.updatedDay : d
          );
          return { ...prev, days: updatedDays };
        });
        // Use the authoritative report returned by apply (no second request).
        if (data.realityReport) setRealityReport(data.realityReport);
        setAdaptedBadges((prev) => ({ ...prev, [`fixday-d${data.dayNumber}`]: "🛠️ Day Rebalanced" }));
        closeFixDayModal();
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else {
        setFixDayError("Apply failed. Please try again.");
      }
    } catch (err) {
      handleFixDayFailure(err);
    } finally {
      setFixDayApplying(false);
    }
  };

  const toggleDay = (dayKey) =>
    setOpenDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }));

  const downloadPDF = () =>
    downloadItineraryPDF({ destination, budget, startDate, endDate, tripData });
  // ─────────────────────────────── JSX ──────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('[https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap](https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap)');

        /* Updated to warm, creamy tones to completely remove blue */
        .travel-vibe-bg { position:fixed; top:0; left:0; width:100vw; height:100vh; background:#FDFBF7; z-index:-1; overflow:hidden; }
        .orb-1 { position:absolute; top:-10%; left:-10%; width:50vw; height:50vw; background:radial-gradient(circle,rgba(245,158,11,0.2) 0%,rgba(255,255,255,0) 70%); filter:blur(80px); animation:float 20s ease-in-out infinite; }
        .orb-2 { position:absolute; bottom:-20%; right:-10%; width:60vw; height:60vw; background:radial-gradient(circle,rgba(16,185,129,0.15) 0%,rgba(255,255,255,0) 70%); filter:blur(90px); animation:float 25s ease-in-out infinite reverse; }
        .orb-3 { position:absolute; top:30%; left:30%; width:40vw; height:40vw; background:radial-gradient(circle,rgba(217,119,6,0.15) 0%,rgba(255,255,255,0) 70%); filter:blur(70px); animation:float 22s ease-in-out infinite alternate; }
        
        @keyframes float { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(5%,10%) scale(1.1)} 66%{transform:translate(-5%,5%) scale(0.9)} 100%{transform:translate(0,0) scale(1)} }
        @keyframes slideDown { 0%{opacity:0;transform:translate(-50%,-20px)} 100%{opacity:1;transform:translate(-50%,0)} }
        .animate-slideDown { animation:slideDown 0.4s ease-out forwards; }
        @keyframes slideUp { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
        .animate-slideUp { animation:slideUp 0.4s ease-out forwards; }
        @keyframes popIn { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes bounceEmoji { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes loadPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .loading-pulse { animation:loadPulse 2s infinite; }

        .plan-trip-container {
          --font-head:'Playfair Display',Georgia,serif;
          --font-ui:'Space Grotesk',sans-serif;
          --surface:rgba(255,255,255,0.7); --surface-2:rgba(255,255,255,0.5); --surface-3:rgba(255,255,255,0.9);
          --border:rgba(0,0,0,0.08); --border-2:rgba(0,0,0,0.04);
          --text:#111827; --muted:#4B5563; --dim:#9CA3AF;
          --amber:#F59E0B; --amber-dim:rgba(245,158,11,0.15); --amber-text:#B45309;
          --emerald:#10B981; --emerald-dim:rgba(16,185,129,0.15); --emerald-text:#047857;
          --rose:#EF4444; --rose-dim:rgba(239,68,68,0.15);
          font-family:var(--font-ui); color:var(--text); font-size:14px; line-height:1.5;
          min-height:100vh; padding:20px; display:flex; justify-content:center; position:relative; z-index:1;
        }

        .shell { background:rgba(255,255,255,0.6); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); width:100%; max-width:1200px; border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,0.05); box-shadow:0 20px 50px rgba(0,0,0,0.04); display:flex; flex-direction:column; }

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
        .dot { width:6px; height:6px; border-radius:50%; background:var(--emerald); animation:pulse 2s infinite; }

        .layout { display:grid; grid-template-columns:260px 1fr; min-height:700px; flex:1; }
        .sidebar { background:var(--surface-2); border-right:1px solid var(--border); padding:24px 0; display:flex; flex-direction:column; gap:2px; }
        .sidebar-section { padding:0 20px 8px; margin-top:16px; }
        .sidebar-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--dim); margin-bottom:12px; padding:0 4px; }
        .nav-item { display:flex; align-items:center; gap:12px; padding:9px 16px; border-radius:8px; font-size:13px; font-weight:500; color:var(--muted); cursor:pointer; transition:all .2s; margin:0 8px; }
        .nav-item:hover { background:rgba(255,255,255,0.7); color:var(--text); transform:translateX(4px); }
        .nav-item.active { background:var(--surface-3); color:var(--text); font-weight:600; }

        .trip-meta { margin:16px 20px 0; padding:16px; background:rgba(255,255,255,0.7); border-radius:12px; border:1px solid var(--border); }
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
        .btn-pdf { padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.9); color:#111827; border:1px solid rgba(0,0,0,0.1); font-family:var(--font-ui); transition:transform 0.15s,box-shadow 0.15s; }
        .btn-pdf:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.05); }
        .btn-dashboard { padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; background:rgba(255,255,255,0.7); color:#374151; border:1px solid rgba(0,0,0,0.1); font-family:var(--font-ui); transition:transform 0.15s,background 0.15s; }
        .btn-dashboard:hover { background:rgba(255,255,255,1); transform:translateY(-1px); }
        .btn-book { padding:8px 20px; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer; background:linear-gradient(135deg,#D97706,#EF4444); color:#fff; border:none; box-shadow:0 4px 16px rgba(239,68,68,0.2); font-family:var(--font-ui); transition:transform 0.15s,box-shadow 0.15s; }
        .btn-book:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(239,68,68,0.3); }

        .tabs { padding:0 32px; display:flex; gap:8px; border-bottom:1px solid var(--border-2); margin-top:8px; overflow-x:auto; }
        .tab { padding:12px 16px; font-size:13px; font-weight:700; cursor:pointer; color:var(--muted); border-bottom:2px solid transparent; margin-bottom:-1px; text-transform:uppercase; letter-spacing:.06em; transition:all .2s; white-space:nowrap; }
        .tab.active { color:var(--amber-text); border-bottom-color:var(--amber); }

        .content { flex:1; overflow-y:auto; padding:24px 32px; display:flex; flex-direction:column; gap:16px; }
        .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        @media(max-width:768px){ .stats-row{grid-template-columns:1fr 1fr;} .layout{grid-template-columns:1fr;} }
        .stat-card { background:rgba(255,255,255,0.8); border:1px solid var(--border); border-radius:12px; padding:16px; transition:transform 0.2s; }
        .stat-card:hover { transform:translateY(-2px); }
        .stat-label { font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:700; margin-bottom:6px; }
        .stat-val { font-size:24px; font-weight:700; line-height:1; }

        .day-row { background:rgba(255,255,255,0.9); border:1px solid var(--border); border-radius:12px; overflow:hidden; transition:all .2s; margin-bottom:12px; }
        .day-row.open { border-color:rgba(245,158,11,0.3); box-shadow:0 8px 24px rgba(0,0,0,0.04); }
        .day-header { display:flex; align-items:center; cursor:pointer; }
        .day-num { width:56px; height:56px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; border-right:1px solid rgba(0,0,0,0.05); background:rgba(255,255,255,0.5); flex-shrink:0; }
        .day-num.d1{color:var(--amber-text)} .day-num.d2{color:var(--emerald-text)} .day-num.d3{color:var(--amber-text)} .day-num.d4{color:var(--rose)}
        .day-title-wrap { flex:1; padding:0 16px; display:flex; align-items:center; }
        .day-title { font-size:15px; font-weight:700; color:var(--text); }
        .day-chevron { padding:0 20px; color:var(--dim); font-size:14px; transition:transform .3s; flex-shrink:0; }
        .day-chevron.open { transform:rotate(180deg); color:var(--amber-text); }
        .day-body { border-top:1px solid rgba(0,0,0,0.05); display:none; grid-template-columns:1fr 1fr 1fr; background:rgba(255,255,255,0.5); }
        .day-body.open { display:grid; }
        @media(max-width:768px){ .day-body.open{grid-template-columns:1fr;} }
        .day-slot { padding:16px; border-right:1px solid rgba(0,0,0,0.05); position:relative; }
        .day-slot:last-child { border-right:none; }
        .slot-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; position:relative; }
        .slot-label { font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; display:flex; align-items:center; gap:6px; margin-bottom:0; }
        .slot-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .slot-text { font-size:13px; font-weight:500; color:var(--text); line-height:1.6; }
        .btn-pivot { background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); color:var(--amber-text); border-radius:6px; font-size:11px; font-weight:700; padding:2px 8px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.15s; font-family:var(--font-ui); }
        .btn-pivot:hover:not(:disabled) { background:rgba(217,119,6,0.18); transform:translateY(-1px); }
        .btn-pivot:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-lock { padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-family:var(--font-ui); transition:all 0.15s; border:1px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.8); color:var(--muted); }
        .btn-lock:hover:not(:disabled) { border-color:var(--amber); color:var(--amber-text); }
        .btn-lock.is-locked { border-color:rgba(217,119,6,0.5); background:rgba(217,119,6,0.12); color:var(--amber-text); }
        .activity-meta-pill { font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:9999px; display:inline-flex; align-items:center; gap:4px; font-family:var(--font-ui); }
        .pivot-popover { position:absolute; right:0; top:28px; z-index:30; background:#fff; border:1px solid rgba(0,0,0,0.12); border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.15); padding:6px; width:210px; animation:popIn 0.2s ease-out; }
        .pivot-option { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; font-size:12px; font-weight:600; color:var(--text); cursor:pointer; transition:background 0.15s; }
        .pivot-option:hover { background:rgba(217,119,6,0.1); color:var(--amber-text); }
        .pivot-skeleton { background:linear-gradient(90deg,#f0ede6 25%,#faf8f5 50%,#f0ede6 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:54px; margin-top:4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .adapted-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:rgba(5,150,105,0.1); color:var(--emerald-text); border:1px solid rgba(5,150,105,0.25); margin-top:6px; }

        /* Phase 4: Fix My Day (day-level action) */
        .btn-fixday { background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); color:var(--amber-text); border-radius:8px; font-size:12px; font-weight:700; padding:6px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; font-family:var(--font-ui); margin-right:12px; white-space:nowrap; }
        .btn-fixday:hover:not(:disabled) { background:rgba(217,119,6,0.18); transform:translateY(-1px); }
        .btn-fixday:disabled { cursor:not-allowed; opacity:0.5; }
        .fixday-reason { display:flex; flex-direction:column; gap:2px; padding:12px 14px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,0.9); cursor:pointer; transition:all 0.15s; text-align:left; }
        .fixday-reason.active { border-color:var(--amber); background:var(--amber-dim); }
        .fixday-slot { border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px 14px; background:rgba(0,0,0,0.02); }
        .fixday-slot.replaced { border-color:rgba(16,185,129,0.4); background:rgba(16,185,129,0.06); }
        .fixday-slot.readonly { opacity:0.85; }

        .section-head { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); margin-bottom:12px; margin-top:8px; }
        .budget-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:600px){ .budget-grid{grid-template-columns:1fr;} }
        .budget-row { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(255,255,255,0.8); border:1px solid rgba(0,0,0,0.05); border-radius:8px; }
        .budget-total { grid-column:1/-1; border-color:rgba(16,185,129,0.2); background:var(--emerald-dim); }
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

        {pivotError && (
          <div className="fixed top-6 right-6 z-50 animate-slideDown" style={{ maxWidth: "420px" }}>
            <div style={{ background: "#EF4444", color: "#fff", padding: "12px 18px", borderRadius: "10px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{pivotError}</span>
              <button onClick={() => setPivotError(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>✕</button>
            </div>
          </div>
        )}

        {showCustomModal && pivotTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowCustomModal(false)}>
            <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "420px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--text)", marginBottom: "4px" }}>
                ⚡ Custom Pivot Reason
              </div>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                Tell TripNow what changed for Day {pivotTarget.dayNumber} {pivotTarget.block}:
              </p>
              <input
                type="text"
                placeholder="e.g. Too hot outside, need air conditioning"
                value={customReasonInput}
                onChange={(e) => setCustomReasonInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customReasonInput.trim()) {
                    handleTriggerPivot(pivotTarget.dayNumber, pivotTarget.block, "custom", customReasonInput.trim());
                  }
                }}
                autoFocus
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "14px", outline: "none", fontFamily: "var(--font-ui)", marginBottom: "16px" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => { setShowCustomModal(false); setCustomReasonInput(""); }}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "#fff", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  disabled={!customReasonInput.trim()}
                  onClick={() => handleTriggerPivot(pivotTarget.dayNumber, pivotTarget.block, "custom", customReasonInput.trim())}
                  style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "var(--amber)", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: customReasonInput.trim() ? "pointer" : "not-allowed", opacity: customReasonInput.trim() ? 1 : 0.6 }}
                >
                  Adapt Now →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="shell">
          <div className="topbar">
            <div className="topbar-left">
              <div className="wordmark">Trip<span>Now</span></div>
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
                        ✈️ Save This Trip →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ✅ UPDATED LOADING SKELETON */}
              {loading && !showSuccess && (
                <div className="content mt-4">
                  <TripSkeleton />
                </div>
              )}

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

              {showSuccess && !error && (
                <div className="content" style={{ alignItems:"center", justifyContent:"center" }}>
                  <div style={{ textAlign:"center", background:"rgba(255,255,255,0.9)", padding:"48px", borderRadius:"24px", border:"1px solid rgba(16,185,129,0.3)", boxShadow:"0 20px 40px rgba(0,0,0,0.05)", animation:"popIn 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
                    <div style={{ fontSize:"64px", marginBottom:"16px", animation:"bounceEmoji 1.5s infinite" }}>🎉</div>
                    <h2 style={{ color:"var(--emerald-text)", fontSize:"28px", fontWeight:"800", marginBottom:"8px" }}>Trip Ready!</h2>
                    <p style={{ color:"var(--muted)", fontSize:"15px" }}>Your personalized itinerary is cooked to perfection.</p>
                  </div>
                </div>
              )}

              {!loading && !showSuccess && !error && tripData && (
                <>
                  {/* ── REALITY SCORE BANNER (PHASE 3) ── */}
                  {realityReport && (
                    <div style={{
                      background: "rgba(255, 255, 255, 0.9)",
                      backdropFilter: "blur(16px)",
                      borderRadius: "14px",
                      padding: "16px 20px",
                      marginBottom: "16px",
                      border: `1px solid ${realityReport.color || "rgba(16, 185, 129, 0.3)"}`,
                      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "12px",
                            background: realityReport.color ? `${realityReport.color}15` : "rgba(16, 185, 129, 0.1)",
                            color: realityReport.color || "#059669",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `1.5px solid ${realityReport.color || "#059669"}`,
                            flexShrink: 0,
                          }}>
                            <span style={{ fontSize: "20px", fontWeight: "900", lineHeight: "1", fontFamily: "var(--font-ui)" }}>
                              {realityReport.score}
                            </span>
                            <span style={{ fontSize: "9px", fontWeight: "700", opacity: 0.8, textTransform: "uppercase", marginTop: "2px" }}>
                              Score
                            </span>
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                                ⭐ Trip Reality Score
                              </span>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: realityReport.color ? `${realityReport.color}20` : "rgba(16, 185, 129, 0.15)",
                                color: realityReport.color || "#059669",
                              }}>
                                {realityReport.status}
                              </span>
                              {realityLoading && (
                                <span style={{ fontSize: "11px", color: "var(--dim)" }}>⚡ Recalculating...</span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                              Deterministic verification across time windows, activity buffers, budget allowance, and daily workload
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowRealityModal(true)}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "7px 16px",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          🔍 View Breakdown
                        </button>
                      </div>

                      {/* Sub-scores strip */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <div style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.03)", color: "var(--muted)", fontWeight: "500" }}>
                          ⏱️ Time Feasibility: <b style={{ color: "var(--text)" }}>{realityReport.subScores?.timeFeasibility ?? "—"}/100</b>
                        </div>
                        <div style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.03)", color: "var(--muted)", fontWeight: "500" }}>
                          💰 Budget Feasibility: <b style={{ color: "var(--text)" }}>{realityReport.subScores?.budgetFeasibility ?? "—"}/100</b>
                        </div>
                        <div style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.03)", color: "var(--muted)", fontWeight: "500" }}>
                          🏃 Pace: <b style={{ color: "var(--text)" }}>{realityReport.metrics?.paceCategory || "Balanced"}</b>
                        </div>
                        <div style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.03)", color: "var(--muted)", fontWeight: "500" }}>
                          🗺️ Route: <span style={{ color: "var(--dim)" }}>{realityReport.subScores?.routeEfficiency !== null ? `${realityReport.subScores?.routeEfficiency}/100` : "Stage A (Awaiting Coords)"}</span>
                        </div>

                        {realityReport.issues && realityReport.issues.length > 0 ? (
                          <div style={{ marginLeft: "auto", fontSize: "11px", color: "#b45309", fontWeight: "600" }}>
                            ⚠️ {realityReport.issues.length} {realityReport.issues.length === 1 ? "issue" : "issues"} detected
                          </div>
                        ) : (
                          <div style={{ marginLeft: "auto", fontSize: "11px", color: "var(--emerald-text)", fontWeight: "600" }}>
                            ✨ All constraints verified
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="tabs">
                    {["Itinerary","Map","Budget","Food & Stays","Tips"].map(tab => (
                      <div key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                        {tab}
                      </div>
                    ))}
                  </div>

                  <div className="content">

                    {/* ── MAP TAB USING CUSTOM MAPVIEW COMPONENT ── */}
                    {activeTab === "Map" && (
                      <div className="mt-4">
                        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>🗺️ Map View</h2>
                        <div className="mt-10">
                          <MapView destination={destination} />
                        </div>
                      </div>
                    )}

                    {activeTab === "Itinerary" && (
                      <>
                        <div className="stats-row">
                          <div className="stat-card"><div className="stat-label">Total Days</div><div className="stat-val" style={{color:"var(--amber-text)"}}>{dayCount}</div></div>
                          <div className="stat-card"><div className="stat-label">Total Budget</div><div className="stat-val" style={{color:"var(--emerald-text)"}}>₹{budget}</div></div>
                          <div className="stat-card"><div className="stat-label">Destination</div><div className="stat-val" style={{fontSize:"18px",textTransform:"capitalize",color:"var(--amber-text)"}}>{destination}</div></div>
                          <div className="stat-card"><div className="stat-label">Activities</div><div className="stat-val" style={{color:"var(--rose)"}}>{(tripData.days?.length||0)*3}+</div></div>
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
                                  <div className="day-title">{safeString(day.title) || `Exploring ${destination}`}</div>
                                )}
                              </div>
                              {!editMode && (() => {
                                const elig = getFixDayEligibility(day);
                                return (
                                  <button
                                    className="btn-fixday"
                                    disabled={!elig.eligible}
                                    title={elig.reason}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (elig.eligible) openFixDayModal(day);
                                    }}
                                  >
                                    🛠️ Fix My Day
                                  </button>
                                );
                              })()}
                              <div className={`day-chevron ${openDays[i] ? "open" : ""}`}>▾</div>
                            </div>

                            <div className={`day-body ${openDays[i] ? "open" : ""}`}>
                              {[
                                { key:"morning",   label:"Morning",   dot:"var(--amber)",  text:"var(--amber-text)" },
                                { key:"afternoon", label:"Afternoon", dot:"var(--emerald)",text:"var(--emerald-text)" },
                                { key:"evening",   label:"Evening",   dot:"var(--rose)",   text:"var(--rose)" },
                              ].map(({ key, label, dot, text }) => {
                                const slotKey = `d${day.day}-${key}`;
                                const isLoading = Boolean(pivotLoading[slotKey]);
                                const isMenuOpen = activePivotMenu === slotKey;
                                const activity = getActivityForSlot(day, key);
                                const isLocked = Boolean(activity?.locked);
                                const isLocking = Boolean(lockLoading[slotKey]);

                                return (
                                  <div key={key} className="day-slot">
                                    <div className="slot-header">
                                      <div className="slot-label" style={{ color: text }}>
                                        <div className="slot-dot" style={{ background: dot }} />
                                        {label}
                                      </div>
                                      {!editMode && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          <button
                                            className={`btn-lock ${isLocked ? "is-locked" : ""}`}
                                            disabled={isLocking}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleLock(day.day, key);
                                            }}
                                            title={isLocked ? "Activity is locked. Click to unlock." : "Lock activity to prevent modifications"}
                                          >
                                            {isLocking ? "⏳" : isLocked ? "🔒 Locked" : "🔓 Lock"}
                                          </button>

                                          <div style={{ position: "relative" }}>
                                            <button
                                              className="btn-pivot"
                                              disabled={isLoading || isLocked}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isLocked) {
                                                  setActivePivotMenu(isMenuOpen ? null : slotKey);
                                                }
                                              }}
                                              title={isLocked ? "Activity is locked. Unlock it to adapt or replace." : "Adapt this activity when reality changes"}
                                              style={isLocked ? { opacity: 0.5, cursor: "not-allowed", borderStyle: "dashed" } : {}}
                                            >
                                              {isLoading ? "⏳ Adapting..." : "⚡ Pivot"}
                                            </button>

                                            {isMenuOpen && !isLocked && (
                                              <div className="pivot-popover" onClick={(e) => e.stopPropagation()}>
                                                <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 8px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                                                  ⚡ What Changed?
                                                </div>
                                                {[
                                                  { id: "rain", label: "🌧️ Rain", desc: "Bad weather" },
                                                  { id: "low_energy", label: "🥱 Low energy", desc: "Need to relax" },
                                                  { id: "budget", label: "💰 Budget", desc: "Free / cheap" },
                                                  { id: "running_late", label: "⏰ Running late", desc: "Short on time" },
                                                  { id: "closed", label: "🚫 Closed", desc: "Venue shut" },
                                                ].map(opt => (
                                                  <div
                                                    key={opt.id}
                                                    className="pivot-option"
                                                    onClick={() => handleTriggerPivot(day.day, key, opt.id)}
                                                  >
                                                    <span>{opt.label}</span>
                                                    <span style={{ fontSize: "10px", color: "var(--dim)", marginLeft: "auto" }}>{opt.desc}</span>
                                                  </div>
                                                ))}
                                                <div
                                                  className="pivot-option"
                                                  style={{ borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: "4px" }}
                                                  onClick={() => {
                                                    setPivotTarget({ dayNumber: day.day, block: key });
                                                    setShowCustomModal(true);
                                                    setActivePivotMenu(null);
                                                  }}
                                                >
                                                  <span>✏️ Other...</span>
                                                  <span style={{ fontSize: "10px", color: "var(--dim)", marginLeft: "auto" }}>Custom</span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {editMode ? (
                                      <textarea
                                        value={editableTrip?.days[i]?.[key] || ""}
                                        onChange={(e) => {
                                          const updated = JSON.parse(JSON.stringify(editableTrip));
                                          updated.days[i][key] = e.target.value;
                                          setEditableTrip(updated);
                                        }}
                                        style={{ background:"rgba(255,255,255,0.9)", padding:"8px", borderRadius:"6px", width:"100%", border:"1px solid #d1d5db", fontSize:"13px", minHeight:"80px", outline:"none", resize:"vertical", fontFamily:"var(--font-ui)" }}
                                      />
                                    ) : isLoading ? (
                                      <div>
                                        <div className="pivot-skeleton" />
                                        <div style={{ fontSize:"11px", color:"var(--amber-text)", marginTop:"6px", fontWeight:"600" }}>
                                          ⚡ Adapting with AI...
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="slot-text">{safeString(day[key])}</div>
                                        {activity && (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                                            {activity.category && (
                                              <span className="activity-meta-pill" style={{ background: "rgba(217, 119, 6, 0.08)", color: "#b45309" }}>
                                                🏷️ {activity.category}
                                              </span>
                                            )}
                                            {activity.durationMinutes && (
                                              <span className="activity-meta-pill" style={{ background: "rgba(5, 150, 105, 0.08)", color: "#047857" }}>
                                                ⏱️ {activity.durationMinutes}m
                                              </span>
                                            )}
                                            {activity.indoorOutdoor && (
                                              <span className="activity-meta-pill" style={{ background: "rgba(79, 70, 229, 0.08)", color: "#4338ca" }}>
                                                {activity.indoorOutdoor === "Indoor" ? "🏠 Indoor" : activity.indoorOutdoor === "Outdoor" ? "☀️ Outdoor" : "⛅ Mixed"}
                                              </span>
                                            )}
                                            {activity.cost && (
                                              <span className="activity-meta-pill" style={{ background: "rgba(107, 114, 128, 0.08)", color: "#374151" }}>
                                                💰 {activity.cost}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {adaptedBadges[slotKey] && (
                                          <div className="adapted-badge">{adaptedBadges[slotKey]}</div>
                                        )}
                                      </>
                                    )}
                                    {!editMode && key === "evening" && day.food?.length > 0 && (
                                      <div style={{ marginTop:"12px", padding:"10px", background:"rgba(245,158,11,0.1)", borderRadius:"6px", border:"1px solid rgba(245,158,11,0.2)" }}>
                                        <b style={{ fontSize:"10px", color:"var(--amber-text)", textTransform:"uppercase", letterSpacing:"0.05em" }}>🍽️ Evening Eats:</b>
                                        {day.food.map((f, fi) => (
                                          <div key={fi} style={{ fontSize:"12px", color:"var(--text)", marginTop:"4px", fontWeight:"500" }}>• {safeString(f)}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {activeTab === "Budget" && tripData.budgetBreakdown && (
                      <>
                        <div className="section-head">Budget breakdown</div>
                        <div className="budget-grid">
                          {Object.entries(tripData.budgetBreakdown).map(([key, val]) => (
                            <div key={key} className={`budget-row ${key.toLowerCase().includes("total") ? "budget-total" : ""}`}>
                              <span style={{ textTransform:"capitalize", fontWeight:"600", color:"var(--muted)" }}>
                                {safeString(key).replace(/([A-Z])/g," $1").trim()}
                              </span>
                              <span style={{ fontWeight:"700", color:"var(--emerald-text)" }}>{safeString(val)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {activeTab === "Food & Stays" && (
                      <>
                        {tripData.whereToStay && (
                          <>
                            <div className="section-head">Where to Stay</div>
                            <div className="budget-grid" style={{ marginBottom:"24px" }}>
                              <div className="budget-row" style={{ flexDirection:"column", alignItems:"flex-start", background:"var(--amber-dim)", borderColor:"rgba(245,158,11,0.3)" }}>
                                <span style={{ color:"var(--amber-text)", marginBottom:"6px", fontWeight:"bold" }}>Budget Option</span>
                                <span style={{ color:"var(--text)" }}>{safeString(tripData.whereToStay.budget || tripData.whereToStay.budgetOption)}</span>
                              </div>
                              <div className="budget-row" style={{ flexDirection:"column", alignItems:"flex-start", background:"var(--emerald-dim)", borderColor:"rgba(16,185,129,0.3)" }}>
                                <span style={{ color:"var(--emerald-text)", marginBottom:"6px", fontWeight:"bold" }}>Mid-Range Option</span>
                                <span style={{ color:"var(--text)" }}>{safeString(tripData.whereToStay.midRange || tripData.whereToStay.midRangeOption)}</span>
                              </div>
                            </div>
                          </>
                        )}
                        {tripData.mustEat?.length > 0 && (
                          <>
                            <div className="section-head">Must-Try Local Foods</div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                              {Array.isArray(tripData.mustEat) ? tripData.mustEat.map((food, i) => (
                                <div key={i} style={{ background:"rgba(255,255,255,0.8)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:"8px", padding:"14px 16px", display:"flex", gap:"12px" }}>
                                  <span style={{ fontSize:"16px" }}>🍜</span>
                                  <span style={{ fontSize:"13px", fontWeight:"500", color:"var(--text)" }}>{safeString(food)}</span>
                                </div>
                              )) : null}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {activeTab === "Tips" && tripData.travelTips?.length > 0 && (
                      <>
                        <div className="section-head">Essential Travel Tips</div>
                        <div style={{ display:"grid", gap:"12px" }}>
                          {Array.isArray(tripData.travelTips) ? tripData.travelTips.map((tip, i) => (
                            <div key={i} style={{ background:"rgba(255,255,255,0.8)", border:"1px solid rgba(0,0,0,0.05)", borderRadius:"8px", padding:"14px 16px", display:"flex", gap:"12px" }}>
                              <div style={{ fontWeight:"800", color:"var(--muted)", flexShrink:0 }}>0{i+1}</div>
                              <div style={{ fontWeight:"500", color:"var(--text)", lineHeight:"1.6" }}>{safeString(tip)}</div>
                            </div>
                          )) : null}
                        </div>
                      </>
                    )}

                    <div style={{ textAlign:"center", padding:"24px 0", marginTop:"auto" }}>
                      <span style={{ fontSize:"10px", color:"var(--dim)", fontWeight:700, letterSpacing:".15em" }}>
                        GENERATED WITH AI BY TRIPNOW
                      </span>
                    </div>

                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── REALITY SCORE DETAILS MODAL (PHASE 3) ── */}
      {showRealityModal && realityReport && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowRealityModal(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--text)" }}>
                  ⭐ Reality Verification Breakdown
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Deterministic evaluation by TripNow Reality Engine
                </p>
              </div>
              <button
                onClick={() => setShowRealityModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Score Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: realityReport.color ? `${realityReport.color}10` : "rgba(16, 185, 129, 0.08)",
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${realityReport.color || "#059669"}30`,
              marginBottom: "20px",
            }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  Overall Reality Score
                </span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: realityReport.color || "var(--emerald-text)" }}>
                  {realityReport.score} <span style={{ fontSize: "18px", fontWeight: "600", color: "var(--muted)" }}>/ 100</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: realityReport.color || "#059669",
                  color: "#FFFFFF",
                }}>
                  {realityReport.status}
                </span>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                  {realityReport.metrics?.lockedActivityCount || 0} Locked {(realityReport.metrics?.lockedActivityCount === 1) ? "Anchor" : "Anchors"}
                </div>
              </div>
            </div>

            {/* Sub-scores Breakdown */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                Sub-Score Analysis
              </h4>
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ background: "rgba(0,0,0,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                    <span>⏱️ Time Feasibility</span>
                    <span style={{ color: "var(--text)" }}>{realityReport.subScores?.timeFeasibility ?? "—"}/100</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${realityReport.subScores?.timeFeasibility || 0}%`, height: "100%", background: "#059669", borderRadius: "3px" }} />
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                    <span>💰 Budget Feasibility</span>
                    <span style={{ color: "var(--text)" }}>{realityReport.subScores?.budgetFeasibility ?? "—"}/100</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${realityReport.subScores?.budgetFeasibility || 0}%`, height: "100%", background: "#10B981", borderRadius: "3px" }} />
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                    <span>🏃 Pacing & Daily Load ({realityReport.metrics?.paceCategory || "Balanced"})</span>
                    <span style={{ color: "var(--text)" }}>{realityReport.subScores?.activityLoad ?? "—"}/100</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${realityReport.subScores?.activityLoad || 0}%`, height: "100%", background: "#D97706", borderRadius: "3px" }} />
                  </div>
                </div>

                <div style={{ background: "rgba(0,0,0,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                    <span>🗺️ Route & Distance Efficiency</span>
                    <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                      {realityReport.subScores?.routeEfficiency !== null ? `${realityReport.subScores?.routeEfficiency}/100` : "Stage A (Awaiting Coords)"}
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: realityReport.subScores?.routeEfficiency ? `${realityReport.subScores.routeEfficiency}%` : "100%", height: "100%", background: "rgba(0,0,0,0.15)", borderRadius: "3px" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Issues */}
            <div>
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                Friction Warnings & Feasibility Issues ({realityReport.issues?.length || 0})
              </h4>
              {(!realityReport.issues || realityReport.issues.length === 0) ? (
                <div style={{ padding: "14px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "8px", color: "var(--emerald-text)", fontSize: "13px", fontWeight: "500" }}>
                  ✨ No feasibility issues detected. Your itinerary has comfortable buffers, balanced pacing, and realistic costs.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {realityReport.issues.map((iss, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: iss.severity === "high" ? "rgba(225, 29, 72, 0.06)" : "rgba(245, 158, 11, 0.08)",
                        border: `1px solid ${iss.severity === "high" ? "rgba(225, 29, 72, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: iss.severity === "high" ? "var(--rose)" : "var(--amber)",
                          color: "#FFFFFF",
                        }}>
                          {iss.severity}
                        </span>
                        {iss.day && (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)" }}>
                            Day {iss.day} {iss.period ? `· ${iss.period}` : ""}
                          </span>
                        )}
                        {iss.isLocked && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            background: "rgba(0,0,0,0.08)",
                            color: "var(--text)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            marginLeft: "auto",
                          }}>
                            🔒 Locked Anchor
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text)", lineHeight: "1.5" }}>
                        {iss.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                onClick={() => setShowRealityModal(false)}
                style={{
                  background: "var(--text)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIX MY DAY MODAL (PHASE 4) ── */}
      {showFixDayModal && (
        <div
          style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", background:"rgba(0,0,0,0.4)", backdropFilter:"blur(6px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
          onClick={() => { if (!fixDayLoading && !fixDayApplying) closeFixDayModal(); }}
        >
          <div
            style={{ background:"#FFFFFF", borderRadius:"16px", width:"100%", maxWidth:"600px", maxHeight:"85vh", overflowY:"auto", boxShadow:"0 25px 50px rgba(0,0,0,0.15)", border:"1px solid rgba(0,0,0,0.08)", padding:"24px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", borderBottom:"1px solid rgba(0,0,0,0.06)", paddingBottom:"12px" }}>
              <div>
                <h3 style={{ margin:0, fontSize:"18px", fontWeight:"800", color:"var(--text)" }}>
                  🛠️ Fix My Day{fixDayTarget ? ` · Day ${fixDayTarget.dayNumber}` : ""}
                </h3>
                <p style={{ margin:"4px 0 0", fontSize:"12px", color:"var(--muted)" }}>
                  {fixDayPreview ? "Review the proposed change before applying" : "Tell TripNow what changed — it will rebalance this day"}
                </p>
              </div>
              <button
                onClick={() => { if (!fixDayLoading && !fixDayApplying) closeFixDayModal(); }}
                style={{ background:"none", border:"none", fontSize:"18px", color:"var(--muted)", cursor:"pointer", padding:"4px 8px", borderRadius:"4px" }}
              >
                ✕
              </button>
            </div>

            {fixDayError && (
              <div style={{ marginBottom:"16px", padding:"10px 14px", borderRadius:"8px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#b91c1c", fontSize:"12px", fontWeight:"600" }}>
                ⚠️ {fixDayError}
              </div>
            )}

            {/* FIXDAY_STEP1 */}
            {!fixDayPreview && (
              <div>
                <div style={{ fontSize:"11px", fontWeight:"800", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" }}>
                  What changed?
                </div>
                <div style={{ display:"grid", gap:"8px", marginBottom:"16px" }}>
                  {[
                    { id:"schedule_overload", label:"📆 Schedule Overload", desc:"Too much packed into this day" },
                    { id:"running_late", label:"⏰ Running Late", desc:"Behind schedule right now" },
                    { id:"custom", label:"✏️ Custom", desc:"Describe your own situation" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`fixday-reason ${fixDayReason === opt.id ? "active" : ""}`}
                      onClick={() => { setFixDayReason(opt.id); setFixDayError(null); }}
                    >
                      <span style={{ fontSize:"13px", fontWeight:"700", color:"var(--text)" }}>{opt.label}</span>
                      <span style={{ fontSize:"11px", color:"var(--muted)" }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {fixDayReason === "running_late" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px" }}>
                    <div>
                      <label style={{ fontSize:"11px", fontWeight:"700", color:"var(--muted)", display:"block", marginBottom:"6px" }}>Current period</label>
                      <select
                        value={fixDayCurrentPeriod}
                        onChange={(e) => setFixDayCurrentPeriod(e.target.value)}
                        style={{ width:"100%", padding:"9px 10px", border:"1px solid var(--border)", borderRadius:"8px", fontSize:"13px", fontFamily:"var(--font-ui)", outline:"none", background:"#fff" }}
                      >
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:"11px", fontWeight:"700", color:"var(--muted)", display:"block", marginBottom:"6px" }}>Delay (minutes)</label>
                      <input
                        type="number" min={15} max={240} step={5}
                        value={fixDayDelay}
                        onChange={(e) => setFixDayDelay(e.target.value === "" ? "" : Number(e.target.value))}
                        style={{ width:"100%", padding:"9px 10px", border:"1px solid var(--border)", borderRadius:"8px", fontSize:"13px", fontFamily:"var(--font-ui)", outline:"none", boxSizing:"border-box" }}
                      />
                      <span style={{ fontSize:"10px", color:"var(--dim)" }}>Between 15 and 240</span>
                    </div>
                  </div>
                )}

                {fixDayReason === "custom" && (
                  <div style={{ marginBottom:"16px" }}>
                    <label style={{ fontSize:"11px", fontWeight:"700", color:"var(--muted)", display:"block", marginBottom:"6px" }}>What happened?</label>
                    <textarea
                      value={fixDayCustom}
                      maxLength={300}
                      onChange={(e) => setFixDayCustom(e.target.value)}
                      placeholder="e.g. Museum is closed today and it's raining"
                      style={{ width:"100%", minHeight:"70px", padding:"10px", border:"1px solid var(--border)", borderRadius:"8px", fontSize:"13px", fontFamily:"var(--font-ui)", resize:"vertical", outline:"none", boxSizing:"border-box" }}
                    />
                    <span style={{ fontSize:"10px", color:"var(--dim)" }}>{(fixDayCustom || "").trim().length}/300</span>
                  </div>
                )}

                <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px", marginTop:"4px" }}>
                  <button
                    onClick={closeFixDayModal}
                    disabled={fixDayLoading}
                    style={{ padding:"9px 16px", borderRadius:"8px", border:"1px solid var(--border)", background:"#fff", fontWeight:"600", fontSize:"13px", cursor:"pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFixDayPreview}
                    disabled={!isFixDayFormValid() || fixDayLoading}
                    style={{ padding:"9px 20px", borderRadius:"8px", border:"none", background:"var(--amber)", color:"#fff", fontWeight:"700", fontSize:"13px", cursor:(!isFixDayFormValid() || fixDayLoading) ? "not-allowed" : "pointer", opacity:(!isFixDayFormValid() || fixDayLoading) ? 0.6 : 1 }}
                  >
                    {fixDayLoading ? "⏳ Analyzing…" : "Preview Fix →"}
                  </button>
                </div>
              </div>
            )}
            {/* FIXDAY_STEP2 */}
            {fixDayPreview && (
              <div>
                {/* Score delta */}
                {fixDayPreview.scoreDelta && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:"12px", padding:"14px 16px", marginBottom:"16px", flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:"11px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--muted)" }}>Reality Score</div>
                      <div style={{ fontSize:"22px", fontWeight:"900", color:"var(--text)", display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ color:"var(--muted)" }}>{fixDayPreview.scoreDelta.scoreBefore}</span>
                        <span style={{ fontSize:"16px", color:"var(--dim)" }}>→</span>
                        <span style={{ color:"var(--emerald-text)" }}>{fixDayPreview.scoreDelta.scoreAfter}</span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", fontSize:"11px", fontWeight:"700" }}>
                      <div style={{ color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Status</div>
                      <div style={{ marginTop:"4px", color:"var(--text)" }}>
                        {fixDayPreview.scoreDelta.statusBefore} <span style={{ color:"var(--dim)" }}>→</span> {fixDayPreview.scoreDelta.statusAfter}
                      </div>
                    </div>
                  </div>
                )}

                {/* Diagnosis */}
                {fixDayPreview.diagnosis && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginBottom:"16px" }}>
                    <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"6px", background:"rgba(0,0,0,0.03)", color:"var(--muted)", fontWeight:"500" }}>
                      ⏱️ Active: <b style={{ color:"var(--text)" }}>{fixDayPreview.diagnosis.beforeActiveMinutes}m → {fixDayPreview.diagnosis.targetActiveMinutes}m</b>
                    </span>
                    <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"6px", background:"rgba(0,0,0,0.03)", color:"var(--muted)", fontWeight:"500" }}>
                      🔒 Locked anchors: <b style={{ color:"var(--text)" }}>{fixDayPreview.diagnosis.lockedAnchorsCount}</b>
                    </span>
                    {Array.isArray(fixDayPreview.diagnosis.issuesAddressed) && fixDayPreview.diagnosis.issuesAddressed.length > 0 && (
                      <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"6px", background:"rgba(245,158,11,0.12)", color:"#b45309", fontWeight:"600" }}>
                        ✓ Addresses {fixDayPreview.diagnosis.issuesAddressed.length} {fixDayPreview.diagnosis.issuesAddressed.length === 1 ? "issue" : "issues"}
                      </span>
                    )}
                  </div>
                )}

                {/* FIXDAY_SLOTS */}
                <div style={{ fontSize:"11px", fontWeight:"800", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" }}>
                  Proposed day
                </div>
                <div style={{ display:"grid", gap:"10px", marginBottom:"16px" }}>
                  {Array.isArray(fixDayPreview.slots) && fixDayPreview.slots.map((slot, idx) => {
                    const actionLabels = {
                      COMPLETED_PAST: { text:"✓ Completed", color:"var(--dim)" },
                      CURRENT_IN_PROGRESS: { text:"▶ In progress", color:"var(--amber-text)" },
                      UNCHANGED: { text:"= Unchanged", color:"var(--muted)" },
                      REPLACED: { text:"⇄ Replaced", color:"var(--emerald-text)" },
                    };
                    const meta = actionLabels[slot.action] || { text: slot.action, color:"var(--muted)" };
                    const isReplaced = slot.action === "REPLACED";
                    return (
                      <div key={idx} className={`fixday-slot ${isReplaced ? "replaced" : "readonly"}`}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px", gap:"8px" }}>
                          <span style={{ fontSize:"10px", fontWeight:"800", textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--muted)" }}>
                            {slot.period}
                          </span>
                          <span style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            {slot.isLocked && <span style={{ fontSize:"10px", fontWeight:"700", color:"var(--amber-text)" }}>🔒 Locked</span>}
                            <span style={{ fontSize:"10px", fontWeight:"800", color: meta.color }}>{meta.text}</span>
                          </span>
                        </div>
                        {isReplaced ? (
                          <div>
                            <div style={{ fontSize:"12px", color:"var(--muted)", textDecoration:"line-through", opacity:0.75 }}>
                              {slot.originalActivity?.title}
                              {slot.originalActivity?.durationMinutes ? ` · ${slot.originalActivity.durationMinutes}m` : ""}
                            </div>
                            <div style={{ fontSize:"14px", color:"var(--dim)", lineHeight:"1", margin:"2px 0" }}>↓</div>
                            <div style={{ fontSize:"13px", fontWeight:"700", color:"var(--text)" }}>
                              {slot.replacementActivity?.title}
                            </div>
                            {slot.replacementActivity?.description && (
                              <div style={{ fontSize:"12px", color:"var(--muted)", marginTop:"2px" }}>{slot.replacementActivity.description}</div>
                            )}
                            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"6px" }}>
                              {slot.replacementActivity?.category && (
                                <span className="activity-meta-pill" style={{ background:"rgba(217,119,6,0.08)", color:"#b45309" }}>🏷️ {slot.replacementActivity.category}</span>
                              )}
                              {slot.replacementActivity?.durationMinutes && (
                                <span className="activity-meta-pill" style={{ background:"rgba(5,150,105,0.08)", color:"#047857" }}>⏱️ {slot.replacementActivity.durationMinutes}m</span>
                              )}
                              {slot.replacementActivity?.indoorOutdoor && (
                                <span className="activity-meta-pill" style={{ background:"rgba(79,70,229,0.08)", color:"#4338ca" }}>{slot.replacementActivity.indoorOutdoor}</span>
                              )}
                              {slot.replacementActivity?.cost && (
                                <span className="activity-meta-pill" style={{ background:"rgba(107,114,128,0.08)", color:"#374151" }}>💰 {slot.replacementActivity.cost}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize:"13px", fontWeight:"500", color:"var(--text)" }}>
                            {slot.activity?.title}
                            {slot.activity?.durationMinutes ? <span style={{ color:"var(--muted)" }}> · {slot.activity.durationMinutes}m</span> : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* FIXDAY_STEP2_FOOTER */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", marginTop:"4px" }}>
                  <button
                    onClick={() => { setFixDayPreview(null); setFixDayError(null); }}
                    disabled={fixDayApplying}
                    style={{ padding:"9px 16px", borderRadius:"8px", border:"1px solid var(--border)", background:"#fff", fontWeight:"600", fontSize:"13px", cursor:fixDayApplying ? "not-allowed" : "pointer" }}
                  >
                    ← Back
                  </button>
                  <div style={{ display:"flex", gap:"10px" }}>
                    <button
                      onClick={closeFixDayModal}
                      disabled={fixDayApplying}
                      style={{ padding:"9px 16px", borderRadius:"8px", border:"1px solid var(--border)", background:"#fff", fontWeight:"600", fontSize:"13px", cursor:fixDayApplying ? "not-allowed" : "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFixDayApply}
                      disabled={fixDayApplying}
                      style={{ padding:"9px 20px", borderRadius:"8px", border:"none", background:"var(--emerald)", color:"#fff", fontWeight:"700", fontSize:"13px", cursor:fixDayApplying ? "not-allowed" : "pointer", opacity:fixDayApplying ? 0.6 : 1 }}
                    >
                      {fixDayApplying ? "⏳ Applying…" : "✓ Apply Change"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CUSTOM REASON MODAL ── */}
      {showCustomModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowCustomModal(false)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "var(--text)" }}>
              ✏️ Custom Pivot Reason
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--muted)" }}>
              Describe what changed (e.g., "Too hot outside", "Need kid-friendly place")
            </p>
            <textarea
              value={customReasonInput}
              onChange={(e) => setCustomReasonInput(e.target.value)}
              placeholder="Enter reason..."
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "13px",
                fontFamily: "var(--font-ui)",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
              <button
                onClick={() => setShowCustomModal(false)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "8px 14px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pivotTarget) {
                    handleTriggerPivot(pivotTarget.dayNumber, pivotTarget.block, "custom", customReasonInput);
                  }
                }}
                disabled={!customReasonInput.trim()}
                style={{
                  background: "var(--amber)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  cursor: customReasonInput.trim() ? "pointer" : "not-allowed",
                  fontWeight: "700",
                  opacity: customReasonInput.trim() ? 1 : 0.6,
                }}
              >
                Adapt Now →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}