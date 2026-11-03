// frontend/src/components/privacy/CookieConsent.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  getStoredConsent,
  hasUserConsented,
  acceptAllCookies,
  rejectOptionalCookies,
  saveConsentPreferences,
  CONSENT_STATUS,
} from "../../utils/cookieConsent";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: false,
    marketing: false,
  });

  const modalRef = useRef(null);

  // Check consent state on mount & set up event listener for reopening preferences
  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) {
      setShowBanner(true);
    } else {
      setPreferences({
        analytics: Boolean(consent.categories?.analytics),
        marketing: Boolean(consent.categories?.marketing),
      });
    }

    const handleOpenPreferences = () => {
      const current = getStoredConsent();
      if (current) {
        setPreferences({
          analytics: Boolean(current.categories?.analytics),
          marketing: Boolean(current.categories?.marketing),
        });
      }
      setShowModal(true);
    };

    window.addEventListener("tripnow-open-cookie-preferences", handleOpenPreferences);
    return () => {
      window.removeEventListener("tripnow-open-cookie-preferences", handleOpenPreferences);
    };
  }, []);

  // Keyboard accessibility: Escape to close modal, body scroll lock
  useEffect(() => {
    if (!showModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModal]);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setPreferences({ analytics: true, marketing: true });
    setShowBanner(false);
    setShowModal(false);
  };

  const handleRejectOptional = () => {
    rejectOptionalCookies();
    setPreferences({ analytics: false, marketing: false });
    setShowBanner(false);
    setShowModal(false);
  };

  const handleOpenCustomize = () => {
    setShowBanner(false);
    setShowModal(true);
  };

  const handleSaveCustomPreferences = () => {
    saveConsentPreferences({
      status: CONSENT_STATUS.CUSTOMIZED,
      analytics: preferences.analytics,
      marketing: preferences.marketing,
    });
    setShowModal(false);
    setShowBanner(false);
  };

  const handleCancelModal = () => {
    const current = getStoredConsent();
    if (current) {
      setPreferences({
        analytics: Boolean(current.categories?.analytics),
        marketing: Boolean(current.categories?.marketing),
      });
    } else {
      // If user had not consented yet and canceled the modal, bring back the banner
      setShowBanner(true);
    }
    setShowModal(false);
  };

  return (
    <>
      {/* ── 1. Cookie Consent Banner ── */}
      {showBanner && (
        <aside
          role="region"
          aria-label="Cookie consent banner"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            backgroundColor: "rgba(26, 26, 46, 0.96)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.35)",
            padding: "16px 24px",
            fontFamily: "'DM Sans', sans-serif",
            color: "#fff",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            {/* Banner Description */}
            <div style={{ flex: "1 1 500px", minWidth: "280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "18px" }}>🍪</span>
                <span style={{ fontWeight: 800, fontSize: "15px", color: "#fef3c7" }}>
                  Your Privacy & Cookies on TripNow
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.78)", lineHeight: 1.55, margin: 0 }}>
                We use strictly necessary cookies to keep you securely signed in and protect our API. We do not
                deploy third-party advertising trackers or sell your personal data. Learn more in our{" "}
                <Link to="/cookies" style={{ color: "#f59e0b", textDecoration: "underline", fontWeight: 600 }}>
                  Cookie Policy
                </Link>{" "}
                and{" "}
                <Link to="/privacy" style={{ color: "#f59e0b", textDecoration: "underline", fontWeight: 600 }}>
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            {/* Banner Actions */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                onClick={handleRejectOptional}
                style={{
                  padding: "9px 18px",
                  borderRadius: "11px",
                  border: "1.5px solid rgba(255, 255, 255, 0.22)",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                }}
              >
                Reject Optional
              </button>

              <button
                type="button"
                onClick={handleOpenCustomize}
                style={{
                  padding: "9px 16px",
                  borderRadius: "11px",
                  border: "none",
                  background: "transparent",
                  color: "#f59e0b",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Customize
              </button>

              <button
                type="button"
                onClick={handleAcceptAll}
                style={{
                  padding: "10px 22px",
                  borderRadius: "11px",
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 3px 14px rgba(239, 68, 68, 0.35)",
                  transition: "transform 0.18s, box-shadow 0.18s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                }}
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── 2. Cookie Preferences Modal ── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-preferences-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            fontFamily: "'DM Sans', sans-serif",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelModal();
          }}
        >
          <div
            ref={modalRef}
            style={{
              width: "100%",
              maxWidth: "560px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              overflow: "hidden",
              animation: "modalFadeIn 0.2s ease-out",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 28px 18px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <h2
                  id="cookie-preferences-title"
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Cookie Preferences
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Manage the categories of cookies and storage used during your visits to TripNow.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelModal}
                aria-label="Close preferences"
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Categories */}
            <div style={{ padding: "20px 28px", maxHeight: "60vh", overflowY: "auto" }}>
              {/* Category 1: Strictly Necessary */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                      Strictly Necessary Cookies
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "4px 10px",
                      borderRadius: "100px",
                      backgroundColor: "#dcfce7",
                      color: "#166534",
                    }}
                  >
                    Always Active
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                  Essential for TripNow to function properly. Includes secure HttpOnly JWT session authentication (
                  <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: "4px" }}>token</code>
                  ) and session-bound CSRF security validation. These cannot be disabled.
                </p>
              </div>

              {/* Category 2: Analytics Cookies */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                      Analytics Cookies
                    </span>
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "100px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                      }}
                    >
                      Currently Not Deployed
                    </span>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, analytics: e.target.checked }))
                      }
                      style={{ width: "18px", height: "18px", accentColor: "#f59e0b", cursor: "pointer" }}
                    />
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                  Used to measure anonymous site usage to help improve TripNow's features and performance.
                  TripNow does not currently deploy third-party analytics trackers.
                </p>
              </div>

              {/* Category 3: Marketing & Advertising */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                      Marketing & Advertising
                    </span>
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "100px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                      }}
                    >
                      Currently Not Deployed
                    </span>
                  </div>
                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, marketing: e.target.checked }))
                      }
                      style={{ width: "18px", height: "18px", accentColor: "#f59e0b", cursor: "pointer" }}
                    />
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                  Used to track visitors across websites to display targeted ads. TripNow does not display ads,
                  does not use tracking pixels, and does not sell your personal data.
                </p>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div
              style={{
                padding: "16px 28px 24px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={handleRejectOptional}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reject All Optional
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleCancelModal}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#f1f5f9",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomPreferences}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 3px 12px rgba(239, 68, 68, 0.3)",
                  }}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

