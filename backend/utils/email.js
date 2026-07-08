// backend/utils/email.js
// Server-side email sending via the EmailJS REST API.
//
// IMPORTANT: security emails (password reset, verification) are sent from the
// BACKEND using the EmailJS *private key* (accessToken). The raw token only
// ever travels inside the email link — it is never returned in an API response.
//
// All EmailJS credentials are OPTIONAL env vars. If they are missing, sending
// is skipped gracefully (logged, not thrown) so the app still runs in dev/test.
const axios = require("axios");

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

const cfg = {
  serviceId: process.env.EMAILJS_SERVICE_ID,
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
  resetTemplateId: process.env.EMAILJS_RESET_TEMPLATE_ID,
  verifyTemplateId: process.env.EMAILJS_VERIFY_TEMPLATE_ID,
};

const isConfigured = () =>
  Boolean(cfg.serviceId && cfg.publicKey && cfg.privateKey);

// Low-level send. Returns true on success, false on any failure/skip.
const sendTemplate = async (templateId, templateParams) => {
  if (process.env.NODE_ENV === "test") return true; // never send during tests
  if (!isConfigured() || !templateId) {
    console.warn(
      "✉️  EmailJS not fully configured — skipping email send.",
      "Set EMAILJS_SERVICE_ID / EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY and the template IDs."
    );
    return false;
  }

  try {
    await axios.post(
      EMAILJS_ENDPOINT,
      {
        service_id: cfg.serviceId,
        template_id: templateId,
        user_id: cfg.publicKey,
        accessToken: cfg.privateKey,
        template_params: templateParams,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    return true;
  } catch (error) {
    // Never leak email-provider internals to the caller; just log server-side.
    console.error(
      "✉️  Email send failed:",
      error.response?.data || error.message
    );
    return false;
  }
};

const sendPasswordResetEmail = ({ toEmail, toName, link }) =>
  sendTemplate(cfg.resetTemplateId, {
    to_email: toEmail,
    user_name: toName || "there",
    link,
    subject: "Reset your TripNow password",
  });

const sendVerificationEmail = ({ toEmail, toName, link }) =>
  sendTemplate(cfg.verifyTemplateId, {
    to_email: toEmail,
    user_name: toName || "there",
    link,
    subject: "Verify your TripNow email",
  });

module.exports = {
  isConfigured,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
