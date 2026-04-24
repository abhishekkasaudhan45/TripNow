process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/travel-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const app = require("../app");
const Booking = require("../models/Booking");

const buildBookingPayload = (overrides = {}) => ({
  destination: "Goa",
  guests: 2,
  checkin: "2030-05-01T00:00:00.000Z",
  checkout: "2030-05-05T00:00:00.000Z",
  ...overrides,
});

let mongoServer;

const loginAsAdmin = async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ password: process.env.ADMIN_PASSWORD });

  return response.body.data.token;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "travel-website-test",
  });
});

afterEach(async () => {
  await Booking.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Travel API", () => {
  it("returns a healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      })
    );
  });

  it("creates a booking with valid data", async () => {
    const response = await request(app)
      .post("/api/bookings")
      .send(buildBookingPayload());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        destination: "Goa",
        guests: 2,
      })
    );
  });

  it("rejects booking creation when required fields are missing", async () => {
    const response = await request(app)
      .post("/api/bookings")
      .send({
        guests: 2,
        checkin: "2030-05-01T00:00:00.000Z",
        checkout: "2030-05-05T00:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors.fields.destination).toBe("Destination is required");
  });

  it("rejects booking creation when checkout is before checkin", async () => {
    const response = await request(app)
      .post("/api/bookings")
      .send(
        buildBookingPayload({
          checkin: "2030-05-05T00:00:00.000Z",
          checkout: "2030-05-01T00:00:00.000Z",
        })
      );

    expect(response.status).toBe(400);
    expect(response.body.errors.fields.checkout).toBe(
      "Check-out date must be after check-in date"
    );
  });

  it("does not expose booking listings on the public bookings route", async () => {
    const response = await request(app).get("/api/bookings");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("/api/bookings");
  });

  it("requires a password for admin login", async () => {
    const response = await request(app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Password is required");
  });

  it("rejects invalid admin credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid admin credentials");
  });

  it("rejects protected admin requests without a bearer token", async () => {
    const response = await request(app).get("/api/admin/bookings");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("rejects protected admin requests with an invalid token", async () => {
    const response = await request(app)
      .get("/api/admin/bookings")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or expired token");
  });

  it("returns paginated bookings for authenticated admins", async () => {
    await Booking.create([
      buildBookingPayload({ destination: "Bali" }),
      buildBookingPayload({ destination: "Kyoto", checkin: "2030-06-01T00:00:00.000Z", checkout: "2030-06-05T00:00:00.000Z" }),
      buildBookingPayload({ destination: "Reykjavik", checkin: "2030-07-01T00:00:00.000Z", checkout: "2030-07-04T00:00:00.000Z" }),
    ]);

    const token = await loginAsAdmin();

    const response = await request(app)
      .get("/api/admin/bookings?page=99&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      })
    );
  });

  it("returns a 404 response for unknown API routes", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("/api/does-not-exist");
  });
});
