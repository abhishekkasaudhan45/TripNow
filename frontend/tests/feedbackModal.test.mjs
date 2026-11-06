// frontend/tests/feedbackModal.test.mjs
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("TripNow — Feedback Modal & Footer Integration Suite", () => {
  const modalPath = path.resolve("frontend/src/components/feedback/FeedbackModal.jsx");
  const footerPath = path.resolve("frontend/src/layouts/Footer.jsx");

  describe("Section 1: FeedbackModal Component Architecture & Contracts", () => {
    it("1.1 FeedbackModal.jsx exists and has valid component export", () => {
      assert.ok(fs.existsSync(modalPath), "FeedbackModal.jsx must exist");
      const content = fs.readFileSync(modalPath, "utf8");
      assert.ok(
        content.includes("export default function FeedbackModal"),
        "FeedbackModal must export a default function"
      );
      assert.ok(
        content.includes("isOpen") && content.includes("onClose"),
        "FeedbackModal must accept isOpen and onClose props"
      );
    });

    it("1.2 FeedbackModal conforms to ARIA accessibility requirements", () => {
      const content = fs.readFileSync(modalPath, "utf8");
      assert.ok(content.includes('role="dialog"'), "Must implement role='dialog'");
      assert.ok(content.includes('aria-modal="true"'), "Must implement aria-modal='true'");
      assert.ok(
        content.includes('aria-labelledby="feedback-dialog-title"'),
        "Must implement aria-labelledby for modal title"
      );
      assert.ok(
        content.includes('id="feedback-dialog-title"'),
        "Must provide corresponding title id"
      );
      assert.ok(
        content.includes("e.key === \"Escape\"") || content.includes("e.key === 'Escape'"),
        "Must handle Escape key to dismiss dialog"
      );
    });

    it("1.3 FeedbackModal contains 1-5 star ratings and categories", () => {
      const content = fs.readFileSync(modalPath, "utf8");
      assert.ok(content.includes("[1, 2, 3, 4, 5]") || content.includes("[1,2,3,4,5]"), "Must support 1 to 5 star ratings");
      assert.ok(content.includes("Experience"), "Must include 'Experience' category");
      assert.ok(content.includes("Feature Request"), "Must include 'Feature Request' category");
      assert.ok(content.includes("Bug"), "Must include 'Bug' category");
      assert.ok(content.includes("Other"), "Must include 'Other' category");
    });

    it("1.4 FeedbackModal submits to /api/feedback via api.js with user prefill", () => {
      const content = fs.readFileSync(modalPath, "utf8");
      assert.ok(content.includes("getUser()"), "Must read user credentials via getUser()");
      assert.ok(content.includes('api.post("/api/feedback"'), "Must call api.post with /api/feedback");
      assert.ok(content.includes("isSubmitting"), "Must track isSubmitting state to prevent duplicate submissions");
    });
  });

  describe("Section 2: Footer Integration & Database-First Form", () => {
    it("2.1 Footer.jsx imports and mounts FeedbackModal", () => {
      assert.ok(fs.existsSync(footerPath), "Footer.jsx must exist");
      const content = fs.readFileSync(footerPath, "utf8");
      assert.ok(
        content.includes('import FeedbackModal from "../components/feedback/FeedbackModal"'),
        "Footer must import FeedbackModal"
      );
      assert.ok(
        content.includes("isFeedbackOpen"),
        "Footer must manage isFeedbackOpen state"
      );
      assert.ok(
        content.includes("<FeedbackModal"),
        "Footer must render <FeedbackModal />"
      );
    });

    it("2.2 Footer.jsx renders a dedicated 'Feedback' trigger button", () => {
      const content = fs.readFileSync(footerPath, "utf8");
      assert.ok(
        content.includes("setIsFeedbackOpen(true)"),
        "Footer must have an action button to set isFeedbackOpen to true"
      );
      assert.ok(
        /<button[^>]*onClick=\{[^}]*setIsFeedbackOpen\(true\)[^}]*\}[\s\S]*?>[\s\S]*?Feedback[\s\S]*?<\/button>/.test(content),
        "Footer must include button with Feedback text"
      );
    });

    it("2.3 Footer inline FeedbackForm connects to /api/feedback database-first", () => {
      const content = fs.readFileSync(footerPath, "utf8");
      assert.ok(
        content.includes('api.post("/api/feedback"'),
        "Inline FeedbackForm must submit to /api/feedback"
      );
    });

    it("2.4 Preserves brand identity standards in Footer.jsx", () => {
      const content = fs.readFileSync(footerPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Footer must keep TripNowLogo");
      assert.ok(content.includes('theme="dark"'), "Footer logo must keep theme='dark'");
      assert.ok(content.includes('subtitle="AI Travel Planning"'), "Footer logo must keep subtitle");
    });
  });
});
