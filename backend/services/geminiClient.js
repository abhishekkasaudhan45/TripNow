// backend/services/geminiClient.js
const { GoogleGenAI, Type } = require("@google/genai");
const env = require("../config/env");

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_TIMEOUT_MS =
  Number(process.env.AI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS) || 60000;

let cachedClient = null;
let lastApiKey = null;

/**
 * Returns a configured GoogleGenAI instance.
 * Uses lazy singleton caching in production; instantiates fresh in tests or when requested
 * so Jest per-test mock implementations are seamlessly respected.
 */
const getGeminiClient = (options = {}) => {
  const apiKey = options.apiKey !== undefined ? options.apiKey : env.geminiApiKey;
  if (!apiKey) {
    return null;
  }

  const isTest = process.env.NODE_ENV === "test";
  if (!isTest && !options.fresh && cachedClient && lastApiKey === apiKey) {
    return cachedClient;
  }

  const client = new GoogleGenAI({ apiKey });
  if (!isTest && !options.fresh) {
    cachedClient = client;
    lastApiKey = apiKey;
  }
  return client;
};

/**
 * Resets the cached singleton client (useful for testing).
 */
const resetGeminiClient = () => {
  cachedClient = null;
  lastApiKey = null;
};

/**
 * Resolves the primary configured model identifier.
 */
const getModelName = () => {
  return env.geminiModel || process.env.GEMINI_MODEL || DEFAULT_MODEL;
};

/**
 * Resolves the fallback configured model identifier.
 */
const getFallbackModelName = () => {
  return (
    env.geminiFallbackModel ||
    process.env.GEMINI_FALLBACK_MODEL ||
    FALLBACK_MODEL
  );
};

/**
 * Cleans markdown code fences from AI responses.
 */
const cleanMarkdownFences = (text = "") => {
  if (typeof text !== "string") return "";
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
};

/**
 * Classifies a Gemini API error into stable operational buckets
 * without leaking raw keys, endpoints, or stack traces.
 */
const classifyGeminiError = (error) => {
  const status =
    error?.status ||
    error?.statusCode ||
    error?.code ||
    error?.response?.status ||
    error?.cause?.status;

  const rawMsg = error?.message || "";
  let errorDetail = rawMsg;
  try {
    const parsed =
      typeof rawMsg === "string" && rawMsg.trim().startsWith("{")
        ? JSON.parse(rawMsg)
        : null;
    errorDetail = parsed?.error?.message || rawMsg;
  } catch {
    errorDetail = rawMsg;
  }

  // Redact potential API keys or sensitive query parameters from log details
  const sanitizedMessage =
    typeof errorDetail === "string"
      ? errorDetail
          .replace(/key=[a-zA-Z0-9_\-\.]+/gi, "key=[REDACTED]")
          .replace(/AIza[a-zA-Z0-9_\-]{35}/g, "[REDACTED_API_KEY]")
      : String(errorDetail);

  const lower = sanitizedMessage.toLowerCase();
  const logDetail = { status, name: error?.name, message: sanitizedMessage };

  if (
    sanitizedMessage.includes("API key is missing") ||
    sanitizedMessage.includes("GEMINI_API_KEY") ||
    error?.code === "CONFIG_ERROR"
  ) {
    return {
      bucket: "config_error",
      httpStatus: 500,
      message: "AI service configuration error: API key is missing",
      logDetail,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    (status === 400 &&
      (sanitizedMessage.includes("API key not valid") ||
        sanitizedMessage.includes("API_KEY_INVALID"))) ||
    sanitizedMessage.includes("API_KEY_INVALID")
  ) {
    return {
      bucket: "auth",
      httpStatus: 502,
      message: "AI service authentication failed: Invalid or unauthorized API key",
      logDetail,
    };
  }

  // 🛡️ Candidate Safety & Recitation Blocks (HTTP 422)
  if (
    error?.finishReason === "SAFETY" ||
    error?.finishReason === "RECITATION" ||
    lower.includes("safety") ||
    lower.includes("finish_reason is safety") ||
    lower.includes("finish_reason is recitation") ||
    lower.includes("blocked due to safety") ||
    lower.includes("recitation")
  ) {
    return {
      bucket: "safety_blocked",
      httpStatus: 422,
      message: "AI content safety check flagged the itinerary prompt. Please refine your travel query.",
      logDetail,
    };
  }

  // 📋 Client Validation / Bad Arguments (HTTP 400)
  if (
    status === 400 ||
    sanitizedMessage.includes("INVALID_ARGUMENT") ||
    lower.includes("bad request")
  ) {
    return {
      bucket: "invalid_argument",
      httpStatus: 400,
      message: "Invalid travel request parameters provided to AI service.",
      logDetail,
    };
  }

  if (
    status === 404 ||
    sanitizedMessage.includes("models/") ||
    sanitizedMessage.includes("not found") ||
    sanitizedMessage.includes("is not supported") ||
    sanitizedMessage.includes("NOT_FOUND")
  ) {
    return {
      bucket: "model_unavailable",
      httpStatus: 502,
      message: "AI service model configuration error: Configured model is unavailable",
      logDetail,
    };
  }

  if (
    status === 429 ||
    sanitizedMessage.includes("RESOURCE_EXHAUSTED") ||
    sanitizedMessage.includes("Quota exceeded") ||
    sanitizedMessage.includes("rate limit")
  ) {
    return {
      bucket: "rate_limited",
      httpStatus: 429,
      message: "AI service rate limit reached. Please try again in a few moments.",
      logDetail,
    };
  }

  if (
    status === 504 ||
    error?.name === "AbortError" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "ECONNABORTED" ||
    error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.cause?.name === "ConnectTimeoutError" ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("fetch failed")
  ) {
    return {
      bucket: "timeout",
      httpStatus: 504,
      message: "AI service request timed out. Please try again.",
      logDetail,
    };
  }

  if (
    status === 500 ||
    status === 503 ||
    sanitizedMessage.includes("UNAVAILABLE") ||
    sanitizedMessage.includes("INTERNAL") ||
    lower.includes("overloaded") ||
    lower.includes("internal error")
  ) {
    return {
      bucket: "upstream_unavailable",
      httpStatus: 503,
      message: "AI service is temporarily overloaded. Please try again in a moment.",
      logDetail,
    };
  }

  return {
    bucket: "unclassified",
    httpStatus: 502,
    message: "AI service error: Unable to generate itinerary at this time. Please try again.",
    logDetail,
  };
};

/**
 * Executes a Gemini content generation call with bounded timeout and model fallback.
 */
const generateContentWithFallback = async ({
  client,
  model,
  contents,
  config,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  logger = console,
}) => {
  if (!client) {
    const err = new Error("AI service configuration error: API key is missing");
    err.status = 500;
    throw err;
  }

  let usedModel = model || getModelName();
  const fallbackModel = getFallbackModelName();

  const requestPromise = (async () => {
    try {
      return await client.models.generateContent({
        model: usedModel,
        contents,
        config,
      });
    } catch (primaryErr) {
      const msg = primaryErr.message || "";
      const isNewUserDeprecation =
        primaryErr.status === 404 &&
        msg.toLowerCase().includes("no longer available to new users");

      if (isNewUserDeprecation && usedModel !== fallbackModel) {
        const originalModel = usedModel;
        usedModel = fallbackModel;
        logger.warn(
          `⚠️ Model '${originalModel}' is no longer available to new users. Falling back to Google AI Studio recommended '${usedModel}'...`
        );
        return await client.models.generateContent({
          model: usedModel,
          contents,
          config,
        });
      }
      throw primaryErr;
    }
  })();

  let timeoutTimer;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimer = setTimeout(() => {
      const err = new Error("AI service request timed out");
      err.name = "AbortError";
      err.status = 504;
      reject(err);
    }, timeoutMs);
    if (timeoutTimer.unref) timeoutTimer.unref();
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutTimer);
  }
};

module.exports = {
  GoogleGenAI,
  Type,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  DEFAULT_TIMEOUT_MS,
  getGeminiClient,
  resetGeminiClient,
  getModelName,
  getFallbackModelName,
  cleanMarkdownFences,
  classifyGeminiError,
  generateContentWithFallback,
};
