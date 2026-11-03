# Phase 5D.4 — Frontend Activity Metadata UI & Dashboard Integration Report

## 1. Executive Summary

Phase 5D.4 implements the frontend visualization and user interface for the canonical activity metadata contract established in Phases 5D.1–5D.3:

1. **`activityType`** (11 canonical categories: sightseeing, culture, adventure, nature, food, relaxation, shopping, nightlife, transport, accommodation, other)
2. **`durationMinutes`** (15–720 min, formatted cleanly as e.g. `45m`, `1h`, `1h 30m`, distinguishing confirmed visit durations from inferred estimates `~1h (est.)`)
3. **`travelMode`** (recommended transit mode from previous venue: walk, transit, drive, taxi, cycle, ferry, flight; `none` and `unknown` omitted)
4. **`intensity`** (physical exertion level: low, moderate, high with color-coded exertion pills)

All existing fields (`indoorOutdoor`, `cost`, and legacy `category` fallback) remain fully preserved.

---

## 2. Shared Component Architecture: `ActivityMetadataBadges`

Location: `frontend/src/components/ActivityMetadataBadges.jsx`

### Key Responsibilities & Capabilities:
- **Canonical Type Mapping**: Maps each of the 11 activity types to distinct icons, accessible labels, soft background tints, matching borders, and text colors.
- **Estimated vs. Confirmed Duration**: Formats duration into human-readable strings (`45m`, `1h 15m`). If `durationInferred` is true, renders an estimated badge (`~1h 15m (est.)`) with a dashed border and distinct tooltip. Inferred durations are **never** displayed as confirmed facts.
- **Directional Transit Mode**: Renders an arrow prefix (`→ 🚶 Walk`, `→ 🚌 Transit`, `→ 🚗 Drive`) with accessible aria-label and descriptive tooltip ("Recommended travel from prior stop: [Mode]"). Modes `none` and `unknown` are explicitly omitted.
- **Physical Exertion**: Renders traffic-light inspired badges (`🟢 Low`, `🟡 Moderate`, `🔴 High`) indicating exertion level.
- **Backward Compatibility**: If canonical `activityType` is missing on a legacy trip activity, gracefully falls back to displaying `activity.category`.
- **Zero-Layout Shift & Pure Rendering**: If an activity object has no valid metadata, returns `null`. The exported utility `hasActivityMetadata(activity)` allows parent wrappers to conditionally render card borders/headers without empty layout shifts.
- **Compact & Full Modes**: Supports `compact={true}` for modal previews (Fix Day) and card summaries (Dashboard), and `compact={false}` for the primary itinerary day timeline.

---

## 3. Page Integrations

### A. Itinerary Generation & Day Timeline (`frontend/src/pages/PlanTrip.jsx`)
- Replaced redundant, legacy inline pill blocks with `<ActivityMetadataBadges activity={activity} />`.
- Updated `handleTriggerPivot` state logic to ensure that replacement activity metadata (`activityType`, `durationMinutes`, `durationInferred: false`, `travelMode`, `intensity`) survives state updates and subsequent saves.
- Updated `getActivityForSlot` fallback logic so that legacy entries without duration do not fabricate a default `120m` duration.

### B. Fix Day Candidate Preview Modal (`frontend/src/pages/PlanTrip.jsx`)
- **Replacement Activity**: Displays `<ActivityMetadataBadges activity={slot.replacementActivity} />` with full badges ribbon beneath proposed replacement activity details.
- **Original Activity**: Displays `<ActivityMetadataBadges activity={slot.originalActivity} compact style={{ opacity: 0.75 }} />` to allow before/after comparison.
- **Unchanged / In-Progress Slots**: Displays `<ActivityMetadataBadges activity={slot.activity} compact />` for full day contextual awareness.

### C. Dashboard Saved Trips Cards (`frontend/src/pages/Dashboard.jsx`)
- In `TripCard`, parses `trip.aiPlan` safely (handling both parsed objects and serialized JSON strings).
- Extracts Day 1 preview activity and queries `hasActivityMetadata(previewActivity)`.
- If valid metadata exists, renders a compact highlight snippet with Day 1 badge and metadata pills.
- If `trip.aiPlan` is missing, null, or has no metadata (historical trips, manual trips), renders `null` with **zero layout shift**, no empty space, and no placeholders.

---

## 4. Frontend Test Infrastructure Notice & Manual Acceptance Checklist

### Notice Regarding Frontend Test Framework
In accordance with Step 7 of the specification:
The `frontend` package (`frontend/package.json`) uses React 19, Vite, and Tailwind CSS. No automated component testing framework (such as Jest or Vitest) is installed. Per project instructions ("Do not add an unnecessary test framework"), verification was performed via production Vite build verification and a comprehensive manual acceptance checklist.

### Manual Acceptance Checklist

| Test Scenario | Steps to Verify | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **1. Fresh Itinerary Generation** | 1. Navigate to `/plan`<br>2. Generate a 3-day itinerary for "Tokyo" | Activity cards in Day 1–3 show Type, Duration, Travel Mode, and Intensity badges with proper icons and tooltips. | Ready for browser check |
| **2. Inferred Duration Display** | Inspect activities where duration was not returned by LLM | Inferred duration displays with `~` prefix and `(est.)` tag (e.g. `~1h 30m (est.)`) with dashed border. Confirmed durations show solid border without `~`. | Verified in component logic |
| **3. Travel Mode Filtering** | Check activities with `none` or `unknown` travelMode | Badges for `none` or `unknown` are not rendered. Only valid modes (walk, transit, drive, etc.) render with `→ [icon] [label]`. | Verified in component logic |
| **4. Adaptive & Custom Pivot** | 1. Click "Pivot" on an activity<br>2. Select "Rainy Day" or enter custom reason | Replacement activity replaces slot and displays new metadata badges without losing metadata fields on subsequent save. | Verified in state handler |
| **5. Fix Day Candidate Preview** | 1. Open Fix Day modal for an overloaded day<br>2. Review Step 2 preview | Replaced slot shows original activity badges (compact/dimmed) and replacement badges. Unchanged slots show compact badges. | Verified in JSX integration |
| **6. Dashboard AI Plan Preview** | 1. Navigate to `/dashboard`<br>2. View saved AI trips | AI trips display Day 1 highlight snippet with compact metadata badges. | Verified in JSX integration |
| **7. Historical Trips Graceful Degradation** | View saved manual trips or legacy historical trips without metadata | Card displays normal destination/dates/pills without any empty boxes, broken lines, or layout shift. | Verified in logic |

---

## 5. Verification Results

- **Frontend Production Build**: `npm run build --prefix frontend` passed cleanly (19.36s, 0 errors).
- **Backend Test Suite**: `npm test --prefix backend` passed 100% (27/27 suites, 446/446 tests green).
- **Dependency Security**: `npm audit --omit=dev` reported 0 vulnerabilities in both frontend and backend.
- **Code Quality**: `git diff --check` passed cleanly with 0 whitespace or formatting errors.

