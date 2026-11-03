/**
 * Curated canonical destination suggestions for autocomplete, hero discovery, and search.
 * Includes domestic Indian destinations and international tiers (Tier A, Tier B, Tier C).
 */

export const SUGGESTED_DESTINATIONS = [
  // Domestic
  { name: "Goa", region: "India", tier: "DOMESTIC", badge: "Domestic · Beach", emoji: "🏖️" },
  { name: "Manali", region: "India", tier: "DOMESTIC", badge: "Domestic · Mountain", emoji: "🏔️" },
  { name: "Jaipur", region: "India", tier: "DOMESTIC", badge: "Domestic · Heritage", emoji: "🏯" },
  { name: "Kerala", region: "India", tier: "DOMESTIC", badge: "Domestic · Nature", emoji: "🌴" },
  { name: "Ladakh", region: "India", tier: "DOMESTIC", badge: "Domestic · Adventure", emoji: "⛰️" },
  { name: "Rishikesh", region: "India", tier: "DOMESTIC", badge: "Domestic · Yoga", emoji: "🕉️" },
  { name: "Udaipur", region: "India", tier: "DOMESTIC", badge: "Domestic · Lakes", emoji: "🏰" },
  { name: "Andaman", region: "India", tier: "DOMESTIC", badge: "Domestic · Island", emoji: "🏝️" },
  { name: "Kashmir", region: "India", tier: "DOMESTIC", badge: "Domestic · Valley", emoji: "❄️" },
  { name: "Varanasi", region: "India", tier: "DOMESTIC", badge: "Domestic · Spiritual", emoji: "🪔" },
  { name: "Mumbai", region: "India", tier: "DOMESTIC", badge: "Domestic · Metro", emoji: "🌆" },
  { name: "Delhi", region: "India", tier: "DOMESTIC", badge: "Domestic · Metro", emoji: "🏛️" },

  // International Tier A (Budget Neighbors & Southeast Asia)
  { name: "Nepal", region: "South Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇳🇵" },
  { name: "Thailand", region: "Southeast Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇹🇭" },
  { name: "Vietnam", region: "Southeast Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇻🇳" },
  { name: "Sri Lanka", region: "South Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇱🇰" },
  { name: "Indonesia", region: "Southeast Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇮🇩" },
  { name: "Bhutan", region: "South Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇧🇹" },
  { name: "Philippines", region: "Southeast Asia", tier: "GLOBAL_TIER_A", badge: "Tier A · Budget", emoji: "🇵🇭" },

  // International Tier B (Mid-Cost Hubs & Middle East)
  { name: "Bali", region: "Indonesia", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🌺" },
  { name: "Dubai", region: "UAE", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🏙️" },
  { name: "Singapore", region: "Southeast Asia", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🦁" },
  { name: "Abu Dhabi", region: "UAE", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🕌" },
  { name: "Malaysia", region: "Southeast Asia", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🇲🇾" },
  { name: "Turkey", region: "Eurasia", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🇹🇷" },
  { name: "Egypt", region: "North Africa", tier: "GLOBAL_TIER_B", badge: "Tier B · Mid-Cost", emoji: "🇪🇬" },

  // International Tier C (Western & High-Cost Hubs)
  { name: "Paris", region: "France", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🗼" },
  { name: "London", region: "UK", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🇬🇧" },
  { name: "Tokyo", region: "Japan", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🗾" },
  { name: "Switzerland", region: "Europe", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🇨🇭" },
  { name: "Rome", region: "Italy", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🏛️" },
  { name: "New York", region: "USA", tier: "GLOBAL_TIER_C", badge: "Tier C · Western", emoji: "🗽" },
  { name: "Europe", region: "Schengen", tier: "GLOBAL_TIER_C", badge: "Tier C · Regional", emoji: "🇪🇺" },
];

/**
 * Filter suggested destinations matching user query.
 * If query is empty, returns curated top destinations.
 */
export function getMatchingSuggestions(query, limit = 7) {
  if (!query || !query.trim()) {
    // Top curated recommendations when empty
    return [
      SUGGESTED_DESTINATIONS[0], // Goa
      SUGGESTED_DESTINATIONS[1], // Manali
      SUGGESTED_DESTINATIONS[18], // Bali
      SUGGESTED_DESTINATIONS[19], // Dubai
      SUGGESTED_DESTINATIONS[13], // Thailand
      SUGGESTED_DESTINATIONS[25], // Paris
      SUGGESTED_DESTINATIONS[27], // Tokyo
    ].slice(0, limit);
  }

  const clean = query.toLowerCase().trim();
  const filtered = SUGGESTED_DESTINATIONS.filter((d) => {
    return (
      d.name.toLowerCase().includes(clean) ||
      d.region.toLowerCase().includes(clean) ||
      d.badge.toLowerCase().includes(clean)
    );
  });

  return filtered.slice(0, limit);
}

export default {
  SUGGESTED_DESTINATIONS,
  getMatchingSuggestions,
};

