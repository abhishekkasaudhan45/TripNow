const request = require("supertest");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const app = require("../app");
const User = require("../models/User");
const env = require("../config/env");
const { parseDurationToMs, COOKIE_MAX_AGE_MS } = require("../config/authCookie");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");

beforeAll(async () => { await connect(); });
afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await closeDatabase(); });

const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "Passw0rd123", // 8+ chars, upper + lower + number
};

describe("POST /api/auth/signup", () => {
  it("creates a new user and sets auth cookie (password and token not leaked in body)", async () => {
    const res = await request(app).post("/api/auth/signup").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"].some((c) => c.startsWith("token="))).toBe(true);
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

  it("logs in with correct credentials and sets auth cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"].some((c) => c.startsWith("token="))).toBe(true);
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
    const token = extractToken(signup);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });
});

// ─────────────────────────────────────────────────────────────
// SEC-01: Session Invalidation on Password Change / Reset
// ─────────────────────────────────────────────────────────────
describe("SEC-01: Session Invalidation on Password Reset", () => {
  it("rejects a token issued BEFORE a password reset, but accepts a token issued AFTER reset", async () => {
    // 1. User signs up and gets initial session token
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const initialToken = extractToken(signupRes);

    // Initial token can access /me
    const meBefore = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${initialToken}`);
    expect(meBefore.status).toBe(200);

    // Advance time past the 1-second JWT iat resolution boundary
    await new Promise((resolve) => setTimeout(resolve, 1050));

    // 2. Set up password reset token
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    await User.findOneAndUpdate(
      { email: validUser.email },
      { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + 3600_000) }
    );

    // 3. Execute password reset
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawResetToken, password: "BrandNewPassword123" });
    expect(resetRes.status).toBe(200);

    // 4. PREVIOUS TOKEN MUST BE REJECTED with 401
    const meAfterWithOldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${initialToken}`);
    expect(meAfterWithOldToken.status).toBe(401);
    expect(meAfterWithOldToken.body.message).toMatch(/password change|invalid or expired/i);

    // 5. User logs in with new password -> newly issued token works
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "BrandNewPassword123" });
    expect(loginRes.status).toBe(200);
    const newToken = extractToken(loginRes);

    const meAfterWithNewToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${newToken}`);
    expect(meAfterWithNewToken.status).toBe(200);
    expect(meAfterWithNewToken.body.data.user.email).toBe(validUser.email);
  });

  it("safely authenticates legacy users without passwordChangedAt", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const token = extractToken(signupRes);

    // Explicitly unset passwordChangedAt to simulate legacy user
    await User.findOneAndUpdate(
      { email: validUser.email },
      { $unset: { passwordChangedAt: 1 } }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it("updates passwordChangedAt timestamp whenever password is modified on existing user", async () => {
    const user = await User.create(validUser);
    expect(user.passwordChangedAt).toBeUndefined();

    // Modify password
    user.password = "UpdatedPassword456";
    await user.save();

    expect(user.passwordChangedAt).toBeInstanceOf(Date);
    expect(user.passwordChangedAt.getTime()).toBeLessThan(Date.now());
  });

  it("downgrades invalidated session to unauthenticated guest in optionalAuth middleware", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const token = extractToken(signupRes);

    await new Promise((resolve) => setTimeout(resolve, 1050));

    // Reset password to advance passwordChangedAt
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    await User.findOneAndUpdate(
      { email: validUser.email },
      { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + 3600_000) }
    );
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawResetToken, password: "BrandNewPassword123" });

    // Call optionalAuth with the old token
    const optionalAuth = require("../middleware/optionalAuth");
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextCalled = false;
    await optionalAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// SEC-02: JWT Expiry & Cookie MaxAge Alignment
// ─────────────────────────────────────────────────────────────
describe("SEC-02: JWT Expiry & Cookie MaxAge Alignment", () => {
  it("aligns cookie maxAge with env.jwtExpiresIn", () => {
    const expectedMs = parseDurationToMs(env.jwtExpiresIn);
    expect(COOKIE_MAX_AGE_MS).toBe(expectedMs);
    expect(COOKIE_MAX_AGE_MS).toBeGreaterThan(0);
  });

  it("parses valid duration formats into exact milliseconds", () => {
    expect(parseDurationToMs("2h")).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs("30d")).toBe(30 * 24 * 60 * 60 * 1000);
    expect(parseDurationToMs("15m")).toBe(15 * 60 * 1000);
    expect(parseDurationToMs("60s")).toBe(60 * 1000);
    expect(parseDurationToMs("3600")).toBe(3600 * 1000);
    expect(parseDurationToMs(3600000)).toBe(3600000);
  });

  it("returns the documented default (2h) when duration is absent", () => {
    expect(parseDurationToMs()).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs(undefined)).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs(null)).toBe(2 * 60 * 60 * 1000);
  });

  it("rejects zero or negative values with an explicit error", () => {
    expect(() => parseDurationToMs(0)).toThrow(/greater than 0/i);
    expect(() => parseDurationToMs("0")).toThrow(/greater than 0/i);
    expect(() => parseDurationToMs("0s")).toThrow(/greater than 0/i);
    expect(() => parseDurationToMs("0h")).toThrow(/greater than 0/i);
    expect(() => parseDurationToMs(-1000)).toThrow(/greater than 0/i);
    expect(() => parseDurationToMs("-5m")).toThrow(/cannot be negative/i);
    expect(() => parseDurationToMs("-60s")).toThrow(/cannot be negative/i);
  });

  it("rejects NaN and Infinity with an explicit error", () => {
    expect(() => parseDurationToMs(NaN)).toThrow(/must be a finite number/i);
    expect(() => parseDurationToMs(Infinity)).toThrow(/must be a finite number/i);
    expect(() => parseDurationToMs(-Infinity)).toThrow(/must be a finite number/i);
  });

  it("rejects malformed or empty duration strings with an explicit error", () => {
    expect(() => parseDurationToMs("invalid")).toThrow(/Invalid JWT duration format/i);
    expect(() => parseDurationToMs("")).toThrow(/cannot be empty/i);
    expect(() => parseDurationToMs("   ")).toThrow(/cannot be empty/i);
    expect(() => parseDurationToMs("2h30m")).toThrow(/Invalid JWT duration format/i);
  });

  it("rejects unsupported units with an explicit error", () => {
    expect(() => parseDurationToMs("10w")).toThrow(/Invalid JWT duration unit "w"/i);
    expect(() => parseDurationToMs("1y")).toThrow(/Invalid JWT duration unit "y"/i);
    expect(() => parseDurationToMs("5ms")).toThrow(/Invalid JWT duration unit "ms"/i);
    expect(() => parseDurationToMs("2 hours")).toThrow(/Invalid JWT duration unit "hours"/i);
  });

  it("issues JWTs with the configured expiration duration", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const token = extractToken(signupRes);

    const decoded = jwt.decode(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();

    // Verify duration (exp - iat) aligns with env.jwtExpiresIn (e.g. 2h = 7200 seconds)
    const expectedSeconds = parseDurationToMs(env.jwtExpiresIn) / 1000;
    expect(decoded.exp - decoded.iat).toBe(expectedSeconds);
  });
});

// ─────────────────────────────────────────────────────────────
// SEC-04: Default Password Exclusion (select: false)
// ─────────────────────────────────────────────────────────────
describe("SEC-04: Default Password Exclusion (select: false)", () => {
  it("omits password field by default on User.findOne and User.findById queries", async () => {
    await request(app).post("/api/auth/signup").send(validUser);

    const userFindOne = await User.findOne({ email: validUser.email });
    expect(userFindOne.password).toBeUndefined();

    const userFindById = await User.findById(userFindOne._id);
    expect(userFindById.password).toBeUndefined();
  });

  it("allows password retrieval only when explicitly requested with .select('+password')", async () => {
    await request(app).post("/api/auth/signup").send(validUser);

    const userWithPassword = await User.findOne({ email: validUser.email }).select("+password");
    expect(userWithPassword.password).toBeDefined();
    expect(userWithPassword.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
  });
});

// ─────────────────────────────────────────────────────────────
// SEC-05: JWT Issuer and Audience Claims
// ─────────────────────────────────────────────────────────────
describe("SEC-05: JWT Issuer and Audience Claims", () => {
  it("issues JWTs embedding correct issuer and audience claims", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const token = extractToken(signupRes);

    const decoded = jwt.decode(token);
    expect(decoded.iss).toBe("tripnow-api");
    expect(decoded.aud).toBe("tripnow-client");
  });

  it("rejects tokens with an incorrect issuer with 401", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const user = await User.findOne({ email: validUser.email });

    const wrongIssuerToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      env.jwtSecret,
      {
        expiresIn: "2h",
        issuer: "unauthorized-malicious-api",
        audience: env.jwtAudience,
        algorithm: "HS256",
      }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${wrongIssuerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it("rejects tokens with an incorrect audience with 401", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const user = await User.findOne({ email: validUser.email });

    const wrongAudienceToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      env.jwtSecret,
      {
        expiresIn: "2h",
        issuer: env.jwtIssuer,
        audience: "foreign-unintended-client",
        algorithm: "HS256",
      }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${wrongAudienceToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it("rejects tokens missing issuer or audience claims with 401", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const user = await User.findOne({ email: validUser.email });

    // Token without iss/aud claims
    const claimlessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      env.jwtSecret,
      { expiresIn: "2h", algorithm: "HS256" }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${claimlessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  it("rejects tokens signed with an invalid secret", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(validUser);
    const user = await User.findOne({ email: validUser.email });

    const forgedToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      "completely_wrong_attacker_secret_key",
      {
        expiresIn: "2h",
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
        algorithm: "HS256",
      }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${forgedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });
});
