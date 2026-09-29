// backend/tests/normalizer.test.js
const {
  normalizeItinerary,
  findActivityInPlan,
  extractTitleAndDesc,
} = require("../utils/itineraryNormalizer");

describe("itineraryNormalizer - extractTitleAndDesc", () => {
  it("splits title and description with em-dash", () => {
    const res = extractTitleAndDesc("Calangute Beach — Relax on golden sands and try water sports");
    expect(res.title).toBe("Calangute Beach");
    expect(res.description).toBe("Relax on golden sands and try water sports");
  });

  it("splits title and description with hyphen", () => {
    const res = extractTitleAndDesc("Basilica of Bom Jesus - Explore UNESCO heritage church");
    expect(res.title).toBe("Basilica of Bom Jesus");
    expect(res.description).toBe("Explore UNESCO heritage church");
  });

  it("splits title and description with colon", () => {
    const res = extractTitleAndDesc("Fontainhas: Walk through colorful historic Portuguese quarter");
    expect(res.title).toBe("Fontainhas");
    expect(res.description).toBe("Walk through colorful historic Portuguese quarter");
  });

  it("handles plain sentence without delimiter", () => {
    const text = "Visit the local spice plantation in Ponda. Tour the fields and have a buffet lunch.";
    const res = extractTitleAndDesc(text);
    expect(res.title).toBe("Visit the local spice plantation in Ponda");
    expect(res.description).toBe(text);
  });
});

describe("itineraryNormalizer - normalizeItinerary", () => {
  const legacyPlan = {
    destination: "Goa, India",
    days: [
      {
        day: 1,
        title: "Coastal Explorer",
        morning: "Fort Aguada — Explore Portuguese coastal fort",
        afternoon: "Baga Beach — Beachside shacks and lunch",
        evening: "Anjuna Sunset — Evening walk and cafe dinner",
        food: ["Goan Fish Curry"],
      },
      {
        day: 2,
        title: "Old Goa Heritage",
        morning: "Se Cathedral — Historic religious complex",
        afternoon: "Archaeological Museum — Statues and paintings",
        evening: "Mandovi Cruise — River sunset boat tour",
        food: ["Bebinca"],
      },
    ],
  };

  it("synthesizes activities[] from legacy string blocks with stable IDs and default locked=false", () => {
    const { plan, isString } = normalizeItinerary(JSON.stringify(legacyPlan));

    expect(isString).toBe(true);
    expect(plan.days.length).toBe(2);

    // Day 1
    const d1Activities = plan.days[0].activities;
    expect(d1Activities.length).toBe(3);

    expect(d1Activities[0].id).toBe("d1-morning-01");
    expect(d1Activities[0].period).toBe("morning");
    expect(d1Activities[0].title).toBe("Fort Aguada");
    expect(d1Activities[0].locked).toBe(false);
    expect(d1Activities[0].durationMinutes).toBe(120);

    expect(d1Activities[1].id).toBe("d1-afternoon-01");
    expect(d1Activities[1].period).toBe("afternoon");
    expect(d1Activities[1].title).toBe("Baga Beach");

    expect(d1Activities[2].id).toBe("d1-evening-01");
    expect(d1Activities[2].period).toBe("evening");
    expect(d1Activities[2].title).toBe("Anjuna Sunset");

    // Backward compatibility: legacy blocks remain synchronized
    expect(plan.days[0].morning).toContain("Fort Aguada");
    expect(plan.days[0].afternoon).toContain("Baga Beach");
    expect(plan.days[0].evening).toContain("Anjuna Sunset");
  });

  it("preserves already-structured activities without overwriting existing IDs or locked states", () => {
    const structuredPlan = {
      destination: "Lisbon, Portugal",
      days: [
        {
          day: 1,
          title: "Historic Lisbon",
          activities: [
            {
              id: "custom-act-01",
              period: "morning",
              title: "Belem Tower",
              description: "Iconic medieval fortified tower",
              category: "Sightseeing",
              durationMinutes: 90,
              cost: "€8",
              indoorOutdoor: "Mixed",
              location: { name: "Belem" },
              locked: true,
            },
          ],
        },
      ],
    };

    const { plan } = normalizeItinerary(structuredPlan);
    const act = plan.days[0].activities[0];

    expect(act.id).toBe("custom-act-01");
    expect(act.locked).toBe(true);
    expect(act.durationMinutes).toBe(90);
    expect(act.cost).toBe("€8");
    expect(act.location.name).toBe("Belem");
  });
});

describe("itineraryNormalizer - findActivityInPlan", () => {
  const samplePlan = {
    days: [
      {
        day: 1,
        activities: [
          { id: "d1-morning-01", period: "morning", title: "Morning Walk", locked: false },
          { id: "d1-afternoon-01", period: "afternoon", title: "Beach Lunch", locked: true },
        ],
      },
    ],
  };

  it("finds activity by activityId", () => {
    const match = findActivityInPlan(samplePlan, { activityId: "d1-afternoon-01" });
    expect(match).not.toBeNull();
    expect(match.activity.title).toBe("Beach Lunch");
    expect(match.activity.locked).toBe(true);
    expect(match.dayIndex).toBe(0);
    expect(match.activityIndex).toBe(1);
  });

  it("finds activity by dayNumber and period block", () => {
    const match = findActivityInPlan(samplePlan, { dayNumber: 1, block: "morning" });
    expect(match).not.toBeNull();
    expect(match.activity.id).toBe("d1-morning-01");
    expect(match.activity.locked).toBe(false);
  });

  it("returns null if activity does not exist", () => {
    const match = findActivityInPlan(samplePlan, { activityId: "non-existent-id" });
    expect(match).toBeNull();
  });
});
