import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function Booking() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // ─── Trip data passed from PlanTrip via navigate("/booking", { state })
  const destination = state?.destination || "";
  const budget      = state?.budget      || "";
  const startDate   = state?.checkin     || state?.startDate || "";
  const endDate     = state?.checkout    || state?.endDate   || "";
  const tripData    = state?.tripData    || null; // full AI-generated object (optional)

  const dayCount = startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
    : 0;

  // ─── Form state
  const [form, setForm] = useState({
    fullName:  "",
    email:     "",
    phone:     "",
    travelers: "1",
    notes:     "",
  });

  const [status, setStatus]   = useState("idle"); // idle | loading | success | error
  const [errMsg, setErrMsg]   = useState("");
  const [bookingId, setBookingId] = useState(null);

  // Redirect if no state passed in
  useEffect(() => {
    if (!destination) navigate("/plan-trip");
  }, [destination, navigate]);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.phone) {
      setErrMsg("Please fill in your name, email, and phone.");
      return;
    }
    setErrMsg("");
    setStatus("loading");

    try {
      const payload = {
        destination,
        budget,
        startDate,
        endDate,
        dayCount,
        fullName:  form.fullName,
        email:     form.email,
        phone:     form.phone,
        travelers: Number(form.travelers),
        notes:     form.notes,
        tripData:  tripData || null,
      };

      const res = await api.post("/api/bookings", payload);
      setBookingId(res.data?.data?._id || "CONFIRMED");
      setStatus("success");
    } catch (err) {
      setErrMsg(
        err?.response?.data?.message || "Booking failed. Please try again."
      );
      setStatus("error");
    }
  };

  // ─────────────────────────────── STYLES ───────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');

    .bk-root {
      min-height: 100vh;
      background: #f4f7f6;
      position: relative;
      overflow: hidden;
      font-family: 'DM Sans', sans-serif;
      color: #1e293b;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 20px 80px;
    }

    /* orbs */
    .bk-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
    }
    .bk-orb-1 {
      top: -10%; left: -10%;
      width: 50vw; height: 50vw;
      background: radial-gradient(circle, rgba(255,174,92,0.35) 0%, transparent 70%);
      animation: bkFloat 22s ease-in-out infinite;
    }
    .bk-orb-2 {
      bottom: -15%; right: -8%;
      width: 55vw; height: 55vw;
      background: radial-gradient(circle, rgba(92,218,255,0.35) 0%, transparent 70%);
      animation: bkFloat 28s ease-in-out infinite reverse;
    }
    @keyframes bkFloat {
      0%,100% { transform: translate(0,0) scale(1); }
      33%      { transform: translate(4%,8%) scale(1.08); }
      66%      { transform: translate(-4%,4%) scale(0.93); }
    }

    /* card */
    .bk-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 820px;
      background: rgba(255,255,255,0.6);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.07);
      overflow: hidden;
    }

    /* header strip */
    .bk-hero {
      background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
      padding: 32px 36px 28px;
      position: relative;
    }
    .bk-hero-back {
      position: absolute;
      top: 20px; left: 20px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.35);
      color: #fff;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: background 0.2s;
    }
    .bk-hero-back:hover { background: rgba(255,255,255,0.3); }
    .bk-hero-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.75);
      margin-bottom: 8px;
      margin-top: 28px;
    }
    .bk-hero-title {
      font-family: 'Playfair Display', serif;
      font-size: 38px;
      font-weight: 900;
      color: #fff;
      line-height: 1.1;
      text-transform: capitalize;
    }
    .bk-hero-title em { font-style: italic; }
    .bk-hero-pills {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .bk-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      backdrop-filter: blur(8px);
    }

    /* body */
    .bk-body {
      padding: 32px 36px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    /* summary row */
    .bk-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .bk-stat {
      background: rgba(255,255,255,0.8);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: center;
    }
    .bk-stat-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .bk-stat-val {
      font-size: 20px;
      font-weight: 800;
      color: #1e293b;
    }
    .bk-stat-val.amber { color: #b45309; }
    .bk-stat-val.green { color: #047857; }
    .bk-stat-val.sky   { color: #0369a1; font-size: 15px; text-transform: capitalize; }

    /* section heading */
    .bk-section-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 14px;
    }

    /* form */
    .bk-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .bk-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .bk-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bk-label {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      letter-spacing: .03em;
    }
    .bk-input, .bk-textarea, .bk-select {
      padding: 11px 14px;
      background: rgba(255,255,255,0.8);
      border: 1.5px solid rgba(0,0,0,0.1);
      border-radius: 10px;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 500;
      color: #1e293b;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .bk-input:focus, .bk-textarea:focus, .bk-select:focus {
      border-color: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
    }
    .bk-textarea {
      resize: vertical;
      min-height: 80px;
    }

    /* divider */
    .bk-divider {
      height: 1px;
      background: rgba(0,0,0,0.06);
    }

    /* total row */
    .bk-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(16,185,129,0.08);
      border: 1px solid rgba(16,185,129,0.25);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .bk-total-label {
      font-size: 13px;
      font-weight: 700;
      color: #047857;
    }
    .bk-total-val {
      font-size: 22px;
      font-weight: 800;
      color: #047857;
    }

    /* error */
    .bk-error {
      background: rgba(244,63,94,0.08);
      border: 1px solid rgba(244,63,94,0.25);
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #be123c;
    }

    /* CTA */
    .bk-cta {
      width: 100%;
      padding: 15px;
      background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
      border: none;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      cursor: pointer;
      letter-spacing: .03em;
      box-shadow: 0 6px 20px rgba(239,68,68,0.28);
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    }
    .bk-cta:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(239,68,68,0.35);
    }
    .bk-cta:disabled { opacity: 0.65; cursor: not-allowed; }

    /* ─── SUCCESS SCREEN ─── */
    .bk-success {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 520px;
      background: rgba(255,255,255,0.65);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.07);
      padding: 52px 40px;
      text-align: center;
      animation: bkPopIn 0.5s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes bkPopIn {
      0% { transform: scale(0.85); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .bk-success-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: bkBounce 1.6s ease-in-out infinite;
    }
    @keyframes bkBounce {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
    .bk-success-title {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-weight: 900;
      color: #047857;
      margin-bottom: 10px;
    }
    .bk-success-sub {
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .bk-booking-id {
      display: inline-block;
      margin-top: 12px;
      padding: 6px 18px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 100px;
      font-size: 12px;
      font-weight: 800;
      color: #047857;
      letter-spacing: .06em;
      word-break: break-all;
    }
    .bk-success-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
    }
    .bk-btn-dash {
      flex: 1;
      padding: 12px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      border: none;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      transition: transform 0.15s;
    }
    .bk-btn-dash:hover { transform: translateY(-1px); }
    .bk-btn-home {
      flex: 1;
      padding: 12px;
      background: rgba(255,255,255,0.8);
      border: 1.5px solid rgba(0,0,0,0.1);
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #374151;
      cursor: pointer;
      transition: background 0.15s;
    }
    .bk-btn-home:hover { background: rgba(255,255,255,1); }

    @media (max-width: 600px) {
      .bk-hero { padding: 28px 20px 22px; }
      .bk-body { padding: 24px 20px; }
      .bk-summary { grid-template-columns: 1fr 1fr; }
      .bk-row { grid-template-columns: 1fr; }
      .bk-hero-title { font-size: 28px; }
    }
  `;

  // ─────────────────────────────── SUCCESS SCREEN ───────────────────────
  if (status === "success") {
    return (
      <>
        <style>{css}</style>
        <div className="bk-root">
          <div className="bk-orb bk-orb-1" />
          <div className="bk-orb bk-orb-2" />
          <div className="bk-success">
            <div className="bk-success-icon">🎉</div>
            <div className="bk-success-title">Booking Confirmed!</div>
            <p className="bk-success-sub">
              Your trip to <strong style={{ textTransform: "capitalize" }}>{destination}</strong> has been booked successfully.
              We'll send the details to <strong>{form.email}</strong>.
            </p>
            {bookingId && (
              <div className="bk-booking-id">
                Booking ID: {bookingId}
              </div>
            )}
            <div className="bk-success-actions">
              <button className="bk-btn-dash" onClick={() => navigate("/dashboard")}>
                📋 View Dashboard
              </button>
              <button className="bk-btn-home" onClick={() => navigate("/")}>
                🏠 Go Home
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────── MAIN FORM ────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="bk-root">
        <div className="bk-orb bk-orb-1" />
        <div className="bk-orb bk-orb-2" />

        <div className="bk-card">

          {/* ── Hero strip ── */}
          <div className="bk-hero">
            <button className="bk-hero-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <div className="bk-hero-label">Review & Confirm</div>
            <div className="bk-hero-title">
              Trip to <em>{destination || "your destination"}</em>
            </div>
            <div className="bk-hero-pills">
              {startDate && <span className="bk-pill">📅 {startDate} → {endDate}</span>}
              {dayCount  > 0 && <span className="bk-pill">🌙 {dayCount} Days</span>}
              {budget    && <span className="bk-pill">💰 ₹{budget}</span>}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="bk-body">

            {/* Trip summary stats */}
            <div>
              <div className="bk-section-title">Trip Summary</div>
              <div className="bk-summary">
                <div className="bk-stat">
                  <div className="bk-stat-label">Duration</div>
                  <div className="bk-stat-val amber">{dayCount} Days</div>
                </div>
                <div className="bk-stat">
                  <div className="bk-stat-label">Budget</div>
                  <div className="bk-stat-val green">₹{budget}</div>
                </div>
                <div className="bk-stat">
                  <div className="bk-stat-label">Destination</div>
                  <div className="bk-stat-val sky">{destination}</div>
                </div>
              </div>
            </div>

            <div className="bk-divider" />

            {/* Traveller details form */}
            <div>
              <div className="bk-section-title">Traveller Details</div>
              <div className="bk-form">
                <div className="bk-row">
                  <div className="bk-field">
                    <label className="bk-label">Full Name *</label>
                    <input
                      className="bk-input"
                      name="fullName"
                      placeholder="e.g. Arjun Sharma"
                      value={form.fullName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">Email Address *</label>
                    <input
                      className="bk-input"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="bk-row">
                  <div className="bk-field">
                    <label className="bk-label">Phone Number *</label>
                    <input
                      className="bk-input"
                      name="phone"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">Number of Travellers</label>
                    <select
                      className="bk-select"
                      name="travelers"
                      value={form.travelers}
                      onChange={handleChange}
                    >
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? "Person" : "People"}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bk-field">
                  <label className="bk-label">Special Requests / Notes</label>
                  <textarea
                    className="bk-textarea"
                    name="notes"
                    placeholder="Any dietary requirements, accessibility needs, or special requests..."
                    value={form.notes}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="bk-divider" />

            {/* Total */}
            <div className="bk-total-row">
              <span className="bk-total-label">💰 Total Budget</span>
              <span className="bk-total-val">₹{budget}</span>
            </div>

            {/* Error */}
            {(errMsg || status === "error") && (
              <div className="bk-error">⚠️ {errMsg || "Something went wrong."}</div>
            )}

            {/* Submit */}
            <button
              className="bk-cta"
              onClick={handleSubmit}
              disabled={status === "loading"}
            >
              {status === "loading" ? "⏳ Confirming your booking..." : "✈️ Confirm Booking"}
            </button>

          </div>
        </div>
      </div>
    </>
  );
}