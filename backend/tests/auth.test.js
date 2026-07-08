const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./db");

beforeAll(async () => { await connect(); });
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await closeDatabase(); });

const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "Passw0rd", // 8+ chars, upper + lower + number
};

describe("POST /api/auth/signup", () => {
  it("creates a new user and returns a token (password not leaked)", async () => {
    const res = await request(app).post("/api/auth/signup").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("test@example.com");
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, password: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 400", async () => {
    await request(app).post("/api/auth/signup").send(validUser);
    const res = await request(app).post("/api/auth/signup").send(validUser);

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/signup").send(validUser);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "WrongPass1" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user with a valid token", async () => {
    const signup = await request(app).post("/api/auth/signup").send(validUser);
    const token = signup.body.data.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });
});
