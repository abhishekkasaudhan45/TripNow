# TripNow Phase 5E.2 — Deterministic Budget Intelligence Engine Report

**Phase:** Phase 5E.2 — Baseline Matrix & Deterministic Budget Intelligence Engine  
**Date:** November 1, 2026  
**Status:** Successfully Implemented & Verified  
**Role:** Senior Node.js/Express Architect, React Engineer & Financial Calculation Engine Specialist  

---

## 1. Executive Summary

Phase 5E.2 delivers the foundational, pure-function mathematical engine for TripNow's **Deterministic Budget Intelligence**. 

Previously, TripNow relied on Google Gemini generative AI prompts to produce static itinerary `budgetBreakdown` blocks, while the frontend cost-splitting modal applied static percentages (30/35/20/10/5 %) that ignored trip duration, destination economics, and baseline sufficiency.

In Phase 5E.2, we established:
1. **Four Economic Tiers:** `TIER_1_METRO`, `TIER_2_RESORT`, `TIER_3_BUDGET`, and `TIER_4_INTERNATIONAL`, plus an explicit `UNKNOWN` designation.
2. **Configurable Reference Baseline Matrix:** In INR per person per day with strict twin-sharing accommodation assumptions and an exact 100% component proportion breakdown.
3. **Pure Backend Calculation Engine (`backend/services/budgetIntelligence/`):** Pure synchronous calculation without database, network, or LLM access.
4. **Pure Frontend Calculation Utility (`frontend/src/utils/budgetIntelligence.js`):** ESM implementation with 100% semantic parity with the backend.
5. **Rigorous Automated Testing:** 27 backend Jest tests + 6 frontend Node tests passing with zero failures. Existing 28 backend test suites (455 tests) remain 100% green.

---

## 2. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │ User Input Contract                    │
                      │ { totalBudget, days, guests, dest, cc }│
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │ 1. Strict Validation Engine              │
                     │  - totalBudget > 0, finite number        │
                     │  - days, guests are positive integers    │
                     │  - destination is non-empty string       │
                     │  - No default mutation (no silent 1s)    │
                     └───────────────────┬──────────────────────┘
                                         │ Valid
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │ 2. Currency Normalization & Safety       │
                     │  - Approved: INR (₹)                     │
                     │  - Other: UNSUPPORTED_CURRENCY           │
                     └───────────────────┬──────────────────────┘
                                         │ INR
                                         ▼
                     ┌──────────────────────────────────────────┐
                     │ 3. Destination Tier Resolver             │
                     │  - Word-boundary token / alias lookup    │
                     │  - Anti-collision matching               │
                     │  - Resolves tier & isInternational flag  │
                     └───────────────────┬──────────────────────┘
                                         │
                ┌────────────────────────┴────────────────────────┐
                ▼                                                 ▼
     ┌────────────────────────┐                        ┌───────────────────────┐
     │ International or       │                        │ Domestic Known Tier   │
     │ Unknown Destination    │                        │ (Tiers 1, 2, 3)       │
     │ - BASELINE_NOT_CONFIG  │                        │                       │
     │ - UNKNOWN_DESTINATION  │                        └──────────┬────────────┘
     │ - No misleading stats  │                                   │
     └────────────────────────┘                                   ▼
                                                      ┌────────────────────────┐
                                                      │ 4. Deterministic Math  │
                                                      │  - Per-person daily    │
                                                      │  - Group daily         │
                                                      │  - Standard total      │
                                                      │  - Sufficiency ratio   │
                                                      │  - Comfort category    │
                                                      │  - Category breakdown  │
                                                      │  - Advisory warnings   │
                                                      └────────────────────────┘
```

---

## 3. Destination Economic Tier Mapping

The application categorizes destinations into exactly four distinct economic tiers, plus an unclassified `UNKNOWN` tier:

| Tier Identifier | Economic Classification | Key Domestic / Regional Examples | International Examples | Baseline Status |
| :--- | :--- | :--- | :--- | :--- |
| **`TIER_1_METRO`** | High-cost domestic metropolitan centers | Mumbai, Delhi NCR (New Delhi, Gurgaon, Noida), Bengaluru, Kolkata, Chennai, Hyderabad, Pune, Ahmedabad | None (Never classify international as domestic metro) | **APPROVED (INR)** |
| **`TIER_2_RESORT`** | Beach, island, and luxury resort destinations | Goa, Andaman & Nicobar (Havelock, Port Blair), Lakshadweep, Puducherry, Daman, Diu, Alibaug, Gokarna | Bali, Phuket, Maldives, Koh Samui, Mauritius, Cancun, Hawaii, Fiji, Santorini (`isInternational: true`) | **Domestic: APPROVED (INR)**<br/>**Int'l: NOT CONFIGURED** |
| **`TIER_3_BUDGET`** | Budget-oriented hills, heritage, and regional destinations | Manali, Shimla, Rishikesh, Jaipur, Udaipur, Darjeeling, Varanasi, Kashmir, Ladakh, Kerala, Ooty, Nainital, Mussoorie, Agra, Amritsar, Pushkar, Hampi, Dharamshala | None | **APPROVED (INR)** |
| **`TIER_4_INTERNATIONAL`** | General international destinations | None | Tokyo, London, Paris, New York, Singapore, Dubai, Rome, Bangkok, Sydney, Amsterdam, Hong Kong, San Francisco | **NOT YET APPROVED** |
| **`UNKNOWN`** | Unrecognized destinations | Any destination not in registry | Any unlisted international location | **NOT APPLICABLE** |

### Collision-Safe Matching Rules
To prevent partial substring collisions:
- Normalized inputs are matched against whole alias phrases using word-boundary matching (`(?:^|\s)alias(?:\s|$)`).
- Collision examples prevented:
  - `Andaman` vs `Daman`: "Andaman" maps to `Andaman and Nicobar` (`TIER_2_RESORT`), never confusing with "Daman".
  - `Agra` vs `Niagara`: "Niagara Falls" returns `UNKNOWN`, never erroneously mapping to "Agra".
  - `Goa` vs `Goalkeeping`: "Goalkeeping Camp" returns `UNKNOWN`, never matching "Goa".
- **No Silent Domestic Fallback:** Unknown destinations return `tier: "UNKNOWN"` with an informative warning (`UNKNOWN_DESTINATION`). They are never silently categorized into Tier 3.

---

## 4. Configurable Baseline Matrix

> [!NOTE]
> **Reference Estimates Disclaimer:** All baseline figures are configurable reference anchors for budget feasibility calculation. They are NOT real-time commercial quotes or guaranteed market prices. Accommodation components assume twin-sharing room occupancy ($\text{Room Rate} \div 2$). Intercity airfare and long-distance trains are explicitly excluded.

### Initial Reference Anchors (in INR per person per day)

| Tier | Budget (Backpacker / Hostel) | Standard (3-Star / Balanced) | Premium (4/5-Star / Luxury) | Status |
| :--- | :---: | :---: | :---: | :--- |
| **`TIER_1_METRO`** | ₹2,000 | **₹5,300** | ₹13,300 | Configured |
| **`TIER_2_RESORT`** (Domestic) | ₹1,800 | **₹5,000** | ₹12,500 | Configured |
| **`TIER_3_BUDGET`** | ₹1,250 | **₹3,250** | ₹8,300 | Configured |
| **`TIER_4_INTERNATIONAL`** | `null` | `null` | `null` | **NOT YET APPROVED** |

### Configurable Category Proportions
Category splits are defined as configurable percentages that sum to exactly 1.00 (100%):

$$\text{Accommodation (twin-sharing)}: 35\% \quad | \quad \text{Food}: 25\% \quad | \quad \text{Transport}: 15\% \quad | \quad \text{Activities}: 15\% \quad | \quad \text{Misc Buffer}: 10\%$$

*Proportions sum verification:* $0.35 + 0.25 + 0.15 + 0.15 + 0.10 = 1.00$.

---

## 5. Mathematical Formulas & Classification

1. **Per-Person Daily Budget ($B_{\text{ppd}}$):**
   $$B_{\text{ppd}} = \text{Math.round}\left(\frac{\text{totalBudget}}{\text{guests} \times \text{days}}\right)$$

2. **Group Daily Budget ($B_{\text{gpd}}$):**
   $$B_{\text{gpd}} = \text{Math.round}\left(\frac{\text{totalBudget}}{\text{days}}\right)$$

3. **Estimated Standard Total ($C_{\text{std}}$):**
   $$C_{\text{std}} = \text{Math.round}(\text{standardDailyBaseline} \times \text{guests} \times \text{days})$$

4. **Standard Budget Difference ($\Delta_{\text{std}}$):**
   $$\Delta_{\text{std}} = \text{Math.round}(\text{totalBudget} - C_{\text{std}})$$
   - $\Delta_{\text{std}} \ge 0$: Budget surplus over standard baseline.
   - $\Delta_{\text{std}} < 0$: Budget shortfall against standard baseline.

5. **Sufficiency Ratio ($R_{\text{suff}}$):**
   $$R_{\text{suff}} = \text{Number}\left(\left(\frac{B_{\text{ppd}}}{\text{standardDailyBaseline}}\right).\text{toFixed}(4)\right)$$

6. **Comfort Classification Thresholds:**
   - **`low`**: $R_{\text{suff}} < 0.75$ (Hostels, public transit, local street food advised).
   - **`moderate`**: $0.75 \le R_{\text{suff}} < 1.50$ (Standard 3-star stays, cabs, casual dining).
   - **`high`**: $R_{\text{suff}} \ge 1.50$ (Premium 4/5-star resorts, private chauffeur, fine dining).

---

## 6. Input / Output Contracts

### Input Contract
```typescript
interface BudgetIntelligenceInput {
  totalBudget: number | string; // Positive finite number (> 0)
  days: number;                // Positive integer (> 0)
  guests: number;              // Positive integer (> 0)
  destination: string;         // Non-empty string
  currency?: string;           // Optional, default "INR"
}
```

### Output Contract
```typescript
interface BudgetIntelligenceResult {
  status: "CALCULATED" | "BASELINE_NOT_CONFIGURED" | "UNSUPPORTED_CURRENCY" | "UNKNOWN_DESTINATION" | "INVALID_INPUT";
  tier: "TIER_1_METRO" | "TIER_2_RESORT" | "TIER_3_BUDGET" | "TIER_4_INTERNATIONAL" | "UNKNOWN";
  currency: string;
  totalBudget: number | null;
  days: number | null;
  guests: number | null;
  perPersonDailyBudget: number | null;
  groupDailyBudget: number | null;
  estimatedStandardTotal: number | null;
  standardBudgetDifference: number | null;
  sufficiencyRatio: number | null;
  category: "low" | "moderate" | "high" | null;
  breakdown: {
    dailyPerPerson: { accommodation: number; food: number; transport: number; activities: number; misc: number; total: number };
    tripTotal: { accommodation: number; food: number; transport: number; activities: number; misc: number; total: number };
    proportions: Record<string, number>;
    assumptions: Record<string, string>;
  } | null;
  warnings: Array<{ code: string; severity: "info" | "warning" | "success"; message: string }>;
  validationErrors: string[];
}
```

---

## 7. Currency Safety

- In Phase 5E.2, calculations run **only for INR (`₹`)**.
- If a user passes `USD`, `EUR`, `GBP`, `JPY`, or any other currency:
  - Returns `status: "UNSUPPORTED_CURRENCY"`.
  - Attaches `code: "UNSUPPORTED_CURRENCY"` warning.
  - Returns `null` for `estimatedStandardTotal`, `sufficiencyRatio`, `category`, and `breakdown`.
- **Zero Live Currency API Calls:** Does not assume hardcoded exchange rates that may drift or fail.

---

## 8. Extensibility: Adding Destinations & Currencies

### How to Add a New Destination
In `backend/services/budgetIntelligence/destinationTierResolver.js` (and `frontend/src/utils/budgetIntelligence.js`):
```javascript
{
  canonicalName: "Coorg",
  aliases: ["coorg", "kodagu", "madikeri"],
  tier: ECONOMIC_TIERS.TIER_3_BUDGET,
  isInternational: false,
}
```

### How to Add Future Currency-Specific Baselines
In `baselineMatrix.js`:
```javascript
const BASELINE_MATRIX = {
  INR: { ... },
  USD: {
    TIER_1_METRO: { budget: 35, standard: 95, premium: 250, isConfigured: true },
    TIER_4_INTERNATIONAL: { budget: 50, standard: 130, premium: 350, isConfigured: true },
  }
};
```
Once approved, adding `USD` to `SUPPORTED_CURRENCIES` activates international and foreign calculations immediately.

---

## 9. Verification & Test Results

### 1. Backend Test Suite
```bash
npm test --prefix backend -- tests/budgetIntelligenceEngine.test.js
```
- **Test Suites:** 1 passed, 1 total
- **Tests:** 27 passed, 27 total
- **Execution Time:** 1.607 s

### 2. Frontend Test Suite & Parity
```bash
node --test frontend/tests/budgetIntelligence.test.mjs
```
- **Sub-Tests:** 6 passed, 6 total
- **Parity:** 100% exact deep equality across all test fixtures.

### 3. Full Existing Regression Suite
```bash
npm test --prefix backend
```
- **Test Suites:** 29 passed, 29 total (28 existing + 1 new)
- **Tests:** 482 passed, 482 total (455 existing + 27 new)
- **Regressions:** 0

---

## 10. Scope Confirmation

- No modifications to `Booking` schema or models.
- No modifications to booking controllers or API routes.
- No modifications to AI generation prompts or Gemini schemas.
- No modifications to Adaptive Pivot, Custom Pivot, or Fix Day.
- No modifications to Reality Score engine or calculations.
- No modifications to Dashboard or PlanTrip UI.
- No database migrations or external dependencies introduced.
- Clean Git diff adhering 100% to Phase 5E.2 boundaries.

