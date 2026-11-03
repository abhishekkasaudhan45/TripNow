// backend/tests/queryProjectionAndValidation.test.js
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

const userA = { name: "User A", email: "usera@example.com", password: "Password123" };
const userB = { name: "User B", email: "userb@example.com", password: "Password123" };

const signupUser = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: extractToken(res), user: res.body.data.user };
};

describe("Batch 2B — ARCH-02: Dashboard Query Projection", () => {
  it("projects only summary fields on GET /api/bookings and excludes large aiPlan data", async () => {
    const { token } = await signupUser(userA);

    // Create a booking with a large mock aiPlan and realityScore
    const createRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Tokyo",
        checkin: "2026-09-01",
        checkout: "2026-09-05",
        guests: 2,
        budget: "50000",
        notes: "Remember JR pass",
        coverImage: "https://images.example.com/tokyo.jpg",
        aiPlan: {
          days: [
            { day: 1, title: "Arrival", activities: ["Shinjuku", "Shibuya"] },
            { day: 2, title: "Temples", activities: ["Asakusa", "Ueno"] },
          ],
          hugeNestedMetadata: "X".repeat(5000),
        },
      });

    expect(createRes.status).toBe(201);
    const tripId = createRes.body.data._id;

    // Fetch dashboard list
    const listRes = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const summaryCard = listRes.body.data[0];

    // Required summary fields must exist
    expect(summaryCard._id).toBe(tripId);
    expect(summaryCard.destination).toBe("Tokyo");
    expect(summaryCard.guests).toBe(2);
    expect(summaryCard.budget).toBe("50000");
    expect(summaryCard.notes).toBe("Remember JR pass");
    expect(summaryCard.coverImage).toBe("https://images.example.com/tokyo.jpg");
    expect(summaryCard.checkin).toBeDefined();
    expect(summaryCard.checkout).toBeDefined();
    expect(summaryCard.createdAt).toBeDefined();
    expect(summaryCard.isShared).toBe(false);

    // Heavy payload fields MUST be excluded from list response
    expect(summaryCard.aiPlan).toBeUndefined();
    expect(summaryCard.tripData).toBeUndefined();
    expect(summaryCard.realityScore).toBeUndefined();
  });

  it("preserves complete itinerary data on individual GET /api/bookings/:id", async () => {
    const { token } = await signupUser(userA);

    const aiPlanData = {
      days: [{ day: 1, title: "Arrival & Welcome Dinner" }],
    };

    const createRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Kyoto",
        checkin: "2026-10-01",
        checkout: "2026-10-04",
        guests: 3,
        aiPlan: aiPlanData,
      });

    const tripId = createRes.body.data._id;

    const detailRes = await request(app)
      .get(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.destination).toBe("Kyoto");
    // Full itinerary is present on single trip detail
    expect(detailRes.body.data.aiPlan).toEqual(aiPlanData);
  });

  it("isolates user bookings so callers only see their own trips", async () => {
    const { token: tokenA } = await signupUser(userA);
    const { token: tokenB } = await signupUser(userB);

    await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ destination: "Paris", checkin: "2026-06-01", checkout: "2026-06-04", guests: 1 });

    await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ destination: "Rome", checkin: "2026-07-01", checkout: "2026-07-05", guests: 2 });

    const resA = await request(app).get("/api/bookings").set("Authorization", `Bearer ${tokenA}`);
    expect(resA.body.data).toHaveLength(1);
    expect(resA.body.data[0].destination).toBe("Paris");

    const resB = await request(app).get("/api/bookings").set("Authorization", `Bearer ${tokenB}`);
    expect(resB.body.data).toHaveLength(1);
    expect(resB.body.data[0].destination).toBe("Rome");
  });
});

describe("Batch 2B — ARCH-03: Authentication Error Propagation", () => {
  it("forwards duplicate email errors to centralized error handler with 400 status", async () => {
    await signupUser(userA);

    // Attempt second signup with identical email
    const res = await request(app).post("/api/auth/signup").send(userA);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("returns 400 validation error when signup body is missing required fields", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "invalid@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 when login credentials fail", async () => {
    await signupUser(userA);

    const res = await request(app).post("/api/auth/login").send({
      email: userA.email,
      password: "WrongPassword123",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it("rejects unauthorized GET /api/auth/me with 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("Batch 2B — ARCH-08: Booking Zod Validation", () => {
  let token;

  beforeEach(async () => {
    const auth = await signupUser(userA);
    token = auth.token;
  });

  it("rejects booking creation when destination is missing or empty", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "   ",
        checkin: "2026-08-01",
        checkout: "2026-08-04",
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.destination).toBeDefined();
  });

  it("rejects booking creation when checkout is before checkin", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Berlin",
        checkin: "2026-08-10",
        checkout: "2026-08-05",
        guests: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.checkout).toMatch(/after check-in/i);
  });

  it("rejects booking creation with non-positive guest count", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Madrid",
        checkin: "2026-08-01",
        checkout: "2026-08-04",
        guests: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("strips unauthorized isShared modification during generic PUT updates", async () => {
    const createRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Lisbon",
        checkin: "2026-09-01",
        checkout: "2026-09-05",
        guests: 2,
        isShared: false,
      });

    const tripId = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Lisbon (Updated)",
        isShared: true, // Attempt unauthorized sharing modification
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.destination).toBe("Lisbon (Updated)");
    // isShared must remain false
    expect(updateRes.body.data.isShared).toBe(false);
  });

  it("rejects invalid date range on PUT update when checkout <= checkin", async () => {
    const createRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        destination: "Amsterdam",
        checkin: "2026-09-01",
        checkout: "2026-09-05",
        guests: 2,
      });

    const tripId = createRes.body.data._id;

    const updateRes = await request(app)
      .put(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        checkin: "2026-09-10",
        checkout: "2026-09-05",
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.success).toBe(false);
  });
});

