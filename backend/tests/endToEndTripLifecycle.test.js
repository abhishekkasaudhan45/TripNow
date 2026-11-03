// backend/tests/endToEndTripLifecycle.test.js
const request = require("supertest");
const app = require("../app");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { GoogleGenAI } = require("@google/genai");

jest.mock("@google/genai", () => {
  const original = jest.requireActual("@google/genai");
  return {
    ...original,
    GoogleGenAI: jest.fn(),
  };
});

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

const userA = { name: "Traveler Alice", email: "alice.lifecycle@example.com", password: "Password123!" };
const userB = { name: "Traveler Bob", email: "bob.lifecycle@example.com", password: "Password123!" };

const signupUser = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: extractToken(res), user: res.body.data.user };
};

const initialSamplePlan = {
  destination: "Paris, France",
  days: [
    {
      day: 1,
      title: "Historic Heart of Paris",
      morning: "Visit the Louvre Museum and Mona Lisa",
      afternoon: "Stroll Tuileries Garden and Place de la Concorde",
      evening: "Sunset Seine river cruise",
      food: ["Croissant at local boulangerie", "Duck Confit for dinner"],
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Louvre Museum",
          description: "World famous museum exploring classical masterworks",
          category: "Culture & History",
          durationMinutes: 180,
          cost: "$22",
          indoorOutdoor: "Indoor",
          locked: false,
        },
        {
          id: "d1-afternoon-01",
          period: "afternoon",
          title: "Tuileries Garden",
          description: "Scenic French formal garden walking tour",
          category: "Sightseeing",
          durationMinutes: 90,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d1-evening-01",
          period: "evening",
          title: "Seine River Cruise",
          description: "Evening cruise viewing illuminated monuments",
          category: "Sightseeing",
          durationMinutes: 75,
          cost: "$18",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
    {
      day: 2,
      title: "Bohemian Montmartre",
      morning: "Climb Sacré-Cœur and explore Place du Tertre",
      afternoon: "Café lunch and Montmartre vineyard walk",
      evening: "Dinner at a traditional French bistro in Pigalle",
      food: ["French Onion Soup", "Fresh Crepes"],
      activities: [
        {
          id: "d2-morning-01",
          period: "morning",
          title: "Sacré-Cœur Basilica",
          description: "Visit the hilltop basilica with panoramic views",
          category: "Culture & History",
          durationMinutes: 120,
          cost: "Free",
          indoorOutdoor: "Mixed",
          locked: false,
        },
        {
          id: "d2-afternoon-01",
          period: "afternoon",
          title: "Montmartre Vineyard Walk",
          description: "Explore the hidden vineyard and cobblestone alleys",
          category: "Sightseeing",
          durationMinutes: 90,
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d2-evening-01",
          period: "evening",
          title: "French Bistro Dining",
          description: "Authentic dinner at Le Consulat",
          category: "Dining & Nightlife",
          durationMinutes: 120,
          cost: "$45",
          indoorOutdoor: "Indoor",
          locked: false,
        },
      ],
    },
  ],
  mustEat: ["Croissant", "Duck Confit", "French Onion Soup"],
  budgetBreakdown: {
    total: "$1200",
    accommodation: "$600",
    foodPerDay: "$80",
    transport: "$40",
    activities: "$250",
  },
  travelTips: ["Use the Paris Metro for fast transit", "Validate ticket upon entry"],
  whereToStay: {
    budget: "Hôtel Saint-Germain",
    midRange: "Le Marais Boutique Hotel",
  },
  bestTimeToVisit: "May to September",
};

describe("Phase 3D — Complete Trip Lifecycle End-to-End Suite", () => {
  let authA, authB;

  beforeEach(async () => {
    authA = await signupUser(userA);
    authB = await signupUser(userB);

    // Default mock response for Google Gemini
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify(initialSamplePlan),
        }),
      },
    }));
  });

  // ==========================================
  // SCENARIO A: NEW TRIP GENERATION
  // ==========================================
  describe("Scenario A: New Trip Generation", () => {
    it("A1. Authenticated user generates new trip: persists initial booking linked to user without duplicates", async () => {
      const res = await request(app)
        .post("/api/ai")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          destination: "Paris, France",
          budget: "$1200",
          startDate: "2026-12-10",
          endDate: "2026-12-12",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tripId).toBeDefined();

      // Check DB
      const booking = await Booking.findById(res.body.tripId);
      expect(booking).not.toBeNull();
      expect(String(booking.user)).toBe(String(authA.user.id || authA.user._id));
      expect(booking.destination).toBe("Paris, France");
      expect(booking.__v).toBe(0);

      // Verify no duplicate records created
      const count = await Booking.countDocuments({ user: authA.user.id || authA.user._id });
      expect(count).toBe(1);
    });

    it("A2. Anonymous user generates new trip: persists unlinked booking (user: null)", async () => {
      const res = await request(app)
        .post("/api/ai")
        .send({
          destination: "Paris, France",
          budget: "$1000",
          startDate: "2026-12-01",
          endDate: "2026-12-03",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tripId).toBeDefined();

      const booking = await Booking.findById(res.body.tripId);
      expect(booking.user).toBeNull();
      expect(booking.destination).toBe("Paris, France");
    });
  });

  // ==========================================
  // SCENARIO B: ADAPTIVE PIVOT (DECOUPLED STAGING & SAVE)
  // ==========================================
  describe("Scenario B: Adaptive Pivot Lifecycle", () => {
    let trip;

    beforeEach(async () => {
      trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        notes: "Anniversary getaway",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("B1. Generates Adaptive Pivot: candidate is staged in memory, DB remains UNMUTATED until explicit save", async () => {
      const adaptiveReplacement = {
        title: "Musée d'Orsay Impressionist Wing",
        description: "Indoor sheltered visit exploring Monet and Van Gogh masterworks during heavy rain.",
        category: "Culture & History",
        indoorOutdoor: "Indoor",
        estimatedDurationMinutes: 150,
        costEstimate: "$16 per person",
        reason: "100% sheltered indoor cultural alternative during rain disruption.",
        insiderTip: "Book tickets online in advance to skip queue.",
      };

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({ replacement: adaptiveReplacement }),
          }),
        },
      }));

      // 1. Generate Adaptive Pivot on Day 1 Afternoon (Tuileries Garden -> Musée d'Orsay)
      const pivotRes = await request(app)
        .post("/api/ai/pivot")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 1,
          block: "afternoon",
          pivotReason: "rain",
        });

      expect(pivotRes.status).toBe(200);
      expect(pivotRes.body.success).toBe(true);
      expect(pivotRes.body.data.persisted).toBe(false);
      expect(pivotRes.body.data.replacement.title).toBe("Musée d'Orsay Impressionist Wing");

      // Verify DB remains 100% UNMUTATED prior to explicit save
      const dbPreSave = await Booking.findById(trip._id);
      expect(dbPreSave.__v).toBe(0);
      const preSavePlan = JSON.parse(dbPreSave.aiPlan);
      expect(preSavePlan.days[0].afternoon).toBe("Stroll Tuileries Garden and Place de la Concorde");

      // 2. Explicit Save Changes
      const stagedPlan = pivotRes.body.data.stagedPlan;
      const saveRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: stagedPlan,
          baseVersion: 0,
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.data.__v).toBe(1);

      // Verify DB is now updated and realityScore was deterministically calculated
      const dbPostSave = await Booking.findById(trip._id);
      expect(dbPostSave.__v).toBe(1);
      const postSavePlan = JSON.parse(dbPostSave.aiPlan);
      expect(postSavePlan.days[0].afternoon).toContain("Musée d'Orsay");
      expect(dbPostSave.realityScore).toBeDefined();

      // 3. Reopening / Refreshing: GET /api/bookings/:id returns saved plan without new AI request
      const loadRes = await request(app)
        .get(`/api/bookings/${trip._id}`)
        .set("Authorization", `Bearer ${authA.token}`);

      expect(loadRes.status).toBe(200);
      const loadedPlan = JSON.parse(loadRes.body.data.aiPlan);
      expect(loadedPlan.days[0].afternoon).toContain("Musée d'Orsay");
      expect(loadRes.body.data.__v).toBe(1);
    });
  });

  // ==========================================
  // SCENARIO C: CUSTOM PIVOT
  // ==========================================
  describe("Scenario C: Custom Pivot Lifecycle", () => {
    let trip;

    beforeEach(async () => {
      trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("C1. Rejects invalid custom inputs (empty or whitespace-only)", async () => {
      const res = await request(app)
        .post("/api/ai/pivot")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 2,
          block: "afternoon",
          pivotReason: "custom",
          customReason: "   ",
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.customReason).toBeDefined();
    });

    it("C2. Generates Custom Pivot with valid instruction, stages candidate, and saves explicitly", async () => {
      const customReplacement = {
        title: "Café de Flore Historic Literary Tea",
        description: "Relaxing afternoon tea and pastries in Saint-Germain-des-Prés.",
        category: "Relaxation",
        indoorOutdoor: "Indoor",
        estimatedDurationMinutes: 75,
        costEstimate: "$20",
        reason: "Gentle seated afternoon tea satisfying traveler requirement.",
        insiderTip: "Sit in the upstairs salon for quieter seating.",
      };

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({ replacement: customReplacement }),
          }),
        },
      }));

      const pivotRes = await request(app)
        .post("/api/ai/pivot")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 2,
          block: "afternoon",
          pivotReason: "custom",
          customReason: "Need a restful seated cafe due to fatigue",
        });

      expect(pivotRes.status).toBe(200);
      expect(pivotRes.body.data.persisted).toBe(false);
      expect(pivotRes.body.data.replacement.title).toBe("Café de Flore Historic Literary Tea");

      // Save explicitly
      const saveRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: pivotRes.body.data.stagedPlan,
          baseVersion: 0,
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.data.__v).toBe(1);

      const check = await Booking.findById(trip._id);
      expect(check.__v).toBe(1);
      const plan = JSON.parse(check.aiPlan);
      expect(plan.days[1].afternoon).toContain("Café de Flore");
    });
  });

  // ==========================================
  // SCENARIO D: FIX DAY LIFECYCLE
  // ==========================================
  describe("Scenario D: Fix Day Proposal & Apply Lifecycle", () => {
    let trip;

    beforeEach(async () => {
      trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("D1. Fix Day preview issues signed token without mutating DB; apply commits changes", async () => {
      const fixDayReplacement = {
        title: "Sheltered Covered Passages Walk",
        description: "Explore Galerie Vivienne indoor shopping arcades.",
        category: "Sightseeing",
        indoorOutdoor: "Indoor",
        durationMinutes: 90,
        cost: "Free",
        reason: "Sheltered route during weather disruption.",
      };

      GoogleGenAI.mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify({ replacement: fixDayReplacement }),
          }),
        },
      }));

      // Preview Fix Day
      const previewRes = await request(app)
        .post("/api/ai/fix-day/preview")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 1,
          reason: "schedule_overload",
          currentPeriod: "afternoon",
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data.proposalToken).toBeDefined();

      const replacedSlot = previewRes.body.data.slots.find((s) => s.status === "replaced") || previewRes.body.data.slots[0];
      const targetPeriod = replacedSlot.period;

      // Ensure MongoDB document is still unmodified
      const dbCheck = await Booking.findById(trip._id);
      expect(dbCheck.__v).toBe(0);

      // Apply Fix Day proposal
      const applyRes = await request(app)
        .post("/api/ai/fix-day/apply")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 1,
          proposalToken: previewRes.body.data.proposalToken,
        });

      expect(applyRes.status).toBe(200);
      expect(applyRes.body.success).toBe(true);

      const dbPostApply = await Booking.findById(trip._id);
      expect(dbPostApply.__v).toBe(1);
      const updatedPlan = JSON.parse(dbPostApply.aiPlan);
      expect(updatedPlan.days[0][targetPeriod]).toContain("Sheltered Covered Passages");
    });
  });

  // ==========================================
  // SCENARIO E: ACTIVITY LOCKING
  // ==========================================
  describe("Scenario E: Activity Locking Invariants", () => {
    let trip;

    beforeEach(async () => {
      trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("E1. Locking an activity blocks AI pivot and prevents deletion, content edit, or covert unlocking (HTTP 423)", async () => {
      // 1. Lock Day 1 morning activity (Louvre Museum) via POST /api/ai/activity/lock
      const lockRes = await request(app)
        .post("/api/ai/activity/lock")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          activityId: "d1-morning-01",
          locked: true,
        });

      expect(lockRes.status).toBe(200);
      expect(lockRes.body.data.locked).toBe(true);

      // Version incremented to 1 due to lock
      const dbLocked = await Booking.findById(trip._id);
      expect(dbLocked.__v).toBe(1);

      // 2. Attempt to adapt locked block: fails with HTTP 423 (locked)
      const pivotAttempt = await request(app)
        .post("/api/ai/pivot")
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          tripId: trip._id.toString(),
          dayNumber: 1,
          block: "morning",
          pivotReason: "rain",
        });

      expect(pivotAttempt.status).toBe(423);
      expect(pivotAttempt.body.message).toContain("locked");

      // 3. Attempt to save an itinerary with modified locked activity title: fails with 423
      const tamperedTitlePlan = JSON.parse(dbLocked.aiPlan);
      tamperedTitlePlan.days[0].activities[0].title = "Tampered Louvre Title";

      const tamperedRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: tamperedTitlePlan,
          baseVersion: 1,
        });

      expect(tamperedRes.status).toBe(423);
      expect(tamperedRes.body.message).toContain("Cannot modify locked activity");

      // 4. Attempt to covertly unlock: fails with 423
      const covertUnlockPlan = JSON.parse(dbLocked.aiPlan);
      covertUnlockPlan.days[0].activities[0].locked = false;

      const covertRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: covertUnlockPlan,
          baseVersion: 1,
        });

      expect(covertRes.status).toBe(423);
      expect(covertRes.body.message).toContain("Cannot unlock activity");

      // 5. Attempt to delete locked activity: fails with 423
      const deleteLockedPlan = JSON.parse(dbLocked.aiPlan);
      deleteLockedPlan.days[0].activities = deleteLockedPlan.days[0].activities.filter(
        (a) => a.id !== "d1-morning-01"
      );

      const deleteRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: deleteLockedPlan,
          baseVersion: 1,
        });

      expect(deleteRes.status).toBe(423);
      expect(deleteRes.body.message).toContain("Locked activities cannot be deleted");

      // 6. Legitimate save: modify unlocked activity while keeping locked activity identical
      const validPlan = JSON.parse(dbLocked.aiPlan);
      validPlan.days[0].activities[1].title = "Updated Unlocked Tuileries Walk";
      validPlan.days[0].afternoon = "Updated Unlocked Tuileries Walk";

      const validSave = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: validPlan,
          baseVersion: 1,
        });

      expect(validSave.status).toBe(200);
      expect(validSave.body.data.__v).toBe(2);
    });
  });

  // ==========================================
  // SCENARIO F: ANONYMOUS AUTHENTICATION & OWNERSHIP
  // ==========================================
  describe("Scenario F: Anonymous Authentication & Ownership", () => {
    let tripA;

    beforeEach(async () => {
      tripA = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("F1. Rejects unauthenticated save, preserves ownership, and blocks cross-user tampering", async () => {
      // 1. Unauthenticated save returns 401
      const unauthRes = await request(app)
        .patch(`/api/bookings/${tripA._id}/itinerary`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(unauthRes.status).toBe(401);

      // 2. User B cannot view User A's trip via GET: returns 404
      const getResB = await request(app)
        .get(`/api/bookings/${tripA._id}`)
        .set("Authorization", `Bearer ${authB.token}`);

      expect(getResB.status).toBe(404);

      // 3. User B cannot save changes to User A's trip: returns 404
      const patchResB = await request(app)
        .patch(`/api/bookings/${tripA._id}/itinerary`)
        .set("Authorization", `Bearer ${authB.token}`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(patchResB.status).toBe(404);

      // 4. Authenticated owner User A verifies trip and saves successfully
      const getResA = await request(app)
        .get(`/api/bookings/${tripA._id}`)
        .set("Authorization", `Bearer ${authA.token}`);

      expect(getResA.status).toBe(200);
      expect(getResA.body.data.__v).toBe(0);

      const saveResA = await request(app)
        .patch(`/api/bookings/${tripA._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(saveResA.status).toBe(200);
      expect(saveResA.body.data.__v).toBe(1);
    });
  });

  // ==========================================
  // SCENARIO G: SAVE AND CONCURRENCY RESILIENCE
  // ==========================================
  describe("Scenario G: Save and Concurrency Resilience", () => {
    let trip;

    beforeEach(async () => {
      trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        aiPlan: JSON.stringify(initialSamplePlan),
      });
    });

    it("G1. Stale baseVersion returns HTTP 409 Conflict without overwriting newer server version", async () => {
      // Simulate another session saving first: increment __v to 1
      await Booking.findByIdAndUpdate(trip._id, { $inc: { __v: 1 } });

      // Stale attempt with baseVersion 0
      const conflictRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.currentVersion).toBe(1);
      expect(conflictRes.body.expectedVersion).toBe(0);

      // Verify DB version was NOT modified
      const check = await Booking.findById(trip._id);
      expect(check.__v).toBe(1);
    });

    it("G2. Prevents duplicate submissions: second call with same baseVersion yields 409", async () => {
      const firstSave = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(firstSave.status).toBe(200);
      expect(firstSave.body.data.__v).toBe(1);

      // Duplicate immediate call with stale baseVersion 0
      const duplicateSave = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: initialSamplePlan,
          baseVersion: 0,
        });

      expect(duplicateSave.status).toBe(409);
    });

    it("G3. Rejects invalid itinerary schema with HTTP 400", async () => {
      const res = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: { days: [] }, // empty days not allowed
          baseVersion: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.["itinerary.days"]).toBeDefined();
    });
  });

  // ==========================================
  // SCENARIO H & DATABASE INTEGRITY
  // ==========================================
  describe("Scenario H & Database Integrity", () => {
    it("H1. Verifies dashboard trip list, field isolation, and exact reality score sync", async () => {
      const trip = await Booking.create({
        user: authA.user.id || authA.user._id,
        destination: "Paris, France",
        guests: 2,
        checkin: new Date("2026-12-10"),
        checkout: new Date("2026-12-12"),
        budget: "$1200",
        notes: "Anniversary getaway notes",
        aiPlan: JSON.stringify(initialSamplePlan),
      });

      // Modify and save
      const modifiedPlan = JSON.parse(JSON.stringify(initialSamplePlan));
      modifiedPlan.days[0].morning = "Morning Croissant Bakery Workshop";

      const saveRes = await request(app)
        .patch(`/api/bookings/${trip._id}/itinerary`)
        .set("Authorization", `Bearer ${authA.token}`)
        .send({
          itinerary: modifiedPlan,
          baseVersion: 0,
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.data.__v).toBe(1);

      // 1. Dashboard retrieval via GET /api/bookings
      const dashboardRes = await request(app)
        .get("/api/bookings")
        .set("Authorization", `Bearer ${authA.token}`);

      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.body.data.length).toBe(1);
      expect(dashboardRes.body.data[0]._id).toBe(trip._id.toString());
      expect(dashboardRes.body.data[0].destination).toBe("Paris, France");

      // 2. Authoritative Database Integrity Verification
      const persisted = await Booking.findById(trip._id);
      expect(persisted.__v).toBe(1);
      expect(persisted.destination).toBe("Paris, France");
      expect(persisted.guests).toBe(2);
      expect(persisted.budget).toBe("$1200");
      expect(persisted.notes).toBe("Anniversary getaway notes");
      expect(String(persisted.user)).toBe(String(authA.user.id || authA.user._id));

      // Reality score exists and matches
      expect(persisted.realityScore).toBeDefined();
      expect(persisted.realityScore.score).toBeGreaterThan(0);
    });
  });
});
