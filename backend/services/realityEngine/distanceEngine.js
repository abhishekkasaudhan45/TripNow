// backend/services/realityEngine/distanceEngine.js

const EARTH_RADIUS_KM = 6371;

/**
 * Validates whether an object represents a valid geographic coordinate.
 */
function isValidCoordinate(coord) {
  if (!coord || typeof coord !== "object") return false;
  const { lat, lng } = coord;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 * Returns distance in kilometers (rounded to 2 decimal places), or null if coordinates are invalid.
 */
function haversineDistanceKm(coord1, coord2) {
  if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) {
    return null;
  }

  // Exact same point optimization
  if (coord1.lat === coord2.lat && coord1.lng === coord2.lng) {
    return 0;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Evaluates route feasibility for a day's activities.
 * Gracefully handles missing coordinates (Stage A).
 */
function evaluateDayRoute(day) {
  const activities = Array.isArray(day?.activities) ? day.activities : [];
  if (activities.length < 2) {
    return {
      hasCoordinates: false,
      totalDistanceKm: 0,
      legs: [],
      anomalies: [],
    };
  }

  const legs = [];
  const anomalies = [];
  let validCoordCount = 0;
  let totalDistanceKm = 0;

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    if (isValidCoordinate(act.location)) {
      validCoordCount++;
    }

    if (i > 0) {
      const prevAct = activities[i - 1];
      const dist = haversineDistanceKm(prevAct.location, act.location);

      if (dist !== null) {
        totalDistanceKm += dist;
        legs.push({
          fromId: prevAct.id,
          toId: act.id,
          fromTitle: prevAct.title,
          toTitle: act.title,
          distanceKm: dist,
        });

        // Teleportation anomaly: Adjacent activities > 40 km apart
        if (dist > 40) {
          anomalies.push({
            id: `iss-teleport-${day.day}-${prevAct.id}-${act.id}`,
            type: "teleportation_risk",
            severity: "high",
            day: day.day,
            message: `Long distance (${dist} km) between "${prevAct.title}" and "${act.title}" may require significant transit time.`,
            fromActivityId: prevAct.id,
            toActivityId: act.id,
            isLocked: Boolean(prevAct.locked || act.locked),
          });
        }
      } else {
        legs.push({
          fromId: prevAct.id,
          toId: act.id,
          fromTitle: prevAct.title,
          toTitle: act.title,
          distanceKm: null,
          unresolved: true,
        });
      }
    }
  }

  const hasCoordinates = validCoordCount === activities.length;

  return {
    hasCoordinates,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    legs,
    anomalies,
  };
}

module.exports = {
  isValidCoordinate,
  haversineDistanceKm,
  evaluateDayRoute,
  EARTH_RADIUS_KM,
};
