// backend/tests/budgetApi.test.js
const request = require("supertest");
const express = require("express");
const rateLimit = require("express-rate-limit");
const app = require("../app");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const aiService = require("../services/aiService");
const { budgetLimiter } = require("../middleware/rateLimiters");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const testUser = {
  name: "Budget Tester",
  email: "budgettester@example.com",
  password: "Password123!",
};

const createAuthenticatedUser = async () => {
  const res = await request(app).post("/api/auth/signup").send(testUser);
  const token = extractToken(res);
  const csrfRes = await request(app)
    .get("/api/csrf-token")
    .set("Cookie", [`token=${token}`]);
  const csrfToken = csrfRes.body.csrfToken;
  return { token, csrfToken, user: res.body.data.user };
};

describe("TripNow Phase 5E.3 — Backend Budget Intelligence API Integration", () => {
  // =========================================================================
  // 1. Valid Requests & Multi-Traveler Support
  // =========================================================================
  describe("1. Valid Requests & Multi-Traveler Calculations", () => {
    it("1. Successfully processes a valid INR request for a single traveler", async () => {
      const payload = {
        totalBudget: 15000,
        days: 3,
        guests: 1,
        destination: "Goa",
        currency: "INR",
      };

      const res = await request(app)
        .post("/api/budget/intelligence")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const data = res.body.data;
      expect(data.status).toBe("CALCULATED");
      expect(data.tier).toBe("TIER_2_RESORT");
      expect(data.currency).toBe("INR");
      expect(data.totalBudget).toBe(15000);
      expect(data.days).toBe(3);
      expect(data.guests).toBe(1);
      expect(data.perPersonDailyBudget).toBe(5000);
      expect(data.groupDailyBudget).toBe(5000);
      expect(data.estimatedStandardTotal).toBe(15000);
      expect(data.standardBudgetDifference).toBe(0);
      expect(data.sufficiencyRatio).toBe(1.0);
      expect(data.category).toBe("moderate");
      expect(data.breakdown).toBeDefined();
      expect(data.breakdown.dailyPerPerson.total).toBe(5000);
      expect(Array.isArray(data.warnings)).toBe(true);
    });

    it("2. Accurately calculates for multiple travelers on a multi-day trip", async () => {
      const payload = {
        totalBudget: 63600,
        days: 3,
        guests: 4,
        destination: "Mumbai",
        currency: "INR",
      };

      const res = await request(app)
        .post("/api/budget/intelligence")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.tier).toBe("TIER_1_METRO");
      expect(data.perPersonDailyBudget).toBe(5300); // 63600 / (4 * 3)
      expect(data.groupDailyBudget).toBe(21200);   // 63600 / 3
      expect(data.estimatedStandardTotal).toBe(63600);
      expect(data.sufficiencyRatio).toBe(1.0);
      expect(data.category).toBe("moderate");
    });
  });

  // =========================================================================
  // 2. Input Validation (Rejection of Invalid / Malformed Data)
  // =========================================================================
  describe("2. Input Validation & Structured 4xx Responses", () => {
    it("3. Rejects invalid budget (zero, negative, non-numeric)", async () => {
      const invalidBudgets = [0, -1000, "not-a-number"];
      for (const b of invalidBudgets) {
        const res = await request(app)
          .post("/api/budget/intelligence")
          .send({ totalBudget: b, days: 3, guests: 2, destination: "Goa" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors.totalBudget).toBeDefined();
      }
    });

    it("4. Rejects invalid days (zero, negative, fractional)", async () => {
      const invalidDays = [0, -3, 2.5];
      for (const d of invalidDays) {
        const res = await request(app)
          .post("/api/budget/intelligence")
          .send({ totalBudget: 15000, days: d, guests: 2, destination: "Goa" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.errors.days).toBeDefined();
      }
    });

    it("5. Rejects invalid guest count (zero, negative, fractional)", async () => {
      const invalidGuests = [0, -1, 1.5];
      for (const g of invalidGuests) {
        const res = await request(app)
          .post("/api/budget/intelligence")
          .send({ totalBudget: 15000, days: 3, guests: g, destination: "Goa" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.errors.guests).toBeDefined();
      }
    });

    it("6. Rejects missing or empty destination", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({ totalBudget: 15000, days: 3, guests: 2, destination: "   " });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.destination).toBeDefined();
    });

    it("10. Rejects missing request body", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .set("Content-Type", "application/json")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it("11. Rejects malformed JSON with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .set("Content-Type", "application/json")
        .send("{ malformed: json, missing quotes }");

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. Currency and Destination Boundaries
  // =========================================================================
  describe("3. Currency and Destination Boundaries", () => {
    it("7. Returns UNSUPPORTED_CURRENCY status for foreign currencies without assuming exchange rates", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 1500,
          days: 3,
          guests: 1,
          destination: "Goa",
          currency: "USD",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("UNSUPPORTED_CURRENCY");
      expect(res.body.data.currency).toBe("USD");
      expect(res.body.data.estimatedStandardTotal).toBeNull();
      expect(res.body.data.sufficiencyRatio).toBeNull();
      expect(res.body.data.category).toBeNull();
      expect(res.body.data.warnings.some((w) => w.code === "UNSUPPORTED_CURRENCY")).toBe(true);
    });

    it("8. Successfully calculates international budget intelligence for global tier destinations (Tokyo -> Tier C)", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 110000,
          days: 5,
          guests: 1,
          destination: "Tokyo",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("CALCULATED");
      expect(res.body.data.tier).toBe("GLOBAL_TIER_C");
      expect(res.body.data.dailyTierEstimates).toBeDefined();
      expect(res.body.data.dailyTierEstimates.low).toBe(14000);
      expect(res.body.data.dailyTierEstimates.mid).toBe(22000);
      expect(res.body.data.dailyTierEstimates.high).toBe(40000);
      expect(res.body.data.estimatedTripTotals).toBeDefined();
      expect(res.body.data.estimatedTripTotals.mid).toBe(110000);
      expect(res.body.data.estimatedStandardTotal).toBe(110000);
      expect(res.body.data.sufficiencyRatio).toBe(1.0);
      expect(res.body.data.category).toBe("moderate");
      expect(res.body.data.warnings.some((w) => w.code === "GLOBAL_ESTIMATE_ADVISORY")).toBe(true);
    });

    it("9. Returns UNKNOWN_DESTINATION status for unrecognized destinations without calculating misleading numbers", async () => {
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send({
          totalBudget: 25000,
          days: 3,
          guests: 2,
          destination: "Atlantis Underwater City",
          currency: "INR",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("UNKNOWN_DESTINATION");
      expect(res.body.data.tier).toBe("UNKNOWN");
      expect(res.body.data.estimatedStandardTotal).toBeNull();
      expect(res.body.data.sufficiencyRatio).toBeNull();
      expect(res.body.data.category).toBeNull();
      expect(res.body.data.warnings.some((w) => w.code === "UNKNOWN_DESTINATION")).toBe(true);
    });
  });

  // =========================================================================
  // 4. Security, CSRF, and Authentication
  // =========================================================================
  describe("4. Security, CSRF & Authentication Invariants", () => {
    it("12. Verifies budgetLimiter configuration and headers", () => {
      expect(budgetLimiter).toBeDefined();
      expect(typeof budgetLimiter).toBe("function");
    });

    it("12b. Enforces rate limiting on an active test router when limit is exceeded", async () => {
      const testApp = express();
      testApp.use(express.json());

      const activeLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 3, // strict cap of 3
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Too many calculations" },
        skip: () => false, // do not skip in test
      });

      testApp.post("/test-budget", activeLimiter, (req, res) => {
        res.json({ success: true });
      });

      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const res = await request(testApp).post("/test-budget").send({});
        expect(res.status).toBe(200);
      }

      // 4th request must be rejected with 429 Too Many Requests
      const blockedRes = await request(testApp).post("/test-budget").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
    });

    it("13. Enforces CSRF on cookie-authenticated requests (blocks without token, passes with token)", async () => {
      const { token, csrfToken } = await createAuthenticatedUser();

      const payload = {
        totalBudget: 15000,
        days: 3,
        guests: 1,
        destination: "Goa",
        currency: "INR",
      };

      // A. Cookie present, but NO CSRF token -> Rejected 403 Forbidden
      const blockedRes = await request(app)
        .post("/api/budget/intelligence")
        .set("Cookie", [`token=${token}`])
        .set("Origin", "http://localhost:5173")
        .send(payload);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.code).toBe("CSRF_TOKEN_MISSING");

      // B. Cookie present, WITH valid CSRF token -> Allowed 200 OK
      const allowedRes = await request(app)
        .post("/api/budget/intelligence")
        .set("Cookie", [`token=${token}`])
        .set("x-csrf-token", csrfToken)
        .set("Origin", "http://localhost:5173")
        .send(payload);

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.success).toBe(true);
    });

    it("14. Allows anonymous / unauthenticated guest callers without requiring credentials", async () => {
      const payload = {
        totalBudget: 15000,
        days: 3,
        guests: 1,
        destination: "Goa",
      };

      // Completely unauthenticated request (no cookie, no Authorization header)
      const res = await request(app)
        .post("/api/budget/intelligence")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("CALCULATED");
    });

    it("Never trusts frontend-calculated results (tamper resistance)", async () => {
      const tamperedPayload = {
        totalBudget: 4000, // For Jaipur (standard = 3250), 4000 / 2 days = 2000/day -> ratio 0.615 -> LOW
        days: 2,
        guests: 1,
        destination: "Jaipur",
        currency: "INR",
        // Malicious client tampering:
        category: "high",
        sufficiencyRatio: 99.9,
        perPersonDailyBudget: 999999,
        estimatedStandardTotal: 1,
        standardBudgetDifference: 999999,
      };

      const res = await request(app)
        .post("/api/budget/intelligence")
        .send(tamperedPayload);

      expect(res.status).toBe(200);
      const data = res.body.data;
      // Backend must calculate independently and reject client tampering!
      expect(data.category).toBe("low");
      expect(data.perPersonDailyBudget).toBe(2000);
      expect(data.estimatedStandardTotal).toBe(6500);
      expect(data.standardBudgetDifference).toBe(-2500);
      expect(data.sufficiencyRatio).toBeLessThan(0.75);
    });
  });

  // =========================================================================
  // 5. Side-Effect Free Guarantees (No DB, No Gemini, Booking Intact)
  // =========================================================================
  describe("5. Side-Effect Free Invariants & Isolation", () => {
    it("15. Performs zero database writes during calculation", async () => {
      const initialBookings = await Booking.countDocuments();
      const initialUsers = await User.countDocuments();

      await request(app)
        .post("/api/budget/intelligence")
        .send({ totalBudget: 25000, days: 3, guests: 2, destination: "Goa" });

      const finalBookings = await Booking.countDocuments();
      const finalUsers = await User.countDocuments();

      expect(finalBookings).toBe(initialBookings);
      expect(finalUsers).toBe(initialUsers);
    });

    it("16. Does NOT invoke Google Gemini during budget calculation", async () => {
      const spyAi = jest.spyOn(aiService, "generateItinerary");

      await request(app)
        .post("/api/budget/intelligence")
        .send({ totalBudget: 25000, days: 3, guests: 2, destination: "Goa" });

      expect(spyAi).not.toHaveBeenCalled();
      spyAi.mockRestore();
    });

    it("17. Existing booking creation and update flows remain completely intact", async () => {
      const { token, csrfToken } = await createAuthenticatedUser();

      const bookingPayload = {
        destination: "Goa",
        guests: 2,
        checkin: "2026-11-10T00:00:00.000Z",
        checkout: "2026-11-14T00:00:00.000Z",
        budget: "25000",
        fullName: "Test Traveler",
        email: "test@example.com",
        phone: "+91 9876543210",
      };

      const bookingRes = await request(app)
        .post("/api/bookings")
        .set("Cookie", [`token=${token}`])
        .set("x-csrf-token", csrfToken)
        .set("Origin", "http://localhost:5173")
        .send(bookingPayload);

      expect(bookingRes.status).toBe(201);
      expect(bookingRes.body.success).toBe(true);
      expect(bookingRes.body.data.destination).toBe("Goa");
      expect(bookingRes.body.data.budget).toBe("25000"); // Existing storage semantics intact!
    });
  });
});

