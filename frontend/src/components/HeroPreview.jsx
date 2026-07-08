import { useState, useEffect } from "react";

// A self-contained marketing animation: it "types out" a sample AI itinerary in
// a loop, cycling through a few destinations. No backend call — it just gives a
// first-time visitor an instant, tangible sense of what TripNow produces.
const TRIPS = [
  {
    place: "Goa",
    days: "3 days",
    lines: [
      { d: "Day 1", t: "Sunset & seafood shacks at Baga Beach" },
      { d: "Day 2", t: "Old Goa heritage walk · Basilica of Bom Jesus" },
      { d: "Day 3", t: "Dudhsagar Falls trek & spice plantation" },
    ],
  },
  {
    place: "Manali",
    days: "4 days",
    lines: [
      { d: "Day 1", t: "Hadimba Temple & old Manali cafés" },
      { d: "Day 2", t: "Solang Valley paragliding & snow point" },
      { d: "Day 3", t: "Atal Tunnel drive to Sissu" },
    ],
  },
  {
    place: "Jaipur",
    days: "3 days",
    lines: [
      { d: "Day 1", t: "Amber Fort & Panna Meena stepwell" },
      { d: "Day 2", t: "City Palace, Hawa Mahal & bazaars" },
      { d: "Day 3", t: "Nahargarh sunset & Rajasthani thali" },
    ],
  },
];

const TYPE_MS = 26;   // per-character speed
const LINE_PAUSE = 420;
const TRIP_PAUSE = 2400;

export default function HeroPreview() {
  const [ti, setTi] = useState(0);           // trip index
  const [li, setLi] = useState(0);           // line index within the trip
  const [typing, setTyping] = useState("");  // partial text of the current line
  const [revealed, setRevealed] = useState([]); // completed lines

  const trip = TRIPS[ti];

  useEffect(() => {
    // Finished all lines for this trip → pause, then advance to the next trip.
    if (li >= trip.lines.length) {
      const t = setTimeout(() => {
        setTi((prev) => (prev + 1) % TRIPS.length);
        setLi(0);
        setTyping("");
        setRevealed([]);
      }, TRIP_PAUSE);
      return () => clearTimeout(t);
    }

    const full = `${trip.lines[li].d} — ${trip.lines[li].t}`;

    if (typing.length < full.length) {
      const t = setTimeout(() => setTyping(full.slice(0, typing.length + 1)), TYPE_MS);
      return () => clearTimeout(t);
    }

    // Current line fully typed → commit it and move on.
    const t = setTimeout(() => {
      setRevealed((r) => [...r, full]);
      setTyping("");
      setLi((l) => l + 1);
    }, LINE_PAUSE);
    return () => clearTimeout(t);
  }, [ti, li, typing, trip.lines]);

  return (
    <div
      aria-hidden="true"
      style={{
        maxWidth: "440px", margin: "28px auto 0", textAlign: "left",
        background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.95)", borderRadius: "20px",
        padding: "18px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <style>{`
        @keyframes tn-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes tn-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.35);opacity:0.55} }
        @keyframes tn-line-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        .tn-cursor { display:inline-block; width:2px; height:14px; margin-left:2px; background:#ef4444; vertical-align:middle; animation:tn-blink 1s step-end infinite; }
        .tn-line { animation:tn-line-in 0.35s ease both; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", animation: "tn-pulse 1.4s ease-in-out infinite" }} />
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>
          AI is building your itinerary
        </span>
        <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: "#b45309", background: "rgba(245,158,11,0.12)", padding: "3px 10px", borderRadius: "999px" }}>
          📍 {trip.place} · {trip.days}
        </span>
      </div>

      {/* Itinerary lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: "9px", minHeight: "96px" }}>
        {revealed.map((line, i) => (
          <div key={i} className="tn-line" style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13.5px", color: "#374151", lineHeight: 1.4 }}>
            <span style={{ color: "#22c55e", fontWeight: 800, flexShrink: 0 }}>✓</span>
            <span>{line}</span>
          </div>
        ))}
        {li < trip.lines.length && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13.5px", color: "#111827", lineHeight: 1.4 }}>
            <span style={{ color: "#f59e0b", fontWeight: 800, flexShrink: 0 }}>✦</span>
            <span>{typing}<span className="tn-cursor" /></span>
          </div>
        )}
      </div>
    </div>
  );
}
