// backend/tests/phase5d5SharedTripAndPdfMetadata.test.js
const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const {
  sanitizeStructuredActivity,
  sanitizeDay,
  sanitizePublicAiPlan,
  formatPublicTrip,
} = require("../controllers/Sharedtripcontroller");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Phase 5D.5 — Shared Trip Metadata Sanitization & Security", () => {
  describe("1. Unit Sanitization: sanitizeStructuredActivity", () => {
    it("preserves valid canonical metadata fields (activityType, durationMinutes, travelMode, intensity)", () => {
      const rawActivity = {
        id: "act-101",
        period: "morning",
        title: "Senso-ji Temple",
        description: "Visit historic Buddhist temple",
        category: "Culture",
        activityType: "culture",
        durationMinutes: 120,
        travelMode: "public_transport",
        intensity: "low",
        durationInferred: false,
        cost: "Free",
        indoorOutdoor: "Mixed",
        location: "Asakusa",
      };

      const result = sanitizeStructuredActivity(rawActivity);

      expect(result).toBeDefined();
      expect(result.id).toBe("act-101");
      expect(result.title).toBe("Senso-ji Temple");
      expect(result.activityType).toBe("culture");
      expect(result.durationMinutes).toBe(120);
      expect(result.travelMode).toBe("public_transport");
      expect(result.intensity).toBe("low");
      expect(result.durationInferred).toBeUndefined(); // false is omitted or undefined
      expect(result.cost).toBe("Free");
      expect(result.indoorOutdoor).toBe("Mixed");
      expect(result.location).toBe("Asakusa");
    });

    it("preserves durationInferred: true when duration is an estimate", () => {
      const rawActivity = {
        title: "Mountain Hike",
        durationMinutes: 240,
        durationInferred: true,
        activityType: "adventure",
        travelMode: "walking",
        intensity: "high",
      };

      const result = sanitizeStructuredActivity(rawActivity);

      expect(result.durationMinutes).toBe(240);
      expect(result.durationInferred).toBe(true);
      expect(result.activityType).toBe("adventure");
      expect(result.travelMode).toBe("walking");
      expect(result.intensity).toBe("high");
    });

    it("rejects invalid enum values and omits them from output", () => {
      const rawActivity = {
        title: "Exotic Tour",
        activityType: "space_travel", // invalid enum
        travelMode: "teleportation",  // invalid enum
        intensity: "extreme",        // invalid enum
        durationMinutes: 60,
      };

      const result = sanitizeStructuredActivity(rawActivity);

      expect(result.title).toBe("Exotic Tour");
      expect(result.durationMinutes).toBe(60);
      expect(result.activityType).toBeUndefined();
      expect(result.travelMode).toBeUndefined();
      expect(result.intensity).toBeUndefined();
    });

    it("rejects invalid durations and sets durationMinutes to null without fabricating defaults", () => {
      // Under range (< 15)
      const underRange = sanitizeStructuredActivity({ title: "Quick stop", durationMinutes: 10 });
      expect(underRange.durationMinutes).toBeNull();

      // Over range (> 720)
      const overRange = sanitizeStructuredActivity({ title: "Overnight trek", durationMinutes: 800 });
      expect(overRange.durationMinutes).toBeNull();

      // Non-integer string / float
      const nonInt = sanitizeStructuredActivity({ title: "Tour", durationMinutes: 45.5 });
      expect(nonInt.durationMinutes).toBeNull();

      const invalidStr = sanitizeStructuredActivity({ title: "Tour", durationMinutes: "two hours" });
      expect(invalidStr.durationMinutes).toBeNull();
    });

    it("handles null and missing metadata gracefully", () => {
      const emptyAct = sanitizeStructuredActivity({
        title: "Simple Walk",
      });

      expect(emptyAct.title).toBe("Simple Walk");
      expect(emptyAct.durationMinutes).toBeNull();
      expect(emptyAct.activityType).toBeUndefined();
      expect(emptyAct.travelMode).toBeUndefined();
      expect(emptyAct.intensity).toBeUndefined();
      expect(emptyAct.durationInferred).toBeUndefined();
    });

    it("preserves historical activities without canonical metadata", () => {
      const legacyAct = {
        id: "legacy-1",
        title: "Ancient Castle",
        category: "Historical Site",
        cost: "₹500",
        indoorOutdoor: "Outdoor",
      };

      const result = sanitizeStructuredActivity(legacyAct);

      expect(result.title).toBe("Ancient Castle");
      expect(result.category).toBe("Historical Site");
      expect(result.cost).toBe("₹500");
      expect(result.indoorOutdoor).toBe("Outdoor");
      expect(result.durationMinutes).toBeNull();
      expect(result.activityType).toBeUndefined();
    });

    it("strips arbitrary private properties from activity objects", () => {
      const maliciousActivity = {
        title: "VIP Lounge",
        activityType: "relaxation",
        durationMinutes: 90,
        // Secret or private fields that must be stripped:
        secretAccessPasscode: "PASS-9988",
        internalStaffNotes: "Escort through back entrance",
        clientCreditCardDigits: "4242",
        billingAmountUsd: 1500,
        bookingPnr: "PNR-SECRET-001",
      };

      const result = sanitizeStructuredActivity(maliciousActivity);

      expect(result.title).toBe("VIP Lounge");
      expect(result.activityType).toBe("relaxation");
      expect(result.durationMinutes).toBe(90);

      // Verify all private fields are completely stripped
      expect(result.secretAccessPasscode).toBeUndefined();
      expect(result.internalStaffNotes).toBeUndefined();
      expect(result.clientCreditCardDigits).toBeUndefined();
      expect(result.billingAmountUsd).toBeUndefined();
      expect(result.bookingPnr).toBeUndefined();
    });
  });

  describe("2. End-to-End Shared Trip Endpoint (/api/bookings/shared/:id)", () => {
    let owner;
    let sharedTrip;
    let privateTrip;

    beforeEach(async () => {
      owner = await User.create({
        name: "Test Traveler",
        email: "traveler@tripnow-security.com",
        password: "StrongPassword123!",
        role: "user",
      });

      sharedTrip = await Booking.create({
        user: owner._id,
        fullName: "Test Traveler",
        email: "traveler@tripnow-security.com",
        phone: "+91 9876543210",
        notes: "Confidential executive travel instructions",
        destination: "Tokyo, Japan",
        guests: 2,
        checkin: new Date("2026-11-10T00:00:00.000Z"),
        checkout: new Date("2026-11-15T00:00:00.000Z"),
        budget: "250000",
        dayCount: 5,
        isShared: true,
        aiPlan: {
          destination: "Tokyo, Japan",
          days: [
            {
              day: 1,
              title: "Modern & Historic Tokyo",
              morning: "Visit Meiji Shrine",
              afternoon: "Walk Shibuya Crossing",
              evening: "Dinner in Shinjuku",
              food: ["Ramen", "Yakitori"],
              activities: [
                {
                  id: "d1-morning-01",
                  period: "morning",
                  title: "Meiji Shrine Exploration",
                  description: "Shinto shrine surrounded by serene forest",
                  activityType: "culture",
                  durationMinutes: 90,
                  travelMode: "walking",
                  intensity: "low",
                  cost: "Free",
                  indoorOutdoor: "Outdoor",
                  location: "Shibuya",
                  // Private field:
                  privateTourGuidePhone: "+81-80-0000-1111",
                },
                {
                  id: "d1-afternoon-01",
                  period: "afternoon",
                  title: "Shibuya Crossing & Sky",
                  description: "Iconic scramble crossing and observation deck",
                  activityType: "sightseeing",
                  durationMinutes: 120,
                  durationInferred: true,
                  travelMode: "public_transport",
                  intensity: "moderate",
                  cost: "¥2000",
                  indoorOutdoor: "Mixed",
                  location: "Shibuya",
                  // Private field:
                  vipAccessCard: "CARD-SECRET-777",
                },
              ],
            },
          ],
        },
      });

      privateTrip = await Booking.create({
        user: owner._id,
        fullName: "Test Traveler",
        email: "traveler@tripnow-security.com",
        destination: "Secret Hideaway",
        guests: 1,
        checkin: new Date("2026-12-01T00:00:00.000Z"),
        checkout: new Date("2026-12-05T00:00:00.000Z"),
        isShared: false,
      });
    });

    it("returns 200 with sanitized metadata and strips private fields for shared trips", async () => {
      const res = await request(app).get(`/api/bookings/shared/${sharedTrip._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const tripData = res.body.data;
      expect(tripData.destination).toBe("Tokyo, Japan");
      expect(tripData.isShared).toBe(true);

      // Verify user PII is stripped
      expect(tripData.user).toBeUndefined();
      expect(tripData.fullName).toBeUndefined();
      expect(tripData.email).toBeUndefined();
      expect(tripData.phone).toBeUndefined();
      expect(tripData.notes).toBeUndefined();

      // Verify structured activities have metadata preserved
      const day1 = tripData.aiPlan.days[0];
      expect(day1.activities).toHaveLength(2);

      const act1 = day1.activities[0];
      expect(act1.title).toBe("Meiji Shrine Exploration");
      expect(act1.activityType).toBe("culture");
      expect(act1.durationMinutes).toBe(90);
      expect(act1.travelMode).toBe("walking");
      expect(act1.intensity).toBe("low");
      expect(act1.cost).toBe("Free");
      expect(act1.privateTourGuidePhone).toBeUndefined();

      const act2 = day1.activities[1];
      expect(act2.title).toBe("Shibuya Crossing & Sky");
      expect(act2.activityType).toBe("sightseeing");
      expect(act2.durationMinutes).toBe(120);
      expect(act2.durationInferred).toBe(true);
      expect(act2.travelMode).toBe("public_transport");
      expect(act2.intensity).toBe("moderate");
      expect(act2.vipAccessCard).toBeUndefined();

      // Ensure no private leaks anywhere in JSON response
      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain("+81-80-0000-1111");
      expect(rawJson).not.toContain("CARD-SECRET-777");
      expect(rawJson).not.toContain("traveler@tripnow-security.com");
      expect(rawJson).not.toContain("Confidential executive travel instructions");
    });

    it("rejects private trips with HTTP 404", async () => {
      const res = await request(app).get(`/api/bookings/shared/${privateTrip._id}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found or is private/i);
    });
  });
});

