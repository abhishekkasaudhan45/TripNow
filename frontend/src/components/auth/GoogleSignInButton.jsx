// frontend/src/components/auth/GoogleSignInButton.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import { saveAuth, getAuthErrorMessage } from "../../utils/auth";

/**
 * Reusable, production-grade Google Identity Services (GIS) Sign-In component.
 * - Safely loads Google's official GIS client script.
 * - Renders official "Continue with Google" button with zero third-party wrapper dependencies.
 * - Strictly feature-gated: hidden if VITE_GOOGLE_CLIENT_ID is not configured.
 * - Integrates with session-bound CSRF, HttpOnly auth cookie, and anti-takeover linking response.
 */
export default function GoogleSignInButton({
  onSuccess,
  onError,
  onLinkingRequired,
  disabled = false,
  text = "continue_with", // "signin_with" | "signup_with" | "continue_with"
}) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const clientId =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CLIENT_ID
      ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()
      : null;

  // 1. If Google Client ID is unconfigured, cleanly omit the button
  if (!clientId) {
    return null;
  }

  // 2. Load Google Identity Services script if not already present
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById("google-gsi-client");
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setError("Unable to load Google Sign-In. Please check your connection.");
    };
    document.head.appendChild(script);
  }, []);

  // 3. Initialize GIS and render official button
  useEffect(() => {
    if (!scriptLoaded || !window.google?.accounts?.id || !containerRef.current) {
      return;
    }

    const handleCredentialResponse = async (response) => {
      if (!response?.credential) {
        const msg = "Failed to receive Google credential.";
        setError(msg);
        if (onError) onError(msg);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await api.post("/api/auth/google", {
          idToken: response.credential,
        });

        const user = res.data?.data?.user || res.data?.user || {};
        saveAuth({ user });

        if (onSuccess) {
          onSuccess(user);
        }
      } catch (err) {
        const status = err.response?.status;
        const code = err.response?.data?.code;
        const serverMessage = err.response?.data?.message;

        if (status === 409 && code === "ACCOUNT_EXISTS_LINKING_REQUIRED") {
          const msg =
            serverMessage ||
            "An account with this email already exists. Please log in with your password to link your Google account.";
          setError(msg);
          if (onLinkingRequired) {
            onLinkingRequired(msg);
          } else if (onError) {
            onError(msg);
          }
        } else if (status === 503) {
          const msg = "Google authentication is temporarily disabled.";
          setError(msg);
          if (onError) onError(msg);
        } else {
          const msg = getAuthErrorMessage(
            err,
            "Google sign-in failed. Please try again."
          );
          setError(msg);
          if (onError) onError(msg);
        }
      } finally {
        setLoading(false);
      }
    };

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear previous container contents before rendering
      containerRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        logo_alignment: "left",
        width: containerRef.current.offsetWidth || 340,
      });
    } catch (e) {
      console.error("GIS initialization error:", e);
    }
  }, [scriptLoaded, clientId, text, onSuccess, onError, onLinkingRequired]);

  return (
    <div style={{ width: "100%", marginTop: "10px", marginBottom: "6px" }}>
      {/* Visual divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "14px 0 16px 0",
          color: "#9ca3af",
          fontSize: "12px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.10)" }} />
        <span style={{ padding: "0 12px" }}>or</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(0,0,0,0.10)" }} />
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            padding: "9px 12px",
            borderRadius: "10px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.22)",
            color: "#dc2626",
            fontSize: "12px",
            fontWeight: 600,
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Button container */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          width: "100%",
          minHeight: "44px",
          opacity: disabled || loading ? 0.6 : 1,
          pointerEvents: disabled || loading ? "none" : "auto",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }} />

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.85)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#374151",
              fontWeight: 600,
            }}
          >
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            Connecting to Google…
          </div>
        )}
      </div>
    </div>
  );
}

