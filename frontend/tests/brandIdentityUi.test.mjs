// frontend/tests/brandIdentityUi.test.mjs
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("TripNow Phase 2 — Unified Brand Identity & Logo Suite", () => {
  const logoPath = path.resolve("frontend/src/components/common/TripNowLogo.jsx");
  const barrelPath = path.resolve("frontend/src/components/common/index.js");
  const faviconPath = path.resolve("frontend/public/favicon.svg");
  const indexPath = path.resolve("frontend/index.html");

  const headerPath = path.resolve("frontend/src/layouts/Header.jsx");
  const footerPath = path.resolve("frontend/src/layouts/Footer.jsx");
  const loginPath = path.resolve("frontend/src/pages/Login.jsx");
  const signupPath = path.resolve("frontend/src/pages/Signup.jsx");
  const dashPath = path.resolve("frontend/src/pages/Dashboard.jsx");

  describe("Section 1: Component Architecture & API Contract", () => {
    it("1.1 TripNowLogo.jsx exists and has valid React component structure", () => {
      assert.ok(fs.existsSync(logoPath), "TripNowLogo.jsx must exist");
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes("export default function TripNowLogo"), "Must have default export TripNowLogo");
      assert.ok(content.includes("size = 32"), "Must support default size=32");
      assert.ok(content.includes('variant = "full"'), "Must support default variant='full'");
      assert.ok(content.includes('theme = "light"'), "Must support default theme='light'");
      assert.ok(content.includes("subtitle"), "Must support subtitle prop");
      assert.ok(content.includes("useId()"), "Must use useId() for isolated SVG gradient IDs");
    });

    it("1.2 common barrel (index.js) exports TripNowLogo cleanly", () => {
      assert.ok(fs.existsSync(barrelPath), "common/index.js must exist");
      const content = fs.readFileSync(barrelPath, "utf8");
      assert.ok(content.includes('export { default as TripNowLogo } from "./TripNowLogo"'), "Must export named TripNowLogo");
      assert.ok(content.includes('export { default } from "./TripNowLogo"'), "Must export default TripNowLogo");
    });

    it("1.3 Supports dark and light themes for high-contrast wordmark", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes('#172033'), "Must support dark wordmark (#172033) for light backgrounds");
      assert.ok(content.includes('#FFFFFF'), "Must support white wordmark (#FFFFFF) for dark backgrounds");
      assert.ok(content.includes("Playfair Display"), "Must style wordmark with Playfair Display");
    });

    it("1.4 Wordmark supports optional uppercase subtitle styling", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes("tripnow-subtitle"), "Must provide subtitle container");
      assert.ok(content.includes("letterSpacing: \"0.14em\""), "Subtitle must have tracking");
    });
  });

  describe("Section 2: Concept 06 Vector Anatomy & Accessibility", () => {
    it("2.1 SVG includes sunset-coral gradient for pin silhouette", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes("#F59E0B"), "Must contain sunset orange stop #F59E0B");
      assert.ok(content.includes("#EF4444"), "Must contain coral stop #EF4444");
    });

    it("2.2 SVG includes golden orbital launch gradient and arrowhead", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes("#FBBF24"), "Must contain golden accent stop #FBBF24");
      assert.ok(content.includes("strokeLinecap=\"round\""), "Orbital launch curve must use round linecap");
    });

    it("2.3 Pin silhouette uses evenodd cutout aperture", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes('fillRule="evenodd"'), "Pin must have evenodd aperture cutout");
    });

    it("2.4 Enforces proper accessibility contracts", () => {
      const content = fs.readFileSync(logoPath, "utf8");
      assert.ok(content.includes('role={shouldShowWordmark ? "group" : "img"}'), "Must assign role based on wordmark visibility");
      assert.ok(content.includes('aria-label={title}'), "Must provide aria-label");
      assert.ok(content.includes('aria-hidden={shouldShowWordmark ? "true" : undefined}'), "SVG must be hidden from screen readers when wordmark is visible");
      assert.ok(content.includes('<title>{title}</title>'), "SVG must provide title when wordmark is hidden");
    });
  });

  describe("Section 3: Favicon & HTML Linkage", () => {
    it("3.1 Favicon SVG exists and contains valid Concept 06 vector paths", () => {
      assert.ok(fs.existsSync(faviconPath), "favicon.svg must exist in frontend/public");
      const content = fs.readFileSync(faviconPath, "utf8");
      assert.ok(content.includes('viewBox="0 0 32 32"'), "Favicon must have 32x32 viewBox");
      assert.ok(content.includes("#F59E0B"), "Favicon must contain sunset gradient");
      assert.ok(content.includes("#EF4444"), "Favicon must contain coral gradient");
      assert.ok(content.includes("#FBBF24"), "Favicon must contain golden launch gradient");
      assert.ok(!content.includes("✦"), "Favicon must not contain old star glyph");
      assert.ok(!content.includes("TripNow"), "Favicon must be icon-only without wordmark");
    });

    it("3.2 index.html links directly to /favicon.svg and preserves metadata", () => {
      assert.ok(fs.existsSync(indexPath), "index.html must exist");
      const content = fs.readFileSync(indexPath, "utf8");
      assert.ok(content.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'), "index.html must reference favicon.svg");
      assert.ok(content.includes("<title>TripNow"), "Must preserve SEO title");
      assert.ok(content.includes('name="theme-color" content="#f59e0b"'), "Must preserve theme-color");
    });
  });

  describe("Section 4: Integration Verification in Modified Components", () => {
    it("4.1 Header.jsx uses TripNowLogo and has zero fragmented marks", () => {
      const content = fs.readFileSync(headerPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Header must import and render TripNowLogo");
      assert.ok(content.includes("<TripNowLogo size={36}"), "Header must render TripNowLogo with size 36");
      assert.ok(!content.includes('✦</div>'), "Header must not contain fragmented logo mark");
    });

    it("4.2 Footer.jsx uses TripNowLogo with dark theme and subtitle", () => {
      const content = fs.readFileSync(footerPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Footer must import and render TripNowLogo");
      assert.ok(content.includes('theme="dark"'), "Footer logo must use theme='dark'");
      assert.ok(content.includes('subtitle="AI Travel Planning"'), "Footer logo must provide subtitle");
    });

    it("4.3 Login.jsx uses TripNowLogo across both desktop and mobile views", () => {
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Login must import and render TripNowLogo");
      assert.ok(content.includes('<TripNowLogo size={36} theme="dark"'), "Desktop view must render dark theme logo");
      assert.ok(content.includes('<TripNowLogo size={34}'), "Mobile view must render size 34 logo");
      assert.ok(!content.includes('✦</div>'), "Login must not contain fragmented logo mark");
    });

    it("4.4 Signup.jsx uses TripNowLogo across both desktop and mobile views", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Signup must import and render TripNowLogo");
      assert.ok(content.includes('<TripNowLogo size={36} theme="dark"'), "Desktop view must render dark theme logo");
      assert.ok(content.includes('<TripNowLogo size={34}'), "Mobile view must render size 34 logo");
      assert.ok(!content.includes('✦</div>'), "Signup must not contain fragmented logo mark");
    });

    it("4.5 Dashboard.jsx uses TripNowLogo with variant='icon'", () => {
      const content = fs.readFileSync(dashPath, "utf8");
      assert.ok(content.includes("TripNowLogo"), "Dashboard must import and render TripNowLogo");
      assert.ok(content.includes('variant="icon"'), "Dashboard must render icon variant");
    });

    it("4.6 Confirms zero fragmented brand logo instances across entire frontend/src", () => {
      function walk(dir) {
        let results = [];
        fs.readdirSync(dir).forEach(file => {
          const full = path.join(dir, file);
          if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
          else if (full.endsWith(".jsx")) results.push(full);
        });
        return results;
      }

      const files = walk(path.resolve("frontend/src"));
      let fragmentedCount = 0;
      for (const f of files) {
        const text = fs.readFileSync(f, "utf8");
        // Fragmented brand pattern: icon div containing ✦ followed by TripNow text span
        const hasFragmentedLogo =
          /style=\{\{[^}]*width:\s*["']3[0-9]px["'][^}]*\}\}[^>]*>\s*✦\s*<\/div>\s*<(?:span|p)[^>]*>TripNow<\/(?:span|p)>/s.test(
            text
          );
        if (hasFragmentedLogo) {
          fragmentedCount++;
        }
      }
      assert.strictEqual(fragmentedCount, 0, "No fragmented logo marks should remain in frontend/src");
    });
  });
});
