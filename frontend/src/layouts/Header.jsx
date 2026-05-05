// frontend/src/layouts/Header.jsx
// CHANGES:
//   ✅ Reads user name from localStorage "user" key (saved by Login/Signup)
//   ✅ Displays user's first name next to their avatar near logout button

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  // ✅ Read user object saved by Login/Signup: { id, name, email, role }
  const getUser = () => {
    try {
      const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [token, setToken]   = useState(getToken());
  const [user, setUser]     = useState(getUser());
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Re-read token + user on every route change
  useEffect(() => {
    setToken(getToken());
    setUser(getUser());
  }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
    navigate("/");
  };

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const links = [
    { label: "Home",      path: "/" },
    { label: "Plan Trip", path: "/plan-trip" },
    { label: "Booking",   path: "/booking" },
    { label: "Dashboard", path: "/dashboard" },
    ...(token ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  // ✅ Get first name only for display
  const displayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email?.split("@")[0] || "User";

  // ✅ Avatar initials
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=DM+Sans:wght@400;600;700&display=swap');
        .hn-link { position:relative; cursor:pointer; font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif; transition:color 0.2s; text-decoration:none; }
        .hn-link::after { content:''; position:absolute; bottom:-5px; left:0; width:0; height:2px; background:linear-gradient(90deg,#f59e0b,#ef4444); border-radius:2px; transition:width 0.25s ease; }
        .hn-link:hover::after, .hn-link.active::after { width:100%; }
        .hn-btn { transition:transform 0.15s,box-shadow 0.15s; font-family:'DM Sans',sans-serif; cursor:pointer; font-weight:700; border:none; }
        .hn-btn:hover { transform:translateY(-1px); }

        /* ✅ User chip — name + avatar */
        .hn-user-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 14px 5px 6px;
          background: rgba(245,158,11,0.08);
          border: 1.5px solid rgba(245,158,11,0.2);
          border-radius: 100px;
        }
        .hn-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(135deg,#f59e0b,#ef4444);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #fff;
          flex-shrink: 0;
        }
        .hn-username {
          font-size: 13px; font-weight: 700;
          color: #b45309;
          max-width: 90px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      <header style={{
        position:"fixed", top:0, left:0, right:0, zIndex:999,
        background: scrolled ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.78)",
        backdropFilter:"blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.09)" : "1px solid rgba(255,255,255,0.7)",
        boxShadow: scrolled ? "0 4px 28px rgba(0,0,0,0.09)" : "none",
        transition:"all 0.3s ease",
        fontFamily:"'DM Sans',sans-serif",
      }}>
        <div style={{
          maxWidth:"1200px", margin:"0 auto",
          padding: scrolled ? "10px 24px" : "15px 24px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          transition:"padding 0.3s",
        }}>

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
          <nav style={{ display:"flex", gap:"28px", alignItems:"center" }} className="hidden md:flex">
            {links.map(l => (
              <span
                key={l.path}
                onClick={() => navigate(l.path)}
                className={`hn-link ${isActive(l.path) ? "active" : ""}`}
                style={{ color: isActive(l.path) ? "#f59e0b" : "#374151" }}
              >
                {l.label}
              </span>
            ))}
          </nav>

          {/* Auth area */}
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
                {/* ✅ User chip with name */}
                <div className="hn-user-chip">
                  <div className="hn-avatar">{initials}</div>
                  <span className="hn-username">{displayName}</span>
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
            {token && user && (
              <div style={{ padding:"12px 0 8px", borderBottom:"1px solid rgba(0,0,0,0.06)", marginBottom:"4px", display:"flex", alignItems:"center", gap:"10px" }}>
                <div className="hn-avatar">{initials}</div>
                <div>
                  <div style={{ fontSize:"14px", fontWeight:700, color:"#111827" }}>{user.name || displayName}</div>
                  <div style={{ fontSize:"12px", color:"#9ca3af" }}>{user.email}</div>
                </div>
              </div>
            )}
            {links.map(l => (
              <div key={l.path}
                onClick={() => { navigate(l.path); setMenuOpen(false); }}
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