const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
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

const validUser = {
  name: "Reliable Traveler",
  email: "traveler@example.com",
  password: "SecurePassword123!",
};

describe("Phase 5A: Signup and Login Reliability Suite", () => {
  describe("1. Signup Validation & Execution", () => {
    it("successfully creates a new user and sets a secure HttpOnly cookie", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account created successfully");
      expect(res.body.data.user.email).toBe(validUser.email.toLowerCase());
      expect(res.body.data.user.name).toBe(validUser.name);
      expect(res.body.data.token).toBeUndefined(); // Never leak token in body

      // Cookie assertions
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const authCookie = cookies.find((c) => c.startsWith("token="));
      expect(authCookie).toBeDefined();
      expect(authCookie).toMatch(/HttpOnly/i);
      expect(authCookie).toMatch(/SameSite=Lax/i);
      expect(authCookie).toMatch(/Path=\//i);
    });

    it("verifies password is encrypted using bcrypt before database storage", async () => {
      await request(app).post("/api/auth/signup").send(validUser);
      const user = await User.findOne({ email: validUser.email.toLowerCase() }).select("+password");

      expect(user).toBeDefined();
      expect(user.password).not.toBe(validUser.password);
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
      const match = await bcrypt.compare(validUser.password, user.password);
      expect(match).toBe(true);
    });

    it("rejects duplicate email with a clear duplicate-account message", async () => {
      await request(app).post("/api/auth/signup").send(validUser);
      const dupRes = await request(app).post("/api/auth/signup").send({
        name: "Another Name",
        email: validUser.email,
        password: "AnotherPassword123!",
      });

      expect(dupRes.status).toBe(400);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.message).toBe("User with this email already exists");
    });

    it("handles MongoDB E11000 duplicate key error safely without leaking details", async () => {
      const { errorHandler } = require("../middleware/errorHandler");
      const fakeReq = { id: "test-req-id" };
      let capturedStatus = null;
      let capturedJson = null;
      const fakeRes = {
        headersSent: false,
        status(code) {
          capturedStatus = code;
          return this;
        },
        json(data) {
          capturedJson = data;
          return this;
        },
      };

      const mongoErr = new Error("E11000 duplicate key error collection: travel.users index: email_1 dup key");
      mongoErr.code = 11000;
      mongoErr.keyPattern = { email: 1 };
      mongoErr.keyValue = { email: "test@example.com" };

      errorHandler(mongoErr, fakeReq, fakeRes, () => {});

      expect(capturedStatus).toBe(400);
      expect(capturedJson.success).toBe(false);
      expect(capturedJson.message).toBe("User with this email already exists");
      expect(capturedJson.stack).toBeUndefined();
    });

    it("rejects weak password under 8 characters with explicit validation message", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...validUser, password: "Short1!" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.errors.password).toBe("Password must be at least 8 characters");
    });

    it("rejects password missing uppercase letter", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...validUser, password: "password123!" });

      expect(res.status).toBe(400);
      expect(res.body.errors.password).toBe("Password must include an uppercase letter");
    });

    it("rejects password missing a number", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...validUser, password: "PasswordSecret!" });

      expect(res.status).toBe(400);
      expect(res.body.errors.password).toBe("Password must include a number");
    });

    it("rejects invalid email formats", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ ...validUser, email: "invalid-email-format" });

      expect(res.status).toBe(400);
      expect(res.body.errors.email).toBe("Please provide a valid email");
    });

    it("rejects missing required fields (name, email, password)", async () => {
      const res = await request(app).post("/api/auth/signup").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("2. Login Validation & Authentication", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/signup").send(validUser);
    });

    it("successfully logs in with valid credentials and sets auth cookie", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: validUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Login successful");
      expect(res.body.data.user.email).toBe(validUser.email.toLowerCase());

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("token="))).toBe(true);
    });

    it("rejects incorrect password with generic 401 error message", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
        password: "IncorrectPassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("rejects non-existent email with identical generic 401 message (anti-enumeration)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "AnyPassword123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("rejects login request missing password with 400", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: validUser.email,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("3. Session Persistence & Logout", () => {
    it("preserves session across requests using the HttpOnly cookie (/api/auth/me)", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(validUser);
      const token = extractToken(signupRes);

      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`]);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe(validUser.email.toLowerCase());
      expect(meRes.body.data.user.name).toBe(validUser.name);
    });

    it("clears the auth cookie on logout", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(validUser);
      const token = extractToken(signupRes);

      // Acquire session CSRF token
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${token}`]);
      const csrfToken = csrfRes.body.csrfToken;

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${token}`])
        .set("X-CSRF-Token", csrfToken);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      const cookies = logoutRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const authCookie = cookies.find((c) => c.startsWith("token="));
      // Cleared cookie has empty value or past expiration
      expect(authCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
    });
  });

  describe("4. CSRF Bootstrap & Mutating Request Validation", () => {
    it("issues a valid unauthenticated CSRF token on GET /api/csrf-token", async () => {
      const res = await request(app).get("/api/csrf-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.csrfToken).toBe("string");
      const parts = res.body.csrfToken.split(".");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBe(32); // 16-byte salt in hex
      expect(parts[1].length).toBe(64); // SHA-256 HMAC in hex
    });

    it("rejects an authenticated mutating request if CSRF token is missing", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(validUser);
      const token = extractToken(signupRes);

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${token}`])
        .send({
          destination: "Bali, Indonesia",
          guests: 2,
          checkin: "2026-12-01",
          checkout: "2026-12-07",
          fullName: "Reliable Traveler",
          email: validUser.email,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_MISSING");
    });

    it("rejects an authenticated mutating request if CSRF token is invalid or tampered", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(validUser);
      const token = extractToken(signupRes);

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${token}`])
        .set("X-CSRF-Token", "invalid-salt.invalid-hmac-signature")
        .send({
          destination: "Bali, Indonesia",
          guests: 2,
          checkin: "2026-12-01",
          checkout: "2026-12-07",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
    });

    it("accepts an authenticated mutating request with a valid session-bound CSRF token", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(validUser);
      const token = extractToken(signupRes);

      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${token}`]);
      const csrfToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${token}`])
        .set("X-CSRF-Token", csrfToken)
        .send({
          destination: "Bali, Indonesia",
          guests: 2,
          checkin: "2026-12-01",
          checkout: "2026-12-07",
          fullName: "Reliable Traveler",
          email: validUser.email,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});

