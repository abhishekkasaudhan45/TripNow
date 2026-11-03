// backend/tests/itineraryPersistence.test.js
const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { toggleActivityLock } = require("../services/lockService");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const userA = { name: "Traveler A", email: "travelerA@example.com", password: "Password123!" };
const userB = { name: "Traveler B", email: "travelerB@example.com", password: "Password123!" };

const signup = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: extractToken(res), user: res.body.data.user };
};

const samplePlan = {
  destination: "Goa, India",
  days: [
    {
      day: 1,
      title: "North Goa Beaches",
      morning: "Baga Beach stroll and water sports",
      afternoon: "Anjuna flea market and beach shacks",
      evening: "Sunset dining at Curlies",
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Baga Beach stroll",
          description: "Water sports and walking",
          category: "Adventure & Outdoors",
          durationMinutes: 120,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d1-afternoon-01",
          period: "afternoon",
          title: "Anjuna market",
          description: "Flea market shopping",
          category: "Sightseeing",
          durationMinutes: 150,
          cost: "$20",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d1-evening-01",
          period: "evening",
          title: "Sunset dining",
          description: "Beachfront dining",
          category: "Dining & Nightlife",
          durationMinutes: 120,
          cost: "$40",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
    {
      day: 2,
      title: "Historic Old Goa",
      morning: "Basilica of Bom Jesus",
      afternoon: "Se Cathedral and museum",
      evening: "Latin Quarter Fontainhas walk",
      activities: [
        {
          id: "d2-morning-01",
          period: "morning",
          title: "Basilica of Bom Jesus",
          description: "UNESCO historic church visit",
          category: "Culture & History",
          durationMinutes: 90,
          cost: "Free",
          indoorOutdoor: "Indoor",
          locked: false,
        },
        {
          id: "d2-afternoon-01",
          period: "afternoon",
          title: "Se Cathedral",
          description: "Historic cathedral and art museum",
          category: "Culture & History",
          durationMinutes: 120,
          cost: "$5",
          indoorOutdoor: "Indoor",
          locked: false,
        },
        {
          id: "d2-evening-01",
          period: "evening",
          title: "Fontainhas heritage walk",
          description: "Portuguese architecture and heritage stroll",
          category: "Sightseeing",
          durationMinutes: 120,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
  ],
  budgetBreakdown: { total: "$500" },
  travelTips: ["Rent a scooter for easy travel"],
};

describe("PATCH /api/bookings/:id/itinerary - Batch 1 Implementation", () => {
  let tokenA, tokenB, booking;

  beforeEach(async () => {
    const authA = await signup(userA);
    const authB = await signup(userB);
    tokenA = authA.token;
    tokenB = authB.token;

    booking = await Booking.create({
      user: authA.user.id || authA.user._id,
      destination: "Goa, India",
      guests: 2,
      checkin: new Date("2026-11-10"),
      checkout: new Date("2026-11-12"),
      budget: "$500",
      notes: "Quiet room requested",
      aiPlan: JSON.stringify(samplePlan),
    });
  });

  it("rejects unauthenticated requests with HTTP 401", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .send({ itinerary: samplePlan, baseVersion: 0 });

    expect(res.status).toBe(401);
  });

  it("rejects invalid ObjectId with HTTP 400", async () => {
    const res = await request(app)
      .patch("/api/bookings/invalid-id/itinerary")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: samplePlan, baseVersion: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid ID");
  });

  it("returns HTTP 404 when User B tries to update User A's itinerary (ownership check)", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ itinerary: samplePlan, baseVersion: 0 });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Trip not found");
  });

  it("rejects payload missing baseVersion with HTTP 400", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: samplePlan });

    expect(res.status).toBe(400);
    expect(res.body.errors?.baseVersion).toBeDefined();
  });

  it("rejects invalid itinerary structure (empty days) with HTTP 400", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: { days: [] }, baseVersion: 0 });

    expect(res.status).toBe(400);
    expect(res.body.errors?.["itinerary.days"]).toBeDefined();
  });

  it("successfully updates itinerary and increments version by exactly 1", async () => {
    const modifiedPlan = JSON.parse(JSON.stringify(samplePlan));
    modifiedPlan.days[0].afternoon = "Calangute Beach Café — Relaxing coffee and ocean view";
    modifiedPlan.days[0].activities[1].title = "Calangute Beach Café";
    modifiedPlan.days[0].activities[1].description = "Relaxing coffee and ocean view";

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: modifiedPlan, baseVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.__v).toBe(1);

    // Verify in MongoDB
    const persisted = await Booking.findById(booking._id);
    expect(persisted.__v).toBe(1);
    const savedPlan = JSON.parse(persisted.aiPlan);
    expect(savedPlan.days[0].afternoon).toBe("Calangute Beach Café — Relaxing coffee and ocean view");

    // Verify unrelated fields remained 100% untouched
    expect(persisted.destination).toBe("Goa, India");
    expect(persisted.guests).toBe(2);
    expect(persisted.notes).toBe("Quiet room requested");
    expect(persisted.budget).toBe("$500");
    expect(String(persisted.user)).toBe(String(booking.user));

    // Verify realityScore was deterministically updated and synchronized
    expect(persisted.realityScore).toBeDefined();
    expect(persisted.realityScore.score).toBeGreaterThan(0);
  });

  it("rejects stale baseVersion with HTTP 409 Conflict (Optimistic Concurrency Control)", async () => {
    // Simulate concurrent modification in another session
    await Booking.findByIdAndUpdate(booking._id, { $inc: { __v: 1 } });

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: samplePlan, baseVersion: 0 });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Conflict");
    expect(res.body.currentVersion).toBe(1);
    expect(res.body.expectedVersion).toBe(0);
  });

  it("strictly protects locked activities: rejects modification with HTTP 423", async () => {
    // Lock an activity on Day 2 morning
    await toggleActivityLock({
      tripId: booking._id.toString(),
      activityId: "d2-morning-01",
      locked: true,
      user: { _id: booking.user },
    });

    // Attempt to tamper with the locked activity title
    const tamperedPlan = JSON.parse(JSON.stringify(samplePlan));
    tamperedPlan.days[1].activities[0].locked = true;
    tamperedPlan.days[1].activities[0].title = "Hacked Title on Locked Activity";

    // Version is now 1 due to the lock toggle
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: tamperedPlan, baseVersion: 1 });

    expect(res.status).toBe(423);
    expect(res.body.message).toContain("locked");
  });

  it("strictly protects locked activities: rejects unauthorized unlock attempt with HTTP 423", async () => {
    // Lock an activity on Day 2 morning
    await toggleActivityLock({
      tripId: booking._id.toString(),
      activityId: "d2-morning-01",
      locked: true,
      user: { _id: booking.user },
    });

    // Attempt to silently unlock via itinerary save payload
    const unlockedPlan = JSON.parse(JSON.stringify(samplePlan));
    unlockedPlan.days[1].activities[0].locked = false;

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: unlockedPlan, baseVersion: 1 });

    expect(res.status).toBe(423);
    expect(res.body.message).toContain("Cannot unlock activity");
  });

  it("strictly protects locked activities: rejects deletion of locked activity with HTTP 423", async () => {
    // Lock an activity on Day 2 morning
    await toggleActivityLock({
      tripId: booking._id.toString(),
      activityId: "d2-morning-01",
      locked: true,
      user: { _id: booking.user },
    });

    // Omit the locked activity from activities array
    const deletedPlan = JSON.parse(JSON.stringify(samplePlan));
    deletedPlan.days[1].activities = deletedPlan.days[1].activities.filter(
      (a) => a.id !== "d2-morning-01"
    );

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: deletedPlan, baseVersion: 1 });

    expect(res.status).toBe(423);
    expect(res.body.message).toContain("missing from the updated itinerary");
  });

  it("permits save when locked activity is untouched and other activities are updated", async () => {
    // Lock Day 2 morning
    await toggleActivityLock({
      tripId: booking._id.toString(),
      activityId: "d2-morning-01",
      locked: true,
      user: { _id: booking.user },
    });

    // Modify Day 1 afternoon (unlocked) while keeping Day 2 morning locked and identical
    const validPlan = JSON.parse(JSON.stringify(samplePlan));
    validPlan.days[1].activities[0].locked = true; // matches DB
    validPlan.days[0].afternoon = "Updated unlocked afternoon";
    validPlan.days[0].activities[1].title = "Updated unlocked afternoon";

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: validPlan, baseVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.__v).toBe(2);

    const check = await Booking.findById(booking._id);
    const plan = JSON.parse(check.aiPlan);
    expect(plan.days[1].activities[0].locked).toBe(true);
    expect(plan.days[0].afternoon).toBe("Updated unlocked afternoon");
  });

  it("handles duplicate submission safely: second submission with same baseVersion returns 409 Conflict", async () => {
    const planToSave = JSON.parse(JSON.stringify(samplePlan));
    planToSave.days[0].morning = "Early morning beach jog";

    // First submission succeeds
    const firstRes = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: planToSave, baseVersion: 0 });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.__v).toBe(1);

    // Immediate duplicate submission with old baseVersion 0 fails with 409
    const secondRes = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: planToSave, baseVersion: 0 });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.message).toContain("Conflict");
  });

  it("successfully saves and normalizes legacy booking with unstructured prose itinerary", async () => {
    const legacyPlan = {
      destination: "Goa",
      days: [
        {
          day: 1,
          morning: "Visit Aguada Fort",
          afternoon: "Beach shack lunch",
          evening: "Sunset drinks",
        },
      ],
    };

    const legacyBooking = await Booking.create({
      user: booking.user,
      destination: "Goa",
      guests: 1,
      checkin: new Date("2026-12-01"),
      checkout: new Date("2026-12-02"),
      aiPlan: JSON.stringify(legacyPlan),
    });

    const res = await request(app)
      .patch(`/api/bookings/${legacyBooking._id}/itinerary`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ itinerary: legacyPlan, baseVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await Booking.findById(legacyBooking._id);
    const saved = JSON.parse(check.aiPlan);
    expect(Array.isArray(saved.days[0].activities)).toBe(true);
    expect(saved.days[0].activities.length).toBeGreaterThan(0);
  });
});
