// frontend/src/components/budget/BudgetIntelligencePanel.jsx
import React, { useMemo } from "react";
import {
  CALCULATION_STATUS,
  ECONOMIC_TIERS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  calculateBudgetIntelligence,
} from "../../utils/budgetIntelligence.js";

/**
 * Human-readable tier label and badge details.
 */
const TIER_META = {
  [ECONOMIC_TIERS.TIER_1_METRO]: {
    label: "Tier 1: High-Cost Metro",
    shortLabel: "Tier 1 Metro",
    description: "Metropolitan hubs (e.g. Mumbai, Delhi, Bengaluru)",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
  },
  [ECONOMIC_TIERS.TIER_2_RESORT]: {
    label: "Tier 2: Resort & Island",
    shortLabel: "Tier 2 Resort",
    description: "Beach, island & holiday resorts (e.g. Goa, Andaman)",
    badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  [ECONOMIC_TIERS.TIER_3_BUDGET]: {
    label: "Tier 3: Regional & Heritage",
    shortLabel: "Tier 3 Regional",
    description: "Heritage hills & cultural destinations (e.g. Jaipur, Manali, Varanasi)",
    badgeColor: "bg-sky-100 text-sky-900 border-sky-300",
  },
  [ECONOMIC_TIERS.GLOBAL_TIER_A]: {
    label: "Global Tier A: Budget Neighbors & SE Asia",
    shortLabel: "Global Tier A",
    description: "Budget neighbors & Southeast Asia (e.g. Thailand, Vietnam, Sri Lanka, Nepal)",
    badgeColor: "bg-teal-100 text-teal-900 border-teal-300",
  },
  [ECONOMIC_TIERS.GLOBAL_TIER_B]: {
    label: "Global Tier B: Mid-Cost Hubs & Middle East",
    shortLabel: "Global Tier B",
    description: "Mid-cost hubs & Middle East (e.g. UAE, Dubai, Singapore, Bali, Turkey)",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300",
  },
  [ECONOMIC_TIERS.GLOBAL_TIER_C]: {
    label: "Global Tier C: Western & High-Cost Hubs",
    shortLabel: "Global Tier C",
    description: "Western & high-cost hubs (e.g. Western Europe, UK, USA, Japan, Australia)",
    badgeColor: "bg-purple-100 text-purple-900 border-purple-300",
  },
  [ECONOMIC_TIERS.TIER_4_INTERNATIONAL]: {
    label: "Tier 4: International",
    shortLabel: "International",
    description: "Destinations outside India",
    badgeColor: "bg-purple-100 text-purple-900 border-purple-300",
  },
  [ECONOMIC_TIERS.UNKNOWN]: {
    label: "Unmapped Destination",
    shortLabel: "Unmapped",
    description: "Destination not currently in economic tier registry",
    badgeColor: "bg-gray-100 text-gray-800 border-gray-300",
  },
};

/**
 * Comfort classification badge and explanation.
 */
const COMFORT_META = {
  [COMFORT_CATEGORIES.LOW]: {
    label: "Budget-Conscious Comfort",
    pillClass: "bg-amber-50 text-amber-800 border-amber-200",
    barClass: "bg-amber-500",
    summary:
      "Comfort guidance: Well-suited for hostels, shared transit, and local dining. Ideal for budget travelers.",
  },
  [COMFORT_CATEGORIES.MODERATE]: {
    label: "Standard Balanced Comfort",
    pillClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    barClass: "bg-emerald-500",
    summary:
      "Comfort guidance: Aligns well with standard 3-star lodging, mid-range dining, and local sightseeing.",
  },
  [COMFORT_CATEGORIES.HIGH]: {
    label: "Premium High Comfort",
    pillClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    barClass: "bg-indigo-500",
    summary:
      "Comfort guidance: Comfortably supports 4-5 star hotels, private cabs, and upscale experiences.",
  },
};

/**
 * Format positive INR amounts with Indian numbering (e.g. ₹1,50,000).
 */
const formatINR = (val) => {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) return "—";
  return `₹${Math.round(Number(val)).toLocaleString("en-IN")}`;
};

/**
 * Reusable Budget Intelligence Panel Component.
 *
 * Guarantees:
 * - Pure client-side deterministic evaluation via useMemo (< 1ms).
 * - Zero network requests, zero Gemini calls.
 * - Responsive at 375px mobile without horizontal scroll.
 * - Accessible labels, neutral non-misleading financial guidance.
 * - Clear Low, Mid, and High travel-cost estimates with Mid visually highlighted.
 * - Prominent "Ground stay estimate (excludes international flights & visas)" for international destinations.
 * - Expense allocation clearly labels 10% miscellaneous as "Buffer & Contingency".
 */
export default function BudgetIntelligencePanel({
  totalBudget,
  days,
  guests = 1,
  destination,
  currency = "INR",
  compact = false,
  showBreakdown = true,
  showDisclaimer = true,
  className = "",
}) {
  const safeDays = Math.max(1, Number(days) || 1);
  const safeGuests = Math.max(1, Number(guests) || 1);

  // Pure deterministic memoized calculation
  const calc = useMemo(() => {
    return calculateBudgetIntelligence({
      totalBudget,
      days: safeDays,
      guests: safeGuests,
      destination: destination || "",
      currency: currency || "INR",
    });
  }, [totalBudget, safeDays, safeGuests, destination, currency]);

  const { status, tier, category, breakdown, warnings } = calc;
  const destinationName = calc.resolvedDestination || destination || "Destination";

  // ── Handle Boundary Conditions ───────────────────────────────────────────
  if (status === CALCULATION_STATUS.INVALID_INPUT) {
    if (compact) return null;
    return (
      <div
        className={`rounded-2xl border border-gray-200 bg-white/70 backdrop-blur-md p-4 text-xs text-gray-600 ${className}`}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <span>💡</span>
          <span>Budget Intelligence Preview</span>
        </div>
        <p className="mt-1 text-gray-500">
          Enter destination, trip duration (≥ 1 day), travelers (≥ 1), and budget to see real-time
          economic intelligence.
        </p>
      </div>
    );
  }

  if (status === CALCULATION_STATUS.UNSUPPORTED_CURRENCY) {
    return (
      <div
        className={`rounded-2xl border border-amber-200 bg-amber-50/80 backdrop-blur-md p-4 text-xs text-amber-900 ${className}`}
      >
        <div className="flex items-center gap-2 font-bold">
          <span>💱</span>
          <span>Currency Reference Notice ({calc.currency})</span>
        </div>
        <p className="mt-1 text-amber-800">
          TripNow's baseline cost intelligence is currently anchored in Indian Rupees (INR ₹).
          Foreign exchange rates are not guessed to prevent misleading estimates.
        </p>
      </div>
    );
  }

  if (status === CALCULATION_STATUS.BASELINE_NOT_CONFIGURED) {
    return (
      <div
        className={`rounded-2xl border border-purple-200 bg-purple-50/80 backdrop-blur-md p-4 text-xs text-purple-900 ${className}`}
      >
        <div className="flex items-center gap-2 font-bold">
          <span>🌐</span>
          <span>International Baseline Notice ({destinationName})</span>
        </div>
        <p className="mt-1 text-purple-800">
          Economic baseline data is not yet configured for international destinations. Domestic INR
          anchors are not applied to ensure calculations remain honest and realistic.
        </p>
      </div>
    );
  }

  if (status === CALCULATION_STATUS.UNKNOWN_DESTINATION) {
    return (
      <div
        className={`rounded-2xl border border-gray-200/90 bg-gray-50/90 backdrop-blur-md p-4 text-xs text-gray-700 ${className}`}
      >
        <div className="flex items-center gap-2 font-bold text-gray-900">
          <span>📍</span>
          <span>Unmapped Destination ({destinationName})</span>
        </div>
        <p className="mt-1 text-gray-600 leading-relaxed">
          This destination is not recognized in the regional economic registry. Reference cost
          guidance is unavailable.
        </p>
      </div>
    );
  }

  const tierMeta = TIER_META[tier] || TIER_META[ECONOMIC_TIERS.UNKNOWN];
  const comfortMeta = COMFORT_META[category] || COMFORT_META[COMFORT_CATEGORIES.MODERATE];

  const difference = calc.standardBudgetDifference ?? 0;
  const isSurplus = difference > 0;
  const isShortfall = difference < 0;
  const isInternational = Boolean(calc.isInternational || tier?.startsWith("GLOBAL_TIER_"));

  const dailyEstimates = calc.dailyTierEstimates || {
    low: null,
    mid: null,
    high: null,
  };
  const tripTotals = calc.estimatedTripTotals || {
    low: null,
    mid: null,
    high: null,
  };

  // ── Compact View (e.g. for Home Hero search card) ────────────────────────
  if (compact) {
    return (
      <div
        className={`rounded-2xl border border-white/90 bg-white/95 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm transition hover:shadow-md ${className}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Header & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">🧭</span>
            <span className="text-xs font-bold text-gray-900 tracking-tight truncate">
              {destinationName}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${tierMeta.badgeColor}`}
            >
              {tierMeta.shortLabel}
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${comfortMeta.pillClass}`}
          >
            {comfortMeta.label}
          </span>
        </div>

        {/* International Ground Stay Notice (Prominent) */}
        {isInternational && (
          <div className="mt-2 rounded-lg bg-sky-50 border border-sky-100 px-2 py-1 text-[11px] text-sky-900 font-medium flex items-center gap-1.5">
            <span className="text-xs">✈️</span>
            <span className="truncate">Ground stay estimate (excludes international flights & visas)</span>
          </div>
        )}

        {/* Three Estimates Spectrum (Low, Mid [Highlighted], High) */}
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          {/* Low */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
              Low
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-extrabold text-gray-900">
              {formatINR(dailyEstimates.low)}
            </div>
            <div className="text-[9px] text-gray-500">/ p / d</div>
            <div className="mt-1 border-t border-gray-100 pt-1 text-[9px] text-gray-500 font-medium">
              Total {formatINR(tripTotals.low)}
            </div>
          </div>

          {/* Mid (Emphasized) */}
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50/70 p-2 shadow-xs relative">
            <div className="text-[9px] font-black uppercase tracking-wider text-amber-900 flex items-center justify-center gap-0.5">
              <span>★</span> Mid
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-black text-amber-950">
              {formatINR(dailyEstimates.mid)}
            </div>
            <div className="text-[9px] text-amber-800 font-semibold">/ p / d</div>
            <div className="mt-1 border-t border-amber-200/60 pt-1 text-[9px] text-amber-950 font-bold">
              Total {formatINR(tripTotals.mid)}
            </div>
          </div>

          {/* High */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
              High
            </div>
            <div className="mt-0.5 text-xs sm:text-sm font-extrabold text-gray-900">
              {formatINR(dailyEstimates.high)}
            </div>
            <div className="text-[9px] text-gray-500">/ p / d</div>
            <div className="mt-1 border-t border-gray-100 pt-1 text-[9px] text-gray-500 font-medium">
              Total {formatINR(tripTotals.high)}
            </div>
          </div>
        </div>

        {/* Selected Budget Comparison & Variance */}
        <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px]">
          <span className="text-gray-500">
            Available: <strong className="text-gray-900">{formatINR(calc.perPersonDailyBudget)}</strong>/p/d
          </span>
          <span
            className={`font-bold ${
              isSurplus ? "text-emerald-700" : isShortfall ? "text-amber-700" : "text-gray-700"
            }`}
          >
            {isSurplus ? `+${formatINR(difference)} Surplus` : isShortfall ? `-${formatINR(Math.abs(difference))} Shortfall` : "Balanced"}
          </span>
        </div>
      </div>
    );
  }

  // ── Full Comprehensive View (PlanTrip & Booking) ──────────────────────────
  return (
    <div
      className={`rounded-2xl border border-white/90 bg-white/85 backdrop-blur-xl p-4 sm:p-6 shadow-sm ${className}`}
      style={{ fontFamily: "'DM Sans', sans-serif", color: "#1e293b" }}
    >
      {/* 1. Header & Economic Tier */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Deterministic Budget Intelligence
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Real-time reference viability based on {destinationName} economic benchmarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${tierMeta.badgeColor}`}
            title={tierMeta.description}
          >
            🏷️ {tierMeta.label}
          </span>
          <span
            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${comfortMeta.pillClass}`}
          >
            {comfortMeta.label}
          </span>
        </div>
      </div>

      {/* 2. International Ground Stay Notice (Prominently Displayed) */}
      {isInternational && (
        <div className="mt-3.5 rounded-xl border border-sky-200 bg-sky-50/90 p-3.5 text-xs text-sky-950 flex items-start gap-2.5 shadow-xs">
          <span className="text-lg leading-none mt-0.5">✈️</span>
          <div className="flex-1">
            <div className="font-bold text-sky-900 text-[13px]">
              Ground stay estimate (excludes international flights & visas)
            </div>
            <p className="mt-1 text-sky-800 text-xs leading-relaxed">
              Baseline figures cover in-destination daily lodging (twin-sharing), food, inner-city
              transit, and sightseeing admissions. Intercontinental flights, visa application fees,
              and foreign exchange buffers are excluded.
            </p>
          </div>
        </div>
      )}

      {/* 3. Destination Cost Spectrum: Low, Mid (Recommended), High */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Destination Cost Spectrum · {destinationName}
          </h4>
          <span className="text-[11px] text-gray-400">
            Estimates for {safeGuests} {safeGuests === 1 ? "traveler" : "travelers"} · {safeDays} {safeDays === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Low Estimate Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-gray-500 text-[10px]">
                Low Estimate
              </span>
              <span className="text-[10px] text-gray-400">Budget-Conscious</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-extrabold text-gray-900">
              {formatINR(dailyEstimates.low)}
              <span className="text-xs font-normal text-gray-500 ml-1">/ person / day</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Estimated Total:</span>
              <span className="font-bold text-gray-800">{formatINR(tripTotals.low)}</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-400">
              Hostels, local dining, public transit
            </div>
          </div>

          {/* Mid Estimate Card (VISUALLY EMPHASIZED & RECOMMENDED) */}
          <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/40 p-3.5 sm:p-4 shadow-md relative ring-2 ring-amber-400/20">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase tracking-wider text-amber-900 text-[10px]">
                Mid Estimate
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-xs">
                ★ Recommended
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-black text-amber-950">
              {formatINR(dailyEstimates.mid)}
              <span className="text-xs font-medium text-amber-900 ml-1">/ person / day</span>
            </div>
            <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
              <span className="text-amber-900 font-medium">Estimated Total:</span>
              <span className="font-black text-amber-950">{formatINR(tripTotals.mid)}</span>
            </div>
            <div className="mt-1 text-[10px] text-amber-800 font-medium">
              Standard 3★ lodging (twin-sharing), casual dining, local sights
            </div>
          </div>

          {/* High Estimate Card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-3.5 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-gray-500 text-[10px]">
                High Estimate
              </span>
              <span className="text-[10px] text-gray-400">Premium Comfort</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-extrabold text-gray-900">
              {formatINR(dailyEstimates.high)}
              <span className="text-xs font-normal text-gray-500 ml-1">/ person / day</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Estimated Total:</span>
              <span className="font-bold text-gray-800">{formatINR(tripTotals.high)}</span>
            </div>
            <div className="mt-1 text-[10px] text-gray-400">
              4–5★ hotels, private cabs, upscale experiences
            </div>
          </div>
        </div>
      </div>

      {/* 4. Planned Budget Comparison Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Total Planned Budget
          </div>
          <div className="mt-1 text-base sm:text-lg font-extrabold text-gray-900">
            {formatINR(calc.totalBudget)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {safeGuests} {safeGuests === 1 ? "traveler" : "travelers"} · {safeDays} {safeDays === 1 ? "day" : "days"}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Available / Person / Day
          </div>
          <div className="mt-1 text-base sm:text-lg font-extrabold text-amber-700">
            {formatINR(calc.perPersonDailyBudget)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Group: {formatINR(calc.groupDailyBudget)} / day
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Estimated Standard
          </div>
          <div className="mt-1 text-base sm:text-lg font-extrabold text-gray-700">
            {formatINR(calc.estimatedStandardTotal)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Mid baseline: {formatINR(dailyEstimates.mid || 0)} / p / d
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Reference Variance
          </div>
          <div
            className={`mt-1 text-base sm:text-lg font-extrabold ${
              isSurplus ? "text-emerald-700" : isShortfall ? "text-amber-700" : "text-gray-700"
            }`}
          >
            {isSurplus
              ? `+${formatINR(difference)}`
              : isShortfall
              ? `-${formatINR(Math.abs(difference))}`
              : "₹0"}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {isSurplus ? "Estimated Surplus" : isShortfall ? "Estimated Shortfall" : "Balanced with standard"}
          </div>
        </div>
      </div>

      {/* 5. Comfort Guidance Summary */}
      <div className="mt-3.5 rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700">Guidance:</span>
          <span className="text-gray-600">{comfortMeta.summary}</span>
        </div>
      </div>

      {/* 6. Advisory Warnings (if any) */}
      {warnings && warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {warnings.map((w, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3 text-xs leading-relaxed ${
                w.severity === "success"
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : w.severity === "info"
                  ? "border-sky-200 bg-sky-50/80 text-sky-900"
                  : "border-amber-200 bg-amber-50/80 text-amber-900"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5">
                  {w.severity === "success" ? "✓" : w.severity === "info" ? "ℹ️" : "⚠️"}
                </span>
                <div>{w.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7. Expense Allocation Table & Proportions */}
      {showBreakdown && breakdown && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Estimated Standard Expense Allocation
            </h4>
            <span className="text-[11px] text-gray-400">Based on standard reference model</span>
          </div>

          {/* Group totals across categories */}
          {(() => {
            const groupTotal = breakdown.tripTotal || breakdown.partyTotal || {};
            return (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                {/* Accommodation */}
                <div className="rounded-xl border border-gray-100 bg-white/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>🏨 Stays (35%)</span>
                  </div>
                  <div className="mt-1 font-bold text-gray-900">
                    {formatINR(breakdown.dailyPerPerson?.accommodation)} <span className="text-[10px] text-gray-400 font-normal">/ p / d</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Group Total: {formatINR(groupTotal.accommodation)}
                  </div>
                </div>

                {/* Food */}
                <div className="rounded-xl border border-gray-100 bg-white/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>🍽️ Food (25%)</span>
                  </div>
                  <div className="mt-1 font-bold text-gray-900">
                    {formatINR(breakdown.dailyPerPerson?.food)} <span className="text-[10px] text-gray-400 font-normal">/ p / d</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Group Total: {formatINR(groupTotal.food)}
                  </div>
                </div>

                {/* Transport */}
                <div className="rounded-xl border border-gray-100 bg-white/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>🚖 Transit (15%)</span>
                  </div>
                  <div className="mt-1 font-bold text-gray-900">
                    {formatINR(breakdown.dailyPerPerson?.transport)} <span className="text-[10px] text-gray-400 font-normal">/ p / d</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Group Total: {formatINR(groupTotal.transport)}
                  </div>
                </div>

                {/* Activities */}
                <div className="rounded-xl border border-gray-100 bg-white/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>🎟️ Sights (15%)</span>
                  </div>
                  <div className="mt-1 font-bold text-gray-900">
                    {formatINR(breakdown.dailyPerPerson?.activities)} <span className="text-[10px] text-gray-400 font-normal">/ p / d</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Group Total: {formatINR(groupTotal.activities)}
                  </div>
                </div>

                {/* Buffer & Contingency (Replaced "Party" / "Buffer (10%)") */}
                <div className="rounded-xl border border-gray-100 bg-white/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                    <span>🛡️ Buffer & Contingency (10%)</span>
                  </div>
                  <div className="mt-1 font-bold text-gray-900">
                    {formatINR(breakdown.dailyPerPerson?.misc)} <span className="text-[10px] text-gray-400 font-normal">/ p / d</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Group Total: {formatINR(groupTotal.misc)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 8. Disclaimers */}
      {showDisclaimer && (
        <div className="mt-4 border-t border-gray-100 pt-3 text-[11px] text-gray-400 leading-relaxed">
          <p>
            ℹ️ <strong>Reference Model Notice:</strong> Figures are indicative estimates grounded in
            destination economic benchmarks. Accommodation estimates assume standard twin-sharing.
            Estimates include local lodging, food, inner-city transit, and sightseeing admissions;
            long-distance flights or express train tickets are excluded. Not a live price or booking quote.
          </p>
        </div>
      )}
    </div>
  );
}
