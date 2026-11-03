const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Booking = require("../models/Booking");
const env = require("../config/env");
const storageService = require("../services/storageService");
const cloudinary = require("cloudinary").v2;
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

// Helper sample buffers
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06,
]);

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
  0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
]);

const WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
  0x38, 0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00,
]);

const SVG_BUFFER = Buffer.from(
  "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert('xss')</script></svg>"
);

const EXE_BUFFER = Buffer.from(
  "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00\xb8\x00\x00\x00"
);

describe("TripNow Phase 3A — Image Upload Architecture Tests", () => {
  let userA, userB, adminUser;
  let tokenA, tokenB, adminToken;
  let csrfA, csrfB, adminCsrf;
  let tripA;

  beforeEach(async () => {
    // 1. Create User A (Owner)
    const resA = await request(app).post("/api/auth/signup").send({
      name: "Alice Owner",
      email: "alice.owner@example.com",
      password: "StrongPassword123!",
    });
    tokenA = extractToken(resA);
    userA = resA.body.data.user;

    const csrfResA = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", [`token=${tokenA}`]);
    csrfA = csrfResA.body.csrfToken;

    // 2. Create User B (Attacker / Different User)
    const resB = await request(app).post("/api/auth/signup").send({
      name: "Bob Intruder",
      email: "bob.intruder@example.com",
      password: "StrongPassword123!",
    });
    tokenB = extractToken(resB);
    userB = resB.body.data.user;

    const csrfResB = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", [`token=${tokenB}`]);
    csrfB = csrfResB.body.csrfToken;

    // 3. Create Admin User
    const resAdmin = await request(app).post("/api/auth/signup").send({
      name: "Admin User",
      email: "admin.manager@example.com",
      password: "AdminPassword123!",
    });
    adminToken = extractToken(resAdmin);
    adminUser = resAdmin.body.data.user;
    await User.findByIdAndUpdate(adminUser._id || adminUser.id, { role: "admin" });

    const adminCsrfRes = await request(app)
      .get("/api/csrf-token")
      .set("Cookie", [`token=${adminToken}`]);
    adminCsrf = adminCsrfRes.body.csrfToken;

    // 4. Create Trip owned by User A
    tripA = await Booking.create({
      destination: "Goa, India",
      checkin: new Date("2026-11-01"),
      checkout: new Date("2026-11-05"),
      guests: 2,
      budget: "25000",
      user: userA._id || userA.id,
      coverImage: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2",
    });
  });

  // ── 1. Valid Image Upload ──────────────────────────────────────────────────
  describe("1. Valid Image Upload", () => {
    it("successfully uploads a valid JPEG cover image and updates trip in DB", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "cover.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coverImage).toMatch(/^https:\/\/res\.cloudinary\.com\//);

      // Verify in MongoDB
      const updated = await Booking.findById(tripA._id);
      expect(updated.coverImage).toBe(res.body.data.coverImage);
    });

    it("successfully uploads a valid PNG image using the 'image' field name", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("image", PNG_BUFFER, {
          filename: "scenery.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coverImage).toContain(".png");
    });

    it("successfully uploads a valid WebP image", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", WEBP_BUFFER, {
          filename: "beach.webp",
          contentType: "image/webp",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coverImage).toContain(".webp");
    });
  });

  // ── 2. Invalid File Extension ─────────────────────────────────────────────
  describe("2. Invalid File Extension", () => {
    it("rejects an upload with an invalid extension (.exe)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "malicious.exe",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Unsupported file extension");
    });

    it("rejects an upload with mismatched extension vs content (.png extension for JPEG content)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "mismatch.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("does not match actual image content");
    });
  });

  // ── 3. Incorrect MIME Type ────────────────────────────────────────────────
  describe("3. Incorrect MIME Type", () => {
    it("rejects an upload with non-image MIME type (text/plain)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", Buffer.from("Hello world text"), {
          filename: "hello.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid file type");
    });
  });

  // ── 4. Invalid Image Content / Magic Bytes ─────────────────────────────────
  describe("4. Invalid Image Content", () => {
    it("rejects an executable disguised as an image (.jpg with MZ header)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", EXE_BUFFER, {
          filename: "virus.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("forbidden content signatures");
    });

    it("rejects an SVG file disguised as a JPEG (prevents SVG XSS)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", SVG_BUFFER, {
          filename: "graphic.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("forbidden content signatures");
    });

    it("rejects random corrupted binary content that has no valid image header", async () => {
      const corruptBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", corruptBuffer, {
          filename: "corrupt.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Invalid image content");
    });
  });

  // ── 5. Oversized Upload ───────────────────────────────────────────────────
  describe("5. Oversized Upload", () => {
    it("rejects uploads exceeding the 5MB file size limit with HTTP 413", async () => {
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB
      // Set JPEG header so it would pass magic byte check if not oversized
      oversizedBuffer[0] = 0xff;
      oversizedBuffer[1] = 0xd8;
      oversizedBuffer[2] = 0xff;

      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", oversizedBuffer, {
          filename: "large.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(413);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("5MB");
    });
  });

  // ── 6. Missing Storage Configuration in Production ─────────────────────────
  describe("6. Missing Storage Configuration", () => {
    it("returns HTTP 503 when running in production without cloud credentials", async () => {
      jest.spyOn(storageService, "uploadImage").mockImplementationOnce(async () => {
        throw new storageService.StorageServiceError(
          "Media storage service is unavailable: storage provider is not configured.",
          503
        );
      });

      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "cover.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("storage provider is not configured");
    });
  });

  // ── 7. Storage Provider Failure ───────────────────────────────────────────
  describe("7. Storage Provider Failure", () => {
    it("handles cloud provider upload errors with HTTP 502 without leaking credentials", async () => {
      jest.spyOn(storageService, "uploadImage").mockImplementationOnce(async () => {
        throw new storageService.StorageServiceError(
          "Failed to upload image to storage provider.",
          502
        );
      });

      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "cover.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Failed to upload image to storage provider.");
    });
  });

  // ── 8. Unauthorized Upload ────────────────────────────────────────────────
  describe("8. Unauthorized Upload", () => {
    it("rejects requests missing an authentication cookie with HTTP 401", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "cover.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 9. Ownership Violations ───────────────────────────────────────────────
  describe("9. Ownership Violations", () => {
    it("prevents User B from modifying User A's trip cover image (HTTP 403)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenB}`])
        .set("x-csrf-token", csrfB)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "hacked.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Not authorized");

      // Verify trip was NOT modified
      const trip = await Booking.findById(tripA._id);
      expect(trip.coverImage).toBe("https://images.unsplash.com/photo-1512343879784-a960bf40e7f2");
    });

    it("prevents User B from deleting User A's trip cover image (HTTP 403)", async () => {
      const res = await request(app)
        .delete(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenB}`])
        .set("x-csrf-token", csrfB);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Not authorized");
    });
  });

  // ── 10. Admin Authorization ───────────────────────────────────────────────
  describe("10. Admin Authorization", () => {
    it("allows an admin user to upload cover image for any user's trip", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${adminToken}`])
        .set("x-csrf-token", adminCsrf)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "admin-curated.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const trip = await Booking.findById(tripA._id);
      expect(trip.coverImage).toBe(res.body.data.coverImage);
    });

    it("allows an admin user to delete cover image for any user's trip", async () => {
      const res = await request(app)
        .delete(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${adminToken}`])
        .set("x-csrf-token", adminCsrf);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const trip = await Booking.findById(tripA._id);
      expect(trip.coverImage).toBeNull();
    });
  });

  // ── 11. CSRF Enforcement ──────────────────────────────────────────────────
  describe("11. CSRF Enforcement", () => {
    it("rejects cover image upload without CSRF token (HTTP 403)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        // No x-csrf-token
        .attach("coverImage", JPEG_BUFFER, {
          filename: "cover.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("CSRF");
    });

    it("rejects cover image deletion without CSRF token (HTTP 403)", async () => {
      const res = await request(app)
        .delete(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`]);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("CSRF");
    });
  });

  // ── 12. Image Replacement ─────────────────────────────────────────────────
  describe("12. Image Replacement", () => {
    it("replaces existing custom image with new upload and triggers safe cleanup", async () => {
      const deleteSpy = jest.spyOn(storageService, "deleteImage");

      // First upload
      const res1 = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "first.jpg",
          contentType: "image/jpeg",
        });

      expect(res1.status).toBe(200);
      const firstUrl = res1.body.data.coverImage;

      // Second upload (replacement)
      const res2 = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", PNG_BUFFER, {
          filename: "second.png",
          contentType: "image/png",
        });

      expect(res2.status).toBe(200);
      const secondUrl = res2.body.data.coverImage;
      expect(secondUrl).not.toBe(firstUrl);

      // Verify deletion was called for the previous custom image
      expect(deleteSpy).toHaveBeenCalledWith(firstUrl);

      const trip = await Booking.findById(tripA._id);
      expect(trip.coverImage).toBe(secondUrl);
    });
  });

  // ── 13. Safe Image Deletion ───────────────────────────────────────────────
  describe("13. Safe Image Deletion", () => {
    it("deletes cover image from booking and leaves external Unsplash URL untouched", async () => {
      expect(tripA.coverImage).toContain("unsplash.com");

      const res = await request(app)
        .delete(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coverImage).toBeNull();

      const trip = await Booking.findById(tripA._id);
      expect(trip.coverImage).toBeNull();
    });
  });

  // ── 14. Existing Image URL Compatibility ──────────────────────────────────
  describe("14. Existing Image URL Compatibility", () => {
    it("preserves external Unsplash URL when fetching bookings or updating other fields", async () => {
      // 1. Fetch user bookings - coverImage should still be the Unsplash URL
      const getRes = await request(app)
        .get("/api/bookings")
        .set("Cookie", [`token=${tokenA}`]);

      expect(getRes.status).toBe(200);
      const found = getRes.body.data.find((b) => b._id === tripA._id.toString());
      expect(found.coverImage).toBe("https://images.unsplash.com/photo-1512343879784-a960bf40e7f2");

      // 2. Update booking notes via PUT - coverImage must remain unchanged
      const putRes = await request(app)
        .put(`/api/bookings/${tripA._id}`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .send({ notes: "Updated packing list" });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.coverImage).toBe("https://images.unsplash.com/photo-1512343879784-a960bf40e7f2");
    });
  });

  // ── 15. Route Isolation & Persistence Failure Rollback ─────────────────────
  describe("15. Route Isolation & Rollback Verification", () => {
    it("attempts cleanup of newly uploaded asset if database persistence fails", async () => {
      const deleteSpy = jest.spyOn(storageService, "deleteImage");
      jest.spyOn(Booking.prototype, "save").mockImplementationOnce(async () => {
        throw new Error("Simulated database persistence failure");
      });

      const res = await request(app)
        .post(`/api/bookings/${tripA._id}/cover-image`)
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "fail.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(500);
      expect(deleteSpy).toHaveBeenCalled();
    });

    it("rejects multipart upload on standard JSON routes even with query trick (HTTP 415)", async () => {
      const res = await request(app)
        .post("/api/bookings?action=/cover-image")
        .set("Cookie", [`token=${tokenA}`])
        .set("x-csrf-token", csrfA)
        .attach("coverImage", JPEG_BUFFER, {
          filename: "trick.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(415);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Unsupported Content-Type");
    });
  });
});

