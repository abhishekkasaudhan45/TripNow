# TripNow Phase 5D.2 — Backend Activity Metadata Contract & Gemini Integration Report

**Implementation Status:** Complete & Verified  
**Date:** November 1, 2026  
**Role:** Senior Node.js Backend Engineer, Gemini Structured Output Specialist & Data Contract Architect  
**Project:** TripNow AI Travel Planner  

---

## 1. Executive Summary

Phase 5D.2 establishes the canonical backend metadata contract for travel itinerary activities across TripNow. Following the Phase 5D.1 architecture audit, this phase standardizes four core activity metadata fields:
1. `activityType` (semantic category enum)
2. `durationMinutes` (integer minutes, 15–720)
3. `travelMode` (transit mode from prior location or hotel)
4. `intensity` (physical exertion level: low, moderate, high)

All four fields are implemented as **optional and nullable** to guarantee 100% backward compatibility with historical itineraries. The implementation spans:
- Centralized normalization and safe fallbacks in `backend/utils/itineraryNormalizer.js`.
- Structured output schema definitions and prompt instructions in `backend/services/aiService.js`.
- Persistence validation in `backend/validators/bookingValidators.js` (`itineraryPersistenceSchema`).
- Comprehensive automated test coverage in `backend/tests/activityMetadataContract.test.js` (19 focused tests) and zero regression across all 26 backend test suites (**428/428 tests passing, 100% green**).

---

## 2. Canonical Metadata Contract

The canonical data contract is defined in `backend/utils/itineraryNormalizer.js` and imported across services, controllers, and validators:

### A. Activity Type (`activityType`)
- **Type:** `String` (machine-readable enum) | `null`
- **Allowed Values:**
  - `sightseeing` — Landmark visits, monuments, scenic viewpoints, iconic attractions
  - `culture` — Museums, historical sites, heritage walks, religious/artistic venues
  - `adventure` — Trekking, water sports, thrill rides, active excursions
  - `nature` — National parks, beaches, botanical gardens, wildlife, scenic trails
  - `food` — Cafés, street food tours, restaurants, culinary tastings
  - `relaxation` — Spa, wellness, scenic resting spots, leisurely park visits
  - `shopping` — Markets, bazaars, shopping districts, artisan crafts
  - `nightlife` — Evening entertainment, live music, night markets, social lounges
  - `transport` — Ferries, cable cars, scenic trains, transit journeys
  - `accommodation` — Check-in, hotel settling, resort amenities
  - `other` — Miscellaneous activities not matching standard categories
- **Normalization Rule:** Trims and lowercases input. If present in `ALLOWED_ACTIVITY_TYPES`, returns the canonical string; otherwise returns `null`. **Never fabricates an arbitrary category (e.g. `sightseeing`) for missing or invalid data.**

### B. Duration (`durationMinutes`)
- **Type:** `Number` (integer minutes) | `null`
- **Valid Range:** `15` to `720` (15 minutes to 12 hours)
- **Semantic Definition:** Represents planned time spent experiencing the activity at the venue. Strictly does **not** include travel/transit time to reach the activity.
- **Normalization Rule:** Accepts positive integers between 15 and 720. If `durationMinutes` is undefined, safely inspects `estimatedDurationMinutes` for Pivot compatibility. Non-integers, negative numbers, zero, values below 15, or values above 720 normalize to `null`.
- **Inferred Semantics:** `durationInferred` remains `true` only when duration was previously inferred (such as legacy block synthesis), and is `false` when explicit duration is provided.

### C. Travel Mode (`travelMode`)
- **Type:** `String` (machine-readable enum) | `null`
- **Allowed Values:**
  - `walking` — Pedestrian route on foot
  - `public_transport` — Metro, subway, bus, tram, local train
  - `driving` — Personal or rental car
  - `taxi` — Ride-hailing, cab, auto-rickshaw
  - `cycling` — Bicycle, e-bike
  - `ferry` — Boat, water taxi, ferry crossing
  - `flight` — Domestic or regional air transit
  - `none` — On-site activity or no transit required
  - `unknown` — Unspecified or indeterminate
- **Semantic Definition:** Recommended transit mode to reach this activity from the previous stop or lodging. For the first activity of the day (morning), lodging/hotel serves as the reference point. For activities at the same venue, `none` is used.
- **Normalization Rule:** Trims and lowercases input. If in `ALLOWED_TRAVEL_MODES`, returns the string; otherwise returns `null`. **Never fabricates `"walking"` for missing or invalid data.**

### D. Intensity (`intensity`)
- **Type:** `String` (machine-readable enum) | `null`
- **Allowed Values:**
  - `low` — Minimal physical exertion (dining, river cruise, theater, beach relaxation)
  - `moderate` — Standard active walking and moderate movement (city walking tour, large museum, market)
  - `high` — High physical effort or sustained stamina (mountain hiking, steep stairs, cycling tour, water sports)
- **Semantic Definition:** Strictly measures **physical effort/exertion**, completely decoupled from cost, popularity, or emotional excitement.
- **Normalization Rule:** Trims and lowercases input. If in `ALLOWED_INTENSITIES`, returns the string; otherwise returns `null`. **Never fabricates `"moderate"` for missing or invalid data.**

---

## 3. Gemini Prompt & Schema Integration

`backend/services/aiService.js` was updated to incorporate the four metadata fields directly into the structured output schema and generation prompt without requiring secondary API calls:

### A. Structured Schema Update (`itinerarySchema`)
The `days.items.properties` schema was extended with an `activities` array containing:
```javascript
activities: {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      period: { type: Type.STRING, enum: ["morning", "afternoon", "evening"] },
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      activityType: { type: Type.STRING, enum: ALLOWED_ACTIVITY_TYPES },
      durationMinutes: { type: Type.INTEGER },
      travelMode: { type: Type.STRING, enum: ALLOWED_TRAVEL_MODES },
      intensity: { type: Type.STRING, enum: ALLOWED_INTENSITIES },
    },
    required: ["period", "title", "description"],
  },
}
```
- `period`, `title`, and `description` are required for each activity.
- `activityType`, `durationMinutes`, `travelMode`, and `intensity` are optional in the schema, allowing Gemini to omit fields or provide null when uncertain.
- In `days.items.required`, legacy block fields (`morning`, `afternoon`, `evening`, `food`) remain required, ensuring existing tests and legacy consumers remain completely unbroken.

### B. Prompt Instructions (`buildItineraryPrompt`)
When generating an itinerary from travel parameters, explicit instructions guide Gemini:
- Provides 3 structured activities matching morning, afternoon, and evening slots.
- Specifies allowed enum tokens for `activityType`, `travelMode`, and `intensity`.
- Constrains `durationMinutes` to realistic integers between 15 and 720.
- Clarifies that `travelMode` references the hotel for morning activities and `"none"` for on-site stops.
- Instructs Gemini to omit metadata or return null instead of guessing.
- Preserves passthrough behavior when a custom user prompt is provided (`if (prompt) return prompt;`).

---

## 4. Persistence Validation

In `backend/validators/bookingValidators.js`, `itineraryPersistenceSchema` was strengthened:
- Added `activitySchema` with strict Zod enum validations for `activityType`, `travelMode`, and `intensity`.
- Added integer range validation for `durationMinutes` (`.min(15).max(720)`).
- Validates both structured object payloads (`{ days: [{ activities: [...] }] }`) and JSON string payloads.
- Rejects invalid enum values or out-of-range durations with HTTP 400 Bad Request.
- Allows missing or null metadata without errors (`.optional().nullable()`), ensuring historical bookings remain 100% savable and readable.

---

## 5. Backward Compatibility & Non-Destructive Principles

1. **No Database Rewrite:** Existing MongoDB `Booking` documents were not altered or migrated.
2. **Missing Metadata Tolerance:** Historical activities without metadata normalize with `null` fields. No fabricated values (`sightseeing`, `120`, `walking`, `moderate`) are injected.
3. **Preservation of Unrelated Properties:** `itineraryNormalizer.js` uses object spread (`...act`) so custom properties (e.g. `insiderTip`, `customTags`, `notes`) are preserved.
4. **Locking & Concurrency Invariants:** Optimistic concurrency control (`__v`) and locked activity protections (HTTP 423) operate identically.

---

## 6. Test Suite & Verification Results

A new focused test suite was authored in `backend/tests/activityMetadataContract.test.js`:
- **Test 1:** Valid activity metadata normalization and casing handling.
- **Test 2:** Invalid `activityType` rejection & nullification without fallback fabrication.
- **Test 3:** Invalid `durationMinutes` rejection (negative, zero, <15, >720, fractional, string).
- **Test 4:** Invalid `travelMode` rejection & nullification.
- **Test 5:** Invalid `intensity` rejection & nullification.
- **Test 6:** Missing metadata normalization (defaults to `null`).
- **Test 7:** Null metadata preservation.
- **Test 8:** Historical activity with no metadata compatibility.
- **Test 9:** `durationInferred` semantics preservation and `estimatedDurationMinutes` mapping.
- **Test 10:** Preservation of unrelated activity fields.
- **Test 11:** Initial Gemini response with metadata and schema adherence.
- **Test 12:** Invalid Gemini metadata normalization to `null`.
- **Test 13:** Persistence API verification (valid save, invalid `activityType` 400, invalid `durationMinutes` 400).
- **Test 14:** Lock protection (423) and optimistic concurrency conflict (409) preservation.

### Full Regression Results
- **New Test Suite:** 19/19 tests passed (`tests/activityMetadataContract.test.js`).
- **Full Backend Test Run:** **26 passed suites, 428 passed tests (100% green)**.
- **Dependencies Audit:** `found 0 vulnerabilities` (`npm audit --omit=dev --prefix backend`).
- **Git Hygiene:** `git diff --check` passed cleanly with 0 whitespace issues.

---

## 7. Deferred Work for Phase 5D.3

The following tasks are explicitly scheduled for Phase 5D.3:
1. **Adaptive & Custom Pivot:** Update `backend/services/pivotService.js` (`PIVOT_CANDIDATE_SCHEMA` and replacement mapping) to generate and preserve `activityType`, `durationMinutes`, `travelMode`, and `intensity`.
2. **Fix Day Proposal & Apply:** Update `backend/services/fixDayService.js` (`FIX_DAY_CANDIDATE_SCHEMA`, prompt, HMAC proposal token signing, and `isLockedActivityUnchanged`) to include the four metadata fields.
3. **Locked Activity Deep Comparison:** Update `isLockedActivityUnchanged` and `bookingController.updateItinerary` to verify locked activity metadata immutability.

