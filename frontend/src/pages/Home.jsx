import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const DESTINATIONS = [
  {
    name: "Manali",
    tag: "Adventure & Snow",
    desc: "Snowy peaks, river valleys & thrilling sports",
    emoji: "🏔️",
    price: "₹18,000",
    img: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&q=80",
    color: "from-blue-600/80 to-indigo-900/60",
  },
  {
    name: "Goa",
    tag: "Beach & Chill",
    desc: "Sun-kissed beaches, nightlife & fresh seafood",
    emoji: "🏖️",
    price: "₹22,000",
    img: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80",
    color: "from-orange-500/80 to-pink-900/60",
  },
  {
    name: "Jaipur",
    tag: "Heritage & Culture",
    desc: "Royal palaces, forts & Rajasthani cuisine",
    emoji: "🏯",
    price: "₹15,000",
    img: "https://images.unsplash.com/photo-1477587458883-47145ed31769?w=600&q=80",
    color: "from-amber-500/80 to-red-900/60",
  },
  {
    name: "Kerala",
    tag: "Nature & Wellness",
    desc: "Backwaters, spice gardens & Ayurveda retreats",
    emoji: "🌴",
    price: "₹20,000",
    img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=80",
    color: "from-emerald-500/80 to-teal-900/60",
  },
  {
    name: "Ladakh",
    tag: "Extreme & Remote",
    desc: "High-altitude lakes, monasteries & starry skies",
    emoji: "⛰️",
    price: "₹28,000",
    img: "https://images.unsplash.com/photo-1506038634487-60a69ae4b7b1?w=600&q=80",
    color: "from-sky-500/80 to-slate-900/60",
  },
  {
    name: "Rishikesh",
    tag: "Spirit & Adventure",
    desc: "Yoga, white-water rafting & sacred ghats",
    emoji: "🕉️",
    price: "₹12,000",
    img: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=600&q=80",
    color: "from-violet-500/80 to-purple-900/60",
  },
];

const WHY = [
  { icon: "🤖", title: "AI Trip Planner", desc: "Get a complete day-by-day itinerary crafted by AI in seconds — food, hotels, activities included." },
  { icon: "💸", title: "Budget Aware", desc: "Set your budget and get plans that actually fit. No surprises, no overspending." },
  { icon: "⚡", title: "Instant Results", desc: "No waiting, no forms. Type your destination, hit plan, and go." },
  { icon: "📱", title: "Save & Access", desc: "All your trips saved in your dashboard, ready whenever you need them." },
];

export default function Home() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ destination: "", checkin: "", checkout: "", budget: "" });
  const [err, setErr] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.destination || !form.checkin || !form.checkout || !form.budget) {
      setErr("Please fill in all fields."); return;
    }
    setErr("");
    navigate("/plan-trip", { state: form });
  }

  function quickPlan(dest) {
    navigate("/plan-trip", {
  state: {
    destination,
    budget,
    checkin,
    checkout
  }
});
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "linear-gradient(160deg,#fff7ed 0%,#fef3c7 18%,#fde8d8 36%,#fce7f3 55%,#ede9fe 75%,#e0f2fe 100%)", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        .card-hover { transition: transform 0.28s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-6px) scale(1.015); box-shadow: 0 24px 60px rgba(0,0,0,0.14)!important; }
        .btn-glow { transition: transform 0.18s, box-shadow 0.18s; }
        .btn-glow:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(245,158,11,0.45)!important; }
        input:focus { outline: none; box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }
        .fade-in { animation: fadeUp 0.7s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "92vh" }}>
        {/* Background image with gradient overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&q=85"
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.28 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg,rgba(255,247,237,0.92) 0%,rgba(254,243,199,0.85) 25%,rgba(253,232,216,0.80) 50%,rgba(252,231,243,0.75) 75%,rgba(237,233,254,0.85) 100%)" }} />
        </div>

        {/* Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div style={{ position:"absolute", top:"-80px", right:"-60px", width:"380px", height:"380px", borderRadius:"50%", background:"radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)", filter:"blur(55px)" }} />
          <div style={{ position:"absolute", bottom:"60px", left:"-80px", width:"340px", height:"340px", borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.3) 0%, transparent 70%)", filter:"blur(55px)" }} />
          <div style={{ position:"absolute", top:"40%", left:"45%", width:"260px", height:"260px", borderRadius:"50%", background:"radial-gradient(circle, rgba(251,113,133,0.2) 0%, transparent 70%)", filter:"blur(45px)" }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-36 pb-20">
          {/* Badge */}
          <div className="fade-in flex justify-center mb-6">
            <span style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"6px 18px", borderRadius:"999px", background:"rgba(255,255,255,0.75)", border:"1px solid rgba(245,158,11,0.35)", fontSize:"12px", fontWeight:700, color:"#b45309", letterSpacing:"0.1em", textTransform:"uppercase", backdropFilter:"blur(12px)" }}>
              ✦ AI-Powered Travel Planning
            </span>
          </div>

          {/* Headline */}
          <div className="fade-in text-center mb-4" style={{ animationDelay:"0.1s" }}>
            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(44px,7vw,88px)", fontWeight:900, lineHeight:1.05, color:"#111827", letterSpacing:"-2px" }}>
              Plan Your<br />
              <span style={{ fontStyle:"italic", background:"linear-gradient(135deg,#f59e0b,#ef4444)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                Dream Trip
              </span>
            </h1>
          </div>
          <p className="fade-in text-center mb-12" style={{ animationDelay:"0.2s", fontSize:"18px", color:"#6b7280", maxWidth:"480px", margin:"0 auto 48px" }}>
            Describe where you want to go — AI builds your perfect itinerary instantly.
          </p>

          {/* Search form */}
          <div className="fade-in" style={{ animationDelay:"0.3s", maxWidth:"860px", margin:"0 auto" }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr 1fr 1fr auto", gap:"12px", background:"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)", padding:"20px", borderRadius:"24px", border:"1px solid rgba(255,255,255,0.95)", boxShadow:"0 8px 48px rgba(0,0,0,0.10)" }}>
                {[
                  { label:"Destination", key:"destination", type:"text", placeholder:"Where to? e.g. Goa" },
                  { label:"Check-in",    key:"checkin",     type:"date", placeholder:"" },
                  { label:"Check-out",   key:"checkout",    type:"date", placeholder:"" },
                  { label:"Budget (₹)", key:"budget",      type:"number", placeholder:"e.g. 15000" },
                ].map(f => (
                  <div key={f.key}>
                    <p style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", color:"#9ca3af", marginBottom:"6px" }}>{f.label}</p>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width:"100%", background:"rgba(249,250,251,0.8)", border:"1.5px solid rgba(0,0,0,0.08)", borderRadius:"12px", padding:"10px 14px", fontSize:"14px", fontWeight:500, color:"#111827", fontFamily:"'DM Sans',sans-serif" }}
                    />
                  </div>
                ))}
                <div style={{ display:"flex", alignItems:"flex-end" }}>
                  <button type="submit" className="btn-glow" style={{ background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", border:"none", borderRadius:"14px", padding:"12px 20px", fontWeight:800, fontSize:"14px", cursor:"pointer", whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(239,68,68,0.3)", fontFamily:"'DM Sans',sans-serif" }}>
                    ✦ AI Planner
                  </button>
                </div>
              </div>
              {err && <p style={{ textAlign:"center", color:"#ef4444", fontSize:"13px", marginTop:"10px" }}>{err}</p>}
            </form>
          </div>

          {/* Quick pills */}
          <div className="fade-in flex flex-wrap justify-center gap-2 mt-6" style={{ animationDelay:"0.4s" }}>
            {["Goa","Manali","Jaipur","Ladakh","Kerala"].map(d => (
              <button key={d} onClick={() => quickPlan(d)} style={{ padding:"7px 18px", borderRadius:"999px", background:"rgba(255,255,255,0.72)", border:"1px solid rgba(255,255,255,0.9)", fontSize:"13px", fontWeight:600, color:"#374151", cursor:"pointer", backdropFilter:"blur(8px)", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(245,158,11,0.15)"; e.currentTarget.style.borderColor="rgba(245,158,11,0.4)"; e.currentTarget.style.color="#b45309"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.72)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.9)"; e.currentTarget.style.color="#374151"; }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHY TRIPNOW ── */}
      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"80px 24px 60px" }}>
        <div className="text-center mb-14">
          <p style={{ fontSize:"11px", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.2em", color:"#f59e0b", marginBottom:"10px" }}>Why TripNow?</p>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(32px,4vw,52px)", fontWeight:900, color:"#111827", letterSpacing:"-1px", lineHeight:1.1 }}>
            Travel smarter,<br /><em>not harder</em>
          </h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"20px" }}>
          {WHY.map((w, i) => (
            <div key={i} className="card-hover" style={{ background:"rgba(255,255,255,0.72)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.95)", borderRadius:"24px", padding:"28px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize:"32px", marginBottom:"14px" }}>{w.icon}</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"18px", fontWeight:700, color:"#111827", marginBottom:"8px" }}>{w.title}</h3>
              <p style={{ fontSize:"14px", color:"#6b7280", lineHeight:1.6 }}>{w.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURED DESTINATIONS ── */}
      <div style={{ maxWidth:"1100px", margin:"0 auto", padding:"20px 24px 80px" }}>
        <div className="text-center mb-12">
          <p style={{ fontSize:"11px", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.2em", color:"#f59e0b", marginBottom:"10px" }}>Explore India</p>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(32px,4vw,52px)", fontWeight:900, color:"#111827", letterSpacing:"-1px" }}>
            Featured Destinations
          </h2>
          <p style={{ color:"#9ca3af", marginTop:"10px", fontSize:"15px" }}>Tap any card to let AI plan that trip for you instantly</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:"20px" }}>
          {DESTINATIONS.map((d, i) => (
            <div
              key={i}
              className="card-hover"
              onClick={() => quickPlan(d.name)}
              style={{ borderRadius:"24px", overflow:"hidden", cursor:"pointer", position:"relative", boxShadow:"0 4px 24px rgba(0,0,0,0.10)" }}
            >
              <img src={d.img} alt={d.name} style={{ width:"100%", height:"210px", objectFit:"cover", display:"block" }} />
              <div className={`absolute inset-0 bg-gradient-to-t ${d.color}`} style={{ top:"40%" }} />
              {/* Tag bubble */}
              <div style={{ position:"absolute", top:"14px", left:"14px", padding:"4px 12px", borderRadius:"999px", background:"rgba(255,255,255,0.2)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.35)", fontSize:"11px", fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                {d.tag}
              </div>
              {/* Content */}
              <div style={{ background:"rgba(255,255,255,0.88)", backdropFilter:"blur(12px)", padding:"18px 20px" }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"20px", fontWeight:800, color:"#111827" }}>
                    {d.emoji} {d.name}
                  </h3>
                  <span style={{ fontSize:"15px", fontWeight:800, color:"#f59e0b" }}>{d.price}</span>
                </div>
                <p style={{ fontSize:"13px", color:"#6b7280", marginBottom:"14px" }}>{d.desc}</p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"12px", color:"#9ca3af", fontWeight:600 }}>Starting from</span>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:"6px", padding:"7px 16px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", fontSize:"12px", fontWeight:800 }}>
                    ✦ Plan with AI →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA BANNER ── */}
      <div style={{ maxWidth:"1100px", margin:"0 auto 80px", padding:"0 24px" }}>
        <div style={{ borderRadius:"32px", padding:"60px 48px", textAlign:"center", background:"linear-gradient(135deg,#f59e0b,#ef4444,#a78bfa)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`, opacity:0.5 }} />
          <div style={{ position:"relative" }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(28px,4vw,48px)", fontWeight:900, color:"#fff", marginBottom:"14px", letterSpacing:"-1px" }}>
              Ready for your next adventure?
            </h2>
            <p style={{ color:"rgba(255,255,255,0.85)", fontSize:"16px", marginBottom:"28px" }}>
              Join thousands of travellers planning smarter with AI.
            </p>
            <Link to="/signup" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"14px 36px", borderRadius:"16px", background:"#fff", color:"#111827", fontWeight:800, fontSize:"15px", textDecoration:"none", boxShadow:"0 6px 24px rgba(0,0,0,0.15)", transition:"transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform=""}>
              Get Started Free →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}