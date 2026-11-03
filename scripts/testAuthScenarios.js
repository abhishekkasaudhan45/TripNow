// scripts/testAuthScenarios.js
const path = require("path");
const request = require(path.join(__dirname, "../backend/node_modules/supertest"));
const mongoose = require(path.join(__dirname, "../backend/node_modules/mongoose"));
const { MongoMemoryServer } = require(path.join(__dirname, "../backend/node_modules/mongodb-memory-server"));
const app = require("../backend/app");
const User = require("../backend/models/User");

async function runScenarios() {
  console.log("=== STARTING AUTH SCENARIOS TEST ===");
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  console.log("✅ In-memory MongoDB connected");

  try {
    // SCENARIO A: Fresh browser, first signup attempt (with valid credentials)
    console.log("\n--- SCENARIO A: Fresh browser, first signup attempt ---");
    const validPayloadA = {
      name: "Fresh User",
      email: "fresh@example.com",
      password: "StrongPass123",
    };
    const resA = await request(app)
      .post("/api/auth/signup")
      .send(validPayloadA);
    console.log("Status:", resA.status);
    console.log("Body:", JSON.stringify(resA.body));
    console.log("Set-Cookie headers:", resA.headers["set-cookie"]);
    const hasTokenCookieA = (resA.headers["set-cookie"] || []).some(c => c.startsWith("token="));
    console.log("Has auth cookie set:", hasTokenCookieA);

    // SCENARIO B: Fresh browser, login attempt
    console.log("\n--- SCENARIO B: Fresh browser, login attempt ---");
    const resB = await request(app)
      .post("/api/auth/login")
      .send({ email: "fresh@example.com", password: "StrongPass123" });
    console.log("Status:", resB.status);
    console.log("Body:", JSON.stringify(resB.body));
    console.log("Has auth cookie set:", (resB.headers["set-cookie"] || []).some(c => c.startsWith("token=")));

    // SCENARIO C: Signup after CSRF token has already been acquired
    console.log("\n--- SCENARIO C: Signup after CSRF token acquired ---");
    const csrfRes = await request(app).get("/api/csrf-token");
    const csrfToken = csrfRes.body.csrfToken;
    console.log("Acquired CSRF token:", csrfToken ? "YES (salt.hmac)" : "NO");
    const resC = await request(app)
      .post("/api/auth/signup")
      .set("X-CSRF-Token", csrfToken)
      .send({
        name: "Second User",
        email: "second@example.com",
        password: "StrongPass123",
      });
    console.log("Status:", resC.status);
    console.log("Body:", JSON.stringify(resC.body));
    console.log("Has auth cookie set:", (resC.headers["set-cookie"] || []).some(c => c.startsWith("token=")));

    // SCENARIO D: Signup with an existing email
    console.log("\n--- SCENARIO D: Signup with existing email ---");
    const resD = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Duplicate User",
        email: "fresh@example.com",
        password: "StrongPass123",
      });
    console.log("Status:", resD.status);
    console.log("Body:", JSON.stringify(resD.body));

    // SCENARIO E: Signup with invalid input (various invalid inputs)
    console.log("\n--- SCENARIO E: Signup with invalid input ---");
    const invalidInputs = [
      { label: "Short password (6 chars, valid in frontend, invalid in backend)", payload: { name: "User", email: "user@example.com", password: "Secret" } },
      { label: "Password without uppercase", payload: { name: "User", email: "user@example.com", password: "secret123" } },
      { label: "Password without number", payload: { name: "User", email: "user@example.com", password: "SecretPass" } },
      { label: "Short name (< 2 chars)", payload: { name: "U", email: "user@example.com", password: "StrongPass123" } },
      { label: "Invalid email", payload: { name: "User", email: "invalid-email", password: "StrongPass123" } },
      { label: "Missing fields", payload: { email: "user@example.com" } },
    ];
    for (const test of invalidInputs) {
      const res = await request(app).post("/api/auth/signup").send(test.payload);
      console.log(`[${test.label}] Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
    }

    // SCENARIO F: Backend unavailable simulation
    console.log("\n--- SCENARIO F: Backend unavailable simulation ---");
    console.log("Client receiving Network Error or 503:");
    console.log("Frontend Signup.jsx catch block: e?.response?.data?.message || 'Registration failed. Try again.'");

    // SCENARIO G: Browser refresh after successful signup
    console.log("\n--- SCENARIO G: Browser refresh after signup (/api/auth/me) ---");
    const cookieA = (resA.headers["set-cookie"] || []).find(c => c.startsWith("token="));
    const tokenVal = cookieA.split(";")[0];
    const resG = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [tokenVal]);
    console.log("Status /api/auth/me with cookie:", resG.status);
    console.log("Body:", JSON.stringify(resG.body));

    // SCENARIO H: Navigation to dashboard after signup (/api/bookings with cookie)
    console.log("\n--- SCENARIO H: Dashboard access (/api/bookings) ---");
    const resH = await request(app)
      .get("/api/bookings")
      .set("Cookie", [tokenVal]);
    console.log("Status /api/bookings with cookie:", resH.status);
    console.log("Body:", JSON.stringify(resH.body));

  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
    console.log("\n✅ Teardown complete");
  }
}

runScenarios().catch(err => {
  console.error("Error running scenarios:", err);
  process.exit(1);
});
