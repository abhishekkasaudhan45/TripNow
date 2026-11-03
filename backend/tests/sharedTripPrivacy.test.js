const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Public Shared Trip Privacy & Security (Step 1 - Hardened)", () => {
  let creatorUser;
  let otherUser;
  let creatorToken;
  let otherToken;
  let publicTripId;
  let privateTripId;
  let legacyTripId;

  beforeEach(async () => {
    // 1. Create creator and another user
    creatorUser = await User.create({
      name: "Alice Montgomery",
      email: "alice.montgomery@secret-domain.com",
      password: "SuperSecretPassword123!",
      role: "user",
    });

    otherUser = await User.create({
      name: "Eve Malory",
      email: "eve@intruder-domain.com",
      password: "SuperSecretPassword123!",
      role: "user",
    });

    const resCreator = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice.montgomery@secret-domain.com", password: "SuperSecretPassword123!" });
    creatorToken = extractToken(resCreator);

    const resOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "eve@intruder-domain.com", password: "SuperSecretPassword123!" });
    otherToken = extractToken(resOther);

    // 2. Create an explicitly shared trip (isShared: true) with nested PII
    const publicTrip = await Booking.create({
      user: creatorUser._id,
      fullName: "Alice Montgomery",
      email: "alice.montgomery@secret-domain.com",
      phone: "+1 (555) 019-2834",
      notes: "Top secret health notes: passenger requires special medical assistance.",
      destination: "Kyoto, Japan",
      guests: 3,
      checkin: new Date("2026-10-15T00:00:00.000Z"),
      checkout: new Date("2026-10-20T00:00:00.000Z"),
      budget: "350000",
      dayCount: 5,
      coverImage: "https://images.unsplash.com/photo-kyoto",
      realityScore: {
        total: 88,
        grade: "A",
        pace: "Balanced",
        breakdown: { time: 90, budget: 85, pace: 88, distance: 89 },
        // Internal metadata that must be stripped:
        internalModelAudit: "Evaluated with v2 engine",
        developerSessionId: "session-internal-xyz-99",
      },
      aiPlan: {
        destination: "Kyoto, Japan",
        bestTimeToVisit: "Spring & Autumn",
        days: [
          {
            day: 1,
            title: "Arashiyama Bamboo Grove",
            morning: "Walk through bamboo grove",
            afternoon: "Visit Tenryu-ji temple",
            evening: "Dinner at Gion",
            food: ["Matcha parfait", "Kaiseki dining"],
            // Phase 2 structured activities containing nested PII:
            activities: [
              {
                id: "d1-morning-01",
                period: "morning",
                title: "Bamboo Grove Walk",
                description: "Scenic walk through soaring bamboo stalks",
                category: "Sightseeing",
                durationMinutes: 90,
                cost: "Free",
                indoorOutdoor: "Outdoor",
                location: "Arashiyama",
                locked: true,
                // Nested sensitive activity fields:
                sensitiveBookingReference: "BK-REF-CONFIDENTIAL-9999",
                privateClientNotes: "VIP Traveler - Private security escort required",
                hotelReservationCode: "HOTEL-CODE-12345",
                creditCardToken: "tok_visa_4242_secret",
              },
            ],
            // Sensitive day-level properties:
            privateDayNotes: "Meet personal doctor at 2 PM",
            driverPhoneNumber: "+81-90-1234-5678",
          },
        ],
        budgetBreakdown: {
          accommodation: "150000",
          foodPerDay: "10000",
          transport: "30000",
          activities: "40000",
          total: "350000",
          // Sensitive breakdown leak:
          actualCreditCardCharges: "350000 JPY billed to card ending 4242",
        },
        whereToStay: {
          budget: "Hostel Gion",
          midRange: "Kyoto Royal Hotel",
          luxury: "Hoshinoya Kyoto",
          privateSecretVilla: "Villa at secret coordinates 35.0116 N",
        },
        mustEat: ["Matcha parfait", "Kaiseki dining"],
        travelTips: ["Purchase an ICOCA card", "Wear comfortable walking shoes"],
        // Sensitive top-level AI plan leaks:
        promptInstructions: "System prompt instructions: do not reveal developer keys",
        rawApiKeySnippet: "AIzaSyFakeDevSecretApiKey9999",
        creatorPersonalEmail: "alice.montgomery@secret-domain.com",
        userEmergencyContact: "Bob Montgomery +1-555-987-6543",
      },
      isShared: true,
    });
    publicTripId = publicTrip._id.toString();

    // 3. Create an explicitly private trip (isShared: false)
    const privateTrip = await Booking.create({
      user: creatorUser._id,
      fullName: "Alice Montgomery",
      email: "alice.montgomery@secret-domain.com",
      phone: "+1 (555) 019-2834",
      notes: "Confidential executive retreat.",
      destination: "Zurich, Switzerland",
      guests: 1,
      checkin: new Date("2026-11-01T00:00:00.000Z"),
      checkout: new Date("2026-11-05T00:00:00.000Z"),
      budget: "500000",
      isShared: false,
    });
    privateTripId = privateTrip._id.toString();

    // 4. Create a legacy trip without isShared field (missing / undefined in MongoDB)
    const legacyTrip = await Booking.create({
      user: creatorUser._id,
      fullName: "Alice Montgomery",
      email: "alice.montgomery@secret-domain.com",
      destination: "Florence, Italy",
      guests: 2,
      checkin: new Date("2026-12-01T00:00:00.000Z"),
      checkout: new Date("2026-12-07T00:00:00.000Z"),
    });
    // Unset isShared explicitly to simulate pre-migration records
    await Booking.updateOne({ _id: legacyTrip._id }, { $unset: { isShared: "" } });
    legacyTripId = legacyTrip._id.toString();
  });

  describe("Finding 1: Nested AI Plan & Structured Activity Serialization", () => {
    it("strictly serializes aiPlan allowing only approved public fields and stripping all nested PII", async () => {
      const res = await request(app).get(`/api/bookings/shared/${publicTripId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const trip = res.body.data;
      expect(trip.aiPlan).toBeDefined();

      // Approved public fields in aiPlan are preserved
      expect(trip.aiPlan.destination).toBe("Kyoto, Japan");
      expect(trip.aiPlan.bestTimeToVisit).toBe("Spring & Autumn");
      expect(Array.isArray(trip.aiPlan.days)).toBe(true);
      expect(trip.aiPlan.budgetBreakdown).toBeDefined();
      expect(trip.aiPlan.budgetBreakdown.total).toBe("350000");
      expect(trip.aiPlan.whereToStay.luxury).toBe("Hoshinoya Kyoto");
      expect(trip.aiPlan.mustEat).toEqual(["Matcha parfait", "Kaiseki dining"]);
      expect(trip.aiPlan.travelTips).toContain("Purchase an ICOCA card");

      // Verify nested sensitive fields are REMOVED from aiPlan
      expect(trip.aiPlan.promptInstructions).toBeUndefined();
      expect(trip.aiPlan.rawApiKeySnippet).toBeUndefined();
      expect(trip.aiPlan.creatorPersonalEmail).toBeUndefined();
      expect(trip.aiPlan.userEmergencyContact).toBeUndefined();
      expect(trip.aiPlan.budgetBreakdown.actualCreditCardCharges).toBeUndefined();
      expect(trip.aiPlan.whereToStay.privateSecretVilla).toBeUndefined();

      // Verify nested day-level leaks are REMOVED
      const day1 = trip.aiPlan.days[0];
      expect(day1.privateDayNotes).toBeUndefined();
      expect(day1.driverPhoneNumber).toBeUndefined();

      // Verify nested activity-level leaks are REMOVED
      const act1 = day1.activities[0];
      expect(act1.title).toBe("Bamboo Grove Walk");
      expect(act1.durationMinutes).toBe(90);
      expect(act1.sensitiveBookingReference).toBeUndefined();
      expect(act1.privateClientNotes).toBeUndefined();
      expect(act1.hotelReservationCode).toBeUndefined();
      expect(act1.creditCardToken).toBeUndefined();

      // Deep string inspection: ensure NO sensitive substrings exist anywhere in the JSON response
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain("AIzaSyFakeDevSecretApiKey9999");
      expect(rawBody).not.toContain("do not reveal developer keys");
      expect(rawBody).not.toContain("Bob Montgomery");
      expect(rawBody).not.toContain("billed to card ending 4242");
      expect(rawBody).not.toContain("secret coordinates");
      expect(rawBody).not.toContain("Meet personal doctor");
      expect(rawBody).not.toContain("+81-90-1234-5678");
      expect(rawBody).not.toContain("BK-REF-CONFIDENTIAL-9999");
      expect(rawBody).not.toContain("Private security escort");
      expect(rawBody).not.toContain("HOTEL-CODE-12345");
      expect(rawBody).not.toContain("tok_visa_4242_secret");
    });

    it("sanitizes realityScore and removes internal developer engine metadata", async () => {
      const res = await request(app).get(`/api/bookings/shared/${publicTripId}`);

      expect(res.status).toBe(200);
      const reality = res.body.data.realityScore;
      expect(reality).toBeDefined();
      expect(reality.total).toBe(88);
      expect(reality.grade).toBe("A");
      expect(reality.pace).toBe("Balanced");
      expect(reality.breakdown.time).toBe(90);

      // Verify internal debugging metadata was stripped
      expect(reality.internalModelAudit).toBeUndefined();
      expect(reality.developerSessionId).toBeUndefined();

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain("v2 engine");
      expect(raw).not.toContain("session-internal-xyz-99");
    });
  });

  describe("Finding 2: Explicit Sharing Decision & Access Control", () => {
    it("returns HTTP 200 when trip has explicit isShared: true", async () => {
      const res = await request(app).get(`/api/bookings/shared/${publicTripId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isShared).toBe(true);
    });

    it("returns HTTP 404 when trip has explicit isShared: false", async () => {
      const res = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found or is private/i);
    });

    it("returns HTTP 404 for legacy trips where isShared is missing/undefined", async () => {
      // Legacy records in MongoDB lack the isShared property. They MUST NOT accidentally be public!
      const res = await request(app).get(`/api/bookings/shared/${legacyTripId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found or is private/i);
    });

    it("works identically on alias route /api/shared/:id", async () => {
      const resPublic = await request(app).get(`/api/shared/${publicTripId}`);
      expect(resPublic.status).toBe(200);

      const resPrivate = await request(app).get(`/api/shared/${privateTripId}`);
      expect(resPrivate.status).toBe(404);

      const resLegacy = await request(app).get(`/api/shared/${legacyTripId}`);
      expect(resLegacy.status).toBe(404);
    });
  });

  describe("Explicit Sharing & Unsharing Operations", () => {
    it("proves that PUT /api/bookings/:id CANNOT enable public sharing through isShared", async () => {
      // 1. Verify initially 404 (private trip)
      const resBefore = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(resBefore.status).toBe(404);

      // 2. Owner attempts to sneak isShared: true into general update endpoint
      const resPut = await request(app)
        .put(`/api/bookings/${privateTripId}`)
        .set("Authorization", `Bearer ${creatorToken}`)
        .send({
          destination: "Zurich (Updated)",
          isShared: true,
        });

      expect(resPut.status).toBe(200);
      expect(resPut.body.data.destination).toBe("Zurich (Updated)");
      // isShared was filtered out by allowedFields and remains false
      expect(resPut.body.data.isShared).toBe(false);

      // 3. Verify STILL inaccessible publicly via shared endpoint
      const resAfter = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(resAfter.status).toBe(404);
      expect(resAfter.body.message).toMatch(/not found or is private/i);
    });

    it("allows the trip owner to explicitly share a private trip via PATCH /api/bookings/:id/share", async () => {
      // 1. Verify initially 404
      const resBefore = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(resBefore.status).toBe(404);

      // 2. Owner explicitly shares
      const resShare = await request(app)
        .patch(`/api/bookings/${privateTripId}/share`)
        .set("Authorization", `Bearer ${creatorToken}`);

      expect(resShare.status).toBe(200);
      expect(resShare.body.data.isShared).toBe(true);

      // 3. Verify immediately accessible publicly
      const resAfter = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(resAfter.status).toBe(200);
      expect(resAfter.body.data.destination).toMatch(/Zurich/);
    });

    it("ensures repeated sharing is safe (idempotent)", async () => {
      const res1 = await request(app)
        .patch(`/api/bookings/${publicTripId}/share`)
        .set("Authorization", `Bearer ${creatorToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.isShared).toBe(true);

      const res2 = await request(app)
        .patch(`/api/bookings/${publicTripId}/share`)
        .set("Authorization", `Bearer ${creatorToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.isShared).toBe(true);

      const resPublic = await request(app).get(`/api/bookings/shared/${publicTripId}`);
      expect(resPublic.status).toBe(200);
    });

    it("allows the trip owner to unshare a trip via PATCH /api/bookings/:id/unshare", async () => {
      // 1. Verify initially 200
      const resBefore = await request(app).get(`/api/bookings/shared/${publicTripId}`);
      expect(resBefore.status).toBe(200);

      // 2. Owner unshares
      const resUnshare = await request(app)
        .patch(`/api/bookings/${publicTripId}/unshare`)
        .set("Authorization", `Bearer ${creatorToken}`);

      expect(resUnshare.status).toBe(200);
      expect(resUnshare.body.data.isShared).toBe(false);

      // 3. Verify immediately private
      const resAfter = await request(app).get(`/api/bookings/shared/${publicTripId}`);
      expect(resAfter.status).toBe(404);
    });

    it("ensures repeated unsharing is safe (idempotent)", async () => {
      const res1 = await request(app)
        .patch(`/api/bookings/${privateTripId}/unshare`)
        .set("Authorization", `Bearer ${creatorToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.isShared).toBe(false);

      const res2 = await request(app)
        .patch(`/api/bookings/${privateTripId}/unshare`)
        .set("Authorization", `Bearer ${creatorToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.isShared).toBe(false);

      const resPublic = await request(app).get(`/api/bookings/shared/${privateTripId}`);
      expect(resPublic.status).toBe(404);
    });

    it("rejects share attempts by non-owners with 404", async () => {
      const resUnauthorized = await request(app)
        .patch(`/api/bookings/${privateTripId}/share`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(resUnauthorized.status).toBe(404);
    });

    it("rejects unshare attempts by non-owners with 404", async () => {
      const resUnauthorized = await request(app)
        .patch(`/api/bookings/${publicTripId}/unshare`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(resUnauthorized.status).toBe(404);
    });

    it("handles invalid ID formats safely with 400 for share and unshare", async () => {
      const resShare = await request(app)
        .patch("/api/bookings/invalid-id-format/share")
        .set("Authorization", `Bearer ${creatorToken}`);

      expect(resShare.status).toBe(400);
      expect(resShare.body.success).toBe(false);

      const resUnshare = await request(app)
        .patch("/api/bookings/invalid-id-format/unshare")
        .set("Authorization", `Bearer ${creatorToken}`);

      expect(resUnshare.status).toBe(400);
      expect(resUnshare.body.success).toBe(false);
    });
  });

  describe("Frontend Contract Preservation (SharedTrip.jsx)", () => {
    it("provides all exact properties required for SharedTrip.jsx rendering", async () => {
      const res = await request(app).get(`/api/bookings/shared/${publicTripId}`);
      expect(res.status).toBe(200);

      const trip = res.body.data;

      // Direct properties read by SharedTrip.jsx
      expect(typeof trip.destination).toBe("string");
      expect(typeof trip.checkin).toBe("string");
      expect(typeof trip.checkout).toBe("string");
      expect(typeof trip.guests).toBe("number");
      expect(typeof trip.budget).toBe("string");
      expect(trip.aiPlan).toBeDefined();

      // Properties read from aiPlan by SharedTrip.jsx
      expect(trip.aiPlan.days.length).toBeGreaterThan(0);
      expect(trip.aiPlan.days[0].morning).toBeDefined();
      expect(trip.aiPlan.days[0].afternoon).toBeDefined();
      expect(trip.aiPlan.days[0].evening).toBeDefined();
      expect(trip.aiPlan.days[0].food).toBeDefined();
      expect(trip.aiPlan.budgetBreakdown).toBeDefined();
      expect(trip.aiPlan.whereToStay).toBeDefined();
      expect(trip.aiPlan.mustEat).toBeDefined();
      expect(trip.aiPlan.travelTips).toBeDefined();
    });
  });
});
