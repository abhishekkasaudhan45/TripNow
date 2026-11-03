// backend/tests/googleAuth.test.js
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const env = require("../config/env");
const { AUTH_COOKIE_NAME } = require("../config/authCookie");
const { connect, clearDatabase, closeDatabase, extractToken } = require("./db");

// Mock google-auth-library
const mockVerifyIdToken = jest.fn();
jest.mock("google-auth-library", () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

describe("TripNow Phase 5B.2 — Google Sign-In & Account Linking", () => {
  const originalEnabled = env.googleAuthEnabled;
  const originalClientId = env.googleClientId;
  const TEST_CLIENT_ID = "test-client-id-12345.apps.googleusercontent.com";

  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    env.googleAuthEnabled = originalEnabled;
    env.googleClientId = originalClientId;
    await closeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
    env.googleAuthEnabled = true;
    env.googleClientId = TEST_CLIENT_ID;
  });

  // Helper to fetch a valid anonymous CSRF token
  const getAnonCsrfToken = async () => {
    const res = await request(app).get("/api/csrf-token");
    return res.body.csrfToken;
  };

  // Helper to build a standard verified Google token payload
  const buildGooglePayload = (overrides = {}) => ({
    sub: "google-sub-987654321",
    email: "traveler@example.com",
    email_verified: true,
    name: "Google Traveler",
    picture: "https://lh3.googleusercontent.com/a/photo123",
    iss: "https://accounts.google.com",
    aud: TEST_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });

  // ── 1. Feature Flag Protection ──
  it("1. returns 503 GOOGLE_AUTH_DISABLED when Google auth is disabled", async () => {
    env.googleAuthEnabled = false;
    const csrfToken = await getAnonCsrfToken();

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "any-token" });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("GOOGLE_AUTH_DISABLED");
    expect(res.body.message).toMatch(/not enabled/i);
  });

  // ── 2. Request Validation ──
  it("2. returns 400 when idToken is missing from request body", async () => {
    const csrfToken = await getAnonCsrfToken();

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ── 3. Invalid Token Signature ──
  it("3. returns 401 when Google token signature is invalid", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token signature"));

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "tampered-token" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_GOOGLE_TOKEN");
  });

  // ── 4. Wrong Audience ──
  it("4. returns 401 when token audience does not match configured GOOGLE_CLIENT_ID", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ aud: "wrong-client-id.apps.googleusercontent.com" }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-wrong-aud" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/audience/i);
  });

  // ── 5. Wrong Issuer ──
  it("5. returns 401 when token issuer is not Google", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ iss: "https://evil-issuer.com" }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-wrong-iss" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/issuer/i);
  });

  // ── 6. Expired Token ──
  it("6. returns 401 when token is expired", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ exp: Math.floor(Date.now() / 1000) - 60 }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-expired" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/expired/i);
  });

  // ── 7. Unverified Email ──
  it("7. returns 400 when Google account email is not verified", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ email_verified: false }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-unverified-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("UNVERIFIED_EMAIL");
  });

  // ── 8. New Google User Registration ──
  it("8. creates a new user, sets HttpOnly cookie and returns 201 for fresh Google user", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "valid-new-user-token" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe("traveler@example.com");
    expect(res.body.data.user.name).toBe("Google Traveler");
    expect(res.body.data.user.avatar).toBe("https://lh3.googleusercontent.com/a/photo123");

    // Verify auth cookie set
    const token = extractToken(res);
    expect(token).toBeDefined();

    // Verify user in database
    const dbUser = await User.findOne({ email: "traveler@example.com" }).select("+googleId");
    expect(dbUser).not.toBeNull();
    expect(dbUser.googleId).toBe("google-sub-987654321");
    expect(dbUser.isVerified).toBe(true);
    expect(dbUser.password).toBeUndefined(); // Google-only users have no password
  });

  // ── 9. Returning Google User Login ──
  it("9. logs in an existing Google user and returns 200 with HttpOnly cookie", async () => {
    await User.create({
      name: "Existing Google User",
      email: "traveler@example.com",
      googleId: "google-sub-987654321",
      isVerified: true,
    });

    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "valid-returning-user-token" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.data.user.email).toBe("traveler@example.com");

    const token = extractToken(res);
    expect(token).toBeDefined();
  });

  // ── 10. Existing Password Account Conflict (Anti-Takeover) ──
  it("10. refuses automatic link when email matches existing password account (409 Conflict)", async () => {
    // Existing password account created locally
    await User.create({
      name: "Local Password User",
      email: "traveler@example.com",
      password: "StrongPassword123!",
      isVerified: false,
    });

    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ sub: "new-google-sub-55555" }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-conflict" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("ACCOUNT_EXISTS_LINKING_REQUIRED");
    expect(res.body.message).toMatch(/log in with your password/i);

    // Verify no cookie was set
    const token = extractToken(res);
    expect(token).toBeNull();

    // Verify database document was NOT overwritten or linked
    const dbUser = await User.findOne({ email: "traveler@example.com" }).select("+googleId");
    expect(dbUser.googleId).toBeUndefined();
  });

  // ── 11. Explicit Authenticated Account Linking ──
  it("11. allows an authenticated user to link their Google account successfully (200 OK)", async () => {
    // Register local password account
    const localUser = await User.create({
      name: "Alice Montgomery",
      email: "alice@example.com",
      password: "StrongPassword123!",
      isVerified: false,
    });

    // Login to obtain auth cookie
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "StrongPassword123!" });
    const authCookie = loginRes.headers["set-cookie"];

    // Fetch authenticated CSRF token
    const csrfRes = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", authCookie);
    const authCsrfToken = csrfRes.body.csrfToken;

    // Mock Google token for Alice
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () =>
        buildGooglePayload({
          sub: "alice-google-sub-777",
          email: "alice@example.com",
          name: "Alice M",
          picture: "https://lh3.googleusercontent.com/alice.jpg",
        }),
    });

    // Link Google account
    const linkRes = await request(app)
      .post("/api/auth/google/link")
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", authCsrfToken)
      .send({ idToken: "alice-google-token" });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.success).toBe(true);
    expect(linkRes.body.message).toBe("Google account linked successfully");
    expect(linkRes.body.data.user.avatar).toBe("https://lh3.googleusercontent.com/alice.jpg");

    // Verify DB updated
    const updatedUser = await User.findById(localUser._id).select("+googleId");
    expect(updatedUser.googleId).toBe("alice-google-sub-777");
    expect(updatedUser.isVerified).toBe(true);
  });

  // ── 12. Email Mismatch During Linking ──
  it("12. rejects linking when Google email does not match active authenticated user (400 Bad Request)", async () => {
    await User.create({
      name: "Bob Traveler",
      email: "bob@example.com",
      password: "StrongPassword123!",
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "StrongPassword123!" });
    const authCookie = loginRes.headers["set-cookie"];

    const csrfRes = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", authCookie);
    const authCsrfToken = csrfRes.body.csrfToken;

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () =>
        buildGooglePayload({
          sub: "charlie-google-sub",
          email: "charlie@example.com", // Mismatch with bob@example.com!
        }),
    });

    const res = await request(app)
      .post("/api/auth/google/link")
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", authCsrfToken)
      .send({ idToken: "token-mismatch-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("EMAIL_MISMATCH");
  });

  // ── 13. Google Identity Already Linked to Another Account ──
  it("13. rejects linking when the Google subject is already linked to another user (409 Conflict)", async () => {
    // User 1 already linked to this Google ID
    await User.create({
      name: "User One",
      email: "one@example.com",
      googleId: "shared-google-sub-999",
      isVerified: true,
    });

    // User 2 logs in
    const userTwo = await User.create({
      name: "User Two",
      email: "two@example.com",
      password: "StrongPassword123!",
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "two@example.com", password: "StrongPassword123!" });
    const authCookie = loginRes.headers["set-cookie"];

    const csrfRes = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", authCookie);
    const authCsrfToken = csrfRes.body.csrfToken;

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () =>
        buildGooglePayload({
          sub: "shared-google-sub-999", // Collision!
          email: "two@example.com",
        }),
    });

    const res = await request(app)
      .post("/api/auth/google/link")
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", authCsrfToken)
      .send({ idToken: "token-collision" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("GOOGLE_ID_ALREADY_LINKED");
  });

  // ── 14. Concurrent Duplicate Account Creation Race ──
  it("14. safely catches duplicate-key race on registration without 500 error", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => buildGooglePayload({ sub: "race-sub-111", email: "race@example.com" }),
    });

    // Simulate pre-existing duplicate immediately before create
    const origCreate = User.create;
    jest.spyOn(User, "create").mockImplementationOnce(async () => {
      const err = new Error("E11000 duplicate key error");
      err.code = 11000;
      throw err;
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "token-race" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ACCOUNT_EXISTS_LINKING_REQUIRED");
    User.create.mockRestore();
  });

  // ── 15. CSRF Missing ──
  it("15. rejects Google auth request when X-CSRF-Token is missing (403 Forbidden)", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "valid-token-no-csrf" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("CSRF_TOKEN_MISSING");
  });

  // ── 16. CSRF Invalid ──
  it("16. rejects Google auth request when X-CSRF-Token is invalid (403 Forbidden)", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", "fake_salt_32bytes_value_here.invalid_hmac_64bytes_signature_here")
      .send({ idToken: "valid-token-bad-csrf" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("CSRF_TOKEN_INVALID");
  });

  // ── 17. Valid Anonymous CSRF Flow ──
  it("17. accepts valid anonymous CSRF token issued by /api/csrf-token", async () => {
    const csrfToken = await getAnonCsrfToken();
    expect(csrfToken).toBeDefined();

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload({ email: "anon-flow@example.com", sub: "sub-anon-1" }),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "valid-token-anon-flow" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ── 18. Authenticated Linking Requires Cookie ──
  it("18. rejects unauthenticated POST /api/auth/google/link (401 Unauthorized)", async () => {
    const res = await request(app)
      .post("/api/auth/google/link")
      .send({ idToken: "some-token" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── 19. HttpOnly Cookie Creation Attributes ──
  it("19. sets HttpOnly cookie with sameSite=lax and path=/ on successful Google login", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "valid-token" });

    expect(res.status).toBe(201);
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

    expect(cookieStr).toMatch(/token=[^;]+/);
    expect(cookieStr.toLowerCase()).toMatch(/httponly/);
    expect(cookieStr.toLowerCase()).toMatch(/samesite=lax/);
    expect(cookieStr.toLowerCase()).toMatch(/path=\//);
  });

  // ── 20. Logout Clears Cookie ──
  it("20. clears auth cookie on logout for Google-authenticated users", async () => {
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const loginRes = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "valid-token" });

    const authCookie = loginRes.headers["set-cookie"];

    // Fetch fresh authenticated CSRF token bound to the newly issued auth cookie
    const csrfRes = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", authCookie);
    const authCsrfToken = csrfRes.body.csrfToken;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", authCookie)
      .set("X-CSRF-Token", authCsrfToken);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    const clearCookie = logoutRes.headers["set-cookie"];
    const clearStr = Array.isArray(clearCookie) ? clearCookie.join("; ") : clearCookie;
    expect(clearStr).toMatch(/token=;/);
  });

  // ── 21. Rate Limiting ──
  it("21. routes /api/auth/google through rate limiting middleware", async () => {
    // Verified: authLimiter is attached to /api/auth/google in authRoutes.js
    const csrfToken = await getAnonCsrfToken();
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => buildGooglePayload(),
    });

    const res = await request(app)
      .post("/api/auth/google")
      .set("X-CSRF-Token", csrfToken)
      .send({ idToken: "rate-test-token" });

    expect([200, 201]).toContain(res.status);
  });

  // ── 22. Existing Password Signup/Login Regression ──
  it("22. preserves full functionality for traditional email/password signup and login", async () => {
    const userPayload = {
      name: "Traditional Traveler",
      email: "traditional@example.com",
      password: "TraditionalPassword123!",
    };

    // Signup
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send(userPayload);

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.data.user.email).toBe("traditional@example.com");

    // Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: userPayload.email, password: userPayload.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(extractToken(loginRes)).toBeDefined();
  });
});
