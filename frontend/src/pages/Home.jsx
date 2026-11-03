import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import HeroPreview from "../components/HeroPreview";
import BudgetIntelligencePanel from "../components/budget/BudgetIntelligencePanel";
import { DestinationAutocomplete } from "../components/common";
import {
  DEFAULT_HERO_IMAGE,
  getDestinationImage,
} from "../utils/destinationImages";
import { IconRoute, IconWallet, IconBolt, IconBookmark } from "../components/icons";

const ICONS = { route: IconRoute, wallet: IconWallet, bolt: IconBolt, bookmark: IconBookmark };

const DESTINATIONS = [
  {
    name: "Manali",
    tag: "Adventure & Snow",
    desc: "Snowy peaks, river valleys & thrilling sports",
    emoji: "🏔️",
    price: "₹18,000",
    img: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23",
  },
  {
    name: "Goa",
    tag: "Beach & Chill",
    desc: "Sun-kissed beaches, nightlife & fresh seafood",
    emoji: "🏖️",
    price: "₹22,000",
    img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2",
  },
  {
    name: "Jaipur",
    tag: "Heritage & Culture",
    desc: "Royal palaces, forts & Rajasthani cuisine",
    emoji: "🏯",
    price: "₹15,000",
    img: "https://images.unsplash.com/photo-1599661046289-e31897846e41",
  },
  {
    name: "Kerala",
    tag: "Nature & Wellness",
    desc: "Backwaters, spice gardens & Ayurveda retreats",
    emoji: "🌴",
    price: "₹20,000",
    img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944",
  },
  {
    name: "Ladakh",
    tag: "Extreme & Remote",
    desc: "High-altitude lakes, monasteries & starry skies",
    emoji: "⛰️",
    price: "₹28,000",
    img: "https://images.unsplash.com/photo-1506038634487-60a69ae4b7b1",
  },
  {
    name: "Rishikesh",
    tag: "Spirit & Adventure",
    desc: "Yoga, white-water rafting & sacred ghats",
    emoji: "🕉️",
    price: "₹12,000",
    img: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2",
  },
];

const CARD_GRADIENTS = [
  "linear-gradient(to bottom, transparent 40%, rgba(30,58,138,0.85))",
  "linear-gradient(to bottom, transparent 40%, rgba(154,52,18,0.85))",
  "linear-gradient(to bottom, transparent 40%, rgba(120,53,15,0.85))",
  "linear-gradient(to bottom, transparent 40%, rgba(6,78,59,0.85))",
  "linear-gradient(to bottom, transparent 40%, rgba(12,74,110,0.85))",
  "linear-gradient(to bottom, transparent 40%, rgba(76,29,149,0.85))",
];

const WHY = [
  { icon: "route",    title: "AI Trip Planner",  desc: "Complete day-by-day itinerary crafted by AI in seconds — food, hotels, activities included." },
  { icon: "wallet",   title: "Budget Aware",      desc: "Set your budget and get plans that actually fit. No surprises, no overspending." },
  { icon: "bolt",     title: "Instant Results",   desc: "Type your destination, hit plan, and go. No long forms, no waiting." },
  { icon: "bookmark", title: "Save & Access",     desc: "All your trips saved in your dashboard, ready whenever you need them." },
];

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDayDateString(dateStr) {
  if (!dateStr) return getTodayDateString();
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().split("T")[0];
}

export default function Home() {
  const navigate = useNavigate();

  // Search form state
  const [form, setForm] = useState({
    destination: "",
    checkin: "",
    checkout: "",
    travelers: 1,
    budget: "",
  });
  const [err, setErr] = useState("");
  const [dateNotice, setDateNotice] = useState("");

  // Dynamic destination background state
  const [activeBg, setActiveBg] = useState(DEFAULT_HERO_IMAGE);
  const [nextBg, setNextBg] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const debounceTimerRef = useRef(null);
  const currentLoadIdRef = useRef(0);

  const todayStr = getTodayDateString();
  const minCheckout = form.checkin ? getNextDayDateString(form.checkin) : todayStr;

  /**
   * Resolves and updates background image based on destination.
   * Debounced for free-text typing; immediate for combobox selection or quick plan pills.
   */
  const triggerBackgroundUpdate = (destName, immediate = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const executeUpdate = () => {
      const { url } = getDestinationImage(destName);
      if (!url || url === activeBg) {
        return;
      }

      const loadId = ++currentLoadIdRef.current;
      const img = new Image();
      img.src = url;

      img.onload = () => {
        // Discard stale load if user typed another query in the meantime
        if (currentLoadIdRef.current !== loadId) return;

        const prefersReducedMotion =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (prefersReducedMotion) {
          setActiveBg(url);
          setNextBg(null);
          setIsTransitioning(false);
          return;
        }

        setNextBg(url);
        setIsTransitioning(true);

        const transitionTimer = setTimeout(() => {
          if (currentLoadIdRef.current === loadId) {
            setActiveBg(url);
            setNextBg(null);
            setIsTransitioning(false);
          }
        }, 500);

        return () => clearTimeout(transitionTimer);
      };

      img.onerror = () => {
        if (currentLoadIdRef.current === loadId) {
          setIsTransitioning(false);
          setNextBg(null);
        }
      };
    };

    if (immediate) {
      executeUpdate();
    } else {
      debounceTimerRef.current = setTimeout(executeUpdate, 350);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      currentLoadIdRef.current = 0;
    };
  }, []);

  const handleDestinationChange = (newVal, isSelection = false) => {
    setForm((prev) => ({ ...prev, destination: newVal }));
    setErr("");
    triggerBackgroundUpdate(newVal, isSelection);
  };

  const handleCheckinChange = (e) => {
    const newCheckin = e.target.value;
    setErr("");
    setForm((prev) => {
      let updatedCheckout = prev.checkout;
      // Auto-advance check-out if check-in moves past or equals checkout, with clear feedback
      if (updatedCheckout && newCheckin && updatedCheckout <= newCheckin) {
        updatedCheckout = getNextDayDateString(newCheckin);
        setDateNotice(`Check-out date was adjusted to ${updatedCheckout} to follow your new check-in date.`);
      } else {
        setDateNotice("");
      }
      return {
        ...prev,
        checkin: newCheckin,
        checkout: updatedCheckout,
      };
    });
  };

  const handleCheckoutChange = (e) => {
    const newCheckout = e.target.value;
    setErr("");
    setDateNotice("");
    setForm((prev) => ({
      ...prev,
      checkout: newCheckout,
    }));
  };

  const handleTravelerChange = (delta) => {
    setForm((prev) => {
      const current = Number(prev.travelers) || 1;
      const next = Math.max(1, Math.min(20, current + delta));
      return { ...prev, travelers: next };
    });
  };

  const handleBudgetChange = (e) => {
    const val = e.target.value;
    setErr("");
    setForm((prev) => ({ ...prev, budget: val }));
  };

  function handleSubmit(e) {
    e.preventDefault();

    const trimmedDest = form.destination.trim();
    if (!trimmedDest) {
      setErr("Please enter a destination to start planning.");
      return;
    }
    if (!form.checkin) {
      setErr("Please select a check-in date.");
      return;
    }
    if (form.checkin < todayStr) {
      setErr("Check-in date cannot be in the past.");
      return;
    }
    if (!form.checkout) {
      setErr("Please select a check-out date.");
      return;
    }
    if (form.checkout <= form.checkin) {
      setErr("Check-out date must be after check-in date.");
      return;
    }

    const budgetNum = Number(form.budget);
    if (!form.budget || isNaN(budgetNum) || budgetNum <= 0) {
      setErr("Please enter a valid travel budget (₹).");
      return;
    }

    setErr("");
    setDateNotice("");
    const guests = Math.max(1, Math.min(20, Number(form.travelers) || 1));

    // Strict navigation contract preservation for /plan-trip
    navigate("/plan-trip", {
      state: {
        destination: trimmedDest,
        checkin: form.checkin,
        checkout: form.checkout,
        budget: String(budgetNum),
        travelers: guests,
        guests: guests,
      },
    });
  }

  function quickPlan(dest) {
    triggerBackgroundUpdate(dest, true);
    navigate("/plan-trip", {
      state: {
        destination: dest,
        budget: "15000",
        checkin: "",
        checkout: "",
        travelers: 1,
        guests: 1,
      },
    });
  }

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background:
          "linear-gradient(160deg, #fff7ed 0%, #fef3c7 18%, #fde8d8 36%, #fce7f3 55%, #ede9fe 75%, #e0f2fe 100%)",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        .card-hover { transition: transform 0.28s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-6px) scale(1.015); box-shadow: 0 24px 60px rgba(0,0,0,0.18) !important; }
        .btn-glow { transition: transform 0.18s, box-shadow 0.18s; }
        .btn-glow:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,158,11,0.45) !important; }
        .inp-field:focus { outline:none; box-shadow: 0 0 0 3px rgba(245,158,11,0.22); border-color: rgba(245,158,11,0.6) !important; }
        .fade-in { animation: fadeUp 0.7s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
        .pill-btn:hover { background:rgba(245,158,11,0.15) !important; border-color:rgba(245,158,11,0.4) !important; color:#b45309 !important; }
        .dest-plan-btn { transition: opacity 0.2s, transform 0.2s; }
        .card-hover:hover .dest-plan-btn { opacity: 1 !important; transform: translateY(0) !important; }
        @media (prefers-reduced-motion: reduce) {
          .card-hover, .btn-glow, .fade-in, img {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      {/* ── HERO ── */}
      <div style={{ position: "relative", overflow: "hidden", minHeight: "92vh" }}>
        {/* Dynamic Destination Hero Background Layer Container */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {/* Active Background Image Layer */}
          <img
            src={activeBg}
            alt="Hero Destination Background"
            width={1600}
            height={900}
            className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.36,
              zIndex: 0,
            }}
          />

          {/* Incoming Cross-fade Background Image Layer */}
          {nextBg && (
            <img
              src={nextBg}
              alt="Incoming Hero Destination Background"
              width={1600}
              height={900}
              className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
              style={{
                position: "absolute",
                inset: 0,
                opacity: isTransitioning ? 0.36 : 0,
                zIndex: 1,
              }}
            />
          )}

          {/* Subtle dark gradient overlay for text legibility */}
          <div
            className="hero-dark-overlay"
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(15, 23, 42, 0.28) 0%, rgba(15, 23, 42, 0.48) 100%)",
              mixBlendMode: "multiply",
              zIndex: 2,
            }}
          />

          {/* Calibrated light scrim to guarantee high contrast for dark text and serif typography */}
          <div
            className="hero-light-scrim"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, rgba(255, 247, 237, 0.88) 0%, rgba(254, 243, 199, 0.80) 25%, rgba(253, 232, 216, 0.74) 50%, rgba(252, 231, 243, 0.70) 75%, rgba(237, 233, 254, 0.84) 100%)",
              zIndex: 3,
            }}
          />
        </div>

        {/* Decorative Blurred Gradient Blobs */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 4 }}>
          <div
            style={{
              position: "absolute",
              top: "-80px",
              right: "-60px",
              width: "380px",
              height: "380px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, transparent 70%)",
              filter: "blur(55px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "60px",
              left: "-80px",
              width: "340px",
              height: "340px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167, 139, 250, 0.28) 0%, transparent 70%)",
              filter: "blur(55px)",
            }}
          />
        </div>

        <div style={{ position: "relative", maxWidth: "1160px", margin: "0 auto", padding: "140px 24px 80px", zIndex: 5 }}>
          <div className="fade-in" style={{ display: "flex", justifyContent: "center", marginBottom: "22px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 18px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.85)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                fontSize: "12px",
                fontWeight: 700,
                color: "#b45309",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                backdropFilter: "blur(12px)",
              }}
            >
              ✦ AI-Powered Travel Planning
            </span>
          </div>

          <div className="fade-in" style={{ textAlign: "center", marginBottom: "12px", animationDelay: "0.1s" }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(44px, 7vw, 88px)",
                fontWeight: 900,
                lineHeight: 1.05,
                color: "#111827",
                letterSpacing: "-2px",
                margin: 0,
              }}
            >
              Plan Your
              <br />
              <span
                style={{
                  fontStyle: "italic",
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Dream Trip
              </span>
            </h1>
          </div>
          <p
            className="fade-in"
            style={{
              textAlign: "center",
              fontSize: "18px",
              color: "#4b5563",
              maxWidth: "500px",
              margin: "0 auto 44px",
              animationDelay: "0.2s",
              lineHeight: 1.5,
            }}
          >
            Your trip, planned in seconds. Tell us where — AI crafts your perfect itinerary with deterministic budget intelligence.
          </p>

          {/* ── COHESIVE RESPONSIVE SEARCH BAR ── */}
          <div className="fade-in" style={{ maxWidth: "980px", margin: "0 auto", animationDelay: "0.3s" }}>
            <form onSubmit={handleSubmit} noValidate>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.05fr_1.05fr_1.1fr_1.1fr_auto] gap-3 items-end"
                style={{
                  background: "rgba(255, 255, 255, 0.88)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  padding: "20px 22px",
                  borderRadius: "26px",
                  border: "1px solid rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 12px 50px -10px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* 1. Destination Field (Combobox Autocomplete) */}
                <div style={{ position: "relative" }}>
                  <label
                    htmlFor="destination-input"
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    Destination
                  </label>
                  <DestinationAutocomplete
                    id="destination-input"
                    value={form.destination}
                    onChange={handleDestinationChange}
                    onSelect={(selected) => {
                      triggerBackgroundUpdate(selected.name, true);
                    }}
                    placeholder="Where to? e.g. Goa, Paris, Bali"
                    className="w-full"
                    inputStyle={{
                      width: "100%",
                      background: "rgba(249, 250, 251, 0.92)",
                      border: "1.5px solid rgba(0, 0, 0, 0.09)",
                      borderRadius: "14px",
                      padding: "11px 14px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#111827",
                      fontFamily: "'DM Sans', sans-serif",
                      boxSizing: "border-box",
                      height: "44px",
                    }}
                  />
                </div>

                {/* 2. Check-in Field */}
                <div>
                  <label
                    htmlFor="checkin-date-input"
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    Check-in
                  </label>
                  <input
                    id="checkin-date-input"
                    className="inp-field"
                    type="date"
                    min={todayStr}
                    value={form.checkin}
                    onChange={handleCheckinChange}
                    style={{
                      width: "100%",
                      background: "rgba(249, 250, 251, 0.92)",
                      border: "1.5px solid rgba(0, 0, 0, 0.09)",
                      borderRadius: "14px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#111827",
                      fontFamily: "'DM Sans', sans-serif",
                      boxSizing: "border-box",
                      height: "44px",
                    }}
                  />
                </div>

                {/* 3. Check-out Field */}
                <div>
                  <label
                    htmlFor="checkout-date-input"
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    Check-out
                  </label>
                  <input
                    id="checkout-date-input"
                    className="inp-field"
                    type="date"
                    min={minCheckout}
                    value={form.checkout}
                    onChange={handleCheckoutChange}
                    style={{
                      width: "100%",
                      background: "rgba(249, 250, 251, 0.92)",
                      border: "1.5px solid rgba(0, 0, 0, 0.09)",
                      borderRadius: "14px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#111827",
                      fontFamily: "'DM Sans', sans-serif",
                      boxSizing: "border-box",
                      height: "44px",
                    }}
                  />
                </div>

                {/* 4. Travelers Field */}
                <div>
                  <label
                    htmlFor="travelers-counter"
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    Travelers
                  </label>
                  <div
                    id="travelers-counter"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: "44px",
                      background: "rgba(249, 250, 251, 0.92)",
                      border: "1.5px solid rgba(0, 0, 0, 0.09)",
                      borderRadius: "14px",
                      padding: "2px 6px",
                      boxSizing: "border-box",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Decrease travelers"
                      onClick={() => handleTravelerChange(-1)}
                      disabled={form.travelers <= 1}
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        border: "none",
                        background: form.travelers <= 1 ? "transparent" : "rgba(0, 0, 0, 0.06)",
                        color: form.travelers <= 1 ? "#cbd5e1" : "#374151",
                        cursor: form.travelers <= 1 ? "not-allowed" : "pointer",
                        fontWeight: 800,
                        fontSize: "15px",
                        transition: "background 0.15s ease",
                      }}
                    >
                      −
                    </button>
                    <div
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#111827",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {form.travelers} {form.travelers === 1 ? "Traveler" : "Travelers"}
                    </div>
                    <button
                      type="button"
                      aria-label="Increase travelers"
                      onClick={() => handleTravelerChange(1)}
                      disabled={form.travelers >= 20}
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        border: "none",
                        background: form.travelers >= 20 ? "transparent" : "rgba(0, 0, 0, 0.06)",
                        color: form.travelers >= 20 ? "#cbd5e1" : "#374151",
                        cursor: form.travelers >= 20 ? "not-allowed" : "pointer",
                        fontWeight: 800,
                        fontSize: "15px",
                        transition: "background 0.15s ease",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 5. Budget Field */}
                <div>
                  <label
                    htmlFor="budget-input"
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    Budget (₹)
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#9ca3af",
                        pointerEvents: "none",
                      }}
                    >
                      ₹
                    </span>
                    <input
                      id="budget-input"
                      className="inp-field"
                      type="number"
                      min="0"
                      placeholder="e.g. 25000"
                      value={form.budget}
                      onChange={handleBudgetChange}
                      style={{
                        width: "100%",
                        background: "rgba(249, 250, 251, 0.92)",
                        border: "1.5px solid rgba(0, 0, 0, 0.09)",
                        borderRadius: "14px",
                        padding: "10px 12px 10px 28px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#111827",
                        fontFamily: "'DM Sans', sans-serif",
                        boxSizing: "border-box",
                        height: "44px",
                      }}
                    />
                  </div>
                </div>

                {/* 6. Primary CTA Button (Exact Text: ✨ Plan with TripNow) */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <button
                    type="submit"
                    className="btn-glow w-full"
                    style={{
                      height: "44px",
                      background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "14px",
                      padding: "0 22px",
                      fontWeight: 800,
                      fontSize: "14px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 18px rgba(239, 68, 68, 0.35)",
                      fontFamily: "'DM Sans', sans-serif",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    ✨ Plan with TripNow
                  </button>
                </div>
              </div>

              {/* Informative Auto-Advance Feedback Notice */}
              {dateNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "#0369a1",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginTop: "10px",
                    background: "rgba(240, 249, 255, 0.95)",
                    padding: "6px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(186, 230, 253, 0.8)",
                  }}
                >
                  <span>ℹ️</span> {dateNotice}
                </div>
              )}

              {/* Inline Validation Error Message */}
              {err && (
                <div
                  role="alert"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginTop: "12px",
                    background: "rgba(254, 242, 242, 0.9)",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid rgba(252, 165, 165, 0.5)",
                  }}
                >
                  <span>⚠️</span> {err}
                </div>
              )}

              {/* Live Budget Intelligence Preview when budget & destination are provided */}
              {form.destination && Number(form.budget) > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <BudgetIntelligencePanel
                    compact={true}
                    destination={form.destination}
                    totalBudget={form.budget}
                    days={
                      form.checkin && form.checkout
                        ? Math.max(1, Math.round((new Date(form.checkout) - new Date(form.checkin)) / 86400000))
                        : 3
                    }
                    guests={form.travelers}
                    currency="INR"
                  />
                </div>
              )}
            </form>
          </div>

          {/* Quick Plan Pills with Domestic and Global Highlights */}
          <div
            className="fade-in"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px",
              marginTop: "22px",
              animationDelay: "0.4s",
            }}
          >
            <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, display: "flex", alignItems: "center" }}>
              Quick plan:
            </span>
            {["Goa", "Manali", "Jaipur", "Bali", "Dubai", "Paris", "Kerala", "Ladakh"].map((d) => (
              <button
                key={d}
                type="button"
                className="pill-btn"
                onClick={() => quickPlan(d)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.95)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                  backdropFilter: "blur(8px)",
                  transition: "all 0.2s",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* ── LIVE ITINERARY PREVIEW ── */}
          <HeroPreview />
        </div>
      </div>

      {/* ── WHY TRIPNOW ── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#f59e0b",
              marginBottom: "10px",
            }}
          >
            Why TripNow?
          </p>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 900,
              color: "#111827",
              letterSpacing: "-1px",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Travel smarter,
            <br />
            <em>not harder</em>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          {WHY.map((w, i) => {
            const IconComp = ICONS[w.icon];
            return (
              <div
                key={i}
                className="card-hover"
                style={{
                  background: "rgba(255, 255, 255, 0.76)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255, 255, 255, 0.95)",
                  borderRadius: "24px",
                  padding: "28px",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.06)",
                }}
              >
                {IconComp ? (
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "11px",
                      background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "14px",
                      color: "#fff",
                    }}
                  >
                    <IconComp size={20} />
                  </div>
                ) : (
                  <div style={{ fontSize: "32px", marginBottom: "14px" }}>{w.icon}</div>
                )}
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#111827",
                    marginBottom: "8px",
                  }}
                >
                  {w.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{w.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FEATURED DESTINATIONS ── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "44px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#f59e0b",
              marginBottom: "10px",
            }}
          >
            Explore India & Beyond
          </p>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 900,
              color: "#111827",
              letterSpacing: "-1px",
              margin: 0,
            }}
          >
            Featured Destinations
          </h2>
          <p style={{ color: "#6b7280", marginTop: "10px", fontSize: "15px", marginBottom: 0 }}>
            Click any card — AI plans that trip for you instantly
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {DESTINATIONS.map((d, i) => (
            <div
              key={i}
              className="card-hover"
              onClick={() => quickPlan(d.name)}
              style={{
                borderRadius: "24px",
                overflow: "hidden",
                cursor: "pointer",
                position: "relative",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.10)",
              }}
            >
              <div style={{ position: "relative", height: "220px", overflow: "hidden" }}>
                <img
                  src={d.img}
                  alt={d.name}
                  width={600}
                  height={400}
                  className="w-full h-full object-cover block transition-transform duration-500 ease-in-out"
                />
                <div style={{ position: "absolute", inset: 0, background: CARD_GRADIENTS[i] }} />
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "14px",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {d.tag}
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    background: "rgba(0, 0, 0, 0.35)",
                    backdropFilter: "blur(10px)",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {d.price}
                </div>
                <div style={{ position: "absolute", bottom: "14px", left: "18px" }}>
                  <p
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "24px",
                      fontWeight: 900,
                      color: "#fff",
                      margin: 0,
                      lineHeight: 1.1,
                      textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    {d.emoji} {d.name}
                  </p>
                  <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.85)", margin: "4px 0 0", fontWeight: 500 }}>
                    {d.desc}
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.92)",
                  backdropFilter: "blur(12px)",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Starting from {d.price}</span>
                <button
                  type="button"
                  className="dest-plan-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    quickPlan(d.name);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 800,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 3px 12px rgba(239, 68, 68, 0.3)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ✦ Plan with AI →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA BANNER ── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto 80px", padding: "0 24px" }}>
        <div
          style={{
            borderRadius: "32px",
            padding: "60px 48px",
            textAlign: "center",
            background: "linear-gradient(135deg, #f59e0b, #ef4444, #a78bfa)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
            }}
          />
          <div style={{ position: "relative" }}>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 900,
                color: "#fff",
                marginBottom: "14px",
                letterSpacing: "-1px",
              }}
            >
              Ready for your next adventure?
            </h2>
            <p style={{ color: "rgba(255, 255, 255, 0.88)", fontSize: "16px", marginBottom: "28px" }}>
              Free to try — no card, no sign-up needed to see your first plan.
            </p>
            <Link
              to="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 36px",
                borderRadius: "16px",
                background: "#fff",
                color: "#111827",
                fontWeight: 800,
                fontSize: "15px",
                textDecoration: "none",
                boxShadow: "0 6px 24px rgba(0, 0, 0, 0.15)",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
            >
              Get Started Free →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
