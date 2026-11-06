const Feedback = require("../models/Feedback");
const emailUtils = require("../utils/email");

const CATEGORIES = ["Bug", "Feature Request", "Experience", "Other"];

/**
 * @desc    Submit user feedback (Database-first with non-blocking email notification)
 * @route   POST /api/feedback
 * @access  Public (Optional auth)
 */
exports.createFeedback = async (req, res) => {
  try {
    const { name, email, category, rating, message } = req.body;

    // 1. Validation
    const ratingNum = Number(rating);
    if (!rating || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid star rating between 1 and 5.",
      });
    }

    const trimmedMsg = typeof message === "string" ? message.trim() : "";
    if (!trimmedMsg || trimmedMsg.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please provide a feedback message (at least 3 characters).",
      });
    }

    if (trimmedMsg.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Feedback message cannot exceed 2000 characters.",
      });
    }

    const validCategory = CATEGORIES.includes(category) ? category : "Experience";

    const senderEmail =
      (email && typeof email === "string" ? email.trim().toLowerCase() : "") ||
      req.user?.email ||
      "";

    const senderName =
      (name && typeof name === "string" ? name.trim() : "") ||
      req.user?.name ||
      "Anonymous Traveller";

    // 2. Database-first: Always store the feedback in MongoDB first
    const feedback = await Feedback.create({
      user: req.user?._id || null,
      name: senderName,
      email: senderEmail,
      category: validCategory,
      rating: ratingNum,
      message: trimmedMsg,
    });

    // 3. Graceful Non-blocking Email Notification
    // If sending fails with "Invalid grant", connection timeout, or bad credentials,
    // catch it safely and log a warning without disrupting the user response.
    try {
      if (typeof emailUtils.sendFeedbackEmail === "function") {
        const sent = await emailUtils.sendFeedbackEmail({
          name: senderName,
          email: senderEmail,
          category: validCategory,
          rating: ratingNum,
          message: trimmedMsg,
        });
        if (sent) {
          feedback.emailNotificationSent = true;
          await feedback.save().catch(() => {});
        }
      }
    } catch (emailErr) {
      console.warn("⚠️ Non-blocking feedback notification error:", emailErr?.message || emailErr);
    }

    // 4. Return clean, user-friendly success response
    return res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      data: {
        id: feedback._id,
        category: feedback.category,
        rating: feedback.rating,
      },
    });
  } catch (err) {
    console.error("❌ Feedback submission error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to submit feedback at this time. Please try again later.",
    });
  }
};

/**
 * @desc    Get all feedback (Admin)
 * @route   GET /api/feedback
 * @access  Private/Admin
 */
exports.getAllFeedback = async (req, res) => {
  try {
    const feedbackList = await Feedback.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: feedbackList.length,
      data: feedbackList,
    });
  } catch (err) {
    console.error("❌ Get feedback error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve feedback records.",
    });
  }
};
