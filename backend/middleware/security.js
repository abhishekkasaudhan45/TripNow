const helmet = require("helmet");
const env = require("../config/env");

/**
 * Enterprise HTTP security headers configured via Helmet.
 * Configured specifically for TripNow's architecture:
 * - Decoupled frontend (Vercel) + API backend (Render)
 * - Conservative Strict-Transport-Security in production HTTPS only (no preload, no includeSubDomains)
 * - CSP supporting Google Fonts, Unsplash images, Google Maps embeds, EmailJS, and external APIs
 * - CORP set to cross-origin to allow decoupled frontend API access
 * - COOP set to same-origin
 * - Frameguard deny + frame-ancestors 'none' to prevent clickjacking
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://accounts.google.com/gsi/client"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com",
        "https://tripnow.abhishektech.me",
        "https://res.cloudinary.com",
        "https://lh3.googleusercontent.com",
      ],
      connectSrc: [
        "'self'",
        ...env.allowedOrigins,
        "https://nominatim.openstreetmap.org",
        "https://api.open-meteo.com",
        "https://api.emailjs.com",
        "https://accounts.google.com/gsi/",
      ],
      frameSrc: ["'self'", "https://maps.google.com", "https://accounts.google.com/gsi/"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  strictTransportSecurity: env.isProduction
    ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: false,
        preload: false,
      }
    : false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

const securityHeaders = (req, res, next) => {
  helmetMiddleware(req, res, (err) => {
    if (err) return next(err);
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
};

module.exports = {
  securityHeaders,
};
