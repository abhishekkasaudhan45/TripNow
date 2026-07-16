const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./db");

beforeAll(async () => { await connect(); });
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await closeDatabase(); });

// Two separate users to prove ownership scoping.
const userA = { name: "Owner A", email: "a@example.com", password: "Passw0rd" };
const userB = { name: "Intruder B", email: "b@example.com", password: "Passw0rd" };

const signup = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return res.body.data.token;
};

const validBooking = {
  destination: "Goa",
  guests: 2,
  checkin: "2026-08-01",
  checkout: "2026-08-04",
  budget: "15000",
  fullName: "Owner A",
  email: "a@example.com",
  phone: "9876543210",
};

const createBooking = async (token) => {
  const res = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${token}`)
    .send(validBooking);
  return res.body.data._id;
};

describe("POST /api/bookings", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/bookings").send(validBooking);
    expect(res.status).toBe(401);
  });

  it("creates a booking linked to the logged-in user", async () => {
    const token = await signup(userA);
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send(validBooking);

    expect(res.status).toBe(201);
    expect(res.body.data.destination).toBe("Goa");
    expect(res.body.data.user).toBeTruthy(); // owner is attached
  });
});

describe("Ownership scoping — users cannot touch other users' trips", () => {
  let tokenA, tokenB, tripId;

  beforeEach(async () => {
    tokenA = await signup(userA);
    tokenB = await signup(userB);
    tripId = await createBooking(tokenA);
  });

  it("owner can read their own trip", async () => {
    const res = await request(app)
      .get(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.destination).toBe("Goa");
  });

  it("another user CANNOT read the trip (404, not leaked)", async () => {
    const res = await request(app)
      .get(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("another user CANNOT update the trip", async () => {
    const res = await request(app)
      .put(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ destination: "Hacked" });
    expect(res.status).toBe(404);

    // Confirm the trip is unchanged for its owner.
    const check = await request(app)
      .get(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(check.body.data.destination).toBe("Goa");
  });

  it("another user CANNOT delete the trip", async () => {
    const res = await request(app)
      .delete(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);

    // Trip still exists for its owner.
    const check = await request(app)
      .get(`/api/bookings/${tripId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(check.status).toBe(200);
  });

  it("GET /api/bookings returns only the caller's own trips", async () => {
    await createBooking(tokenB); // user B saves one trip too
    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1); // only A's trip, not B's
  });
});

describe("GET /api/bookings/shared/:id (public share link)", () => {
  it("returns the trip without any auth header", async () => {
    const tokenA = await signup(userA);
    const tripId = await createBooking(tokenA);

    const res = await request(app).get(`/api/bookings/shared/${tripId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.destination).toBe("Goa");
  });

  it("handles an unknown but valid ObjectId with 404", async () => {
    const res = await request(app).get("/api/bookings/shared/64b000000000000000000000");
    expect(res.status).toBe(404);
  });

  it("handles a malformed id without crashing", async () => {
    const res = await request(app).get("/api/bookings/shared/not-a-real-id");
    expect(res.status).toBeGreaterThanOrEqual(400); // 4xx/5xx, never a crash
  });
});
