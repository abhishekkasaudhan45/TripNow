// backend/services/budgetIntelligence/destinationTierResolver.js
const { ECONOMIC_TIERS } = require("./constants");

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalizes destination string for consistent matching:
 * - Lowercases and trims.
 * - Strips accents / diacritics.
 * - Replaces punctuation (commas, slashes, dashes, dots) with single spaces.
 * - Collapses consecutive spaces.
 */
function normalizeDestination(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stage 1: Existing Indian / Domestic Destination Registry
 * Highest priority: Domestic Indian destinations evaluate first so that
 * overlapping words or foreign mentions never misclassify domestic trips.
 */
const DOMESTIC_DESTINATIONS = Object.freeze([
  // TIER 1 METRO
  {
    canonicalName: "Mumbai",
    aliases: ["mumbai", "bombay", "navi mumbai", "thane"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Delhi NCR",
    aliases: ["delhi", "new delhi", "ncr", "gurgaon", "gurugram", "noida", "greater noida", "ghaziabad", "faridabad"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Bengaluru",
    aliases: ["bengaluru", "bangalore"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Kolkata",
    aliases: ["kolkata", "calcutta"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Chennai",
    aliases: ["chennai", "madras"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Hyderabad",
    aliases: ["hyderabad", "secunderabad"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Pune",
    aliases: ["pune", "poona"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },
  {
    canonicalName: "Ahmedabad",
    aliases: ["ahmedabad", "amdavad", "gandhinagar"],
    tier: ECONOMIC_TIERS.TIER_1_METRO,
    isInternational: false,
  },

  // TIER 2 RESORT (Domestic)
  {
    canonicalName: "Goa",
    aliases: ["goa", "north goa", "south goa", "panaji", "panjim", "calangute", "baga", "anjuna", "candolim", "morjim", "palolem", "vagator", "colva"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Andaman and Nicobar",
    aliases: ["andaman", "andaman and nicobar", "havelock", "havelock island", "swaraj dweep", "port blair", "neil island", "shaheed dweep", "nicobar"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Lakshadweep",
    aliases: ["lakshadweep", "agatti", "kavaratti", "bangaram", "minicoy"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Puducherry",
    aliases: ["puducherry", "pondicherry", "pondy", "auroville"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Daman and Diu",
    aliases: ["daman", "daman and diu", "diu"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Alibaug",
    aliases: ["alibaug", "alibag", "kashid", "murud"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },
  {
    canonicalName: "Gokarna",
    aliases: ["gokarna", "om beach", "kudle"],
    tier: ECONOMIC_TIERS.TIER_2_RESORT,
    isInternational: false,
  },

  // TIER 3 BUDGET (Domestic Hills, Heritage, Regional)
  {
    canonicalName: "Manali",
    aliases: ["manali", "kullu", "solang", "solang valley", "rohtang", "atal tunnel"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Shimla",
    aliases: ["shimla", "simla", "kufri", "chail", "mashobra", "narkanda"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Rishikesh",
    aliases: ["rishikesh", "haridwar", "shivpuri"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Jaipur",
    aliases: ["jaipur", "pink city", "amber"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Udaipur",
    aliases: ["udaipur", "city of lakes"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Darjeeling",
    aliases: ["darjeeling", "kalimpong", "kurseong", "mirik"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Varanasi",
    aliases: ["varanasi", "banaras", "benares", "kashi", "sarnath"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Kashmir",
    aliases: ["kashmir", "srinagar", "gulmarg", "pahalgam", "sonamarg", "jammu and kashmir"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Ladakh",
    aliases: ["ladakh", "leh", "nubra", "nubra valley", "pangong", "pangong tso", "zanskar"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Kerala",
    aliases: ["kerala", "munnar", "alleppey", "alappuzha", "wayanad", "kochi", "cochin", "thekkady", "kumarakom", "kovalam", "varkala"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Ooty",
    aliases: ["ooty", "udhagamandalam", "coonoor", "nilgiris", "kotagiri"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Nainital",
    aliases: ["nainital", "bhimtal", "ranikhet", "almora", "mukteshwar", "jim corbett", "corbett"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Mussoorie",
    aliases: ["mussoorie", "dehradun", "landour", "dhanaulti"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Agra",
    aliases: ["agra", "taj mahal", "fatehpur sikri"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Amritsar",
    aliases: ["amritsar", "golden temple"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Pushkar",
    aliases: ["pushkar", "ajmer"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Hampi",
    aliases: ["hampi", "hospet"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Dharamshala",
    aliases: ["dharamshala", "dharamsala", "mcleodganj", "mcleod ganj", "triund", "bhagsu"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Jodhpur",
    aliases: ["jodhpur", "blue city"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Jaisalmer",
    aliases: ["jaisalmer", "golden city", "sam sand dunes"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Kasol",
    aliases: ["kasol", "parvati valley", "tosh", "malana", "kheerganga"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Shillong",
    aliases: ["shillong", "meghalaya", "cherrapunji", "cherrapunjee", "sohra", "dawki", "mawlynnong"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Gangtok",
    aliases: ["gangtok", "sikkim", "lachung", "lachen", "pelling"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Khajuraho",
    aliases: ["khajuraho"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Mysore",
    aliases: ["mysore", "mysuru", "coorg", "kodagu"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Mahabaleshwar",
    aliases: ["mahabaleshwar", "panchgani"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
  {
    canonicalName: "Lonavala",
    aliases: ["lonavala", "lonavla", "khandala"],
    tier: ECONOMIC_TIERS.TIER_3_BUDGET,
    isInternational: false,
  },
]);

/**
 * Stage 2: Specific International City / Resort Aliases
 * Resolves specific international destinations before broad country-level rules.
 * CRUCIAL: "Bali" resolves here to GLOBAL_TIER_B before "Indonesia" in Stage 3!
 */
const INTERNATIONAL_CITY_DESTINATIONS = Object.freeze([
  // TIER A CITIES (Budget Neighbors & Southeast Asia)
  {
    canonicalName: "Kathmandu",
    aliases: ["kathmandu", "pokhara", "chitwan"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Colombo",
    aliases: ["colombo", "kandy", "galle", "ella", "bentota", "mirissa"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Bangkok",
    aliases: ["bangkok", "chiang mai", "pattaya", "krabi"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Phuket",
    aliases: ["phuket", "patong", "kata", "karon", "koh samui", "samui"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Hanoi",
    aliases: ["hanoi", "ho chi minh", "ho chi minh city", "saigon", "da nang", "hoi an", "halong bay"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Jakarta",
    aliases: ["jakarta", "bandung", "surabaya", "yogyakarta", "jogja"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Thimphu",
    aliases: ["thimphu", "paro", "punakha"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Phnom Penh",
    aliases: ["phnom penh", "siem reap", "angkor wat"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Vientiane",
    aliases: ["vientiane", "luang prabang"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Manila",
    aliases: ["manila", "cebu", "boracay", "palawan", "el nido"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },

  // TIER B CITIES (Mid-Cost Hubs & Middle East)
  {
    // CRITICAL: Bali island resort resolves to GLOBAL_TIER_B before Indonesia (Tier A)
    canonicalName: "Bali",
    aliases: ["bali", "ubud", "seminyak", "kuta", "canggu", "nusa dua", "sanur", "denpasar", "uluwatu"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Dubai",
    aliases: ["dubai", "bur dubai", "deira", "jumeirah", "downtown dubai"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Abu Dhabi",
    aliases: ["abu dhabi", "yas island", "saadiyat"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Singapore",
    aliases: ["singapore", "sentosa", "changi", "marina bay"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Kuala Lumpur",
    aliases: ["kuala lumpur", "kl", "penang", "langkawi", "malacca"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Istanbul",
    aliases: ["istanbul", "cappadocia", "antalya", "bodrum"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Muscat",
    aliases: ["muscat", "salalah"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Doha",
    aliases: ["doha"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Tbilisi",
    aliases: ["tbilisi", "batumi"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Cairo",
    aliases: ["cairo", "giza", "luxor", "aswan", "alexandria", "sharm el sheikh"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Maldives",
    aliases: ["maldives", "male", "maafushi", "hulhumale"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },

  // TIER C CITIES (Western & High-Cost Hubs)
  {
    canonicalName: "Paris",
    aliases: ["paris", "nice", "lyon", "marseille", "cannes", "bordeaux"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "London",
    aliases: ["london", "edinburgh", "manchester", "birmingham", "glasgow"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Tokyo",
    aliases: ["tokyo", "kyoto", "osaka", "yokohama", "shibuya", "shinjuku", "hokkaido", "sapporo", "hiroshima"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "New York",
    aliases: ["new york", "new york city", "nyc", "manhattan", "brooklyn"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Rome",
    aliases: ["rome", "milan", "florence", "venice", "naples", "amalfi", "amalfi coast"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Sydney",
    aliases: ["sydney", "melbourne", "brisbane", "gold coast", "perth", "cairns"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Zurich",
    aliases: ["zurich", "geneva", "lucerne", "interlaken", "zermatt"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Amsterdam",
    aliases: ["amsterdam", "rotterdam", "the hague"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Barcelona",
    aliases: ["barcelona", "madrid", "seville", "valencia", "ibiza"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Berlin",
    aliases: ["berlin", "munich", "frankfurt", "hamburg"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Toronto",
    aliases: ["toronto", "vancouver", "montreal", "ottawa"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Los Angeles",
    aliases: ["los angeles", "la", "san francisco", "sf", "las vegas", "chicago", "miami", "seattle", "boston", "washington dc"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
]);

/**
 * Stage 3: International Country Aliases
 * Matches sovereign country names when no specific city/resort was matched.
 */
const INTERNATIONAL_COUNTRY_DESTINATIONS = Object.freeze([
  // TIER A COUNTRIES (Budget Neighbors & Southeast Asia)
  {
    canonicalName: "Nepal",
    aliases: ["nepal"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Sri Lanka",
    aliases: ["sri lanka", "ceylon"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Thailand",
    aliases: ["thailand", "siam"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Vietnam",
    aliases: ["vietnam"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Indonesia",
    aliases: ["indonesia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Bhutan",
    aliases: ["bhutan"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Cambodia",
    aliases: ["cambodia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Laos",
    aliases: ["laos"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },
  {
    canonicalName: "Philippines",
    aliases: ["philippines", "the philippines"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_A,
    isInternational: true,
  },

  // TIER B COUNTRIES (Mid-Cost Hubs & Middle East)
  {
    canonicalName: "United Arab Emirates",
    aliases: ["uae", "united arab emirates", "sharjah", "ras al khaimah"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Malaysia",
    aliases: ["malaysia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Turkey",
    aliases: ["turkey", "turkiye"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Oman",
    aliases: ["oman"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Qatar",
    aliases: ["qatar"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Georgia",
    aliases: ["georgia country", "georgia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },
  {
    canonicalName: "Egypt",
    aliases: ["egypt"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_B,
    isInternational: true,
  },

  // TIER C COUNTRIES (Western & High-Cost Hubs)
  {
    canonicalName: "France",
    aliases: ["france"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "United Kingdom",
    aliases: ["uk", "united kingdom", "great britain", "britain", "england", "scotland", "wales"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "United States",
    aliases: ["usa", "united states", "united states of america", "america", "california", "florida", "texas"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Italy",
    aliases: ["italy", "italia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Japan",
    aliases: ["japan", "nippon"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Australia",
    aliases: ["australia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Switzerland",
    aliases: ["switzerland", "swiss"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Germany",
    aliases: ["germany", "deutschland"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Spain",
    aliases: ["spain", "espana"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Netherlands",
    aliases: ["netherlands", "holland"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
  {
    canonicalName: "Canada",
    aliases: ["canada"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
]);

/**
 * Stage 4: Recognized Regional Aliases
 * Regional or continental destinations (e.g., "Europe", "Euro trip", "Schengen").
 */
const INTERNATIONAL_REGIONAL_DESTINATIONS = Object.freeze([
  {
    canonicalName: "Europe",
    aliases: ["europe", "european union", "eu", "schengen", "euro trip", "western europe", "eurotrip", "scandinavia"],
    tier: ECONOMIC_TIERS.GLOBAL_TIER_C,
    isInternational: true,
  },
]);

/**
 * Stage 5: Unlisted International Destination Markers & Country List
 * When an unlisted destination clearly belongs to the international sphere,
 * it safely receives a provisional GLOBAL_TIER_B estimate with status GLOBAL_ESTIMATE_ADVISORY.
 */
const UNLISTED_INTERNATIONAL_TOKENS = Object.freeze([
  // General international trip indicators
  "international", "abroad", "overseas", "foreign", "world tour",

  // Recognized world countries/territories not explicitly mapped above
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

/**
 * Helper to test if a normalized string contains an unlisted international indicator.
 */
function isUnlistedInternational(normalized) {
  for (const token of UNLISTED_INTERNATIONAL_TOKENS) {
    const regex = new RegExp(`(?:^|\\s)${escapeRegex(token)}(?:\\s|$)`, "i");
    if (regex.test(normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * Helper to match a normalized query against an array of registry entries.
 * Precedence:
 * 1. Exact alias match
 * 2. Word-boundary substring match sorted by alias length descending
 */
function matchEntry(normalized, entries) {
  // Pass A: Exact alias match
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (normalized === alias) {
        return { entry, alias };
      }
    }
  }

  // Pass B: Word-boundary phrase matching (longest alias first)
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

/**
 * Combined Canonical Registry for backward compatibility.
 */
const DESTINATION_REGISTRY = Object.freeze([
  ...DOMESTIC_DESTINATIONS,
  ...INTERNATIONAL_CITY_DESTINATIONS,
  ...INTERNATIONAL_COUNTRY_DESTINATIONS,
  ...INTERNATIONAL_REGIONAL_DESTINATIONS,
]);

/**
 * Resolves an arbitrary destination string into a canonical economic tier.
 *
 * Deterministic 6-Stage Resolution Precedence:
 * 1. Existing Indian/domestic destination resolution (Highest priority).
 * 2. Specific international city/resort aliases (Bali -> Tier B, Paris -> Tier C).
 * 3. International country aliases (Indonesia, Thailand -> Tier A; UK, France -> Tier C).
 * 4. Regional aliases (Europe -> Tier C).
 * 5. Unlisted international destination fallback -> GLOBAL_TIER_B with GLOBAL_ESTIMATE_ADVISORY.
 * 6. Safe handling of unknown or ambiguous destinations -> UNKNOWN.
 *
 * @param {string} destination - Raw destination name from user or trip data
 * @returns {object} { tier, canonicalName, isInternational, isKnown, isUnlistedInternational, matchedAlias, rawInput }
 */
function resolveDestinationTier(destination) {
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

module.exports = {
  DESTINATION_REGISTRY,
  DOMESTIC_DESTINATIONS,
  INTERNATIONAL_CITY_DESTINATIONS,
  INTERNATIONAL_COUNTRY_DESTINATIONS,
  INTERNATIONAL_REGIONAL_DESTINATIONS,
  normalizeDestination,
  resolveDestinationTier,
};
