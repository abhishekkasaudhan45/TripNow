// backend/tests/anonymousAuthSaveFlow.test.js
const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
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

const userA = { name: "Traveler Alice", email: "alice@example.com", password: "Password123!" };
const userB = { name: "Traveler Bob", email: "bob@example.com", password: "Password123!" };

const samplePlan = {
  destination: "Kyoto, Japan",
  days: [
    {
      day: 1,
      title: "Historic Temples",
      morning: "Fushimi Inari Shrine",
      afternoon: "Kiyomizu-dera Temple",
      evening: "Gion district evening stroll",
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Fushimi Inari Shrine",
          description: "Torii gate hike",
          category: "Culture & History",
          durationMinutes: 120,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
  ],
};

const updatedPlan = {
  destination: "Kyoto, Japan",
  days: [
    {
      day: 1,
      title: "Historic Temples",
      morning: "Fushimi Inari Shrine (Early Morning)",
      afternoon: "Kiyomizu-dera Temple and Tea House",
      evening: "Gion district evening stroll and dinner",
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Fushimi Inari Shrine (Early Morning)",
          description: "Beat crowds at dawn",
          category: "Culture & History",
          durationMinutes: 120,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
  ],
};

describe("Phase 3C.1 Anonymous User Save Authentication & Ownership Flow", () => {
  let authA, authB, bookingA;

  beforeEach(async () => {
    const resA = await request(app).post("/api/auth/signup").send(userA);
    authA = { token: extractToken(resA), user: resA.body.data.user };

    const resB = await request(app).post("/api/auth/signup").send(userB);
    authB = { token: extractToken(resB), user: resB.body.data.user };

    bookingA = await Booking.create({
      user: authA.user.id || authA.user._id,
      destination: "Kyoto, Japan",
      guests: 2,
      checkin: new Date("2026-11-20"),
      checkout: new Date("2026-11-25"),
      budget: "$1200",
      aiPlan: JSON.stringify(samplePlan),
    });
  });

  it("1. Unauthenticated user cannot save: returns HTTP 401 (prompts authentication modal)", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);

    // Verify DB remains untouched
    const check = await Booking.findById(bookingA._id);
    expect(check.__v).toBe(0);
  });

  it("2. Authenticated user saves successfully: returns HTTP 200 with incremented version", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .set("Authorization", `Bearer ${authA.token}`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.__v).toBe(1);

    const check = await Booking.findById(bookingA._id);
    expect(check.__v).toBe(1);
    const saved = JSON.parse(check.aiPlan);
    expect(saved.days[0].morning).toContain("Early Morning");
  });

  it("3. Ownership verification via GET: User B cannot fetch or verify User A's booking (HTTP 404)", async () => {
    const res = await request(app)
      .get(`/api/bookings/${bookingA._id}`)
      .set("Authorization", `Bearer ${authB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Trip not found");
  });

  it("4. Ownership verification via PATCH: User B cannot save changes to User A's booking (HTTP 404)", async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .set("Authorization", `Bearer ${authB.token}`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Trip not found");

    // Authoritative trip remains unmodified
    const check = await Booking.findById(bookingA._id);
    expect(check.__v).toBe(0);
  });

  it("5. Duplicate save requests are prevented: subsequent call with stale baseVersion yields 409", async () => {
    // First save succeeds
    const firstRes = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .set("Authorization", `Bearer ${authA.token}`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.__v).toBe(1);

    // Immediate duplicate save with stale baseVersion=0 fails
    const secondRes = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .set("Authorization", `Bearer ${authA.token}`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.message).toContain("Conflict");
  });

  it("6. Login and save: user logs in, receives token, verifies booking, and saves draft", async () => {
    // Simulate user logging in via modal
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: userA.email, password: userA.password });

    expect(loginRes.status).toBe(200);
    const token = extractToken(loginRes);

    // Step A: Verification of booking ownership and loading authoritative version
    const verifyRes = await request(app)
      .get(`/api/bookings/${bookingA._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(verifyRes.status).toBe(200);
    const currentVersion = verifyRes.body.data.__v;
    expect(currentVersion).toBe(0);

    // Step B: Explicit Save Changes click
    const saveRes = await request(app)
      .patch(`/api/bookings/${bookingA._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({ itinerary: updatedPlan, baseVersion: currentVersion });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.__v).toBe(1);
  });

  it("7. Signup and save: new user registers, creates personal booking, and persists itinerary", async () => {
    const newUser = { name: "New Traveler", email: "new@example.com", password: "Password123!" };
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send(newUser);

    expect(signupRes.status).toBe(201);
    const token = extractToken(signupRes);

    // Create booking for new user
    const createRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Tokyo, Japan",
        guests: 1,
        checkin: "2026-12-01",
        checkout: "2026-12-05",
        budget: "$1500",
        aiPlan: JSON.stringify(samplePlan),
      });

    expect(createRes.status).toBe(201);
    const newTripId = createRes.body.data._id;

    // Explicit save
    const saveRes = await request(app)
      .patch(`/api/bookings/${newTripId}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({ itinerary: updatedPlan, baseVersion: 0 });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.__v).toBe(1);
  });
});

