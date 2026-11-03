// backend/tests/activityMetadataContract.test.js
const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const {
  normalizeItinerary,
  normalizeActivityType,
  normalizeDurationMinutes,
  normalizeTravelMode,
  normalizeIntensity,
  ALLOWED_ACTIVITY_TYPES,
  ALLOWED_TRAVEL_MODES,
  ALLOWED_INTENSITIES,
} = require("../utils/itineraryNormalizer");
const {
  generateItinerary,
  itinerarySchema,
  validateItinerary,
} = require("../services/aiService");
const { GoogleGenAI } = require("@google/genai");

jest.mock("@google/genai");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const testUser = {
  name: "Metadata Tester",
  email: "meta.tester@tripnow.test",
  password: "Password123!",
};

describe("Phase 5D.2 — Backend Activity Metadata Contract & Normalization", () => {
  describe("1. Valid Activity Metadata Normalization", () => {
    it("normalizes and preserves valid metadata enum values and duration", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                period: "morning",
                title: "Rijksmuseum",
                description: "Dutch Golden Age art museum",
                activityType: "culture",
                durationMinutes: 150,
                travelMode: "walking",
                intensity: "low",
                cost: "€22.50",
                indoorOutdoor: "Indoor",
                locked: false,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      const act = normalized.days[0].activities[0];

      expect(act.activityType).toBe("culture");
      expect(act.durationMinutes).toBe(150);
      expect(act.durationInferred).toBe(false);
      expect(act.travelMode).toBe("walking");
      expect(act.intensity).toBe("low");
      expect(act.title).toBe("Rijksmuseum");
    });

    it("normalizes casing and whitespace for enum values safely", () => {
      expect(normalizeActivityType("  CULTURE  ")).toBe("culture");
      expect(normalizeActivityType("Sightseeing")).toBe("sightseeing");
      expect(normalizeTravelMode(" PUBLIC_TRANSPORT ")).toBe("public_transport");
      expect(normalizeTravelMode("walking")).toBe("walking");
      expect(normalizeIntensity(" HIGH ")).toBe("high");
      expect(normalizeIntensity("Moderate")).toBe("moderate");
    });
  });

  describe("2. Invalid Activity Type Normalization", () => {
    it("returns null for unrecognized activityType and never fabricates 'sightseeing'", () => {
      expect(normalizeActivityType("party_club")).toBeNull();
      expect(normalizeActivityType("extreme_sports")).toBeNull();
      expect(normalizeActivityType(123)).toBeNull();
      expect(normalizeActivityType(null)).toBeNull();
      expect(normalizeActivityType(undefined)).toBeNull();

      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Skydiving",
                activityType: "unrecognized_type",
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].activityType).toBeNull();
    });
  });

  describe("3. Invalid Duration Values Normalization", () => {
    it("rejects non-integer, negative, zero, below 15, or above 720 minutes without fabricating 120", () => {
      // Below 15
      expect(normalizeDurationMinutes({ durationMinutes: 10 }).durationMinutes).toBeNull();
      // Zero
      expect(normalizeDurationMinutes({ durationMinutes: 0 }).durationMinutes).toBeNull();
      // Negative
      expect(normalizeDurationMinutes({ durationMinutes: -60 }).durationMinutes).toBeNull();
      // Above 720 (12 hours)
      expect(normalizeDurationMinutes({ durationMinutes: 750 }).durationMinutes).toBeNull();
      // Fractional
      expect(normalizeDurationMinutes({ durationMinutes: 45.5 }).durationMinutes).toBeNull();
      // Non-numeric
      expect(normalizeDurationMinutes({ durationMinutes: "two_hours" }).durationMinutes).toBeNull();

      // Valid boundary values
      expect(normalizeDurationMinutes({ durationMinutes: 15 }).durationMinutes).toBe(15);
      expect(normalizeDurationMinutes({ durationMinutes: 720 }).durationMinutes).toBe(720);
    });
  });

  describe("4. Invalid Travel Mode Normalization", () => {
    it("returns null for unrecognized travelMode and never fabricates 'walking'", () => {
      expect(normalizeTravelMode("spaceship")).toBeNull();
      expect(normalizeTravelMode("scooter")).toBeNull();
      expect(normalizeTravelMode("")).toBeNull();

      const plan = {
        days: [
          {
            day: 1,
            activities: [{ title: "Museum", travelMode: "unsupported_mode" }],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].travelMode).toBeNull();
    });
  });

  describe("5. Invalid Intensity Normalization", () => {
    it("returns null for unrecognized intensity and never fabricates 'moderate'", () => {
      expect(normalizeIntensity("insane")).toBeNull();
      expect(normalizeIntensity("exhausting")).toBeNull();
      expect(normalizeIntensity("chill")).toBeNull();

      const plan = {
        days: [
          {
            day: 1,
            activities: [{ title: "Hike", intensity: "super_hard" }],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].intensity).toBeNull();
    });
  });

  describe("6. Missing Metadata Normalization", () => {
    it("sets missing metadata fields to null without fabricating arbitrary defaults", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                period: "morning",
                title: "City Walk",
                description: "Stroll around central square",
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      const act = normalized.days[0].activities[0];

      expect(act.activityType).toBeNull();
      expect(act.durationMinutes).toBeNull();
      expect(act.durationInferred).toBe(false);
      expect(act.travelMode).toBeNull();
      expect(act.intensity).toBeNull();
    });
  });

  describe("7. Null Metadata Normalization", () => {
    it("cleanly preserves explicit null values without altering them", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Viewpoint",
                activityType: null,
                durationMinutes: null,
                travelMode: null,
                intensity: null,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      const act = normalized.days[0].activities[0];

      expect(act.activityType).toBeNull();
      expect(act.durationMinutes).toBeNull();
      expect(act.travelMode).toBeNull();
      expect(act.intensity).toBeNull();
    });
  });

  describe("8. Historical Activity with No Metadata", () => {
    it("preserves historical activity fields and adds null metadata without schema failure", () => {
      const historicalPlan = {
        destination: "Rome, Italy",
        days: [
          {
            day: 1,
            title: "Ancient Rome",
            activities: [
              {
                id: "hist-01",
                period: "morning",
                title: "Colosseum",
                description: "Visit the iconic amphitheatre",
                category: "Sightseeing",
                durationMinutes: 180,
                cost: "€16",
                indoorOutdoor: "Mixed",
                locked: true,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(historicalPlan);
      const act = normalized.days[0].activities[0];

      expect(act.id).toBe("hist-01");
      expect(act.title).toBe("Colosseum");
      expect(act.category).toBe("Sightseeing");
      expect(act.durationMinutes).toBe(180);
      expect(act.locked).toBe(true);
      expect(act.activityType).toBeNull();
      expect(act.travelMode).toBeNull();
      expect(act.intensity).toBeNull();
    });
  });

  describe("9. Existing durationInferred Semantics", () => {
    it("preserves explicit durationInferred=true when duration was inferred", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Beach Stroll",
                durationMinutes: 120,
                durationInferred: true,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].durationMinutes).toBe(120);
      expect(normalized.days[0].activities[0].durationInferred).toBe(true);
    });

    it("marks durationInferred=false when duration is explicitly provided", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Quick Coffee",
                durationMinutes: 45,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].durationMinutes).toBe(45);
      expect(normalized.days[0].activities[0].durationInferred).toBe(false);
    });

    it("maps estimatedDurationMinutes from Pivot to durationMinutes with durationInferred=false", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Pivot Replacement Activity",
                estimatedDurationMinutes: 60,
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      expect(normalized.days[0].activities[0].durationMinutes).toBe(60);
      expect(normalized.days[0].activities[0].durationInferred).toBe(false);
    });
  });

  describe("10. Preservation of Unrelated Activity Fields", () => {
    it("preserves custom properties on activities during normalization", () => {
      const plan = {
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                title: "Local Market",
                insiderTip: "Arrive before 9 AM for fresh pastries",
                customTags: ["foodie", "morning"],
                venuePhone: "+31 20 1234567",
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(plan);
      const act = normalized.days[0].activities[0];

      expect(act.insiderTip).toBe("Arrive before 9 AM for fresh pastries");
      expect(act.customTags).toEqual(["foodie", "morning"]);
      expect(act.venuePhone).toBe("+31 20 1234567");
    });
  });

  describe("11. Initial Gemini Response with Metadata", () => {
    it("includes activities schema and parses valid Gemini metadata response", () => {
      // Verify itinerarySchema contains activities definitions
      const daysProp = itinerarySchema.properties.days.items.properties;
      expect(daysProp.activities).toBeDefined();
      expect(daysProp.activities.type).toBe("ARRAY");

      const actProps = daysProp.activities.items.properties;
      expect(actProps.activityType.enum).toEqual(ALLOWED_ACTIVITY_TYPES);
      expect(actProps.travelMode.enum).toEqual(ALLOWED_TRAVEL_MODES);
      expect(actProps.intensity.enum).toEqual(ALLOWED_INTENSITIES);

      // Verify validateItinerary accepts structured activities
      const validResponse = {
        destination: "Kyoto, Japan",
        days: [
          {
            day: 1,
            title: "Historic Temples",
            morning: "Kinkaku-ji — Golden Pavilion",
            afternoon: "Ryoan-ji — Zen rock garden",
            evening: "Gion district dinner",
            food: ["Matcha Parfait"],
            activities: [
              {
                period: "morning",
                title: "Kinkaku-ji",
                description: "Visit the Golden Pavilion",
                activityType: "culture",
                durationMinutes: 90,
                travelMode: "public_transport",
                intensity: "low",
              },
            ],
          },
        ],
        mustEat: ["Ramen"],
        budgetBreakdown: { accommodation: "5000", foodPerDay: "2000", transport: "1000", activities: "2000", total: "10000" },
        travelTips: ["Buy IC card"],
        whereToStay: { budget: "Hostel", midRange: "Ryokan" },
        bestTimeToVisit: "Autumn",
      };

      expect(validateItinerary(validResponse)).toBe(true);
    });
  });

  describe("12. Invalid Gemini Metadata Normalization", () => {
    it("sanitizes invalid Gemini metadata to null instead of failing", () => {
      const geminiOutputWithInvalidData = {
        destination: "Berlin",
        days: [
          {
            day: 1,
            activities: [
              {
                id: "d1-morning-01",
                period: "morning",
                title: "Brandenburg Gate",
                description: "Historic monument",
                activityType: "not_a_real_type",
                durationMinutes: 99999, // Way too long
                travelMode: "hovercraft",
                intensity: "hardcore",
              },
            ],
          },
        ],
      };

      const { plan: normalized } = normalizeItinerary(geminiOutputWithInvalidData);
      const act = normalized.days[0].activities[0];

      expect(act.activityType).toBeNull();
      expect(act.durationMinutes).toBeNull();
      expect(act.travelMode).toBeNull();
      expect(act.intensity).toBeNull();
    });
  });

  describe("13. Existing Booking Compatibility & Persistence API", () => {
    it("persists valid activity metadata via PATCH /api/bookings/:id/itinerary", async () => {
      // 1. Create user and obtain auth cookie + CSRF
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const authCookie = signupRes.headers["set-cookie"];

      const csrfRes = await request(app).get("/api/csrf-token").set("Cookie", authCookie);
      const csrfToken = csrfRes.body.csrfToken;

      // 2. Create Booking in database
      const booking = await Booking.create({
        user: signupRes.body.data.user.id,
        destination: "Tokyo",
        guests: 2,
        checkin: new Date("2026-11-10"),
        checkout: new Date("2026-11-15"),
        aiPlan: {
          days: [
            {
              day: 1,
              title: "Shibuya & Shinjuku",
              morning: "Shibuya Crossing",
              afternoon: "Meiji Shrine",
              evening: "Omoide Yokocho",
              activities: [
                { id: "d1-morning-01", period: "morning", title: "Shibuya Crossing", locked: false },
              ],
            },
          ],
        },
      });

      // 3. Update with new metadata contract
      const updatePayload = {
        itinerary: {
          days: [
            {
              day: 1,
              title: "Shibuya & Shinjuku",
              activities: [
                {
                  id: "d1-morning-01",
                  period: "morning",
                  title: "Shibuya Crossing",
                  description: "World famous scramble crossing",
                  activityType: "sightseeing",
                  durationMinutes: 45,
                  travelMode: "public_transport",
                  intensity: "moderate",
                  locked: false,
                },
              ],
            },
          ],
        },
        baseVersion: booking.__v,
      };

      const patchRes = await request(app)
        .patch(`/api/bookings/${booking._id}/itinerary`)
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken)
        .send(updatePayload);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);

      const updated = await Booking.findById(booking._id);
      expect(updated.__v).toBe(booking.__v + 1);

      const parsedPlan = typeof updated.aiPlan === "string" ? JSON.parse(updated.aiPlan) : updated.aiPlan;
      const updatedAct = parsedPlan.days[0].activities[0];
      expect(updatedAct.activityType).toBe("sightseeing");
      expect(updatedAct.durationMinutes).toBe(45);
      expect(updatedAct.travelMode).toBe("public_transport");
      expect(updatedAct.intensity).toBe("moderate");
    });

    it("rejects invalid activityType with HTTP 400 validation error", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        name: "Validator User",
        email: "validator@tripnow.test",
        password: "Password123!",
      });
      const authCookie = signupRes.headers["set-cookie"];

      const csrfRes = await request(app).get("/api/csrf-token").set("Cookie", authCookie);
      const csrfToken = csrfRes.body.csrfToken;

      const booking = await Booking.create({
        user: signupRes.body.data.user.id,
        destination: "London",
        guests: 1,
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-25"),
        aiPlan: { days: [{ day: 1 }] },
      });

      const invalidPayload = {
        itinerary: {
          days: [
            {
              day: 1,
              activities: [
                {
                  id: "d1-morning-01",
                  title: "Tower Bridge",
                  activityType: "illegal_type_not_in_enum",
                },
              ],
            },
          ],
        },
        baseVersion: booking.__v,
      };

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/itinerary`)
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects invalid durationMinutes with HTTP 400 validation error", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        name: "Duration User",
        email: "duration@tripnow.test",
        password: "Password123!",
      });
      const authCookie = signupRes.headers["set-cookie"];

      const csrfRes = await request(app).get("/api/csrf-token").set("Cookie", authCookie);
      const csrfToken = csrfRes.body.csrfToken;

      const booking = await Booking.create({
        user: signupRes.body.data.user.id,
        destination: "London",
        guests: 1,
        checkin: new Date("2026-11-20"),
        checkout: new Date("2026-11-25"),
        aiPlan: { days: [{ day: 1 }] },
      });

      const invalidDurationPayload = {
        itinerary: {
          days: [
            {
              day: 1,
              activities: [
                {
                  id: "d1-morning-01",
                  title: "Big Ben",
                  durationMinutes: -15, // Negative
                },
              ],
            },
          ],
        },
        baseVersion: booking.__v,
      };

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/itinerary`)
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken)
        .send(invalidDurationPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("14. Lock and Optimistic Concurrency Invariants", () => {
    it("preserves locked status and rejects stale version conflicts", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        name: "Lock User",
        email: "lock@tripnow.test",
        password: "Password123!",
      });
      const authCookie = signupRes.headers["set-cookie"];

      const csrfRes = await request(app).get("/api/csrf-token").set("Cookie", authCookie);
      const csrfToken = csrfRes.body.csrfToken;

      const booking = await Booking.create({
        user: signupRes.body.data.user.id,
        destination: "Seoul",
        guests: 1,
        checkin: new Date("2026-12-01"),
        checkout: new Date("2026-12-05"),
        aiPlan: {
          days: [
            {
              day: 1,
              title: "Day 1",
              activities: [
                {
                  id: "d1-morning-01",
                  period: "morning",
                  title: "Gyeongbokgung Palace",
                  description: "Royal palace tour",
                  category: "Culture",
                  locked: true,
                },
              ],
            },
          ],
        },
      });

      // 1. Stale baseVersion conflict (409)
      const conflictRes = await request(app)
        .patch(`/api/bookings/${booking._id}/itinerary`)
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken)
        .send({
          itinerary: { days: [{ day: 1 }] },
          baseVersion: booking.__v + 5, // Stale version
        });

      expect(conflictRes.status).toBe(409);

      // 2. Locked activity modification rejection (423)
      const tamperLockedRes = await request(app)
        .patch(`/api/bookings/${booking._id}/itinerary`)
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken)
        .send({
          itinerary: {
            days: [
              {
                day: 1,
                activities: [
                  {
                    id: "d1-morning-01",
                    period: "morning",
                    title: "Tampered Palace Title",
                    description: "Modified description",
                    category: "Culture",
                    locked: true,
                  },
                ],
              },
            ],
          },
          baseVersion: booking.__v,
        });

      expect(tamperLockedRes.status).toBe(423);
    });
  });
});

