import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const getToken  = () => localStorage.getItem("token") || sessionStorage.getItem("token");
  const [token, setToken]       = useState(getToken());
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setToken(getToken()); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
    navigate("/");
  };

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // ✅ Removed "Plan Trip" — Home page already has the AI planner form
  // ✅ Admin only visible when logged in
  const links = [
    { label: "Home",      path: "/" },
    { label: "Dashboard", path: "/dashboard" },
    ...(token ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=DM+Sans:wght@400;600;700&display=swap');
        .hn-link { position:relative; cursor:pointer; font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif; transition:color 0.2s; }
        .hn-link::after { content:''; position:absolute; bottom:-5px; left:0; width:0; height:2px; background:linear-gradient(90deg,#f59e0b,#ef4444); border-radius:2px; transition:width 0.25s ease; }
        .hn-link:hover::after,.hn-link.active::after { width:100%; }
        .hn-btn { transition:transform 0.15s,box-shadow 0.15s; font-family:'DM Sans',sans-serif; cursor:pointer; font-weight:700; border:none; }
        .hn-btn:hover { transform:translateY(-1px); }
      `}</style>

      <header style={{
        position:"fixed", top:0, left:0, right:0, zIndex:999,
        background: scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)",
        backdropFilter:"blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.09)" : "1px solid rgba(255,255,255,0.7)",
        boxShadow: scrolled ? "0 4px 28px rgba(0,0,0,0.09)" : "none",
        transition:"all 0.3s ease",
        fontFamily:"'DM Sans',sans-serif",
      }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding: scrolled ? "10px 24px" : "15px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"padding 0.3s" }}>

          {/* Logo */}
          <div onClick={() => navigate("/")} style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:"16px", boxShadow:"0 3px 12px rgba(239,68,68,0.32)" }}>
              ✦
            </div>
            <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:900, fontSize:"20px", color:"#111827", letterSpacing:"-0.5px" }}>
              TripNow
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex" style={{ display:"flex", gap:"28px", alignItems:"center" }}>
            {links.map(l => (
              <span key={l.path} onClick={() => navigate(l.path)}
                className={`hn-link ${isActive(l.path) ? "active" : ""}`}
                style={{ color: isActive(l.path) ? "#f59e0b" : "#374151" }}>
                {l.label}
              </span>
            ))}
          </nav>

          {/* Auth buttons */}
          <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
            {!token ? (
              <>
                <button className="hn-btn" onClick={() => navigate("/login")}
                  style={{ padding:"9px 20px", borderRadius:"12px", border:"1.5px solid rgba(0,0,0,0.11)", background:"transparent", fontSize:"14px", color:"#374151" }}>
                  Login
                </button>
                <button className="hn-btn" onClick={() => navigate("/signup")}
                  style={{ padding:"9px 20px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", fontSize:"14px", color:"#fff", boxShadow:"0 3px 14px rgba(239,68,68,0.30)" }}>
                  Sign Up
                </button>
              </>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", color:"#fff", fontWeight:800 }}>
                  A
                </div>
                <button className="hn-btn" onClick={handleLogout}
                  style={{ padding:"9px 20px", borderRadius:"12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:"14px", color:"#ef4444" }}>
                  Logout
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button className="md:hidden hn-btn" onClick={() => setMenuOpen(o => !o)}
              style={{ background:"none", border:"none", fontSize:"20px", color:"#374151", padding:"4px" }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div style={{ background:"rgba(255,255,255,0.97)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(0,0,0,0.06)", padding:"12px 24px 20px" }}>
            {links.map(l => (
              <div key={l.path} onClick={() => { navigate(l.path); setMenuOpen(false); }}
                style={{ padding:"13px 0", fontSize:"15px", fontWeight:600, color: isActive(l.path) ? "#f59e0b" : "#374151", borderBottom:"1px solid rgba(0,0,0,0.05)", cursor:"pointer" }}>
                {l.label}
              </div>
            ))}
            {!token ? (
              <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
                <button onClick={() => { navigate("/login"); setMenuOpen(false); }}
                  style={{ flex:1, padding:"12px", borderRadius:"12px", border:"1.5px solid rgba(0,0,0,0.11)", background:"transparent", fontWeight:700, fontSize:"14px", cursor:"pointer" }}>
                  Login
                </button>
                <button onClick={() => { navigate("/signup"); setMenuOpen(false); }}
                  style={{ flex:1, padding:"12px", borderRadius:"12px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", border:"none", fontWeight:700, fontSize:"14px", color:"#fff", cursor:"pointer" }}>
                  Sign Up
                </button>
              </div>
            ) : (
              <button onClick={handleLogout}
                style={{ width:"100%", marginTop:"14px", padding:"12px", borderRadius:"12px", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", fontWeight:700, cursor:"pointer", fontSize:"14px" }}>
                Logout
              </button>
            )}
          </div>
        )}
      </header>
    </>
  );
}

export default Header;