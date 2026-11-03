const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const env = require("../config/env");
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

const testUser = {
  name: "Cookie Tester",
  email: "cookie.tester@example.com",
  password: "StrongPassword123!",
};

const adminUser = {
  name: "Cookie Admin",
  email: "cookie.admin@example.com",
  password: "AdminPassword123!",
};

describe("HttpOnly Cookie Authentication — Phase 1 Step 2", () => {
  describe("Registration (POST /api/auth/signup)", () => {
    it("sets a secure HttpOnly cookie and does NOT expose the token in the response body", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Account created successfully");

      // Verify token is NOT exposed in JSON body
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      // Verify user profile is returned
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.role).toBe("user");

      // Verify Set-Cookie header
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(tokenCookie).toMatch(/SameSite=Lax/i);
      expect(tokenCookie).toMatch(/Path=\//i);
    });
  });

  describe("Login (POST /api/auth/login)", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/signup").send(testUser);
    });

    it("sets an HttpOnly cookie and omits token from JSON response body", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.token).toBeUndefined();
      expect(res.body.data.user.email).toBe(testUser.email);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(tokenCookie).toMatch(/SameSite=Lax/i);
      expect(tokenCookie).toMatch(/Path=\//i);
    });
  });

  describe("Cookie Extraction & Protected Routes (GET /api/auth/me)", () => {
    it("authenticates via HttpOnly cookie in the Cookie request header", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const token = extractToken(signupRes);
      expect(token).toBeTruthy();

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.name).toBe(testUser.name);
    });

    it("supports Authorization Bearer header as fallback for non-browser clients", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const token = extractToken(signupRes);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it("prioritizes cookie over header if both are provided", async () => {
      const userARes = await request(app).post("/api/auth/signup").send(testUser);
      const tokenA = extractToken(userARes);

      const userBRes = await request(app).post("/api/auth/signup").send({
        name: "User B",
        email: "userb@example.com",
        password: "StrongPassword123!",
      });
      const tokenB = extractToken(userBRes);

      // Cookie has tokenA, Header has tokenB -> should resolve to tokenA (userA)
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${tokenA}`])
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testUser.email);
    });
  });

  describe("Authentication Rejection (Missing, Invalid, Expired, Orphaned)", () => {
    it("rejects request without cookie or header with 401", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/token missing/i);
    });

    it("rejects request with a malformed/invalid token cookie with 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["token=malformed.invalid.token"]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired token/i);
    });

    it("rejects request with an expired token cookie with 401", async () => {
      const expiredToken = jwt.sign(
        { id: "507f1f77bcf86cd799439011", role: "user" },
        env.jwtSecret,
        {
          expiresIn: "-1s",
          issuer: env.jwtIssuer,
          audience: env.jwtAudience,
          algorithm: "HS256",
        }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${expiredToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired token/i);
    });

    it("rejects request when user associated with token has been deleted", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const token = extractToken(signupRes);

      // Delete user from DB
      await User.deleteOne({ email: testUser.email });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/no longer exists/i);
    });
  });

  describe("Server-Side Logout (POST /api/auth/logout)", () => {
    it("clears the auth cookie and prevents subsequent authenticated requests", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const token = extractToken(signupRes);

      // Verify user is currently authenticated
      const preCheck = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`]);
      expect(preCheck.status).toBe(200);

      // Fetch CSRF token for the authenticated session
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${token}`]);
      const csrfToken = csrfRes.body.csrfToken;

      // Call logout with valid CSRF token
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${token}`])
        .set("X-CSRF-Token", csrfToken);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.message).toBe("Logged out successfully");

      // Verify Set-Cookie header clears the token cookie
      const cookies = logoutRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies.find((c) => c.startsWith("token="));
      expect(clearedCookie).toBeDefined();
      // Cleared cookie should either have empty value or expire in the past
      expect(
        clearedCookie.includes("token=;") ||
        clearedCookie.includes("Expires=Thu, 01 Jan 1970") ||
        clearedCookie.includes("Max-Age=0")
      ).toBe(true);
      expect(clearedCookie).toMatch(/Path=\//i);
      expect(clearedCookie).toMatch(/HttpOnly/i);

      // Subsequent authenticated request using empty token cookie must fail with 401
      const postCheck = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["token="]);
      expect(postCheck.status).toBe(401);
    });
  });

  describe("Role-based Authorization with Cookie", () => {
    it("denies non-admin cookie user access to admin route with 403", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const token = extractToken(signupRes);

      const res = await request(app)
        .get("/api/admin/bookings")
        .set("Cookie", [`token=${token}`]);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/forbidden.*admin/i);
    });

    it("allows admin cookie user access to admin route with 200", async () => {
      await request(app).post("/api/auth/signup").send(adminUser);
      await User.findOneAndUpdate({ email: adminUser.email }, { role: "admin" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: adminUser.email, password: adminUser.password });

      const adminToken = extractToken(loginRes);

      const res = await request(app)
        .get("/api/admin/bookings")
        .set("Cookie", [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});

