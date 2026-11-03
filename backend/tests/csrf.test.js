const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
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

const userA = {
  name: "Alice Montgomery",
  email: "alice@example.com",
  password: "StrongPassword123!",
};

const userB = {
  name: "Bob Builder",
  email: "bob@example.com",
  password: "StrongPassword123!",
};

const validBooking = {
  destination: "Goa, India",
  guests: 2,
  checkin: "2026-11-01",
  checkout: "2026-11-05",
  budget: "25000",
  fullName: "Alice Montgomery",
  email: "alice@example.com",
  phone: "+1 555-0199",
};

describe("CSRF Protection — Phase 1 Step 3", () => {
  let tokenA;
  let tokenB;

  beforeEach(async () => {
    const resA = await request(app).post("/api/auth/signup").send(userA);
    tokenA = extractToken(resA);

    const resB = await request(app).post("/api/auth/signup").send(userB);
    tokenB = extractToken(resB);
  });

  describe("Token Issuance (GET /api/csrf-token)", () => {
    it("issues a cryptographically unpredictable token with salt and HMAC", async () => {
      const res = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.csrfToken).toBe("string");

      const parts = res.body.csrfToken.split(".");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBe(32); // 16-byte hex salt
      expect(parts[1].length).toBe(64); // SHA-256 hex HMAC
    });

    it("produces distinct salts/tokens across multiple calls for the same session (unpredictable)", async () => {
      const res1 = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);

      const res2 = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);

      expect(res1.body.csrfToken).not.toBe(res2.body.csrfToken);
    });

    it("allows unauthenticated callers to acquire an initial CSRF token", async () => {
      const res = await request(app).get("/api/csrf-token");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.csrfToken).toBeDefined();
    });
  });

  describe("Safe HTTP Methods (GET, HEAD, OPTIONS)", () => {
    it("allows GET requests without CSRF token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${tokenA}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows HEAD requests without CSRF token", async () => {
      const res = await request(app)
        .head("/api/auth/me")
        .set("Cookie", [`token=${tokenA}`]);

      expect(res.status).toBe(200);
    });

    it("allows OPTIONS preflight requests without CSRF token", async () => {
      const res = await request(app)
        .options("/api/bookings")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST");

      // CORS middleware handles OPTIONS and returns 204 or 200
      expect([200, 204]).toContain(res.status);
    });
  });

  describe("State-Changing Request Protection on Cookie Sessions", () => {
    it("rejects authenticated POST without CSRF token with 403 (CSRF_TOKEN_MISSING)", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("CSRF_TOKEN_MISSING");
      expect(res.body.message).toMatch(/CSRF token missing/i);
    });

    it("rejects authenticated POST with malformed CSRF token with 403 (CSRF_TOKEN_INVALID)", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", "invalid-token-without-dot")
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
    });

    it("rejects authenticated POST with tampered CSRF token signature with 403", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const [salt, hmac] = validToken.split(".");
      const tamperedHmac = (hmac[0] === "a" ? "b" : "a") + hmac.slice(1);
      const tamperedToken = `${salt}.${tamperedHmac}`;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", tamperedToken)
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
    });

    it("accepts authenticated POST with valid session-bound CSRF token", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .send(validBooking);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.destination).toBe("Goa, India");
    });

    it("enforces CSRF protection across PUT, PATCH, and DELETE methods", async () => {
      // 1. Create booking with valid CSRF token
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const token = csrfRes.body.csrfToken;

      const createRes = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", token)
        .send(validBooking);
      expect(createRes.status).toBe(201);
      const bookingId = createRes.body.data._id;

      // 2. PUT without CSRF -> rejected
      const putRes = await request(app)
        .put(`/api/bookings/${bookingId}`)
        .set("Cookie", [`token=${tokenA}`])
        .send({ destination: "Kerala, India" });
      expect(putRes.status).toBe(403);
      expect(putRes.body.code).toBe("CSRF_TOKEN_MISSING");

      // 3. PATCH (/share) without CSRF -> rejected
      const patchRes = await request(app)
        .patch(`/api/bookings/${bookingId}/share`)
        .set("Cookie", [`token=${tokenA}`]);
      expect(patchRes.status).toBe(403);
      expect(patchRes.body.code).toBe("CSRF_TOKEN_MISSING");

      // 4. PATCH (/share) with valid CSRF -> accepted
      const patchValid = await request(app)
        .patch(`/api/bookings/${bookingId}/share`)
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", token);
      expect(patchValid.status).toBe(200);
      expect(patchValid.body.data.isShared).toBe(true);

      // 5. DELETE without CSRF -> rejected
      const delNoCsrf = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set("Cookie", [`token=${tokenA}`]);
      expect(delNoCsrf.status).toBe(403);

      // 6. DELETE with valid CSRF -> accepted
      const delValid = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", token);
      expect(delValid.status).toBe(200);
    });
  });

  describe("Session Binding (No Token Swapping Between Users)", () => {
    it("rejects User A's CSRF token when used with User B's cookie session", async () => {
      // User A gets CSRF token bound to User A's JWT
      const csrfA = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const tokenForUserA = csrfA.body.csrfToken;

      // Attacker attempts to use User A's CSRF token in User B's cookie session
      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenB}`])
        .set("X-CSRF-Token", tokenForUserA)
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
      expect(res.body.message).toMatch(/invalid or expired/i);
    });
  });

  describe("Authentication Lifecycle & Exemptions", () => {
    it("allows unauthenticated signup without CSRF token", async () => {
      const res = await request(app).post("/api/auth/signup").send({
        name: "New Visitor",
        email: "visitor@example.com",
        password: "Passw0rdSecure!",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("allows unauthenticated login without CSRF token", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: userA.email,
        password: userA.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects cookie-authenticated logout without CSRF token with 403", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${tokenA}`]);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_MISSING");
    });

    it("rejects cookie-authenticated logout with invalid CSRF token with 403", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", "invalid.csrf.token");

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
    });

    it("accepts cookie-authenticated logout with valid CSRF token and clears session cookie", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const csrfToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("permits Bearer-only logout without CSRF token", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Bearer Fallback & Anti-Bypass Validation", () => {
    it("permits Bearer-only non-browser requests without CSRF token", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${tokenA}`)
        .send(validBooking);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("STRICT PRECEDENCE: rejects requests carrying both cookie AND Bearer header if CSRF is missing", async () => {
      // Attacker supplies a dummy Bearer header trying to bypass cookie CSRF check
      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("Authorization", `Bearer ${tokenB}`)
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_TOKEN_MISSING");
    });
  });

  describe("Origin & Fetch Metadata Validation (Defense-in-Depth)", () => {
    it("rejects state-changing requests from disallowed origins with 403 (CSRF_ORIGIN_INVALID)", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Origin", "https://malicious-attacker-website.com")
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not allowed/i);
    });

    it("rejects state-changing requests flagged with Sec-Fetch-Site: cross-site", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Origin", "http://localhost:5173")
        .set("Sec-Fetch-Site", "cross-site")
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_ORIGIN_INVALID");
    });

    it("accepts state-changing requests from allowed origin with valid CSRF token", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Origin", "http://localhost:5173")
        .set("Sec-Fetch-Site", "same-site")
        .send(validBooking);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("rejects state-changing requests with Origin: 'null' with 403 (CSRF_ORIGIN_INVALID)", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Origin", "null")
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not allowed/i);
    });

    it("rejects state-changing requests with disallowed Referer header", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Referer", "https://unauthorized-evil-referrer.com/some/path")
        .send(validBooking);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("CSRF_ORIGIN_INVALID");
    });

    it("accepts state-changing requests with allowed Referer header when Origin is absent", async () => {
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${tokenA}`]);
      const validToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${tokenA}`])
        .set("X-CSRF-Token", validToken)
        .set("Referer", "http://localhost:5173/dashboard")
        .send(validBooking);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Production CSRF Secret Validation", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("throws an error in production when CSRF_SECRET is missing", () => {
      process.env.NODE_ENV = "production";
      delete process.env.CSRF_SECRET;
      process.env.JWT_SECRET = "strong_jwt_secret_longer_than_thirty_two_chars";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.ADMIN_PASSWORD = "Password123";
      process.env.ADMIN_EMAIL = "admin@example.com";
      process.env.FIX_DAY_PROPOSAL_SECRET = "strong_proposal_secret_32_chars_minimum";

      expect(() => {
        require("../config/env");
      }).toThrow(/CSRF_SECRET/i);
    });

    it("throws an error in production when CSRF_SECRET is shorter than 32 characters", () => {
      process.env.NODE_ENV = "production";
      process.env.CSRF_SECRET = "too_short_secret";
      process.env.JWT_SECRET = "strong_jwt_secret_longer_than_thirty_two_chars";
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.ADMIN_PASSWORD = "Password123";
      process.env.ADMIN_EMAIL = "admin@example.com";
      process.env.FIX_DAY_PROPOSAL_SECRET = "strong_proposal_secret_32_chars_minimum";

      expect(() => {
        require("../config/env");
      }).toThrow(/at least 32 characters/i);
    });

    it("throws an error in production when CSRF_SECRET is identical to JWT_SECRET", () => {
      process.env.NODE_ENV = "production";
      const sharedSecret = "shared_identical_secret_longer_than_32_chars_abcdef";
      process.env.CSRF_SECRET = sharedSecret;
      process.env.JWT_SECRET = sharedSecret;
      process.env.MONGO_URI = "mongodb://localhost:27017/test";
      process.env.ADMIN_PASSWORD = "Password123";
      process.env.ADMIN_EMAIL = "admin@example.com";
      process.env.FIX_DAY_PROPOSAL_SECRET = "strong_proposal_secret_32_chars_minimum";

      expect(() => {
        require("../config/env");
      }).toThrow(/cannot be identical to JWT_SECRET/i);
    });
  });
});
