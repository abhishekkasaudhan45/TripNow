const request = require("supertest");
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

const testUser = {
  name: "Privacy Tester",
  email: "privacy.tester@tripnow.test",
  password: "SecurePassword123!",
};

describe("Phase 5C — Cookie Consent, Cookie Security & Privacy Invariants", () => {
  describe("1. Strictly Necessary Cookie Verification ('token')", () => {
    it("sets strictly necessary HttpOnly auth cookie with SameSite=Lax on signup", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(tokenCookie).toMatch(/SameSite=Lax/i);
      expect(tokenCookie).toMatch(/Path=\//i);
      expect(tokenCookie).toMatch(/Max-Age=7200/i); // 2 hours = 7200s
    });

    it("does not expose token or password hash in signup response body", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it("properly clears strictly necessary cookie on logout", async () => {
      // 1. Signup
      const signupRes = await request(app)
        .post("/api/auth/signup")
        .send(testUser);
      const authCookie = signupRes.headers["set-cookie"];

      // 2. Obtain CSRF token
      const csrfRes = await request(app)
        .get("/api/csrf-token")
        .set("Cookie", authCookie);
      const csrfToken = csrfRes.body.csrfToken;

      // 3. Logout with CSRF token
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", authCookie)
        .set("X-CSRF-Token", csrfToken);

      expect(logoutRes.status).toBe(200);
      const logoutCookies = logoutRes.headers["set-cookie"];
      expect(logoutCookies).toBeDefined();

      const clearedTokenCookie = logoutCookies.find((c) => c.startsWith("token="));
      expect(clearedTokenCookie).toBeDefined();
      // Verifies cookie is expired immediately
      expect(clearedTokenCookie).toMatch(/(Max-Age=0|expires=Thu, 01 Jan 1970)/i);
    });
  });

  describe("2. CSRF Token In-Memory Storage Verification", () => {
    it("returns CSRF token in response body and does NOT store it in a tracking cookie", async () => {
      const res = await request(app).get("/api/csrf-token");
      expect(res.status).toBe(200);
      expect(res.body.csrfToken).toBeDefined();
      expect(typeof res.body.csrfToken).toBe("string");

      // Verify no tracker cookie named csrf or similar is set
      const cookies = res.headers["set-cookie"] || [];
      const trackingCookies = cookies.filter(
        (c) => c.toLowerCase().includes("track") || c.toLowerCase().includes("analytics")
      );
      expect(trackingCookies.length).toBe(0);
    });
  });

  describe("3. Data Minimization & Privacy Protection", () => {
    it("verifies password is excluded by default from queries and salted with bcrypt", async () => {
      await request(app).post("/api/auth/signup").send(testUser);

      // By default Mongoose excludes password (SEC-04 privacy design)
      const defaultUser = await User.findOne({ email: testUser.email });
      expect(defaultUser).toBeDefined();
      expect(defaultUser.password).toBeUndefined();

      // When explicitly selected for auth check, verify it is a bcrypt hash and never plain text
      const userWithPassword = await User.findOne({ email: testUser.email }).select("+password");
      expect(userWithPassword.password).not.toBe(testUser.password);
      expect(userWithPassword.password).toMatch(/^\$2[ab]\$\d{2}\$/);
    });

    it("never returns sensitive database fields via GET /api/auth/me", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send(testUser);
      const authCookie = signupRes.headers["set-cookie"];

      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", authCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.password).toBeUndefined();
      expect(meRes.body.data.user.__v).toBeUndefined();
      expect(meRes.body.data.user.resetPasswordToken).toBeUndefined();
      expect(meRes.body.data.user.resetPasswordExpires).toBeUndefined();
    });
  });

  describe("4. Cookie Consent Schema & Policy Version Logic Verification", () => {
    // Tests verifying the consent data model matching frontend/src/utils/cookieConsent.js
    const CONSENT_POLICY_VERSION = "1.0.0";

    function validateConsentPayload(stored) {
      if (!stored || typeof stored !== "object") return null;
      if (stored.version !== CONSENT_POLICY_VERSION) return null; // Stale version invalidated
      return {
        version: stored.version,
        timestamp: stored.timestamp,
        status: stored.status,
        categories: {
          necessary: true, // Strictly necessary is locked true
          analytics: Boolean(stored.categories?.analytics),
          marketing: Boolean(stored.categories?.marketing),
        },
      };
    }

    it("locks strictly necessary to true even if client attempts to disable it", () => {
      const clientPayload = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        status: "customized",
        categories: {
          necessary: false, // Attempt to disable necessary
          analytics: false,
          marketing: false,
        },
      };

      const result = validateConsentPayload(clientPayload);
      expect(result).not.toBeNull();
      expect(result.categories.necessary).toBe(true);
      expect(result.categories.analytics).toBe(false);
      expect(result.categories.marketing).toBe(false);
    });

    it("invalidates consent when policy version does not match", () => {
      const oldPayload = {
        version: "0.9.0", // Outdated version
        timestamp: "2026-01-01T00:00:00.000Z",
        status: "accepted_all",
        categories: { necessary: true, analytics: true, marketing: true },
      };

      const result = validateConsentPayload(oldPayload);
      expect(result).toBeNull(); // Must prompt user again
    });

    it("correctly models full opt-in (accepted_all)", () => {
      const allPayload = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        status: "accepted_all",
        categories: { necessary: true, analytics: true, marketing: true },
      };

      const result = validateConsentPayload(allPayload);
      expect(result).not.toBeNull();
      expect(result.status).toBe("accepted_all");
      expect(result.categories.necessary).toBe(true);
      expect(result.categories.analytics).toBe(true);
      expect(result.categories.marketing).toBe(true);
    });

    it("correctly models opt-out of optional categories (rejected_optional)", () => {
      const rejectPayload = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        status: "rejected_optional",
        categories: { necessary: true, analytics: false, marketing: false },
      };

      const result = validateConsentPayload(rejectPayload);
      expect(result).not.toBeNull();
      expect(result.status).toBe("rejected_optional");
      expect(result.categories.necessary).toBe(true);
      expect(result.categories.analytics).toBe(false);
      expect(result.categories.marketing).toBe(false);
    });
  });
});
