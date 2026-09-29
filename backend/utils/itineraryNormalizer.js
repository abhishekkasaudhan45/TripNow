// backend/utils/itineraryNormalizer.js

/**
 * Parses title and description from a legacy text string.
 */
function extractTitleAndDesc(text) {
  if (!text || typeof text !== "string") {
    return { title: "Explore Destination", description: "Scheduled activity" };
  }

  const clean = text.trim();

  // Pattern 1: Title — Description (em-dash)
  if (clean.includes(" — ")) {
    const parts = clean.split(" — ");
    return {
      title: parts[0].trim(),
      description: parts.slice(1).join(" — ").trim() || parts[0].trim(),
    };
  }

  // Pattern 2: Title - Description (hyphen)
  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    return {
      title: parts[0].trim(),
      description: parts.slice(1).join(" - ").trim() || parts[0].trim(),
    };
  }

  // Pattern 3: Title: Description (colon)
  if (clean.includes(": ")) {
    const parts = clean.split(": ");
    return {
      title: parts[0].trim(),
      description: parts.slice(1).join(": ").trim() || parts[0].trim(),
    };
  }

  // Pattern 4: Plain text fallback
  const firstSentence = clean.split(". ")[0];
  const title = firstSentence.length <= 60 ? firstSentence : clean.slice(0, 50) + "...";

  return {
    title,
    description: clean,
  };
}

/**
 * Normalizes any itinerary document into the Phase 2 Structured Activity format
 * while synchronizing legacy block fields for 100% backward compatibility.
 */
function normalizeItinerary(rawPlan) {
  let isString = false;
  let plan = rawPlan;

  if (typeof rawPlan === "string") {
    isString = true;
    try {
      plan = JSON.parse(rawPlan);
    } catch {
      return { plan: rawPlan, isString };
    }
  }

  if (!plan || typeof plan !== "object" || !Array.isArray(plan.days)) {
    return { plan, isString };
  }

  const normalizedDays = plan.days.map((dayObj, dayIdx) => {
    const dayNumber = Number(dayObj.day) || dayIdx + 1;
    const day = { ...dayObj, day: dayNumber };

    // Check if activities array already exists and is structured
    const hasActivities = Array.isArray(day.activities) && day.activities.length > 0;

    if (hasActivities) {
      // Ensure all activities have required Phase 2 fields
      day.activities = day.activities.map((act, actIdx) => {
        const period = act.period || (actIdx === 0 ? "morning" : actIdx === 1 ? "afternoon" : "evening");
        const defaultId = `d${dayNumber}-${period}-${String(actIdx + 1).padStart(2, "0")}`;

        const hasExplicitDuration = typeof act.durationMinutes === "number" && !Number.isNaN(act.durationMinutes);
        return {
          id: act.id || defaultId,
          period,
          title: act.title || act.name || "Activity",
          description: act.description || act.title || "Scheduled activity",
          category: act.category || (period === "evening" ? "Dining & Nightlife" : "Sightseeing"),
          durationMinutes: hasExplicitDuration ? act.durationMinutes : 120,
          durationInferred: !hasExplicitDuration,
          cost: act.cost || act.costEstimate || "Moderate",
          indoorOutdoor: ["Indoor", "Outdoor", "Mixed"].includes(act.indoorOutdoor) ? act.indoorOutdoor : "Mixed",
          location: act.location || null,
          locked: Boolean(act.locked),
        };
      });
    } else {
      // Synthesize activities from legacy morning, afternoon, evening blocks
      const synthesized = [];
      const periods = ["morning", "afternoon", "evening"];

      periods.forEach((period, idx) => {
        const blockText = day[period];
        if (blockText && typeof blockText === "string") {
          const { title, description } = extractTitleAndDesc(blockText);
          synthesized.push({
            id: `d${dayNumber}-${period}-01`,
            period,
            title,
            description,
            category: period === "evening" ? "Dining & Nightlife" : "Sightseeing",
            durationMinutes: 120,
            durationInferred: true,
            cost: "Moderate",
            indoorOutdoor: "Mixed",
            location: null,
            locked: false,
          });
        }
      });

      day.activities = synthesized;
    }

    // Synchronize legacy period fields from activities only if missing
    ["morning", "afternoon", "evening"].forEach((period) => {
      if (!day[period]) {
        const match = day.activities.find((a) => a.period === period);
        if (match) {
          day[period] = `${match.title} — ${match.description}`;
        }
      }
    });

    return day;
  });

  plan.days = normalizedDays;

  return { plan, isString };
}

/**
 * Locate an activity within a normalized plan by activityId or dayNumber + block.
 */
function findActivityInPlan(plan, { activityId, dayNumber, block }) {
  if (!plan || !Array.isArray(plan.days)) return null;

  for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex++) {
    const day = plan.days[dayIndex];
    if (!Array.isArray(day.activities)) continue;

    for (let activityIndex = 0; activityIndex < day.activities.length; activityIndex++) {
      const act = day.activities[activityIndex];

      // Match by ID
      if (activityId && act.id === activityId) {
        return { day, activity: act, dayIndex, activityIndex };
      }

      // Match by day number + period block
      if (
        dayNumber !== undefined &&
        Number(day.day) === Number(dayNumber) &&
        block &&
        act.period === block
      ) {
        return { day, activity: act, dayIndex, activityIndex };
      }
    }
  }

  return null;
}

module.exports = {
  normalizeItinerary,
  findActivityInPlan,
  extractTitleAndDesc,
};
