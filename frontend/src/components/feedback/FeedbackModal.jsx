import React, { useState, useEffect, useRef } from "react";
import api from "../../lib/api";
import { getUser } from "../../utils/auth";

const CATEGORIES = [
  { id: "Experience", label: "✨ Experience", desc: "General thoughts & feelings" },
  { id: "Feature Request", label: "💡 Feature Request", desc: "Ideas for new tools" },
  { id: "Bug", label: "🐛 Bug", desc: "Something isn't working" },
  { id: "Other", label: "💬 Other", desc: "Anything else" },
];

const MOODS = [
  { stars: 1, emoji: "😞", label: "Needs work" },
  { stars: 2, emoji: "😕", label: "Could be better" },
  { stars: 3, emoji: "😐", label: "It's okay" },
  { stars: 4, emoji: "😊", label: "Good" },
  { stars: 5, emoji: "🤩", label: "Loved it!" },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState("Experience");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const modalRef = useRef(null);
  const textareaRef = useRef(null);

  // Initialize and prefill user credentials if logged in
  useEffect(() => {
    if (isOpen) {
      const user = getUser();
      setName(user?.name || "");
      setEmail(user?.email || "");
      setRating(5);
      setHoverRating(0);
      setCategory("Experience");
      setMessage("");
      setErrorMsg("");
      setIsSubmitted(false);
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 60);

      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const currentRating = hoverRating || rating;
  const currentMood = MOODS.find((m) => m.stars === currentRating) || MOODS[4];

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg("Please select a rating between 1 and 5 stars.");
      return;
    }

    if (!message.trim() || message.trim().length < 3) {
      setErrorMsg("Please enter your message (at least 3 characters).");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await api.post("/api/feedback", {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        category,
        rating,
        message: message.trim(),
      });

      if (res.data?.success) {
        setIsSubmitted(true);
      } else {
        throw new Error(res.data?.message || "Failed to submit feedback.");
      }
    } catch (err) {
      console.warn("Feedback submission error:", err);
      const serverMsg =
        err.response?.data?.message ||
        err.message ||
        "Unable to send feedback. Please try again.";
      setErrorMsg(serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      style={{
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/90 transition-all duration-200"
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient banner */}
        <div
          className="relative px-6 py-5 text-white"
          style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 60%, #8b5cf6 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">✦</span>
              <h3
                id="feedback-dialog-title"
                style={{ fontFamily: "'Playfair Display', serif" }}
                className="text-xl font-bold tracking-tight text-white m-0"
              >
                Share Your Feedback
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close feedback dialog"
              className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer border-none bg-transparent"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-white/90">
            Help shape TripNow — your thoughts directly guide our features.
          </p>
        </div>

        {/* Modal Body */}
        {isSubmitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              🎉
            </div>
            <h4
              style={{ fontFamily: "'Playfair Display', serif" }}
              className="text-2xl font-bold text-slate-800 mb-2"
            >
              Thank you for your feedback!
            </h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6 leading-relaxed">
              We received your review and appreciate you taking the time to help make TripNow better.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-semibold text-sm text-white cursor-pointer transition-transform hover:scale-[1.02] border-none shadow-md"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              }}
            >
              Done →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
            {/* Rating Stars */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Rating <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span>{currentMood.emoji}</span>
                  <span>{currentMood.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none cursor-pointer border-none bg-transparent"
                    style={{
                      filter: star <= currentRating ? "none" : "grayscale(1) opacity(0.35)",
                      transform: star <= currentRating ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            {/* Category Chips */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((c) => {
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="feedback-message"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Message <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {message.length} / 2000
                </span>
              </div>
              <textarea
                id="feedback-message"
                ref={textareaRef}
                rows={3}
                required
                maxLength={2000}
                placeholder="What did you love? What could be improved?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
              />
            </div>

            {/* Optional Email & Name inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="feedback-email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                >
                  Your Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="feedback-name"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                >
                  Your Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"
              >
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] border-none disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                }}
              >
                {isSubmitting ? "Sending…" : "Submit Feedback →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

