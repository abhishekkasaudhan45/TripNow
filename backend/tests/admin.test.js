const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase } = require("./db");

beforeAll(async () => { await connect(); });
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await closeDatabase(); });

const signup = async (over = {}) => {
  const user = { name: "User", email: "user@example.com", password: "Passw0rd", ...over };
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: res.body.data.token, email: user.email, password: user.password };
};

describe("Admin authorization — GET /api/admin/bookings", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/admin/bookings");
    expect(res.status).toBe(401);
  });

  it("rejects a normal (non-admin) user with 403", async () => {
    const { token } = await signup();
    const res = await request(app)
      .get("/api/admin/bookings")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("allows an admin user with 200", async () => {
    const { email, password } = await signup({ email: "admin2@example.com" });

    // Promote to admin directly in the DB, then re-login to get a fresh session.
    await User.findOneAndUpdate({ email }, { role: "admin" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    const res = await request(app)
      .get("/api/admin/bookings")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
