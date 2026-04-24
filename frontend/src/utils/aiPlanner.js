export function generateTripPlan({ budget, days, interest }) {
  let destination = "";
  let places = [];

  // 🎯 DESTINATION LOGIC
  if (budget < 15000) {
    destination = "Rishikesh";
    places = ["Ganga Aarti", "River Rafting", "Neer Waterfall", "Laxman Jhula"];
  } else if (budget < 30000) {
    destination = "Manali";
    places = ["Solang Valley", "Rohtang Pass", "Mall Road", "Hadimba Temple"];
  } else {
    destination = "Goa";
    places = ["Baga Beach", "Fort Aguada", "Anjuna Market", "Calangute Beach"];
  }

  // 🧠 DIFFERENT ITINERARY
  const itinerary = [];

  for (let i = 0; i < days; i++) {
    itinerary.push(`Day ${i + 1}: Visit ${places[i % places.length]}`);
  }

  // 💰 COST
  const estimatedCost = budget - 2000;

  return {
    destination,
    itinerary,
    estimatedCost,
  };
}