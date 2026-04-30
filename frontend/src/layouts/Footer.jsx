import { useState } from "react";

const EMAILJS_SERVICE_ID  = "service_b6ilf8d";
const EMAILJS_TEMPLATE_ID = "template_x1hv26r";
const EMAILJS_PUBLIC_KEY  = "wAUCRH4xeOZm30Je2";

const SOCIALS = [
  {
    name: "Instagram", label: "@_abhikasaudhan",
    url: "https://www.instagram.com/_abhikasaudhan?igsh=Z2J5MnhoZm1rOGFt",
    bg: "linear-gradient(135deg,#f59e0b,#ef4444,#a855f7)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
  },
  {
    name: "LinkedIn", label: "Abhishek Kasaudhan",
    url: "https://www.linkedin.com/in/abhishek-kasaudhan-04a27b2a3/",
    bg: "linear-gradient(135deg,#0077b5,#0ea5e9)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>,
  },
  {
    name: "Email", label: "kasaudhan622@gmail.com",
    url: "mailto:kasaudhan622@gmail.com",
    bg: "linear-gradient(135deg,#f59e0b,#ef4444)",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
];

const MOODS = ["😞","😕","😐","😊","🤩"];

/* ── Load EmailJS SDK once ── */
let ejsLoaded = false;
async function loadEJS() {
  if (ejsLoaded || window.emailjs) { ejsLoaded = true; return; }
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { window.emailjs.init(EMAILJS_PUBLIC_KEY); ejsLoaded = true; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function FeedbackForm() {
  const [form, setForm]     = useState({ name:"", email:"", rating:0, message:"" });
  const [hover, setHover]   = useState(0);
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  async function send(e) {
    e.preventDefault();
    if (!form.rating)         { setErrMsg("Please pick a star rating!"); return; }
    if (!form.message.trim()) { setErrMsg("Please write a message!"); return; }
    setErrMsg(""); setStatus("sending");

    try {
      await loadEJS();

      /*
        ⚠️  YOUR EMAILJS TEMPLATE must use these EXACT variable names:
        {{from_name}}  {{from_email}}  {{rating_text}}  {{user_message}}
        
        In EmailJS dashboard → Email Templates → edit template_x1hv26r:
        Subject: New TripNow Feedback from {{from_name}}
        Body:
          Name:    {{from_name}}
          Email:   {{from_email}}
          Rating:  {{rating_text}}
          Message: {{user_message}}
      */
      const templateParams = {
        from_name:    form.name.trim()  || "Anonymous Traveller",
        from_email:   form.email.trim() || "Not provided",
        rating_text:  `${MOODS[form.rating - 1]} ${form.rating}/5`,
        user_message: form.message.trim(),
      };

      const result = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      if (result.status === 200) {
        setStatus("sent");
      } else {
        throw new Error(`EmailJS status: ${result.status}`);
      }
    } catch (err) {
      console.error("EmailJS error:", err);
      setErrMsg(`Send failed: ${err?.text || err?.message || "Unknown error"}`);
      setStatus("idle");
    }
  }

  const inputSt = {
    width:"100%", padding:"10px 13px", borderRadius:"12px",
    border:"1px solid rgba(255,255,255,0.18)",
    background:"rgba(255,255,255,0.09)", color:"#fff",
    fontSize:"13px", fontFamily:"'DM Sans',sans-serif",
    boxSizing:"border-box", outline:"none",
    transition:"border-color 0.2s, box-shadow 0.2s",
  };

  if (status === "sent") return (
    <div style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:"24px", padding:"44px 32px", textAlign:"center" }}>
      <div style={{ fontSize:"52px", marginBottom:"14px" }}>🎉</div>
      <h4 style={{ fontFamily:"'Playfair Display',serif", color:"#fff", fontSize:"20px", fontWeight:800, marginBottom:"8px" }}>
        Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""}!
      </h4>
      <p style={{ color:"rgba(255,255,255,0.55)", fontSize:"14px", lineHeight:1.65 }}>
        Feedback sent to Abhishek. Much appreciated!
      </p>
      <button onClick={() => { setStatus("idle"); setForm({ name:"", email:"", rating:0, message:"" }); }}
        style={{ marginTop:"20px", padding:"9px 22px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.22)", color:"#fff", fontSize:"13px", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
        Send another →
      </button>
    </div>
  );

  return (
    <div style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:"24px", padding:"30px" }}>
      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", fontWeight:800, color:"#fff", marginBottom:"5px" }}>
        Share Your Feedback ✦
      </h3>
      <p style={{ color:"rgba(255,255,255,0.42)", fontSize:"13px", marginBottom:"22px" }}>
        Help make TripNow better — 30 seconds!
      </p>

      <form onSubmit={send} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {/* Stars */}
        <div>
          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"8px" }}>Your Rating *</p>
          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} type="button"
                onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                onClick={() => setForm(p => ({ ...p, rating:s }))}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:"24px", lineHeight:1, padding:"2px", transition:"transform 0.14s", transform:(hover||form.rating)>=s?"scale(1.3)":"scale(1)", filter:(hover||form.rating)>=s?"none":"grayscale(1) opacity(0.35)" }}>
                ⭐
              </button>
            ))}
            {(hover||form.rating) > 0 && (
              <span style={{ marginLeft:"8px", fontSize:"18px" }}>{MOODS[(hover||form.rating)-1]}</span>
            )}
          </div>
        </div>

        {/* Name + Email */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
          {[{l:"Name",k:"name",t:"text",p:"Your name"},{l:"Email",k:"email",t:"email",p:"your@email.com"}].map(f => (
            <div key={f.k}>
              <label style={{ color:"rgba(255,255,255,0.45)", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>{f.l}</label>
              <input type={f.t} placeholder={f.p} value={form[f.k]}
                onChange={e => setForm(p => ({ ...p, [f.k]:e.target.value }))} style={inputSt}
                onFocus={e => { e.target.style.borderColor="rgba(245,158,11,0.5)"; e.target.style.boxShadow="0 0 0 3px rgba(245,158,11,0.10)"; }}
                onBlur={e => { e.target.style.borderColor="rgba(255,255,255,0.18)"; e.target.style.boxShadow="none"; }} />
            </div>
          ))}
        </div>

        {/* Message */}
        <div>
          <label style={{ color:"rgba(255,255,255,0.45)", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:"5px" }}>Message *</label>
          <textarea rows={3} required placeholder="What did you love? What can we improve?"
            value={form.message} onChange={e => setForm(p => ({ ...p, message:e.target.value }))}
            style={{ ...inputSt, resize:"vertical" }}
            onFocus={e => { e.target.style.borderColor="rgba(245,158,11,0.5)"; e.target.style.boxShadow="0 0 0 3px rgba(245,158,11,0.10)"; }}
            onBlur={e => { e.target.style.borderColor="rgba(255,255,255,0.18)"; e.target.style.boxShadow="none"; }} />
        </div>

        {errMsg && (
          <p style={{ color:"#fca5a5", fontSize:"12px", margin:"-4px 0 0", lineHeight:1.5 }}>⚠️ {errMsg}</p>
        )}

        <button type="submit" disabled={status==="sending"}
          style={{ padding:"13px", borderRadius:"14px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", border:"none", color:"#fff", fontWeight:800, fontSize:"14px", cursor:status==="sending"?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 18px rgba(239,68,68,0.32)", opacity:status==="sending"?0.75:1, transition:"transform 0.18s,box-shadow 0.18s" }}
          onMouseEnter={e=>{ if(status!=="sending"){ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 26px rgba(239,68,68,0.44)"; }}}
          onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 4px 18px rgba(239,68,68,0.32)"; }}>
          {status==="sending" ? "⏳ Sending…" : "Send Feedback →"}
        </button>
      </form>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ fontFamily:"'DM Sans',sans-serif", background:"linear-gradient(160deg,#1a1a2e 0%,#16213e 45%,#0f3460 100%)", borderTop:"1px solid rgba(255,255,255,0.07)", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');
        .soc-card { transition:transform 0.22s cubic-bezier(.22,.68,0,1.2),box-shadow 0.2s; text-decoration:none; display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); box-shadow:0 2px 8px rgba(0,0,0,0.14); }
        .soc-card:hover { transform:translateY(-4px) scale(1.02); box-shadow:0 12px 36px rgba(0,0,0,0.22)!important; }
        .foot-link { color:rgba(255,255,255,0.32); font-size:13px; font-weight:500; text-decoration:none; transition:color 0.2s; }
        .foot-link:hover { color:#f59e0b; }
        @media(max-width:768px){ .fg{ grid-template-columns:1fr!important; } }
      `}</style>

      <div style={{ position:"absolute", top:"-80px", right:"-60px", width:"340px", height:"340px", borderRadius:"50%", background:"radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%)", filter:"blur(60px)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-60px", left:"-60px", width:"300px", height:"300px", borderRadius:"50%", background:"radial-gradient(circle,rgba(167,139,250,0.10) 0%,transparent 70%)", filter:"blur(60px)", pointerEvents:"none" }} />

      <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"60px 24px 36px", position:"relative" }}>
        <div className="fg" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"52px", marginBottom:"48px" }}>

          {/* Left: Brand + Socials */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"13px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px", color:"#fff", fontWeight:900, boxShadow:"0 4px 16px rgba(239,68,68,0.32)", flexShrink:0 }}>✦</div>
              <div>
                <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:900, fontSize:"21px", color:"#fff", letterSpacing:"-0.5px", lineHeight:1 }}>TripNow</p>
                <p style={{ color:"rgba(255,255,255,0.32)", fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em" }}>AI Travel Planning</p>
              </div>
            </div>
            <p style={{ color:"rgba(255,255,255,0.42)", fontSize:"14px", lineHeight:1.75, maxWidth:"320px", marginBottom:"24px" }}>
              Plan your dream trip in seconds — AI-crafted itineraries, budget breakdowns, food & hotel picks.
            </p>
            <div style={{ display:"inline-flex", flexDirection:"column", padding:"13px 18px", borderRadius:"16px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)", marginBottom:"22px" }}>
              <span style={{ color:"rgba(255,255,255,0.35)", fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:"3px" }}>Built with ❤️ by</span>
              <span style={{ fontFamily:"'Playfair Display',serif", color:"#fff", fontSize:"17px", fontWeight:800 }}>Abhishek Kasaudhan</span>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"9px" }}>
              {SOCIALS.map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="soc-card">
                  <div style={{ width:"34px", height:"34px", borderRadius:"10px", background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 }}>{s.icon}</div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ color:"rgba(255,255,255,0.35)", fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"2px" }}>{s.name}</p>
                    <p style={{ color:"#fff", fontSize:"13px", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.label}</p>
                  </div>
                  <span style={{ marginLeft:"auto", color:"rgba(255,255,255,0.22)", fontSize:"14px", flexShrink:0 }}>→</span>
                </a>
              ))}
            </div>
          </div>

          {/* Right: Feedback form */}
          <FeedbackForm />
        </div>

        <div style={{ height:"1px", background:"rgba(255,255,255,0.08)", marginBottom:"22px" }} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"10px" }}>
          <p style={{ color:"rgba(255,255,255,0.26)", fontSize:"13px" }}>© 2026 TripNow · Made by Abhishek Kasaudhan</p>
          <div style={{ display:"flex", gap:"18px" }}>
            {[["Home","/"],["Booking","/booking"],["Dashboard","/dashboard"],["Admin","/admin"]].map(([l,p]) => (
              <a key={l} href={p} className="foot-link">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;