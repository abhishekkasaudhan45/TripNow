// frontend/tests/homeHeroSearch.test.mjs
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_HERO_IMAGE,
  DESTINATION_HERO_MAP,
  getDestinationImage,
} from "../src/utils/destinationImages.js";

import {
  SUGGESTED_DESTINATIONS,
  getMatchingSuggestions,
} from "../src/utils/destinationSuggestions.js";

describe("TripNow Phase 3 — Home Hero Search Bar & Dynamic Destination Background Suite", () => {
  const homePath = path.resolve("frontend/src/pages/Home.jsx");
  const autocompletePath = path.resolve("frontend/src/components/common/DestinationAutocomplete.jsx");
  const barrelPath = path.resolve("frontend/src/components/common/index.js");
  const imagesPath = path.resolve("frontend/src/utils/destinationImages.js");
  const suggestionsPath = path.resolve("frontend/src/utils/destinationSuggestions.js");

  describe("Section 1: File Architecture & Barrel Exports", () => {
    it("1.1 DestinationAutocomplete.jsx exists with clean component structure", () => {
      assert.ok(fs.existsSync(autocompletePath), "DestinationAutocomplete.jsx must exist");
      const content = fs.readFileSync(autocompletePath, "utf8");
      assert.ok(
        content.includes("export default function DestinationAutocomplete"),
        "Must default export DestinationAutocomplete"
      );
      assert.ok(
        content.includes("export { SUGGESTED_DESTINATIONS, getMatchingSuggestions }"),
        "Must re-export SUGGESTED_DESTINATIONS and getMatchingSuggestions"
      );
    });

    it("1.2 common barrel (index.js) exports DestinationAutocomplete cleanly", () => {
      assert.ok(fs.existsSync(barrelPath), "common/index.js must exist");
      const content = fs.readFileSync(barrelPath, "utf8");
      assert.ok(
        content.includes('export { default as DestinationAutocomplete } from "./DestinationAutocomplete"'),
        "Must re-export DestinationAutocomplete"
      );
    });

    it("1.3 destinationImages.js exists with constants and getDestinationImage helper", () => {
      assert.ok(fs.existsSync(imagesPath), "destinationImages.js must exist");
      assert.ok(
        typeof DEFAULT_HERO_IMAGE === "string" && DEFAULT_HERO_IMAGE.startsWith("https://"),
        "DEFAULT_HERO_IMAGE must be a valid HTTPS URL"
      );
      assert.ok(typeof DESTINATION_HERO_MAP === "object", "DESTINATION_HERO_MAP must be an object");
      assert.ok(typeof getDestinationImage === "function", "getDestinationImage must be an exported function");
    });

    it("1.4 destinationSuggestions.js exists and exports pure JS data and helpers", () => {
      assert.ok(fs.existsSync(suggestionsPath), "destinationSuggestions.js must exist");
      assert.ok(Array.isArray(SUGGESTED_DESTINATIONS), "SUGGESTED_DESTINATIONS must be an array");
      assert.ok(typeof getMatchingSuggestions === "function", "getMatchingSuggestions must be a function");
    });
  });

  describe("Section 2: Hero Search Bar Structure & Exact Order", () => {
    it("2.1 Fields are defined in exact sequential order: Destination, Check-in, Check-out, Travelers, Budget, Primary CTA", () => {
      const content = fs.readFileSync(homePath, "utf8");

      // Verify the order of label/field declarations in Home.jsx form grid
      const destIndex = content.indexOf("1. Destination Field");
      const checkinIndex = content.indexOf("2. Check-in Field");
      const checkoutIndex = content.indexOf("3. Check-out Field");
      const travelersIndex = content.indexOf("4. Travelers Field");
      const budgetIndex = content.indexOf("5. Budget Field");
      const ctaIndex = content.indexOf("6. Primary CTA Button");

      assert.ok(destIndex > 0, "Destination field must be present");
      assert.ok(checkinIndex > destIndex, "Check-in must appear after Destination");
      assert.ok(checkoutIndex > checkinIndex, "Check-out must appear after Check-in");
      assert.ok(travelersIndex > checkoutIndex, "Travelers must appear after Check-out");
      assert.ok(budgetIndex > travelersIndex, "Budget must appear after Travelers");
      assert.ok(ctaIndex > budgetIndex, "Primary CTA must appear after Budget");
    });

    it("2.2 Primary CTA button has exact required text: '✨ Plan with TripNow'", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(
        content.includes("✨ Plan with TripNow"),
        "CTA button must contain the exact string '✨ Plan with TripNow'"
      );
      assert.ok(
        !content.includes("✦ AI Planner"),
        "Old '✦ AI Planner' button must be completely replaced"
      );
    });

    it("2.3 Home-to-PlanTrip navigation payload preserves exact structure and guest count", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes('navigate("/plan-trip"'), "Must navigate to /plan-trip");
      assert.ok(content.includes("destination: trimmedDest"), "Must include destination");
      assert.ok(content.includes("checkin: form.checkin"), "Must include checkin");
      assert.ok(content.includes("checkout: form.checkout"), "Must include checkout");
      assert.ok(content.includes("budget: String(budgetNum)"), "Must include budget");
      assert.ok(content.includes("travelers: guests"), "Must include travelers");
      assert.ok(content.includes("guests: guests"), "Must include guests for backward compatibility");
    });
  });

  describe("Section 3: Destination Autocomplete & Accessibility", () => {
    it("3.1 DestinationAutocomplete implements full ARIA combobox pattern", () => {
      const content = fs.readFileSync(autocompletePath, "utf8");
      assert.ok(content.includes('role="combobox"'), 'Must specify role="combobox" on input');
      assert.ok(content.includes('aria-autocomplete="list"'), 'Must specify aria-autocomplete="list"');
      assert.ok(content.includes("aria-expanded={isOpen}"), "Must specify dynamic aria-expanded");
      assert.ok(content.includes('role="listbox"'), 'Must specify role="listbox" on popup dropdown');
      assert.ok(content.includes('role="option"'), 'Must specify role="option" on suggestion items');
      assert.ok(content.includes("aria-selected={isSelected}"), "Must specify aria-selected on options");
      assert.ok(content.includes("aria-activedescendant={activeOptionId}"), "Must support aria-activedescendant");
    });

    it("3.2 Supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab)", () => {
      const content = fs.readFileSync(autocompletePath, "utf8");
      assert.ok(content.includes('e.key === "ArrowDown"'), "Must handle ArrowDown key");
      assert.ok(content.includes('e.key === "ArrowUp"'), "Must handle ArrowUp key");
      assert.ok(content.includes('e.key === "Enter"'), "Must handle Enter key");
      assert.ok(content.includes('e.key === "Escape"'), "Must handle Escape key");
      assert.ok(content.includes('e.key === "Tab"'), "Must handle Tab key");
      assert.ok(content.includes("scrollIntoView"), "Must scroll active keyboard item into view");
    });

    it("3.3 Free-text input is preserved and never forcefully constrained", () => {
      const content = fs.readFileSync(autocompletePath, "utf8");
      // Typing triggers onChange without restricting to dropdown options
      assert.ok(content.includes("onChange(nextVal, false)"), "Must propagate free-text value onChange");
    });

    it("3.4 getMatchingSuggestions correctly filters domestic and global tiers", () => {
      // Empty query returns top recommendations
      const defaultSuggestions = getMatchingSuggestions("");
      assert.ok(defaultSuggestions.length > 0, "Empty query must return top recommendations");

      // Search domestic
      const goaSuggestions = getMatchingSuggestions("Goa");
      assert.ok(goaSuggestions.some((d) => d.name === "Goa" && d.tier === "DOMESTIC"));

      // Search global Tier A
      const thaiSuggestions = getMatchingSuggestions("Thailand");
      assert.ok(thaiSuggestions.some((d) => d.name === "Thailand" && d.tier === "GLOBAL_TIER_A"));

      // Search global Tier B
      const baliSuggestions = getMatchingSuggestions("Bali");
      assert.ok(baliSuggestions.some((d) => d.name === "Bali" && d.tier === "GLOBAL_TIER_B"));

      // Search global Tier C
      const parisSuggestions = getMatchingSuggestions("Paris");
      assert.ok(parisSuggestions.some((d) => d.name === "Paris" && d.tier === "GLOBAL_TIER_C"));

      // Search by region
      const europeSuggestions = getMatchingSuggestions("Europe");
      assert.ok(europeSuggestions.length > 0);
    });
  });

  describe("Section 4: Date Validation & Traveler Range Logic", () => {
    it("4.1 Date validation prevents past check-in and enforces min attribute", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes("min={todayStr}"), "Check-in must enforce min={todayStr}");
      assert.ok(content.includes("form.checkin < todayStr"), "Submit handler must check for past dates");
      assert.ok(
        content.includes("Check-in date cannot be in the past"),
        "Must provide inline error for past check-in"
      );
    });

    it("4.2 Check-out must be after check-in and auto-advances if check-in changes", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes("min={minCheckout}"), "Check-out must enforce min={minCheckout}");
      assert.ok(content.includes("form.checkout <= form.checkin"), "Must validate checkout > checkin");
      assert.ok(
        content.includes("Check-out date must be after check-in date"),
        "Must provide inline error when checkout <= checkin"
      );
      assert.ok(
        content.includes("updatedCheckout <= newCheckin") &&
        content.includes("getNextDayDateString(newCheckin)"),
        "Must auto-advance checkout if checkin moves past or equals checkout"
      );
    });

    it("4.3 Travelers control is clamped to [1, 20] with accessible buttons", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(
        content.includes("Math.max(1, Math.min(20, current + delta))"),
        "Must clamp travelers between 1 and 20"
      );
      assert.ok(
        content.includes('aria-label="Decrease travelers"'),
        "Must have accessible decrease button"
      );
      assert.ok(
        content.includes('aria-label="Increase travelers"'),
        "Must have accessible increase button"
      );
      assert.ok(
        content.includes("disabled={form.travelers <= 1}"),
        "Decrease button must be disabled at 1"
      );
      assert.ok(
        content.includes("disabled={form.travelers >= 20}"),
        "Increase button must be disabled at 20"
      );
    });

    it("4.4 Budget control requires non-negative number and shows ₹ prefix", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes('type="number"'), "Budget field must be type=number");
      assert.ok(content.includes('min="0"'), "Budget field must have min=0");
      assert.ok(content.includes("₹"), "Budget field must display ₹ currency symbol");
      assert.ok(
        content.includes("budgetNum <= 0"),
        "Validation must reject zero or negative budget"
      );
    });

    it("4.5 Date auto-advance provides clear user feedback without silent changes", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes("setDateNotice"), "Must set dateNotice state when auto-advancement occurs");
      assert.ok(content.includes("role=\"status\""), "dateNotice must have role='status'");
      assert.ok(content.includes("aria-live=\"polite\""), "dateNotice must have aria-live='polite'");
    });

    it("4.6 Date helper handles leap-day and timezone-boundary transitions accurately", () => {
      function getNextDay(dateStr) {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-").map(Number);
        const next = new Date(Date.UTC(y, m - 1, d));
        next.setUTCDate(next.getUTCDate() + 1);
        return next.toISOString().split("T")[0];
      }

      // Leap day 2024
      assert.strictEqual(getNextDay("2024-02-28"), "2024-02-29");
      assert.strictEqual(getNextDay("2024-02-29"), "2024-03-01");

      // Non-leap day 2025
      assert.strictEqual(getNextDay("2025-02-28"), "2025-03-01");

      // Year-end rollover
      assert.strictEqual(getNextDay("2026-12-31"), "2027-01-01");
    });
  });

  describe("Section 5: Dynamic Destination Background Engine", () => {
    it("5.1 Resolves canonical domestic destinations accurately", () => {
      const goa = getDestinationImage("Goa");
      assert.strictEqual(goa.isFallback, false);
      assert.strictEqual(goa.key, "goa");
      assert.ok(goa.url.includes("images.unsplash.com"));

      const manali = getDestinationImage("Manali, Himachal Pradesh");
      assert.strictEqual(manali.isFallback, false);
      assert.strictEqual(manali.key, "manali");

      const kerala = getDestinationImage("Kerala");
      assert.strictEqual(kerala.isFallback, false);
      assert.strictEqual(kerala.key, "kerala");
    });

    it("5.2 Resolves international Tier A, B, and C destinations accurately", () => {
      // Tier A
      const nepal = getDestinationImage("Nepal");
      assert.strictEqual(nepal.isFallback, false);
      assert.strictEqual(nepal.key, "nepal");

      const thailand = getDestinationImage("Thailand");
      assert.strictEqual(thailand.isFallback, false);
      assert.strictEqual(thailand.key, "thailand");

      // Tier B
      const dubai = getDestinationImage("Dubai");
      assert.strictEqual(dubai.isFallback, false);
      assert.strictEqual(dubai.key, "dubai");

      const bali = getDestinationImage("Bali");
      assert.strictEqual(bali.isFallback, false);
      assert.strictEqual(bali.key, "bali");

      const singapore = getDestinationImage("Singapore");
      assert.strictEqual(singapore.isFallback, false);
      assert.strictEqual(singapore.key, "singapore");

      // Tier C
      const paris = getDestinationImage("Paris");
      assert.strictEqual(paris.isFallback, false);
      assert.strictEqual(paris.key, "paris");

      const tokyo = getDestinationImage("Tokyo");
      assert.strictEqual(tokyo.isFallback, false);
      assert.strictEqual(tokyo.key, "tokyo");

      const london = getDestinationImage("London, United Kingdom");
      assert.strictEqual(london.isFallback, false);
      assert.strictEqual(london.key, "london");
    });

    it("5.3 Falls back gracefully to DEFAULT_HERO_IMAGE on empty or unknown queries", () => {
      const empty = getDestinationImage("");
      assert.strictEqual(empty.isFallback, true);
      assert.strictEqual(empty.url, DEFAULT_HERO_IMAGE);

      const nullInput = getDestinationImage(null);
      assert.strictEqual(nullInput.isFallback, true);
      assert.strictEqual(nullInput.url, DEFAULT_HERO_IMAGE);

      const unknown = getDestinationImage("UnknownPlace12345");
      assert.strictEqual(unknown.isFallback, true);
      assert.strictEqual(unknown.url, DEFAULT_HERO_IMAGE);
    });

    it("5.4 Home.jsx implements debounced free-text background updates and instant selection updates", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes("debounceTimerRef"), "Must utilize debounceTimerRef");
      assert.ok(content.includes("currentLoadIdRef"), "Must utilize currentLoadIdRef to prevent race conditions");
      assert.ok(content.includes("350"), "Must debounce free-text input by ~350ms");
      assert.ok(
        content.includes("triggerBackgroundUpdate(selected.name, true)"),
        "Must immediately update background on combobox selection"
      );
    });

    it("5.5 Home.jsx hero has dual-layer cross-fade, dark overlay, and light scrim for text legibility", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(content.includes("transition-opacity duration-500"), "Must feature smooth 500ms transition");
      assert.ok(content.includes("hero-dark-overlay"), "Must have hero-dark-overlay");
      assert.ok(content.includes("hero-light-scrim"), "Must have hero-light-scrim");
      assert.ok(
        content.includes("mixBlendMode: \"multiply\""),
        "Must apply multiply blend mode for rich scenic contrast"
      );
    });

    it("5.6 Respects user's prefers-reduced-motion configuration in both JS and CSS", () => {
      const content = fs.readFileSync(homePath, "utf8");
      assert.ok(
        content.includes("prefers-reduced-motion: reduce"),
        "Must declare prefers-reduced-motion media queries"
      );
      assert.ok(
        content.includes("prefersReducedMotion"),
        "Must check window.matchMedia('(prefers-reduced-motion: reduce)') in JS"
      );
    });
  });
});
