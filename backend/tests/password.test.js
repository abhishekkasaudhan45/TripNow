const request = require("supertest");
const crypto = require("crypto");
const app = require("../app");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase } = require("./db");

beforeAll(async () => { await connect(); });
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await closeDatabase(); });

const validUser = { name: "Test User", email: "test@example.com", password: "Passw0rd" };
const signup = () => request(app).post("/api/auth/signup").send(validUser);

describe("POST /api/auth/forgot-password", () => {
  it("returns a generic success even for an unknown email (no enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it("stores only a hashed reset token (never the raw token) for a real user", async () => {
    await signup();
    await request(app).post("/api/auth/forgot-password").send({ email: validUser.email });

    const user = await User.findOne({ email: validUser.email }).select(
      "+resetTokenHash +resetTokenExpires"
    );
    expect(user.resetTokenHash).toEqual(expect.any(String));
    expect(user.resetTokenHash).toHaveLength(64); // sha256 hex
    expect(user.resetTokenExpires.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("POST /api/auth/reset-password", () => {
  it("rejects an invalid/expired token with 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "0".repeat(64), password: "NewPass123" });

    expect(res.status).toBe(400);
  });

  it("resets the password with a valid token and lets the user log in", async () => {
    await signup();

    // Simulate the emailed token: set a known hash directly, mirroring the controller.
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    await User.findOneAndUpdate(
      { email: validUser.email },
      { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + 3600_000) }
    );

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: raw, password: "BrandNew1" });
    expect(reset.status).toBe(200);

    // Old password no longer works…
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });
    expect(oldLogin.status).toBe(401);

    // …new password does.
    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "BrandNew1" });
    expect(newLogin.status).toBe(200);

    // Token is single-use: cleared after reset.
    const user = await User.findOne({ email: validUser.email }).select("+resetTokenHash");
    expect(user.resetTokenHash).toBeFalsy();
  });

  it("rejects a weak new password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(64), password: "weak" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/verify-email", () => {
  it("rejects a missing token with 400", async () => {
    const res = await request(app).get("/api/auth/verify-email");
    expect(res.status).toBe(400);
  });

  it("verifies the email with a valid token", async () => {
    await signup();
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    await User.findOneAndUpdate(
      { email: validUser.email },
      { verifyTokenHash: hash, verifyTokenExpires: new Date(Date.now() + 3600_000) }
    );

    const res = await request(app).get(`/api/auth/verify-email?token=${raw}`);
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: validUser.email });
    expect(user.isVerified).toBe(true);
  });
});
