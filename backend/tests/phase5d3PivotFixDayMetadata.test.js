// backend/tests/phase5d3PivotFixDayMetadata.test.js
const request = require("supertest");
const crypto = require("crypto");
const app = require("../app");
const env = require("../config/env");
const Booking = require("../models/Booking");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");
const { GoogleGenAI } = require("@google/genai");
const { executePivot } = require("../services/pivotService");
const {
  previewFixDay,
  applyFixDay,
  signProposalToken,
  verifyProposalToken,
  FixDayError,
} = require("../services/fixDayService");
const { evaluateTripReality } = require("../services/realityEngine");

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

const userA = { name: "Traveler A", email: "travelerA@example.com", password: "Password123" };

const signup = async (user) => {
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: extractToken(res), user: res.body.data.user };
};

const samplePlan = {
  destination: "Goa, India",
  days: [
    {
      day: 1,
      title: "North Goa Heritage",
      morning: "Visit Fort Aguada and lighthouse",
      afternoon: "Lunch at Candolim beachside shack",
      evening: "Sunset walk at Sinquerim beach",
      activities: [
        {
          id: "d1-morning-01",
          period: "morning",
          title: "Fort Aguada Exploration",
          description: "Visit Portuguese fortress and lighthouse",
          category: "Sightseeing",
          activityType: "sightseeing",
          durationMinutes: 120,
          travelMode: "driving",
          intensity: "moderate",
          cost: "₹100",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
        {
          id: "d1-afternoon-01",
          period: "afternoon",
          title: "Beachside Shack Lunch",
          description: "Enjoy Goan curry at Candolim",
          category: "Dining & Nightlife",
          activityType: "food",
          durationMinutes: 90,
          travelMode: "walking",
          intensity: "low",
          cost: "₹600",
          indoorOutdoor: "Mixed",
          locked: false,
        },
        {
          id: "d1-evening-01",
          period: "evening",
          title: "Sunset Walk",
          description: "Stroll along Sinquerim beach",
          category: "Sightseeing",
          activityType: "relaxation",
          durationMinutes: 60,
          travelMode: "walking",
          intensity: "low",
          cost: "Free",
          indoorOutdoor: "Outdoor",
          locked: false,
        },
      ],
    },
  ],
  budgetBreakdown: {
    total: "₹10,000",
  },
};

const createTestBooking = async (plan = samplePlan, ownerUser = null) => {
  const userId = ownerUser ? (ownerUser._id || ownerUser.id) : null;
  return await Booking.create({
    user: userId,
    destination: "Goa, India",
    guests: 2,
    checkin: new Date("2026-11-01"),
    checkout: new Date("2026-11-02"),
    budget: "10000",
    aiPlan: JSON.stringify(plan),
  });
};

describe("Phase 5D.3 — Pivot, Fix Day & Locked Activity Metadata Preservation", () => {
  // =========================================================================
  // Group 1: Adaptive & Custom Pivot Metadata Handling (1–6)
  // =========================================================================

  test("1. Adaptive Pivot preserves valid metadata (activityType, durationMinutes, travelMode, intensity)", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Goa Museum of Art & Culture",
              description: "Sheltered cultural gallery and exhibits.",
              category: "Culture",
              activityType: "culture",
              indoorOutdoor: "Indoor",
              durationMinutes: 90,
              travelMode: "public_transport",
              intensity: "low",
              cost: "₹150",
              reason: "Indoor alternative for bad weather.",
              insiderTip: "Carry water.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "afternoon",
      pivotReason: "rain",
      autoPersist: true,
    });

    expect(result.replacement.activityType).toBe("culture");
    expect(result.replacement.durationMinutes).toBe(90);
    expect(result.replacement.travelMode).toBe("public_transport");
    expect(result.replacement.intensity).toBe("low");
    expect(result.replacement.cost).toBe("₹150");

    // Verify persisted structured activity
    const reloaded = await Booking.findById(booking._id);
    const plan = JSON.parse(reloaded.aiPlan);
    const act = plan.days[0].activities.find((a) => a.period === "afternoon");
    expect(act.activityType).toBe("culture");
    expect(act.durationMinutes).toBe(90);
    expect(act.travelMode).toBe("public_transport");
    expect(act.intensity).toBe("low");
    expect(act.cost).toBe("₹150");
  });

  test("2. Custom Pivot preserves valid metadata", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Accessible Spice Plantation Tour",
              description: "Wheelchair-accessible guided herb trail.",
              category: "Nature",
              activityType: "nature",
              indoorOutdoor: "Outdoor",
              durationMinutes: 120,
              travelMode: "driving",
              intensity: "low",
              cost: "₹500",
              reason: "Fully step-free path.",
              insiderTip: "Pre-book wheelchair transport.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "morning",
      pivotReason: "custom",
      customReason: "Wheelchair accessibility required",
      autoPersist: false,
    });

    expect(result.replacement.activityType).toBe("nature");
    expect(result.replacement.durationMinutes).toBe(120);
    expect(result.replacement.travelMode).toBe("driving");
    expect(result.replacement.intensity).toBe("low");
  });

  test("3. Canonical durationMinutes field is used and prioritized", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Quick Art Walk",
              description: "Brief stroll through local gallery.",
              category: "Culture",
              activityType: "culture",
              indoorOutdoor: "Indoor",
              durationMinutes: 45,
              travelMode: "walking",
              intensity: "low",
              cost: "Free",
              reason: "Fits tight schedule.",
              insiderTip: "Check opening hours.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "evening",
      pivotReason: "low_energy",
    });

    expect(result.replacement.durationMinutes).toBe(45);
    expect(result.replacement.estimatedDurationMinutes).toBe(45);
  });

  test("4. Legacy estimatedDurationMinutes conversion remains compatible", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Old Goa Heritage Walk",
              description: "Walk through church square.",
              category: "Culture",
              indoorOutdoor: "Mixed",
              estimatedDurationMinutes: 75,
              costEstimate: "₹200",
              reason: "Historic exploration.",
              insiderTip: "Wear comfortable shoes.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "morning",
      pivotReason: "rain",
    });

    expect(result.replacement.durationMinutes).toBe(75);
    expect(result.replacement.estimatedDurationMinutes).toBe(75);
    expect(result.replacement.cost).toBe("₹200");
    expect(result.replacement.costEstimate).toBe("₹200");
  });

  test("5. Missing metadata remains optional (missing values normalize to null, no fabricated defaults)", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Serene Library Reading",
              description: "Quiet afternoon at central library.",
              category: "Culture",
              indoorOutdoor: "Indoor",
              durationMinutes: 60,
              cost: "Free",
              reason: "Quiet time.",
              insiderTip: "Keep phones silent.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "afternoon",
      pivotReason: "low_energy",
    });

    expect(result.replacement.activityType).toBeNull();
    expect(result.replacement.travelMode).toBeNull();
    expect(result.replacement.intensity).toBeNull();
  });

  test("6. Invalid metadata is handled safely (invalid enums normalize to null)", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Underwater Cave Diving",
              description: "Deep cave dive.",
              category: "Adventure",
              activityType: "non_existent_category",
              indoorOutdoor: "Mixed",
              durationMinutes: 90,
              travelMode: "teleportation",
              intensity: "ultra_extreme",
              cost: "₹1,500",
              reason: "Adventure excursion.",
              insiderTip: "Bring gear.",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "morning",
      pivotReason: "rain",
    });

    expect(result.replacement.activityType).toBeNull();
    expect(result.replacement.travelMode).toBeNull();
    expect(result.replacement.intensity).toBeNull();
    expect(result.replacement.durationMinutes).toBe(90);
  });

  // =========================================================================
  // Group 2: Fix Day Preview, HMAC Token Integrity & Apply (7–12)
  // =========================================================================

  test("7. Preview includes metadata in diff slots", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Candolim Sunset Café",
              description: "Relaxed seaside tea and snacks.",
              category: "Dining & Nightlife",
              activityType: "food",
              indoorOutdoor: "Mixed",
              durationMinutes: 45,
              travelMode: "walking",
              intensity: "low",
              cost: "₹300",
              reason: "Compacted evening to catch up.",
            },
          }),
        }),
      },
    }));

    const preview = await previewFixDay({
      tripId: booking._id.toString(),
      dayNumber: 1,
      reason: "running_late",
      currentPeriod: "morning",
      delayMinutes: 60,
    });

    expect(preview.proposalToken).toBeDefined();
    const replacedSlot = preview.slots.find((s) => s.action === "REPLACED");
    expect(replacedSlot).toBeDefined();
    expect(replacedSlot.replacementActivity.activityType).toBe("food");
    expect(replacedSlot.replacementActivity.durationMinutes).toBe(45);
    expect(replacedSlot.replacementActivity.travelMode).toBe("walking");
    expect(replacedSlot.replacementActivity.intensity).toBe("low");

    // Verify original activity exposes metadata
    expect(replacedSlot.originalActivity.activityType).toBeDefined();
    expect(replacedSlot.originalActivity.durationMinutes).toBeDefined();
  });

  test("8. HMAC proposal payload retains metadata and validates cryptographically", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Quick Beach Snack",
              description: "Fast Goan street food stop.",
              category: "Dining & Nightlife",
              activityType: "food",
              indoorOutdoor: "Mixed",
              durationMinutes: 30,
              travelMode: "walking",
              intensity: "low",
              cost: "₹150",
              reason: "Light snack stop.",
            },
          }),
        }),
      },
    }));

    const preview = await previewFixDay({
      tripId: booking._id.toString(),
      dayNumber: 1,
      reason: "running_late",
      currentPeriod: "morning",
      delayMinutes: 60,
    });

    const payload = verifyProposalToken(preview.proposalToken);
    expect(payload.replacementSlots[0].replacement.activityType).toBe("food");
    expect(payload.replacementSlots[0].replacement.durationMinutes).toBe(30);
    expect(payload.replacementSlots[0].replacement.travelMode).toBe("walking");
    expect(payload.replacementSlots[0].replacement.intensity).toBe("low");
  });

  test("9. Apply persists metadata to Booking.aiPlan in database", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Fontainhas Heritage Walk",
              description: "Scenic walk in Latin quarter.",
              category: "Culture",
              activityType: "culture",
              indoorOutdoor: "Outdoor",
              durationMinutes: 60,
              travelMode: "public_transport",
              intensity: "moderate",
              cost: "Free",
              reason: "Shorter cultural alternative.",
            },
          }),
        }),
      },
    }));

    const preview = await previewFixDay({
      tripId: booking._id.toString(),
      dayNumber: 1,
      reason: "running_late",
      currentPeriod: "morning",
      delayMinutes: 60,
    });

    const applyResult = await applyFixDay({
      tripId: booking._id.toString(),
      dayNumber: 1,
      proposalToken: preview.proposalToken,
    });

    expect(applyResult.version).toBe(booking.__v + 1);

    const reloaded = await Booking.findById(booking._id);
    const plan = JSON.parse(reloaded.aiPlan);
    const adaptedAct = plan.days[0].activities.find((a) => a.id === "d1-afternoon-01");
    expect(adaptedAct.activityType).toBe("culture");
    expect(adaptedAct.durationMinutes).toBe(60);
    expect(adaptedAct.travelMode).toBe("public_transport");
    expect(adaptedAct.intensity).toBe("moderate");
  });

  test("10. Invalid or tampered proposal tokens with modified metadata are rejected", async () => {
    const booking = await createTestBooking();

    const payload = {
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 1,
      baseVersion: booking.__v,
      reason: "schedule_overload",
      replacementSlots: [
        {
          targetActivityId: "d1-morning-01",
          replacement: {
            id: "d1-morning-01",
            period: "morning",
            title: "Tampered Title",
            description: "Tampered Description",
            category: "Sightseeing",
            activityType: "food",
            indoorOutdoor: "Indoor",
            durationMinutes: 60,
            cost: "₹100",
            reason: "Tampered reason",
          },
        },
      ],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const validToken = signProposalToken(payload);
    const [payloadB64] = validToken.split(".");

    // Tamper with payload bytes
    const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    decoded.replacementSlots[0].replacement.activityType = "nightlife";
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${tamperedPayloadB64}.invalidsignature`;

    await expect(
      applyFixDay({
        tripId: booking._id.toString(),
        dayNumber: 1,
        proposalToken: tamperedToken,
      })
    ).rejects.toThrow(FixDayError);
  });

  test("11. Expired proposal tokens remain rejected", async () => {
    const booking = await createTestBooking();

    const payload = {
      purpose: "fix-day",
      proposalId: crypto.randomUUID(),
      tripId: booking._id.toString(),
      dayNumber: 1,
      baseVersion: booking.__v,
      reason: "schedule_overload",
      replacementSlots: [
        {
          targetActivityId: "d1-morning-01",
          replacement: {
            id: "d1-morning-01",
            period: "morning",
            title: "Expired Title",
            description: "Expired Description",
            category: "Sightseeing",
            activityType: "sightseeing",
            indoorOutdoor: "Indoor",
            durationMinutes: 60,
            cost: "₹100",
            reason: "Reason",
          },
        },
      ],
      issuedAt: Date.now() - 1000000,
      expiresAt: Date.now() - 100000, // Expired
    };

    const expiredToken = signProposalToken(payload);

    await expect(
      applyFixDay({
        tripId: booking._id.toString(),
        dayNumber: 1,
        proposalToken: expiredToken,
      })
    ).rejects.toThrow(FixDayError);
  });

  test("12. Preview does not persist changes before Apply", async () => {
    const booking = await createTestBooking();
    const initialAiPlan = booking.aiPlan;

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Beach Walk",
              description: "Short walk.",
              category: "Sightseeing",
              activityType: "sightseeing",
              indoorOutdoor: "Outdoor",
              durationMinutes: 30,
              cost: "Free",
              reason: "Shorter walk.",
            },
          }),
        }),
      },
    }));

    await previewFixDay({
      tripId: booking._id.toString(),
      dayNumber: 1,
      reason: "running_late",
      currentPeriod: "morning",
      delayMinutes: 60,
    });

    const unchanged = await Booking.findById(booking._id);
    expect(unchanged.__v).toBe(booking.__v);
    expect(unchanged.aiPlan).toBe(initialAiPlan);
  });

  // =========================================================================
  // Group 3: Locking Immutability, Persistence & Concurrency (13–18)
  // =========================================================================

  test("13. Locked activity metadata cannot be modified via itinerary persistence", async () => {
    const { token, user } = await signup(userA);

    // Create a plan with a locked activity that has metadata
    const planWithLocked = {
      destination: "Goa, India",
      days: [
        {
          day: 1,
          activities: [
            {
              id: "d1-morning-01",
              period: "morning",
              title: "Locked Heritage Fort",
              description: "Historic Portuguese fort",
              category: "Sightseeing",
              activityType: "sightseeing",
              durationMinutes: 120,
              travelMode: "driving",
              intensity: "moderate",
              cost: "₹100",
              indoorOutdoor: "Outdoor",
              locked: true,
            },
          ],
        },
      ],
    };

    const booking = await createTestBooking(planWithLocked, user);

    // Attempt to modify activityType of locked activity
    const tamperedPlan = JSON.parse(JSON.stringify(planWithLocked));
    tamperedPlan.days[0].activities[0].activityType = "food";

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: tamperedPlan,
        baseVersion: booking.__v,
      });

    expect(res.status).toBe(423);
    expect(res.body.message).toContain("Cannot modify locked activity");

    // Attempt to modify durationMinutes of locked activity
    tamperedPlan.days[0].activities[0].activityType = "sightseeing";
    tamperedPlan.days[0].activities[0].durationMinutes = 60;

    const res2 = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: tamperedPlan,
        baseVersion: booking.__v,
      });

    expect(res2.status).toBe(423);
    expect(res2.body.message).toContain("Cannot modify locked activity");

    // Attempt to modify travelMode of locked activity
    tamperedPlan.days[0].activities[0].durationMinutes = 120;
    tamperedPlan.days[0].activities[0].travelMode = "flight";

    const res3 = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: tamperedPlan,
        baseVersion: booking.__v,
      });

    expect(res3.status).toBe(423);
    expect(res3.body.message).toContain("Cannot modify locked activity");

    // Attempt to modify intensity of locked activity
    tamperedPlan.days[0].activities[0].travelMode = "driving";
    tamperedPlan.days[0].activities[0].intensity = "high";

    const res4 = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: tamperedPlan,
        baseVersion: booking.__v,
      });

    expect(res4.status).toBe(423);
    expect(res4.body.message).toContain("Cannot modify locked activity");
  });

  test("14. Historical locked activities without metadata remain valid", async () => {
    const { token, user } = await signup(userA);

    // Historical locked activity with NO metadata
    const historicalLockedPlan = {
      destination: "Goa, India",
      days: [
        {
          day: 1,
          activities: [
            {
              id: "d1-morning-01",
              period: "morning",
              title: "Old Locked Fort",
              description: "Historic fort",
              category: "Sightseeing",
              cost: "₹100",
              indoorOutdoor: "Outdoor",
              locked: true,
            },
          ],
        },
      ],
    };

    const booking = await createTestBooking(historicalLockedPlan, user);

    // Save with identical contents (null metadata handled smoothly)
    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: historicalLockedPlan,
        baseVersion: booking.__v,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("15. Unlocked activities can be updated within validation rules", async () => {
    const { token, user } = await signup(userA);
    const booking = await createTestBooking(samplePlan, user);

    const updatedPlan = JSON.parse(JSON.stringify(samplePlan));
    updatedPlan.days[0].activities[1].activityType = "relaxation";
    updatedPlan.days[0].activities[1].durationMinutes = 60;
    updatedPlan.days[0].activities[1].intensity = "low";

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: updatedPlan,
        baseVersion: booking.__v,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.__v).toBe(booking.__v + 1);
  });

  test("16. Optimistic concurrency remains intact (stale baseVersion fails with 409)", async () => {
    const { token, user } = await signup(userA);
    const booking = await createTestBooking(samplePlan, user);

    const res = await request(app)
      .patch(`/api/bookings/${booking._id}/itinerary`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itinerary: samplePlan,
        baseVersion: booking.__v + 99,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Conflict");
  });

  test("17. Activity IDs remain stable where required across Pivot and Fix Day", async () => {
    const booking = await createTestBooking();

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            replacement: {
              title: "Replaced Afternoon Activity",
              description: "Replaced description.",
              category: "Sightseeing",
              activityType: "sightseeing",
              indoorOutdoor: "Indoor",
              durationMinutes: 90,
              cost: "₹100",
              reason: "Adaptive replacement.",
              insiderTip: "None",
            },
          }),
        }),
      },
    }));

    const result = await executePivot({
      tripId: booking._id.toString(),
      dayNumber: 1,
      block: "afternoon",
      activityId: "d1-afternoon-01",
      pivotReason: "rain",
      autoPersist: true,
    });

    expect(result.activityId).toBe("d1-afternoon-01");
    const reloaded = await Booking.findById(booking._id);
    const plan = JSON.parse(reloaded.aiPlan);
    const act = plan.days[0].activities.find((a) => a.period === "afternoon");
    expect(act.id).toBe("d1-afternoon-01");
  });

  test("18. Existing Reality Score calculations remain green with metadata", async () => {
    const booking = await createTestBooking();
    const report = evaluateTripReality(booking);

    expect(report.score).toBeGreaterThan(0);
    expect(report.subScores).toBeDefined();
    expect(report.subScores.timeFeasibility).toBeDefined();
    expect(report.subScores.budgetFeasibility).toBeDefined();
    expect(report.subScores.activityLoad).toBeDefined();
    expect(report.subScores.travelPace).toBeDefined();
  });
});
