import React, { useState, useEffect, useRef } from "react";

const MAX_REASON_LENGTH = 300;

const QUICK_SUGGESTIONS = [
  { id: "indoor", label: "❄️ Indoor / AC", text: "Too hot outside, need an indoor air-conditioned spot" },
  { id: "crowded", label: "👥 Too crowded", text: "Venue is too crowded, want a quieter alternative nearby" },
  { id: "relax", label: "☕ Café / Relax", text: "Need a relaxing café or calm spot to sit and rest" },
  { id: "family", label: "🧸 Kid-friendly", text: "Looking for an engaging, kid-friendly activity" },
  { id: "budget", label: "💰 Low cost / Free", text: "Prefer a free or budget-friendly alternative" },
  { id: "rain", label: "🌧️ Rain shelter", text: "Raining heavily, need a sheltered or indoor activity" },
];

export default function CustomPivotModal({
  isOpen,
  onClose,
  onSubmit,
  target,
  destination = "",
  isLoading = false,
  errorMessage = null,
}) {
  const [customText, setCustomText] = useState("");
  const [validationError, setValidationError] = useState(null);
  const textareaRef = useRef(null);

  // Reset state and focus textarea when modal opens with a new target
  useEffect(() => {
    if (isOpen) {
      setCustomText("");
      setValidationError(null);
      // Small delay to ensure DOM element is ready for focus
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);

      // Prevent background scrolling while modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, target]);

  // Handle Escape key and keyboard shortcut (Ctrl+Enter / Cmd+Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoading) {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, customText]);

  if (!isOpen || !target) return null;

  const trimmedText = customText.trim();
  const charCount = customText.length;
  const isTooLong = charCount > MAX_REASON_LENGTH;
  const isValid = trimmedText.length > 0 && !isTooLong;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    if (!trimmedText) {
      setValidationError("Please describe what changed or what you need.");
      return;
    }

    if (isTooLong) {
      setValidationError(`Description must be under ${MAX_REASON_LENGTH} characters.`);
      return;
    }

    setValidationError(null);
    onSubmit(trimmedText);
  };

  const handleApplySuggestion = (suggestionText) => {
    if (isLoading) return;
    setCustomText(suggestionText);
    setValidationError(null);
    textareaRef.current?.focus();
  };

  const formatBlockName = (block) => {
    if (!block) return "";
    return block.charAt(0).toUpperCase() + block.slice(1);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-pivot-modal-title"
      aria-describedby="custom-pivot-modal-desc"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between border-b"
          style={{
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.15))",
            borderColor: "rgba(245, 158, 11, 0.2)",
          }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2
                id="custom-pivot-modal-title"
                className="text-lg font-extrabold text-slate-900 tracking-tight"
                style={{ fontFamily: "var(--font-ui)" }}
              >
                Custom Activity Adaptation
              </h2>
            </div>
            <p
              id="custom-pivot-modal-desc"
              className="text-xs text-slate-500 mt-1 font-medium"
            >
              Tell TripNow what changed to get an intelligent AI replacement.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Target Context Pill */}
          <div
            className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2"
            style={{
              background: "var(--surface-2, #f8fafc)",
              borderColor: "var(--border, #e2e8f0)",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                style={{
                  background: "var(--amber-dim, rgba(245,158,11,0.15))",
                  color: "var(--amber-text, #92400e)",
                }}
              >
                Day {target.dayNumber} · {formatBlockName(target.block)}
              </span>
              {destination && (
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[180px]">
                  📍 {destination}
                </span>
              )}
            </div>

            {target.currentActivityTitle && (
              <div className="text-xs text-slate-500 font-medium truncate max-w-full">
                Replacing: <span className="font-semibold text-slate-700">"{target.currentActivityTitle}"</span>
              </div>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleApplySuggestion(chip.text)}
                  className="px-2.5 py-1 text-xs rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="custom-pivot-textarea"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                What should we adapt for? <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-xs font-medium ${
                  isTooLong ? "text-rose-600 font-bold" : "text-slate-400"
                }`}
              >
                {charCount}/{MAX_REASON_LENGTH}
              </span>
            </div>

            <textarea
              id="custom-pivot-textarea"
              ref={textareaRef}
              rows={4}
              value={customText}
              disabled={isLoading}
              onChange={(e) => {
                setCustomText(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g., Too hot outside and feeling exhausted. Need a calm, air-conditioned indoor museum or peaceful café to relax for 2 hours."
              className={`w-full p-3 text-sm rounded-xl border bg-white text-slate-800 placeholder-slate-400 focus:outline-none transition resize-none ${
                isTooLong
                  ? "border-rose-400 ring-2 ring-rose-100"
                  : "border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              } disabled:bg-slate-100 disabled:cursor-not-allowed`}
              style={{ fontFamily: "var(--font-ui)" }}
            />

            <p className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono">Ctrl+Enter</kbd> to adapt</span>
              <span>Keep locked activities protected</span>
            </p>
          </form>

          {/* Error Message Alert (Validation or API failure) */}
          {(validationError || errorMessage) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <span className="flex-1 font-medium leading-relaxed">
                {validationError || errorMessage}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="px-5 py-2 text-xs font-bold rounded-lg text-white shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isValid && !isLoading ? "var(--amber, #f59e0b)" : "#94a3b8",
            }}
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                <span>Adapting Activity...</span>
              </>
            ) : (
              <span>Adapt Now →</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

