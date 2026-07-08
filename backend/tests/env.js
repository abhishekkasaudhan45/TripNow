// Runs before any test file is loaded (jest `setupFiles`).
// Sets the env vars that config/env.js requires, so importing the app
// during tests doesn't throw. The real DB connection is provided by
// mongodb-memory-server in tests/db.js — MONGO_URI here is just a placeholder
// to satisfy the presence check.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_EXPIRES_IN = "2h";
process.env.ADMIN_EMAIL = "admin@test.com";
process.env.ADMIN_PASSWORD = "AdminPass123";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/placeholder";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.GROQ_API_KEY = "test-key";
