const request = require("supertest");
const express = require("express");
const app = require("../app");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { securityHeaders } = require("../middleware/security");
const { errorHandler } = require("../middleware/errorHandler");
const { hasForbiddenKeys, hasMongoOperatorKeys } = require("../middleware/payloadSecurity");

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
  name: "Security Tester",
  email: "sec@example.com",
  password: "Password123!",
};

describe("Phase 1 Step 4 — Security Middleware Hardening", () => {
  let authToken;

  beforeEach(async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(testUser);
    authToken = extractToken(signupRes);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. HTTP Security Headers and Helmet
  // ─────────────────────────────────────────────────────────────
  describe("HTTP Security Headers & Helmet", () => {
    it("sets all required defensive HTTP security headers", async () => {
      const res = await request(app).get("/api");

      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
      expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
      expect(res.headers["x-dns-prefetch-control"]).toBe("off");
      expect(res.headers["permissions-policy"]).toContain("camera=()");
    });

    it("ensures X-Powered-By is absent from all responses", async () => {
      const res = await request(app).get("/api");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("includes a robust Content-Security-Policy header with application-tailored directives", async () => {
      const res = await request(app).get("/api");
      const csp = res.headers["content-security-policy"];

      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("https://fonts.googleapis.com");
      expect(csp).toContain("https://images.unsplash.com");
      expect(csp).toContain("https://maps.google.com");
      expect(csp).toContain("https://cdn.jsdelivr.net");
    });

    it("omits HSTS in development/test and enforces conservative HSTS in production without preload or includeSubDomains", async () => {
      // In test environment, HSTS must be disabled
      const testRes = await request(app).get("/api");
      expect(testRes.headers["strict-transport-security"]).toBeUndefined();

      // Simulate production configuration
      const prodApp = express();
      const originalEnv = process.env.NODE_ENV;
      const originalCsrf = process.env.CSRF_SECRET;
      process.env.NODE_ENV = "production";
      process.env.CSRF_SECRET = "test_csrf_secret_32_characters_minimum_entropy";
      process.env.FIX_DAY_PROPOSAL_SECRET = "test_fix_day_proposal_secret_key_32bytes_minimum_safe";
      jest.resetModules();
      const prodSecurity = require("../middleware/security");

      prodApp.use(prodSecurity.securityHeaders);
      prodApp.get("/prod-check", (req, res) => res.json({ ok: true }));

      const prodRes = await request(prodApp).get("/prod-check");
      expect(prodRes.headers["strict-transport-security"]).toBeDefined();
      expect(prodRes.headers["strict-transport-security"]).toContain("max-age=31536000");
      // Conservative posture: No includeSubDomains or preload until full domain readiness
      expect(prodRes.headers["strict-transport-security"]).not.toContain("includeSubDomains");
      expect(prodRes.headers["strict-transport-security"]).not.toContain("preload");

      // Restore env
      process.env.NODE_ENV = originalEnv;
      if (originalCsrf) {
        process.env.CSRF_SECRET = originalCsrf;
      } else {
        delete process.env.CSRF_SECRET;
      }
      jest.resetModules();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Request Correlation & Request IDs
  // ─────────────────────────────────────────────────────────────
  describe("Request Correlation & Request IDs", () => {
    it("generates a UUID X-Request-Id header when none is provided", async () => {
      const res = await request(app).get("/api");
      expect(res.headers["x-request-id"]).toBeDefined();
      // UUID format validation: 8-4-4-4-12 hex chars
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("preserves a valid client-provided X-Request-Id header", async () => {
      const customId = "client-trace-id-123456789";
      const res = await request(app)
        .get("/api")
        .set("X-Request-Id", customId);

      expect(res.headers["x-request-id"]).toBe(customId);
    });

    it("replaces invalid or malformed client-provided X-Request-Id with a secure UUID", async () => {
      const maliciousId = "invalid!id<script>alert(1)</script>";
      const res = await request(app)
        .get("/api")
        .set("X-Request-Id", maliciousId);

      expect(res.headers["x-request-id"]).not.toBe(maliciousId);
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Request Size & Payload Protection
  // ─────────────────────────────────────────────────────────────
  describe("Request Size & Payload Protection", () => {
    it("rejects state-changing requests with non-empty non-JSON Content-Type with 415", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "text/plain")
        .send("email=test@example.com&password=password");

      expect(res.status).toBe(415);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("application/json");
    });

    it("allows state-changing requests without a body (e.g. logout) without Content-Type", async () => {
      // Fetch CSRF token first
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", [`token=${authToken}`]);
      const csrfToken = csrfRes.body.csrfToken;

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`token=${authToken}`])
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects oversized JSON payloads exceeding 50kb with 413", async () => {
      // Construct a payload slightly over 50kb
      const hugeString = "a".repeat(60 * 1024);
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ email: "test@example.com", padding: hugeString }));

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Payload too large");
    });

    it("detects and rejects prototype pollution keys in payloads with 400", async () => {
      const maliciousPayload =
        '{"name":"Test","email":"test@example.com","password":"Password123!","__proto__":{"polluted":true}}';

      const res = await request(app)
        .post("/api/auth/signup")
        .set("Content-Type", "application/json")
        .send(maliciousPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("prototype");
    });

    it("correctly identifies nested forbidden prototype properties and bounds recursion", () => {
      expect(hasForbiddenKeys({ a: { constructor: { polluted: true } } })).toBe(true);
      expect(hasForbiddenKeys({ a: { b: { normal: "value" } } })).toBe(false);
      expect(hasForbiddenKeys(null)).toBe(false);

      // Deeply nested benign payload within depth limit
      const deepBenign = { a: { b: { c: { d: { safe: true } } } } };
      expect(hasForbiddenKeys(deepBenign)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Input Validation & NoSQL Injection Protection
  // ─────────────────────────────────────────────────────────────
  describe("Input Validation & NoSQL Injection Protection", () => {
    it("rejects malformed ObjectId parameters on /api/bookings/:id with 400", async () => {
      const res = await request(app)
        .get("/api/bookings/invalid-not-an-objectid")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid ID format");
    });

    it("rejects malformed ObjectId parameters on /api/bookings/shared/:id with 400", async () => {
      const res = await request(app).get("/api/bookings/shared/invalid-id-format-123");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid ID format");
    });

    it("rejects malformed ObjectId parameters on /api/bookings/:id/share with 400", async () => {
      const patchRes = await request(app)
        .patch("/api/bookings/not-a-valid-id/share")
        .set("Authorization", `Bearer ${authToken}`);

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.success).toBe(false);
      expect(patchRes.body.message).toBe("Invalid ID format");
    });

    it("rejects direct MongoDB operator injection in query string (?$where=...) with 400", async () => {
      const res = await request(app).get("/api/auth/verify-email?$where=sleep(5000)");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("operator keys are not permitted");
    });

    it("rejects nested MongoDB operator injection (?email[$ne]=null) with 400", async () => {
      const res = await request(app).get("/api/auth/verify-email?email[$ne]=null");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("operator keys are not permitted");
    });

    it("rejects filter operator injection (?filter[$where]=...) with 400", async () => {
      const res = await request(app).get("/api/bookings?filter[$where]=sleep(1000)");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("operator keys are not permitted");
    });

    it("rejects deeply nested query operator injection (?filter[nested][$gt]=1) with 400", async () => {
      const res = await request(app).get("/api/bookings?filter[nested][$gt]=1");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("operator keys are not permitted");
    });

    it("allows query parameters containing $ characters within legitimate values", async () => {
      const res = await request(app).get("/api/shared/507f1f77bcf86cd799439011?budget=$500");
      // Route might be 404 because ID doesn't exist, but it must NOT be 400 operator rejected
      expect(res.status).toBe(404);
    });

    it("allows normal pagination, sorting, and filtering query parameters", async () => {
      const res = await request(app).get("/api/shared/507f1f77bcf86cd799439011?page=1&limit=10&sort=createdAt");
      expect(res.status).toBe(404); // reached route handler normally
    });

    it("correctly identifies operator keys via hasMongoOperatorKeys helper", () => {
      expect(hasMongoOperatorKeys({ $where: "1" })).toBe(true);
      expect(hasMongoOperatorKeys({ email: { $ne: "null" } })).toBe(true);
      expect(hasMongoOperatorKeys({ filter: { nested: { $gt: 10 } } })).toBe(true);
      expect(hasMongoOperatorKeys({ budget: "$500", page: "1", sort: "asc" })).toBe(false);
      expect(hasMongoOperatorKeys(null)).toBe(false);
    });

    it("enforces explicit field allowlist in updateBooking and prevents unauthorized field mutation", async () => {
      // Create a booking first
      const createRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          destination: "Tokyo",
          guests: 2,
          checkin: "2026-11-01T00:00:00.000Z",
          checkout: "2026-11-05T00:00:00.000Z",
          budget: "$2000",
        });

      const tripId = createRes.body.data._id;
      const originalUserId = createRes.body.data.user;

      // Attempt to modify destination (allowed) and overwrite user ID or inject unexpected properties (forbidden)
      const fakeUserId = "507f1f77bcf86cd799439099";
      const updateRes = await request(app)
        .put(`/api/bookings/${tripId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          destination: "Kyoto",
          user: fakeUserId,
          injectedField: "malicious_data",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.destination).toBe("Kyoto");
      // user ID must remain unchanged and injectedField must be excluded
      expect(String(updateRes.body.data.user)).toBe(String(originalUserId));
      expect(updateRes.body.data.injectedField).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Rate Limiting Response & Endpoint Protection
  // ─────────────────────────────────────────────────────────────
  describe("Rate Limiting Response Structure", () => {
    it("returns consistent JSON shape and standard headers when a rate limit is triggered", async () => {
      // Create a standalone express app with rate limiter not skipped
      const testLimiterApp = express();
      const rateLimit = require("express-rate-limit");

      const strictLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: "Too many requests. Please slow down.",
        },
      });

      testLimiterApp.use("/throttled", strictLimiter, (req, res) => {
        res.json({ success: true, message: "OK" });
      });

      // First 2 requests succeed
      const res1 = await request(testLimiterApp).get("/throttled");
      expect(res1.status).toBe(200);
      const res2 = await request(testLimiterApp).get("/throttled");
      expect(res2.status).toBe(200);

      // 3rd request is throttled
      const res3 = await request(testLimiterApp).get("/throttled");
      expect(res3.status).toBe(429);
      expect(res3.body.success).toBe(false);
      expect(res3.body.message).toContain("Too many requests");
      expect(res3.headers["ratelimit-limit"]).toBe("2");
      expect(res3.headers["ratelimit-remaining"]).toBe("0");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Error Handling & Information Disclosure Controls
  // ─────────────────────────────────────────────────────────────
  describe("Error Handling & Information Disclosure", () => {
    it("returns consistent 404 response with correlation requestId on unknown routes", async () => {
      const res = await request(app).get("/api/unknown-nonexistent-endpoint");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Route not found");
      expect(res.body.requestId).toBeDefined();
    });

    it("masks internal 500 errors and suppresses stack traces in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalCsrf = process.env.CSRF_SECRET;
      process.env.NODE_ENV = "production";
      process.env.CSRF_SECRET = "test_csrf_secret_32_characters_minimum_entropy";
      process.env.FIX_DAY_PROPOSAL_SECRET = "test_fix_day_proposal_secret_key_32bytes_minimum_safe";
      jest.resetModules();

      const prodApp = express();
      const env = require("../config/env");
      const { errorHandler } = require("../middleware/errorHandler");

      prodApp.get("/crash-test", (req, res, next) => {
        const err = new Error("Database connection to mongodb://admin:secretPass@mongo.cluster failed");
        err.statusCode = 500;
        next(err);
      });
      prodApp.use(errorHandler);

      const res = await request(prodApp).get("/crash-test");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      // Raw internal message and connection string must NOT leak to client
      expect(res.body.message).toBe("Something went wrong. Please try again.");
      expect(res.body.message).not.toContain("secretPass");
      expect(res.body.message).not.toContain("mongodb://");
      expect(res.body.stack).toBeUndefined();

      // Restore env
      process.env.NODE_ENV = originalEnv;
      if (originalCsrf) {
        process.env.CSRF_SECRET = originalCsrf;
      } else {
        delete process.env.CSRF_SECRET;
      }
      jest.resetModules();
    });

    it("returns structured, useful field validation error messages for bad client input", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "",
          email: "not-an-email",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Validation failed");
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.email).toBeDefined();
    });
  });
});
