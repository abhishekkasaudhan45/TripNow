/**
 * Storage Service
 * Isolates image persistence interactions. Supports Cloudinary for production
 * persistent object storage with secure memory/fallback for local dev and tests.
 */

const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const env = require("../config/env");

class StorageServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "StorageServiceError";
    this.statusCode = statusCode;
  }
}

/**
 * Checks whether Cloudinary credentials are provided via environment variables.
 */
function isCloudinaryConfigured() {
  if (env.cloudinaryUrl && env.cloudinaryUrl.trim()) return true;
  return Boolean(
    env.cloudinaryCloudName &&
      env.cloudinaryApiKey &&
      env.cloudinaryApiSecret
  );
}

// Initialize Cloudinary if credentials exist
if (env.cloudinaryUrl && env.cloudinaryUrl.trim()) {
  cloudinary.config({ cloudinary_url: env.cloudinaryUrl.trim() });
} else if (
  env.cloudinaryCloudName &&
  env.cloudinaryApiKey &&
  env.cloudinaryApiSecret
) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName.trim(),
    api_key: env.cloudinaryApiKey.trim(),
    api_secret: env.cloudinaryApiSecret.trim(),
    secure: true,
  });
}

/**
 * Determines whether a URL belongs to a Cloudinary asset.
 */
function isCloudinaryUrl(url) {
  if (typeof url !== "string") return false;
  return url.includes("res.cloudinary.com") || url.includes("cloudinary.com");
}

/**
 * Determines whether a URL is an external third-party URL (such as Unsplash).
 */
function isExternalUrl(url) {
  if (typeof url !== "string") return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  return !isCloudinaryUrl(url);
}

/**
 * Extracts the Cloudinary public_id from a Cloudinary URL.
 * Example:
 * https://res.cloudinary.com/demo/image/upload/v1234567/tripnow/covers/sample.jpg
 * -> "tripnow/covers/sample"
 */
function extractPublicIdFromUrl(url) {
  if (!isCloudinaryUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const match = pathname.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Uploads an image buffer to Cloudinary, or generates a safe in-memory simulated
 * URL when running in development/test without cloud credentials.
 *
 * @param {Buffer} buffer - Validated image buffer
 * @param {object} options
 * @param {string} [options.folder="tripnow/covers"]
 * @param {string} [options.format="jpg"]
 * @returns {Promise<{ url: string, publicId: string, provider: string }>}
 */
async function uploadImage(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new StorageServiceError("Invalid image buffer provided.", 400);
  }

  const folder = options.folder || "tripnow/covers";
  const format = options.format || "jpg";
  const assetId = crypto.randomUUID();
  const publicId = `${folder}/${assetId}`;

  // Production path: Cloudinary configured
  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: assetId,
          folder,
          resource_type: "image",
          format,
          transformation: [
            {
              width: 1920,
              height: 1080,
              crop: "limit",
              quality: "auto",
              fetch_format: "auto",
            },
          ],
        },
        (error, result) => {
          if (error) {
            // Sanitize internal details: do not leak raw API keys or internal stack to client
            return reject(
              new StorageServiceError("Failed to upload image to storage provider.", 502)
            );
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            provider: "cloudinary",
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  // If in strict production and storage credentials are missing, fail explicitly
  if (env.isProduction) {
    throw new StorageServiceError(
      "Media storage service is unavailable: storage provider is not configured.",
      503
    );
  }

  // Development / Test fallback: In-memory simulation with valid HTTPS URL structure
  const devCloudName = env.cloudinaryCloudName || "tripnow-dev";
  const simulatedUrl = `https://res.cloudinary.com/${devCloudName}/image/upload/v1/${publicId}.${format}`;

  return {
    url: simulatedUrl,
    publicId,
    provider: "memory",
  };
}

/**
 * Safely deletes an image asset.
 * If the image is an external URL (e.g. Unsplash), deletion is safely skipped
 * without error so external third-party assets are never affected.
 *
 * @param {string} imageUrlOrPublicId
 * @returns {Promise<{ deleted: boolean, reason?: string, provider?: string }>}
 */
async function deleteImage(imageUrlOrPublicId) {
  if (!imageUrlOrPublicId || typeof imageUrlOrPublicId !== "string") {
    return { deleted: false, reason: "missing_identifier" };
  }

  // Guard against deleting external Unsplash or third-party URLs
  if (isExternalUrl(imageUrlOrPublicId)) {
    return { deleted: false, reason: "external_url" };
  }

  const publicId = isCloudinaryUrl(imageUrlOrPublicId)
    ? extractPublicIdFromUrl(imageUrlOrPublicId)
    : imageUrlOrPublicId;

  if (!publicId) {
    return { deleted: false, reason: "invalid_public_id" };
  }

  if (isCloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      return { deleted: true, publicId, provider: "cloudinary" };
    } catch (err) {
      // Non-fatal: log error on server, do not bubble crash
      console.warn("⚠️ Failed to delete asset from Cloudinary:", err.message);
      return { deleted: false, error: err.message, provider: "cloudinary" };
    }
  }

  return { deleted: true, publicId, provider: "memory" };
}

module.exports = {
  uploadImage,
  deleteImage,
  isCloudinaryConfigured,
  isCloudinaryUrl,
  isExternalUrl,
  extractPublicIdFromUrl,
  StorageServiceError,
};

