// frontend/src/utils/budgetIntelligence.js

/**
 * TripNow Deterministic Budget Intelligence Utility (Frontend ESM).
 *
 * Strict Architectural Guarantees:
 * - Pure vanilla JavaScript (No React, No external dependencies).
 * - No network calls, No Gemini / LLM calls.
 * - Symmetrical parity with backend/services/budgetIntelligence.
 * - Idempotent, zero-latency client-side calculations (< 1ms).
 * - Exact same validation rules, formulas, tier resolution, and output contracts.
 */

export const ECONOMIC_TIERS = Object.freeze({
  TIER_1_METRO: "TIER_1_METRO",
  TIER_2_RESORT: "TIER_2_RESORT",
  TIER_3_BUDGET: "TIER_3_BUDGET",
  TIER_4_INTERNATIONAL: "TIER_4_INTERNATIONAL",
  GLOBAL_TIER_A: "GLOBAL_TIER_A",
  GLOBAL_TIER_B: "GLOBAL_TIER_B",
  GLOBAL_TIER_C: "GLOBAL_TIER_C",
  UNKNOWN: "UNKNOWN",
});

export const CALCULATION_STATUS = Object.freeze({
  CALCULATED: "CALCULATED",
  GLOBAL_ESTIMATE_ADVISORY: "GLOBAL_ESTIMATE_ADVISORY",
  BASELINE_NOT_CONFIGURED: "BASELINE_NOT_CONFIGURED",
  UNSUPPORTED_CURRENCY: "UNSUPPORTED_CURRENCY",
  UNKNOWN_DESTINATION: "UNKNOWN_DESTINATION",
  INVALID_INPUT: "INVALID_INPUT",
});

export const COMFORT_CATEGORIES = Object.freeze({
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
});

export const CATEGORY_PROPORTIONS = Object.freeze({
  accommodation: 0.35, // 35% (twin-sharing assumed)
  food: 0.25,          // 25% (casual to mid-range dining)
  transport: 0.15,     // 15% (local transit, cabs, autos)
  activities: 0.15,    // 15% (sightseeing & entrance fees)
  misc: 0.10,          // 10% (buffer, water, incidentals)
});

export const SUPPORTED_CURRENCIES = Object.freeze(["INR"]);

export const CURRENCY_SYMBOLS = Object.freeze({
  "₹": "INR",
  INR: "INR",
  "$": "USD",
  USD: "USD",
  "€": "EUR",
  EUR: "EUR",
  "£": "GBP",
  GBP: "GBP",
  "¥": "JPY",
  JPY: "JPY",
});

export const GLOBAL_TIER_CONFIG = Object.freeze({
  [ECONOMIC_TIERS.GLOBAL_TIER_A]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    label: "Budget Neighbors & Southeast Asia",
    low: 3500,
    mid: 5500,
    high: 11000,
  }),
  [ECONOMIC_TIERS.GLOBAL_TIER_B]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    label: "Mid-Cost Hubs & Middle East",
    low: 7500,
    mid: 12000,
    high: 22000,
  }),
  [ECONOMIC_TIERS.GLOBAL_TIER_C]: Object.freeze({
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    label: "Western & High-Cost Hubs",
    low: 14000,
    mid: 22000,
    high: 40000,
  }),
});

export const GLOBAL_ESTIMATE_DISCLOSURE =
  "International baseline estimates cover in-destination daily expenses (accommodation, dining, local transit, activities). Intercontinental flights, visa fees, and currency exchange buffers are excluded.";

export const BASELINE_MATRIX = Object.freeze({
  INR: Object.freeze({
    [ECONOMIC_TIERS.TIER_1_METRO]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_1_METRO,
      currency: "INR",
      budget: 2000,
      standard: 5300,
      premium: 13300,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "High-cost metropolitan destinations (e.g., Mumbai, Delhi, Bengaluru)",
    }),
    [ECONOMIC_TIERS.TIER_2_RESORT]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_2_RESORT,
      currency: "INR",
      budget: 1800,
      standard: 5000,
      premium: 12500,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "Beach, island and resort destinations (e.g., Goa, Andaman)",
    }),
    [ECONOMIC_TIERS.TIER_3_BUDGET]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_3_BUDGET,
      currency: "INR",
      budget: 1250,
      standard: 3250,
      premium: 8300,
      isConfigured: true,
      accommodationTwinSharing: true,
      description: "Budget-oriented hills, heritage, and regional destinations (e.g., Manali, Jaipur, Varanasi)",
    }),
    [ECONOMIC_TIERS.TIER_4_INTERNATIONAL]: Object.freeze({
      tier: ECONOMIC_TIERS.TIER_4_INTERNATIONAL,
      currency: "INR",
      budget: null,
      standard: null,
      premium: null,
      isConfigured: false,
      accommodationTwinSharing: true,
      description: "Legacy unconfigured international tier",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_A]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
      currency: "INR",
      budget: 3500,
      standard: 5500,
      premium: 11000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Budget Neighbors & Southeast Asia (Nepal, Sri Lanka, Thailand, Vietnam, Indonesia, Bhutan, Cambodia, Laos, Philippines)",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_B]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
      currency: "INR",
      budget: 7500,
      standard: 12000,
      premium: 22000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Mid-Cost Hubs & Middle East (UAE, Dubai, Abu Dhabi, Singapore, Malaysia, Bali, Turkey, Oman, Qatar, Georgia, Egypt)",
    }),
    [ECONOMIC_TIERS.GLOBAL_TIER_C]: Object.freeze({
      tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
      currency: "INR",
      budget: 14000,
      standard: 22000,
      premium: 40000,
      isConfigured: true,
      isInternational: true,
      accommodationTwinSharing: true,
      description: "Western & High-Cost Hubs (Europe, UK, London, USA, France, Paris, Italy, Japan, Tokyo, Australia, Switzerland)",
    }),
  }),
});

export function getBaselineForTier(tier, currency = "INR") {
  const normCurrency = String(currency || "").trim().toUpperCase();
  const currencyMatrix = BASELINE_MATRIX[normCurrency];
  if (!currencyMatrix) return null;

  const baseline = currencyMatrix[tier];
  if (!baseline || !baseline.isConfigured || baseline.standard === null) {
    return null;
  }
  return baseline;
}

export function generateCategoryBreakdown(standardDailyBaseline, guests = 1, days = 1) {
  if (typeof standardDailyBaseline !== "number" || standardDailyBaseline <= 0) {
    return null;
  }

  const g = Math.max(1, guests);
  const d = Math.max(1, days);

  const dailyPerPerson = {
    accommodation: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.accommodation),
    food: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.food),
    transport: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.transport),
    activities: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.activities),
    misc: Math.round(standardDailyBaseline * CATEGORY_PROPORTIONS.misc),
  };

  const sumDaily =
    dailyPerPerson.accommodation +
    dailyPerPerson.food +
    dailyPerPerson.transport +
    dailyPerPerson.activities +
    dailyPerPerson.misc;

  const diffDaily = standardDailyBaseline - sumDaily;
  if (diffDaily !== 0) {
    dailyPerPerson.misc += diffDaily;
  }

  const tripTotal = {
    accommodation: dailyPerPerson.accommodation * g * d,
    food: dailyPerPerson.food * g * d,
    transport: dailyPerPerson.transport * g * d,
    activities: dailyPerPerson.activities * g * d,
    misc: dailyPerPerson.misc * g * d,
    total: standardDailyBaseline * g * d,
  };

  return {
    dailyPerPerson: {
      ...dailyPerPerson,
      total: standardDailyBaseline,
    },
    tripTotal,
    proportions: { ...CATEGORY_PROPORTIONS },
    assumptions: {
      accommodation: "Assumes twin-sharing hotel or guesthouse accommodation (room rate / 2).",
      transport: "Covers local in-destination transit (metro, taxis, autos, scooters). Intercity/international travel excluded.",
      nature: "Reference estimates for planning guidance, not live commercial quotes.",
    },
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeDestination(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const DOMESTIC_DESTINATIONS = Object.freeze([
  // TIER 1 METRO
  { canonicalName: "Mumbai", aliases: ["mumbai", "bombay", "navi mumbai", "thane"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Delhi NCR", aliases: ["delhi", "new delhi", "ncr", "gurgaon", "gurugram", "noida", "greater noida", "ghaziabad", "faridabad"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Bengaluru", aliases: ["bengaluru", "bangalore"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Kolkata", aliases: ["kolkata", "calcutta"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Chennai", aliases: ["chennai", "madras"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Hyderabad", aliases: ["hyderabad", "secunderabad"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Pune", aliases: ["pune", "poona"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },
  { canonicalName: "Ahmedabad", aliases: ["ahmedabad", "amdavad", "gandhinagar"], tier: ECONOMIC_TIERS.TIER_1_METRO, isInternational: false },

  // TIER 2 RESORT
  { canonicalName: "Goa", aliases: ["goa", "north goa", "south goa", "panaji", "panjim", "calangute", "baga", "anjuna", "candolim", "morjim", "palolem", "vagator", "colva"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Andaman and Nicobar", aliases: ["andaman", "andaman and nicobar", "havelock", "havelock island", "swaraj dweep", "port blair", "neil island", "shaheed dweep", "nicobar"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Lakshadweep", aliases: ["lakshadweep", "agatti", "kavaratti", "bangaram", "minicoy"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Puducherry", aliases: ["puducherry", "pondicherry", "pondy", "auroville"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Daman and Diu", aliases: ["daman", "daman and diu", "diu"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Alibaug", aliases: ["alibaug", "alibag", "kashid", "murud"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },
  { canonicalName: "Gokarna", aliases: ["gokarna", "om beach", "kudle"], tier: ECONOMIC_TIERS.TIER_2_RESORT, isInternational: false },

  // TIER 3 BUDGET
  { canonicalName: "Manali", aliases: ["manali", "kullu", "solang", "solang valley", "rohtang", "atal tunnel"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Shimla", aliases: ["shimla", "simla", "kufri", "chail", "mashobra", "narkanda"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Rishikesh", aliases: ["rishikesh", "haridwar", "shivpuri"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Jaipur", aliases: ["jaipur", "pink city", "amber"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Udaipur", aliases: ["udaipur", "city of lakes"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Darjeeling", aliases: ["darjeeling", "kalimpong", "kurseong", "mirik"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Varanasi", aliases: ["varanasi", "banaras", "benares", "kashi", "sarnath"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Kashmir", aliases: ["kashmir", "srinagar", "gulmarg", "pahalgam", "sonamarg", "jammu and kashmir"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Ladakh", aliases: ["ladakh", "leh", "nubra", "nubra valley", "pangong", "pangong tso", "zanskar"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Kerala", aliases: ["kerala", "munnar", "alleppey", "alappuzha", "wayanad", "kochi", "cochin", "thekkady", "kumarakom", "kovalam", "varkala"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Ooty", aliases: ["ooty", "udhagamandalam", "coonoor", "nilgiris", "kotagiri"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Nainital", aliases: ["nainital", "bhimtal", "ranikhet", "almora", "mukteshwar", "jim corbett", "corbett"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Mussoorie", aliases: ["mussoorie", "dehradun", "landour", "dhanaulti"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Agra", aliases: ["agra", "taj mahal", "fatehpur sikri"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Amritsar", aliases: ["amritsar", "golden temple"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Pushkar", aliases: ["pushkar", "ajmer"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Hampi", aliases: ["hampi", "hospet"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Dharamshala", aliases: ["dharamshala", "dharamsala", "mcleodganj", "mcleod ganj", "triund", "bhagsu"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Jodhpur", aliases: ["jodhpur", "blue city"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Jaisalmer", aliases: ["jaisalmer", "golden city", "sam sand dunes"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Kasol", aliases: ["kasol", "parvati valley", "tosh", "malana", "kheerganga"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Shillong", aliases: ["shillong", "meghalaya", "cherrapunji", "cherrapunjee", "sohra", "dawki", "mawlynnong"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Gangtok", aliases: ["gangtok", "sikkim", "lachung", "lachen", "pelling"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Khajuraho", aliases: ["khajuraho"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Mysore", aliases: ["mysore", "mysuru", "coorg", "kodagu"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Mahabaleshwar", aliases: ["mahabaleshwar", "panchgani"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
  { canonicalName: "Lonavala", aliases: ["lonavala", "lonavla", "khandala"], tier: ECONOMIC_TIERS.TIER_3_BUDGET, isInternational: false },
]);

export const INTERNATIONAL_CITY_DESTINATIONS = Object.freeze([
  // TIER A
  { canonicalName: "Kathmandu", aliases: ["kathmandu", "pokhara", "chitwan"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Colombo", aliases: ["colombo", "kandy", "galle", "ella", "bentota", "mirissa"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Bangkok", aliases: ["bangkok", "chiang mai", "pattaya", "krabi"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Phuket", aliases: ["phuket", "patong", "kata", "karon", "koh samui", "samui"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Hanoi", aliases: ["hanoi", "ho chi minh", "ho chi minh city", "saigon", "da nang", "hoi an", "halong bay"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Jakarta", aliases: ["jakarta", "bandung", "surabaya", "yogyakarta", "jogja"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Thimphu", aliases: ["thimphu", "paro", "punakha"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Phnom Penh", aliases: ["phnom penh", "siem reap", "angkor wat"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Vientiane", aliases: ["vientiane", "luang prabang"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Manila", aliases: ["manila", "cebu", "boracay", "palawan", "el nido"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },

  // TIER B
  { canonicalName: "Bali", aliases: ["bali", "ubud", "seminyak", "kuta", "canggu", "nusa dua", "sanur", "denpasar", "uluwatu"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Dubai", aliases: ["dubai", "bur dubai", "deira", "jumeirah", "downtown dubai"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Abu Dhabi", aliases: ["abu dhabi", "yas island", "saadiyat"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Singapore", aliases: ["singapore", "sentosa", "changi", "marina bay"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Kuala Lumpur", aliases: ["kuala lumpur", "kl", "penang", "langkawi", "malacca"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Istanbul", aliases: ["istanbul", "cappadocia", "antalya", "bodrum"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Muscat", aliases: ["muscat", "salalah"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Doha", aliases: ["doha"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Tbilisi", aliases: ["tbilisi", "batumi"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Cairo", aliases: ["cairo", "giza", "luxor", "aswan", "alexandria", "sharm el sheikh"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Maldives", aliases: ["maldives", "male", "maafushi", "hulhumale"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },

  // TIER C
  { canonicalName: "Paris", aliases: ["paris", "nice", "lyon", "marseille", "cannes", "bordeaux"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "London", aliases: ["london", "edinburgh", "manchester", "birmingham", "glasgow"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Tokyo", aliases: ["tokyo", "kyoto", "osaka", "yokohama", "shibuya", "shinjuku", "hokkaido", "sapporo", "hiroshima"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "New York", aliases: ["new york", "new york city", "nyc", "manhattan", "brooklyn"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Rome", aliases: ["rome", "milan", "florence", "venice", "naples", "amalfi", "amalfi coast"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Sydney", aliases: ["sydney", "melbourne", "brisbane", "gold coast", "perth", "cairns"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Zurich", aliases: ["zurich", "geneva", "lucerne", "interlaken", "zermatt"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Amsterdam", aliases: ["amsterdam", "rotterdam", "the hague"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Barcelona", aliases: ["barcelona", "madrid", "seville", "valencia", "ibiza"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Berlin", aliases: ["berlin", "munich", "frankfurt", "hamburg"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Toronto", aliases: ["toronto", "vancouver", "montreal", "ottawa"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Los Angeles", aliases: ["los angeles", "la", "san francisco", "sf", "las vegas", "chicago", "miami", "seattle", "boston", "washington dc"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
]);

export const INTERNATIONAL_COUNTRY_DESTINATIONS = Object.freeze([
  // TIER A
  { canonicalName: "Nepal", aliases: ["nepal"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Sri Lanka", aliases: ["sri lanka", "ceylon"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Thailand", aliases: ["thailand", "siam"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Vietnam", aliases: ["vietnam"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Indonesia", aliases: ["indonesia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Bhutan", aliases: ["bhutan"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Cambodia", aliases: ["cambodia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Laos", aliases: ["laos"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },
  { canonicalName: "Philippines", aliases: ["philippines", "the philippines"], tier: ECONOMIC_TIERS.GLOBAL_TIER_A, isInternational: true },

  // TIER B
  { canonicalName: "United Arab Emirates", aliases: ["uae", "united arab emirates", "sharjah", "ras al khaimah"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Malaysia", aliases: ["malaysia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Turkey", aliases: ["turkey", "turkiye"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Oman", aliases: ["oman"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Qatar", aliases: ["qatar"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Georgia", aliases: ["georgia country", "georgia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },
  { canonicalName: "Egypt", aliases: ["egypt"], tier: ECONOMIC_TIERS.GLOBAL_TIER_B, isInternational: true },

  // TIER C
  { canonicalName: "France", aliases: ["france"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "United Kingdom", aliases: ["uk", "united kingdom", "great britain", "britain", "england", "scotland", "wales"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "United States", aliases: ["usa", "united states", "united states of america", "america", "california", "florida", "texas"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Italy", aliases: ["italy", "italia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Japan", aliases: ["japan", "nippon"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Australia", aliases: ["australia"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Switzerland", aliases: ["switzerland", "swiss"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Germany", aliases: ["germany", "deutschland"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Spain", aliases: ["spain", "espana"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Netherlands", aliases: ["netherlands", "holland"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
  { canonicalName: "Canada", aliases: ["canada"], tier: ECONOMIC_TIERS.GLOBAL_TIER_C, isInternational: true },
]);

export const INTERNATIONAL_REGIONAL_DESTINATIONS = Object.freeze([
  {
    canonicalName: "Europe",
    aliases: ["europe", "european union", "eu", "schengen", "euro trip", "western europe", "eurotrip", "scandinavia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
]);

const UNLISTED_INTERNATIONAL_TOKENS = Object.freeze([
  "international", "abroad", "overseas", "foreign", "world tour",
  "brazil", "argentina", "chile", "peru", "colombia", "mexico", "costa rica", "cuba",
  "panama", "jamaica", "bahamas", "uruguay", "ecuador", "bolivia",
  "austria", "vienna", "belgium", "brussels", "croatia", "dubrovnik", "czech republic",
  "prague", "denmark", "copenhagen", "finland", "helsinki", "greece", "athens",
  "santorini", "mykonos", "hungary", "budapest", "ireland", "dublin", "norway", "oslo", "iceland", "reykjavik",
  "poland", "warsaw", "portugal", "lisbon", "porto", "sweden", "stockholm",
  "south africa", "cape town", "johannesburg", "morocco", "marrakech", "kenya", "nairobi",
  "tanzania", "zanzibar", "mauritius", "seychelles", "rwanda", "uganda", "namibia",
  "new zealand", "auckland", "queenstown", "fiji", "bora bora", "tahiti", "cancun", "hawaii",
  "jordan", "petra", "amman", "lebanon", "beirut", "saudi arabia", "riyadh", "jeddah",
  "kuwait", "bahrain", "azerbaijan", "baku", "armenia", "yerevan", "uzbekistan",
  "samarkand", "tashkent", "kazakhstan", "almaty", "mongolia", "taiwan", "taipei",
  "hong kong", "macau", "south korea", "korea", "seoul", "busan", "jeju"
]);

function isUnlistedInternational(normalized) {
  for (const token of UNLISTED_INTERNATIONAL_TOKENS) {
    const regex = new RegExp(`(?:^|\\s)${escapeRegex(token)}(?:\\s|$)`, "i");
    if (regex.test(normalized)) {
      return true;
    }
  }
  return false;
}

function matchEntry(normalized, entries) {
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (normalized === alias) {
        return { entry, alias };
      }
    }
  }

  const candidates = [];
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      candidates.push({ entry, alias, length: alias.length });
    }
  }
  candidates.sort((a, b) => b.length - a.length);

  for (const { entry, alias } of candidates) {
    const regex = new RegExp(`(?:^|\\s)${escapeRegex(alias)}(?:\\s|$)`, "i");
    if (regex.test(normalized)) {
      return { entry, alias };
    }
  }

  return null;
}

export const DESTINATION_REGISTRY = Object.freeze([
  ...DOMESTIC_DESTINATIONS,
  ...INTERNATIONAL_CITY_DESTINATIONS,
  ...INTERNATIONAL_COUNTRY_DESTINATIONS,
  ...INTERNATIONAL_REGIONAL_DESTINATIONS,
]);

export function resolveDestinationTier(destination) {
  const rawInput = typeof destination === "string" ? destination.trim() : "";
  const normalized = normalizeDestination(rawInput);

  if (!normalized) {
    return {
      tier: ECONOMIC_TIERS.UNKNOWN,
      canonicalName: rawInput || "Unspecified",
      isInternational: false,
      isKnown: false,
      isUnlistedInternational: false,
      matchedAlias: null,
      rawInput,
    };
  }

  // Stage 1: Existing Indian / domestic destination resolution
  const domMatch = matchEntry(normalized, DOMESTIC_DESTINATIONS);
  if (domMatch) {
    return {
      tier: domMatch.entry.tier,
      canonicalName: domMatch.entry.canonicalName,
      isInternational: false,
      isKnown: true,
      isUnlistedInternational: false,
      matchedAlias: domMatch.alias,
      rawInput,
    };
  }

  // Stage 2: Specific international city / resort aliases
  const cityMatch = matchEntry(normalized, INTERNATIONAL_CITY_DESTINATIONS);
  if (cityMatch) {
    return {
      tier: cityMatch.entry.tier,
      canonicalName: cityMatch.entry.canonicalName,
      isInternational: true,
      isKnown: true,
      isUnlistedInternational: false,
      matchedAlias: cityMatch.alias,
      rawInput,
    };
  }

  // Stage 3: International country aliases
  const countryMatch = matchEntry(normalized, INTERNATIONAL_COUNTRY_DESTINATIONS);
  if (countryMatch) {
    return {
      tier: countryMatch.entry.tier,
      canonicalName: countryMatch.entry.canonicalName,
      isInternational: true,
      isKnown: true,
      isUnlistedInternational: false,
      matchedAlias: countryMatch.alias,
      rawInput,
    };
  }

  // Stage 4: Recognized regional aliases
  const regionMatch = matchEntry(normalized, INTERNATIONAL_REGIONAL_DESTINATIONS);
  if (regionMatch) {
    return {
      tier: regionMatch.entry.tier,
      canonicalName: regionMatch.entry.canonicalName,
      isInternational: true,
      isKnown: true,
      isUnlistedInternational: false,
      matchedAlias: regionMatch.alias,
      rawInput,
    };
  }

  // Stage 5: Unlisted international destination fallback -> GLOBAL_TIER_B
  if (isUnlistedInternational(normalized)) {
    return {
      tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
      canonicalName: rawInput,
      isInternational: true,
      isKnown: true,
      isUnlistedInternational: true,
      matchedAlias: normalized,
      rawInput,
    };
  }

  // Stage 6: Safe handling of unknown or ambiguous destinations
  return {
    tier: ECONOMIC_TIERS.UNKNOWN,
    canonicalName: rawInput,
    isInternational: false,
    isKnown: false,
    isUnlistedInternational: false,
    matchedAlias: null,
    rawInput,
  };
}

export function parseNumericBudgetSafe(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === "string") {
    const clean = raw.replace(/[₹$€£¥,\s]/g, "").trim();
    if (!clean) return null;
    const num = Number(clean);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  return null;
}

export function normalizeCurrencyCode(rawCurrency) {
  if (!rawCurrency || typeof rawCurrency !== "string") {
    return "INR";
  }
  const clean = rawCurrency.trim();
  if (CURRENCY_SYMBOLS[clean]) {
    return CURRENCY_SYMBOLS[clean];
  }
  return clean.toUpperCase();
}

export function calculateBudgetIntelligence(input) {
  const validationErrors = [];
  const warnings = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      status: CALCULATION_STATUS.INVALID_INPUT,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: "INR",
      totalBudget: null,
      days: null,
      guests: null,
      perPersonDailyBudget: null,
      dailyAvailablePerPerson: null,
      groupDailyBudget: null,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: "Unspecified",
      isInternational: false,
      warnings: [],
      validationErrors: ["Input must be a valid non-null object"],
    };
  }

  // 1. Validate totalBudget
  const parsedBudget = parseNumericBudgetSafe(input.totalBudget);
  if (parsedBudget === null) {
    if (input.totalBudget === undefined || input.totalBudget === null || input.totalBudget === "") {
      validationErrors.push("totalBudget is required and must be a finite positive number");
    } else {
      validationErrors.push(`totalBudget must be a finite positive number greater than 0 (received: ${input.totalBudget})`);
    }
  }

  // 2. Validate days
  const rawDays = input.days;
  const isDaysValidInteger = typeof rawDays === "number" && Number.isInteger(rawDays) && rawDays > 0;
  if (!isDaysValidInteger) {
    if (rawDays === undefined || rawDays === null || rawDays === "") {
      validationErrors.push("days is required and must be a positive integer");
    } else {
      validationErrors.push(`days must be a whole positive integer greater than 0 (received: ${rawDays})`);
    }
  }

  // 3. Validate guests
  const rawGuests = input.guests;
  const isGuestsValidInteger = typeof rawGuests === "number" && Number.isInteger(rawGuests) && rawGuests > 0;
  if (!isGuestsValidInteger) {
    if (rawGuests === undefined || rawGuests === null || rawGuests === "") {
      validationErrors.push("guests is required and must be a positive integer");
    } else {
      validationErrors.push(`guests must be a whole positive integer greater than 0 (received: ${rawGuests})`);
    }
  }

  // 4. Validate destination
  const rawDestination = input.destination;
  const isDestValid = typeof rawDestination === "string" && rawDestination.trim().length > 0;
  if (!isDestValid) {
    validationErrors.push("destination is required and must be a non-empty string");
  }

  const normalizedCurrency = normalizeCurrencyCode(input.currency);

  if (validationErrors.length > 0) {
    return {
      status: CALCULATION_STATUS.INVALID_INPUT,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget: parsedBudget,
      days: isDaysValidInteger ? rawDays : null,
      guests: isGuestsValidInteger ? rawGuests : null,
      perPersonDailyBudget: null,
      dailyAvailablePerPerson: null,
      groupDailyBudget: null,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: typeof rawDestination === "string" ? rawDestination.trim() : "Unspecified",
      isInternational: false,
      warnings,
      validationErrors,
    };
  }

  const totalBudget = parsedBudget;
  const days = rawDays;
  const guests = rawGuests;

  const perPersonDailyBudget = Math.round(totalBudget / (guests * days));
  const groupDailyBudget = Math.round(totalBudget / days);

  // 5. Currency Check
  if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
    warnings.push({
      code: "UNSUPPORTED_CURRENCY",
      severity: "warning",
      message: `Currency "${normalizedCurrency}" is not currently supported for baseline calculations. Only INR (₹) reference anchors are currently approved.`,
    });
    return {
      status: CALCULATION_STATUS.UNSUPPORTED_CURRENCY,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: rawDestination.trim(),
      isInternational: false,
      warnings,
      validationErrors: [],
    };
  }

  // 6. Destination Tier Resolution
  const tierResolution = resolveDestinationTier(rawDestination);
  const resolvedTier = tierResolution.tier;

  if (!tierResolution.isKnown || resolvedTier === ECONOMIC_TIERS.UNKNOWN) {
    warnings.push({
      code: "UNKNOWN_DESTINATION",
      severity: "warning",
      message: `Destination "${rawDestination.trim()}" is not recognized in the economic tier registry. Baseline cost estimates cannot be calculated without economic tier mapping.`,
    });
    return {
      status: CALCULATION_STATUS.UNKNOWN_DESTINATION,
      tier: ECONOMIC_TIERS.UNKNOWN,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: rawDestination.trim(),
      isInternational: false,
      warnings,
      validationErrors: [],
    };
  }

  // Legacy unconfigured international tier safety
  if (resolvedTier === ECONOMIC_TIERS.TIER_4_INTERNATIONAL) {
    warnings.push({
      code: "BASELINE_NOT_CONFIGURED",
      severity: "warning",
      message: `Baseline economic data is not yet approved for legacy international destination "${tierResolution.canonicalName}". Domestic INR anchors cannot be applied to international destinations.`,
    });
    return {
      status: CALCULATION_STATUS.BASELINE_NOT_CONFIGURED,
      tier: resolvedTier,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: tierResolution.canonicalName,
      isInternational: true,
      warnings,
      validationErrors: [],
    };
  }

  // 7. Retrieve Configured Baseline
  const baseline = getBaselineForTier(resolvedTier, normalizedCurrency);
  if (!baseline || !baseline.standard) {
    warnings.push({
      code: "BASELINE_NOT_CONFIGURED",
      severity: "warning",
      message: `No approved baseline anchors found for tier "${resolvedTier}" in currency "${normalizedCurrency}".`,
    });
    return {
      status: CALCULATION_STATUS.BASELINE_NOT_CONFIGURED,
      tier: resolvedTier,
      currency: normalizedCurrency,
      totalBudget,
      days,
      guests,
      perPersonDailyBudget,
      dailyAvailablePerPerson: perPersonDailyBudget,
      groupDailyBudget,
      estimatedStandardTotal: null,
      standardBudgetDifference: null,
      sufficiencyRatio: null,
      category: null,
      breakdown: null,
      dailyTierEstimates: null,
      estimatedTripTotals: null,
      resolvedDestination: tierResolution.canonicalName,
      isInternational: Boolean(tierResolution.isInternational),
      warnings,
      validationErrors: [],
    };
  }

  // 8. Calculations with Approved Baseline (Preserves Low, Mid, High Estimates)
  const isIntl = Boolean(tierResolution.isInternational);
  const lowDaily = baseline.budget;
  const midDaily = baseline.standard;
  const highDaily = baseline.premium;

  const dailyTierEstimates = {
    low: lowDaily,
    mid: midDaily,
    high: highDaily,
  };

  const estimatedTripTotals = {
    low: lowDaily * guests * days,
    mid: midDaily * guests * days,
    high: highDaily * guests * days,
  };

  const standardDailyBaseline = midDaily;
  const estimatedStandardTotal = estimatedTripTotals.mid;
  const standardBudgetDifference = Math.round(totalBudget - estimatedStandardTotal);

  const rawRatio = perPersonDailyBudget / standardDailyBaseline;
  const sufficiencyRatio = Number(rawRatio.toFixed(4));

  // 9. Category Comfort Classification
  let category;
  if (sufficiencyRatio < 0.75) {
    category = COMFORT_CATEGORIES.LOW;
  } else if (sufficiencyRatio < 1.50) {
    category = COMFORT_CATEGORIES.MODERATE;
  } else {
    category = COMFORT_CATEGORIES.HIGH;
  }

  // 10. Status & Advisory Warnings
  let status = CALCULATION_STATUS.CALCULATED;

  if (isIntl) {
    warnings.push({
      code: "GLOBAL_ESTIMATE_ADVISORY",
      severity: "info",
      message: GLOBAL_ESTIMATE_DISCLOSURE,
    });

    if (tierResolution.isUnlistedInternational) {
      status = CALCULATION_STATUS.GLOBAL_ESTIMATE_ADVISORY;
      warnings.push({
        code: "UNLISTED_INTERNATIONAL_PROVISIONAL",
        severity: "warning",
        message: `"${tierResolution.canonicalName}" is not explicitly listed in our international destination database. A provisional Global Tier B (Mid-Cost Hub) estimate has been applied.`,
      });
    }
  }

  if (category === COMFORT_CATEGORIES.LOW) {
    warnings.push({
      code: "BUDGET_LOW_ADVISORY",
      severity: "warning",
      message: `Your daily budget (₹${perPersonDailyBudget.toLocaleString("en-IN")}/person) is below the estimated standard baseline (₹${standardDailyBaseline.toLocaleString("en-IN")}/person) for ${tierResolution.canonicalName}. Hostels, public transit, and minimal extra expenses are advised.`,
    });
    if (sufficiencyRatio < 0.55) {
      warnings.push({
        code: "BUDGET_CRITICALLY_TIGHT",
        severity: "warning",
        message: `Your budget is very tight for this party size and duration. Estimated standard cost is ₹${estimatedStandardTotal.toLocaleString("en-IN")} (shortfall of ₹${Math.abs(standardBudgetDifference).toLocaleString("en-IN")}). Consider adjusting duration or budget.`,
      });
    }
  } else if (category === COMFORT_CATEGORIES.MODERATE) {
    warnings.push({
      code: "BUDGET_STANDARD_ADEQUATE",
      severity: "success",
      message: `Your budget aligns well with standard travel, dining, and local attractions in ${tierResolution.canonicalName}.`,
    });
  } else {
    warnings.push({
      code: "BUDGET_PREMIUM_COMFORTABLE",
      severity: "success",
      message: `Your budget comfortably supports premium resorts, private transport, and upscale experiences in ${tierResolution.canonicalName}.`,
    });
  }

  const breakdown = generateCategoryBreakdown(standardDailyBaseline, guests, days);

  return {
    status,
    tier: resolvedTier,
    currency: normalizedCurrency,
    totalBudget,
    days,
    guests,
    perPersonDailyBudget,
    dailyAvailablePerPerson: perPersonDailyBudget,
    groupDailyBudget,
    estimatedStandardTotal,
    standardBudgetDifference,
    sufficiencyRatio,
    category,
    breakdown,
    dailyTierEstimates,
    estimatedTripTotals,
    resolvedDestination: tierResolution.canonicalName,
    isInternational: isIntl,
    warnings,
    validationErrors: [],
  };
}

export default {
  ECONOMIC_TIERS,
  CALCULATION_STATUS,
  COMFORT_CATEGORIES,
  CATEGORY_PROPORTIONS,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  GLOBAL_TIER_CONFIG,
  GLOBAL_ESTIMATE_DISCLOSURE,
  BASELINE_MATRIX,
  DOMESTIC_DESTINATIONS,
  INTERNATIONAL_CITY_DESTINATIONS,
  INTERNATIONAL_COUNTRY_DESTINATIONS,
  INTERNATIONAL_REGIONAL_DESTINATIONS,
  DESTINATION_REGISTRY,
  normalizeDestination,
  resolveDestinationTier,
  getBaselineForTier,
  generateCategoryBreakdown,
  parseNumericBudgetSafe,
  normalizeCurrencyCode,
  calculateBudgetIntelligence,
};
