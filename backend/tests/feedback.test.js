const request = require("supertest");
const app = require("../app");
const Feedback = require("../models/Feedback");
const emailUtils = require("../utils/email");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const signup = async (over = {}) => {
  const user = { name: "Traveler Jane", email: "jane@example.com", password: "Passw0rd1!", ...over };
  const res = await request(app).post("/api/auth/signup").send(user);
  return { token: extractToken(res), user };
};

describe("Feedback API — POST /api/feedback", () => {
  it("submits valid feedback successfully and stores it in MongoDB", async () => {
    const payload = {
      name: "Alice Explorer",
      email: "alice@example.com",
      category: "Experience",
      rating: 5,
      message: "The AI itinerary generator saved me hours of planning for Goa!",
    };

    const res = await request(app)
      .post("/api/feedback")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Thank you for your feedback!");
    expect(res.body.data.id).toBeDefined();

    // Verify stored in MongoDB
    const stored = await Feedback.findById(res.body.data.id);
    expect(stored).not.toBeNull();
    expect(stored.name).toBe("Alice Explorer");
    expect(stored.email).toBe("alice@example.com");
    expect(stored.category).toBe("Experience");
    expect(stored.rating).toBe(5);
    expect(stored.message).toBe("The AI itinerary generator saved me hours of planning for Goa!");
  });

  it("attaches authenticated user ID if logged in", async () => {
    const { token, user } = await signup();

    const res = await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rating: 4,
        category: "Feature Request",
        message: "Would love to see currency conversion for Euro and USD in the budget breakdown.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const stored = await Feedback.findById(res.body.data.id);
    expect(stored.user).toBeDefined();
    expect(stored.name).toBe(user.name);
    expect(stored.email).toBe(user.email);
    expect(stored.category).toBe("Feature Request");
  });

  it("rejects submission if rating is missing or invalid", async () => {
    const resNoRating = await request(app)
      .post("/api/feedback")
      .send({ message: "Great experience overall!" });

    expect(resNoRating.status).toBe(400);
    expect(resNoRating.body.success).toBe(false);

    const resBadRating = await request(app)
      .post("/api/feedback")
      .send({ rating: 6, message: "Too high rating" });

    expect(resBadRating.status).toBe(400);
    expect(resBadRating.body.success).toBe(false);
  });

  it("rejects submission if message is missing or too short", async () => {
    const resEmpty = await request(app)
      .post("/api/feedback")
      .send({ rating: 5, message: "   " });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.success).toBe(false);

    const resShort = await request(app)
      .post("/api/feedback")
      .send({ rating: 5, message: "hi" });

    expect(resShort.status).toBe(400);
    expect(resShort.body.success).toBe(false);
  });

  it("gracefully catches email errors (e.g. Invalid grant, network timeout) without failing client response", async () => {
    // Mock sendFeedbackEmail to simulate an email provider failure (e.g., Gmail API Invalid grant)
    jest.spyOn(emailUtils, "sendFeedbackEmail").mockImplementation(async () => {
      throw new Error("Gmail_API: Invalid grant (token expired or revoked)");
    });

    const payload = {
      name: "Resilient Tester",
      email: "resilient@example.com",
      category: "Bug",
      rating: 3,
      message: "Minor bug on mobile view but app works nicely.",
    };

    const res = await request(app)
      .post("/api/feedback")
      .send(payload);

    // Database record MUST still be saved!
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Thank you for your feedback!");

    const stored = await Feedback.findById(res.body.data.id);
    expect(stored).not.toBeNull();
    expect(stored.name).toBe("Resilient Tester");
    expect(stored.emailNotificationSent).toBe(false);
  });
});

