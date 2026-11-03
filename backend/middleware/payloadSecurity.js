/**
 * Payload security middleware:
 * 1. Enforces application/json Content-Type on state-changing requests with non-empty bodies.
 * 2. Defends against prototype pollution by detecting forbidden keys (__proto__, constructor, prototype).
 * 3. Prevents NoSQL operator injection in query strings by rejecting any key starting with '$',
 *    or containing bracketed/dotted operator patterns like '[$' or '.$', across both flat and nested objects.
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Recursively inspects object keys for prototype pollution vectors.
 * Bounded to depth 10 to prevent CPU/stack exhaustion.
 */
const hasForbiddenKeys = (obj, depth = 0) => {
  if (!obj || typeof obj !== "object" || depth > 10) return false;

  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (hasForbiddenKeys(obj[key], depth + 1)) return true;
    }
  }
  return false;
};

/**
 * Recursively inspects query objects for MongoDB operator keys.
 * Catches:
 * - Direct operators: ?$where=...
 * - Bracketed operators from standard Express parser: ?email[$ne]=null, ?filter[$where]=...
 * - Deeply nested bracketed operators: ?filter[nested][$gt]=1
 * - Dotted operators: ?filter.$gt=1
 * - Nested query objects if extended parser is active.
 * Does NOT inspect or alter query string values (e.g. ?budget=$500 is completely safe and permitted).
 * Bounded to depth 5 to prevent recursion exhaustion.
 */
const hasMongoOperatorKeys = (obj, depth = 0) => {
  if (!obj || typeof obj !== "object" || depth > 5) return false;

  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes("[$") || key.includes(".$")) {
      return true;
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (hasMongoOperatorKeys(obj[key], depth + 1)) return true;
    }
  }
  return false;
};

const payloadSecurity = (req, res, next) => {
  // 1. Content-Type enforcement on state-changing methods with a body
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentLength = req.headers["content-length"];
    const isChunked = req.headers["transfer-encoding"] === "chunked";
    const hasBody = (contentLength && contentLength !== "0") || isChunked;

    if (hasBody) {
      const isMultipart = Boolean(req.is("multipart/form-data"));
      const rawPath = req.originalUrl || req.path || "";
      const pathname = rawPath.split("?")[0];
      const isUploadPath = pathname.endsWith("/cover-image");

      if (isMultipart && isUploadPath) {
        // Permitted multipart file upload path
      } else if (!req.is("application/json")) {
        return res.status(415).json({
          success: false,
          message: "Unsupported Content-Type. Requests with a body must use application/json.",
        });
      }
    }
  }

  // 2. Prototype pollution defense on parsed body
  if (req.body && typeof req.body === "object") {
    if (hasForbiddenKeys(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload: forbidden prototype property detected.",
      });
    }
  }

  // 3. NoSQL operator query string sanitization (direct, bracketed, and nested)
  if (req.query && typeof req.query === "object") {
    if (hasMongoOperatorKeys(req.query)) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameter: MongoDB operator keys are not permitted.",
      });
    }
  }

  next();
};

module.exports = {
  payloadSecurity,
  hasForbiddenKeys,
  hasMongoOperatorKeys,
};
