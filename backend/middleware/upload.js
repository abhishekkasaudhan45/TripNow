/**
 * Upload Middleware
 * Handles bounded in-memory multipart/form-data parsing using Multer,
 * enforces file size (5MB) and file count (1 file) limits, and verifies
 * genuine image content using magic byte inspection.
 */

const multer = require("multer");
const { validateImageBuffer } = require("../utils/imageValidator");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

  const mime = (file.mimetype || "").toLowerCase().trim();
  if (allowedMimes.has(mime)) {
    cb(null, true);
  } else {
    const error = new Error(
      "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed."
    );
    error.code = "INVALID_FILE_TYPE";
    error.statusCode = 400;
    cb(error, false);
  }
};

const multerInstance = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

// Accept single file from either "coverImage" or "image" field
const uploadFields = multerInstance.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

/**
 * Express middleware that parses multipart image upload and validates magic bytes.
 */
function uploadCoverImageMiddleware(req, res, next) {
  uploadFields(req, res, (err) => {
    // Handle Multer errors
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "File size exceeds the 5MB limit.",
        });
      }

      if (
        err.code === "LIMIT_UNEXPECTED_FILE" ||
        err.code === "LIMIT_FILE_COUNT"
      ) {
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded. Maximum 1 image file allowed.",
        });
      }

      if (err.code === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "Failed to process uploaded file.",
      });
    }

    // Resolve uploaded file from accepted field names
    const uploadedFile =
      req.files?.coverImage?.[0] || req.files?.image?.[0] || req.file;

    // Check if multiple files across fields were sent
    const totalFiles =
      (req.files?.coverImage?.length || 0) + (req.files?.image?.length || 0);

    if (totalFiles > 1) {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded. Maximum 1 image file allowed.",
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please attach an image in the 'coverImage' or 'image' field.",
      });
    }

    // Inspect magic bytes and verify genuine raster image
    const validation = validateImageBuffer(
      uploadedFile.buffer,
      uploadedFile.mimetype,
      uploadedFile.originalname
    );

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Attach validated image metadata and buffer to request object
    req.validatedImage = {
      buffer: uploadedFile.buffer,
      format: validation.format,
      mimeType: validation.mimeType,
      extension: validation.extension,
      size: uploadedFile.size,
      originalName: uploadedFile.originalname,
    };

    next();
  });
}

module.exports = {
  uploadCoverImageMiddleware,
  MAX_FILE_SIZE,
};

