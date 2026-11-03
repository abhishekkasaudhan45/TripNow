// frontend/tests/authUiModernization.test.mjs
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("TripNow Phase 4 — Login & Registration UI Modernization Suite", () => {
  const loginPath = path.resolve("frontend/src/pages/Login.jsx");
  const signupPath = path.resolve("frontend/src/pages/Signup.jsx");
  const googleBtnPath = path.resolve("frontend/src/components/auth/GoogleSignInButton.jsx");

  describe("Section 1: Component Architecture & Brand Alignment", () => {
    it("1.1 Login.jsx uses unified TripNowLogo across both desktop and mobile views", () => {
      assert.ok(fs.existsSync(loginPath), "Login.jsx must exist");
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(
        content.includes('import TripNowLogo from "../components/common/TripNowLogo"'),
        "Must import TripNowLogo"
      );
      assert.ok(
        content.includes('<TripNowLogo size={36} theme="dark"'),
        "Desktop panel must use TripNowLogo with size=36 and theme='dark'"
      );
      assert.ok(
        content.includes("<TripNowLogo size={34}"),
        "Mobile header must use TripNowLogo with size=34"
      );
    });

    it("1.2 Signup.jsx uses unified TripNowLogo across both desktop and mobile views", () => {
      assert.ok(fs.existsSync(signupPath), "Signup.jsx must exist");
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(
        content.includes('import TripNowLogo from "../components/common/TripNowLogo"'),
        "Must import TripNowLogo"
      );
      assert.ok(
        content.includes('<TripNowLogo size={36} theme="dark"'),
        "Desktop panel must use TripNowLogo with size=36 and theme='dark'"
      );
      assert.ok(
        content.includes("<TripNowLogo size={34}"),
        "Mobile header must use TripNowLogo with size=34"
      );
    });

    it("1.3 Login and Signup apply unified sunset/coral gradients and design tokens", () => {
      const loginContent = fs.readFileSync(loginPath, "utf8");
      const signupContent = fs.readFileSync(signupPath, "utf8");

      assert.ok(
        loginContent.includes("linear-gradient(135deg, #f59e0b, #ef4444)"),
        "Login button must use sunset-coral gradient"
      );
      assert.ok(
        signupContent.includes("linear-gradient(135deg, #f59e0b, #ef4444)"),
        "Signup button must use sunset-coral gradient"
      );
      assert.ok(loginContent.includes("Playfair Display"), "Login heading must use Playfair Display");
      assert.ok(signupContent.includes("Playfair Display"), "Signup heading must use Playfair Display");
    });
  });

  describe("Section 2: Login Page UI & Form Controls", () => {
    it("2.1 Form contains email, password, forgot-password link, and Sign In CTA", () => {
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(content.includes('id="login-email"'), "Must have login-email input");
      assert.ok(content.includes('id="login-password"'), "Must have login-password input");
      assert.ok(content.includes('to="/forgot-password"'), "Must link to /forgot-password");
      assert.ok(content.includes("Sign In →"), "Must feature 'Sign In →' CTA");
      assert.ok(content.includes('to="/signup"'), "Must link to /signup");
    });

    it("2.2 Password toggle features accessible labels and vector SVGs", () => {
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(
        content.includes('aria-label={showPass ? "Hide password" : "Show password"}'),
        "Password toggle must have descriptive aria-label"
      );
      assert.ok(
        content.includes("aria-pressed={showPass}"),
        "Password toggle must provide aria-pressed state"
      );
      assert.ok(content.includes("<IconEye"), "Must render vector Eye icon");
      assert.ok(content.includes("<IconEyeOff"), "Must render vector EyeOff icon");
    });

    it("2.3 Preserves strict login validation and error handling contracts", () => {
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(
        content.includes("Please provide your email address"),
        "Must validate email presence"
      );
      assert.ok(
        content.includes("Please provide your password"),
        "Must validate password presence"
      );
      assert.ok(
        content.includes('role="alert"'),
        "Error banner must specify role='alert'"
      );
      assert.ok(
        content.includes('aria-live="assertive"'),
        "Error banner must specify aria-live='assertive'"
      );
    });

    it("2.4 Integrates GoogleSignInButton and preserves redirect contract", () => {
      const content = fs.readFileSync(loginPath, "utf8");
      assert.ok(content.includes("<GoogleSignInButton"), "Must render GoogleSignInButton");
      assert.ok(content.includes('text="signin_with"'), "Must pass text='signin_with'");
      assert.ok(content.includes("handleAuthSuccess"), "Must pass handleAuthSuccess handler");
      assert.ok(content.includes("returnTo"), "Must preserve returnTo redirection state");
      assert.ok(content.includes("stagedTrip"), "Must preserve stagedTrip state preservation");
    });
  });

  describe("Section 3: Signup Page UI & Form Controls", () => {
    it("3.1 Form contains full name, email, password, confirm password, and registration CTA", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(content.includes('id="signup-name"'), "Must have signup-name input");
      assert.ok(content.includes('id="signup-email"'), "Must have signup-email input");
      assert.ok(content.includes('id="signup-password"'), "Must have signup-password input");
      assert.ok(content.includes('id="signup-confirm"'), "Must have signup-confirm input");
      assert.ok(content.includes("Create Free Account →"), "Must feature 'Create Free Account →' CTA");
      assert.ok(content.includes('to="/login"'), "Must link back to /login");
    });

    it("3.2 Supports visibility toggles on both password and confirm-password fields", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(
        content.includes('aria-label={showPass ? "Hide password" : "Show password"}'),
        "Password toggle must have descriptive aria-label"
      );
      assert.ok(
        content.includes('aria-label={showConfirmPass ? "Hide confirm password" : "Show confirm password"}'),
        "Confirm password toggle must have descriptive aria-label"
      );
      assert.ok(content.includes("showConfirmPass"), "Must manage showConfirmPass state");
    });

    it("3.3 Displays real-time password requirement checklist matching existing rules", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(content.includes("hasMinLength"), "Must track 8+ characters rule");
      assert.ok(content.includes("hasUpper"), "Must track uppercase rule");
      assert.ok(content.includes("hasLower"), "Must track lowercase rule");
      assert.ok(content.includes("hasNumber"), "Must track number rule");
      assert.ok(content.includes("hasMatch"), "Must track password match rule");
      assert.ok(content.includes("8+ characters"), "Must display 8+ characters requirement label");
    });

    it("3.4 Preserves all 7 existing registration validation rules", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(content.includes("trimmedName.length < 2"), "Must validate name length >= 2");
      assert.ok(content.includes('!form.email.includes("@")'), "Must validate email format");
      assert.ok(content.includes("form.password.length < 8"), "Must validate password length >= 8");
      assert.ok(content.includes("/[a-z]/.test(form.password)"), "Must validate lowercase character");
      assert.ok(content.includes("/[A-Z]/.test(form.password)"), "Must validate uppercase character");
      assert.ok(content.includes("/[0-9]/.test(form.password)"), "Must validate number character");
      assert.ok(content.includes("form.password !== form.confirm"), "Must validate password match");
    });

    it("3.5 Links cleanly to /terms and /privacy", () => {
      const content = fs.readFileSync(signupPath, "utf8");
      assert.ok(content.includes('to="/terms"'), "Must link to /terms");
      assert.ok(content.includes('to="/privacy"'), "Must link to /privacy");
    });
  });

  describe("Section 4: Accessibility & Security Standards", () => {
    it("4.1 All inputs have associated <label htmlFor='...'> matching input ids", () => {
      const loginContent = fs.readFileSync(loginPath, "utf8");
      const signupContent = fs.readFileSync(signupPath, "utf8");

      // Login
      assert.ok(loginContent.includes('htmlFor="login-email"'));
      assert.ok(loginContent.includes('htmlFor="login-password"'));

      // Signup
      assert.ok(signupContent.includes('htmlFor="signup-name"'));
      assert.ok(signupContent.includes('htmlFor="signup-email"'));
      assert.ok(signupContent.includes('htmlFor="signup-password"'));
      assert.ok(signupContent.includes('htmlFor="signup-confirm"'));
    });

    it("4.2 Form controls include aria-required, aria-invalid, and aria-describedby", () => {
      const loginContent = fs.readFileSync(loginPath, "utf8");
      const signupContent = fs.readFileSync(signupPath, "utf8");

      assert.ok(loginContent.includes('aria-required="true"'));
      assert.ok(loginContent.includes("aria-invalid="));
      assert.ok(loginContent.includes("aria-describedby="));

      assert.ok(signupContent.includes('aria-required="true"'));
      assert.ok(signupContent.includes("aria-invalid="));
      assert.ok(signupContent.includes("aria-describedby="));
    });

    it("4.3 Respects user's prefers-reduced-motion configuration", () => {
      const loginContent = fs.readFileSync(loginPath, "utf8");
      const signupContent = fs.readFileSync(signupPath, "utf8");

      assert.ok(loginContent.includes("prefers-reduced-motion: reduce"));
      assert.ok(signupContent.includes("prefers-reduced-motion: reduce"));
    });

    it("4.4 Token security is strictly maintained without localStorage token storage", () => {
      const loginContent = fs.readFileSync(loginPath, "utf8");
      const signupContent = fs.readFileSync(signupPath, "utf8");

      assert.ok(
        !loginContent.includes('localStorage.setItem("token"'),
        "Login must never store token in localStorage"
      );
      assert.ok(
        !signupContent.includes('localStorage.setItem("token"'),
        "Signup must never store token in localStorage"
      );
      assert.ok(
        loginContent.includes("HttpOnly cookie"),
        "Login must preserve HttpOnly cookie security architecture comments"
      );
      assert.ok(
        signupContent.includes("HttpOnly cookie"),
        "Signup must preserve HttpOnly cookie security architecture comments"
      );
    });
  });
});

