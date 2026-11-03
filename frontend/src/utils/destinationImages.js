/**
 * Curated destination imagery for dynamic background rendering and hero discovery.
 * Zero external geocoding/image API dependencies.
 * Neutral fallback to initial LCP hero image.
 */

export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429";

export const DESTINATION_HERO_MAP = {
  // Domestic Hubs (Tier 1 Metro / Tier 2 Resort / Tier 3 Regional)
  manali: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23",
  goa: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
  jaipur: "https://images.unsplash.com/photo-1599661046289-e31897846e41",
  kerala: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944",
  ladakh: "https://images.unsplash.com/photo-1506038634487-60a69ae4b7b1",
  rishikesh: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2",
  udaipur: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1",
  darjeeling: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3",
  andaman: "https://images.unsplash.com/photo-1582967788606-a171c1080cb0",
  shimla: "https://images.unsplash.com/photo-1519681393784-d120267933ba",
  varanasi: "https://images.unsplash.com/photo-1561361058-c24cecae35ca",
  kashmir: "https://images.unsplash.com/photo-1598091383021-15ddea10925d",
  mumbai: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f",
  delhi: "https://images.unsplash.com/photo-1587474260584-136574528ed5",
  agra: "https://images.unsplash.com/photo-1564507592333-c60657eea523",
  bangalore: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2",

  // International Tier A (Budget Neighbors & Southeast Asia)
  thailand: "https://images.unsplash.com/photo-1508009603885-50cf7c579365",
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365",
  phuket: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5",
  nepal: "https://images.unsplash.com/photo-1544735716-392fe2489ffa",
  kathmandu: "https://images.unsplash.com/photo-1544735716-392fe2489ffa",
  vietnam: "https://images.unsplash.com/photo-1528127269322-539801943592",
  hanoi: "https://images.unsplash.com/photo-1528127269322-539801943592",
  srilanka: "https://images.unsplash.com/photo-1546708973-b339540b5162",
  colombo: "https://images.unsplash.com/photo-1546708973-b339540b5162",
  indonesia: "https://images.unsplash.com/photo-1537996194471-e657df975ab4",
  bhutan: "https://images.unsplash.com/photo-1578632767115-351597cf2477",
  cambodia: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
  philippines: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86",

  // International Tier B (Mid-Cost Hubs & Middle East)
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c",
  abudhabi: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c",
  uae: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c",
  singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd",
  malaysia: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07",
  kualalumpur: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07",
  turkey: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200",
  istanbul: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200",
  egypt: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368",
  cairo: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368",
  oman: "https://images.unsplash.com/photo-1578895210405-907db486c111",
  qatar: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7",
  doha: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7",
  georgia: "https://images.unsplash.com/photo-1565008447742-97f6f38c985c",

  // International Tier C (Western & High-Cost Hubs)
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
  france: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad",
  uk: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad",
  tokyo: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26",
  japan: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26",
  newyork: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9",
  usa: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9",
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5",
  italy: "https://images.unsplash.com/photo-1552832230-c0197dd311b5",
  switzerland: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99",
  europe: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b",
  australia: "https://images.unsplash.com/photo-1523482580672-f109ba8cb9be",
  sydney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9",
};

/**
 * Resolves a destination string to a curated background image.
 * Uses exact alias matching first, followed by substring search sorted by length.
 * Falls back to DEFAULT_HERO_IMAGE if input is empty or unrecognized.
 *
 * @param {string} destinationName
 * @returns {{ url: string, isFallback: boolean, key: string }}
 */
export function getDestinationImage(destinationName) {
  if (!destinationName || typeof destinationName !== "string") {
    return { url: DEFAULT_HERO_IMAGE, isFallback: true, key: "default" };
  }

  const clean = destinationName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) {
    return { url: DEFAULT_HERO_IMAGE, isFallback: true, key: "default" };
  }

  // 1. Direct match on normalized key
  if (DESTINATION_HERO_MAP[clean]) {
    return { url: DESTINATION_HERO_MAP[clean], isFallback: false, key: clean };
  }

  // 2. Substring matching: longest key first to prioritize specific hubs (e.g. "kuala lumpur" or "abu dhabi")
  const sortedKeys = Object.keys(DESTINATION_HERO_MAP).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (clean.includes(key)) {
      return { url: DESTINATION_HERO_MAP[key], isFallback: false, key };
    }
  }

  // 3. Reverse substring match if user typed a shorter recognized prefix (e.g. "switz" for switzerland)
  if (clean.length >= 4) {
    for (const key of sortedKeys) {
      if (key.startsWith(clean)) {
        return { url: DESTINATION_HERO_MAP[key], isFallback: false, key };
      }
    }
  }

  // 4. Default fallback to initial preloaded hero image
  return { url: DEFAULT_HERO_IMAGE, isFallback: true, key: "default" };
}

// Preserve backward-compatible default export
const destinationImages = {
  ...DESTINATION_HERO_MAP,
  Manali: DESTINATION_HERO_MAP.manali,
  Goa: DESTINATION_HERO_MAP.goa,
  Jaipur: DESTINATION_HERO_MAP.jaipur,
  Kerala: DESTINATION_HERO_MAP.kerala,
  Ladakh: DESTINATION_HERO_MAP.ladakh,
  Rishikesh: DESTINATION_HERO_MAP.rishikesh,
  Udaipur: DESTINATION_HERO_MAP.udaipur,
  Darjeeling: DESTINATION_HERO_MAP.darjeeling,
  Andaman: DESTINATION_HERO_MAP.andaman,
  Shimla: DESTINATION_HERO_MAP.shimla,
  Varanasi: DESTINATION_HERO_MAP.varanasi,
  Kashmir: DESTINATION_HERO_MAP.kashmir,
  DEFAULT_HERO_IMAGE,
  getDestinationImage,
};

export default destinationImages;
