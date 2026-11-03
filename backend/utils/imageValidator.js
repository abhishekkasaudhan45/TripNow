/**
 * Image Validator Utility
 * Validates file buffers against genuine magic bytes, rejects SVG/executable vectors,
 * and confirms MIME/extension alignment.
 */

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

/**
 * Inspects a Buffer's initial bytes to identify genuine image format.
 * Returns format details or null if not a recognized, safe raster image.
 */
function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return {
      format: "jpeg",
      mimeType: "image/jpeg",
      canonicalExtension: "jpg",
    };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      format: "png",
      mimeType: "image/png",
      canonicalExtension: "png",
    };
  }

  // 3. GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return {
      format: "gif",
      mimeType: "image/gif",
      canonicalExtension: "gif",
    };
  }

  // 4. WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return {
      format: "webp",
      mimeType: "image/webp",
      canonicalExtension: "webp",
    };
  }

  return null;
}

/**
 * Checks for dangerous signatures: SVG (XSS vector), PE executables, ELF binaries, shell scripts.
 */
function containsDangerousSignatures(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return true;

  // Windows PE (MZ)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true;
  }

  // Linux ELF (\x7fELF)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return true;
  }

  // Script shebang (#!)
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return true;
  }

  // Scan initial 1024 bytes for SVG / XML / HTML tags (prevents SVG stored XSS)
  const headerSample = buffer
    .subarray(0, Math.min(buffer.length, 1024))
    .toString("utf8")
    .toLowerCase();

  if (
    headerSample.includes("<svg") ||
    headerSample.includes("xmlns=\"http://www.w3.org/2000/svg\"") ||
    headerSample.includes("<!doctype svg") ||
    (headerSample.includes("<?xml") && headerSample.includes("<svg")) ||
    headerSample.includes("<html") ||
    headerSample.includes("<script")
  ) {
    return true;
  }

  return false;
}

/**
 * Validates an image file buffer along with its declared metadata.
 *
 * @param {Buffer} buffer - Raw file bytes
 * @param {string} declaredMimeType - MIME reported in multipart headers
 * @param {string} originalName - Client filename
 * @returns {{ isValid: boolean, error?: string, format?: string, mimeType?: string, extension?: string }}
 */
function validateImageBuffer(buffer, declaredMimeType = "", originalName = "") {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { isValid: false, error: "No image file buffer provided." };
  }

  if (buffer.length === 0) {
    return { isValid: false, error: "Uploaded file is empty." };
  }

  // Prevent SVG and binary script execution vectors
  if (containsDangerousSignatures(buffer)) {
    return {
      isValid: false,
      error: "Uploaded file contains invalid or forbidden content signatures.",
    };
  }

  // Detect genuine raster image format from magic bytes
  const detected = detectImageFormat(buffer);
  if (!detected) {
    return {
      isValid: false,
      error: "Invalid image content. File must be a valid JPEG, PNG, WebP, or GIF image.",
    };
  }

  // Check declared MIME type if provided
  const normalizedMime = (declaredMimeType || "").toLowerCase().trim();
  if (normalizedMime && !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return {
      isValid: false,
      error: `Unsupported MIME type '${declaredMimeType}'. Only JPEG, PNG, WebP, and GIF are permitted.`,
    };
  }

  // Extract declared extension
  const extMatch = (originalName || "").match(/\.([a-zA-Z0-9]+)$/);
  const declaredExt = extMatch ? extMatch[1].toLowerCase() : "";

  if (declaredExt && !ALLOWED_EXTENSIONS.has(declaredExt)) {
    return {
      isValid: false,
      error: `Unsupported file extension '.${declaredExt}'. Only .jpg, .jpeg, .png, .webp, and .gif are permitted.`,
    };
  }

  // Cross-verify extension compatibility with detected format
  if (declaredExt) {
    const isJpegMatch =
      detected.format === "jpeg" && (declaredExt === "jpg" || declaredExt === "jpeg");
    const isExactMatch = detected.format === declaredExt;

    if (!isJpegMatch && !isExactMatch) {
      return {
        isValid: false,
        error: `File extension '.${declaredExt}' does not match actual image content (${detected.format.toUpperCase()}).`,
      };
    }
  }

  return {
    isValid: true,
    format: detected.format,
    mimeType: detected.mimeType,
    extension: detected.canonicalExtension,
  };
}

module.exports = {
  validateImageBuffer,
  detectImageFormat,
  containsDangerousSignatures,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};

