// backend/services/geminiClient.js
const { GoogleGenAI, Type } = require("@google/genai");
const env = require("../config/env");

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

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
 * Resolves the configured model identifier with fallback.
 */
const getModelName = () => {
  return env.geminiModel || DEFAULT_MODEL;
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
    const parsed = typeof rawMsg === "string" && rawMsg.trim().startsWith("{") ? JSON.parse(rawMsg) : null;
    errorDetail = parsed?.error?.message || rawMsg;
  } catch {
    errorDetail = rawMsg;
  }
  const lower = errorDetail.toLowerCase();
  const logDetail = { status, name: error?.name, message: errorDetail };

  if (
    errorDetail.includes("API key is missing") ||
    errorDetail.includes("GEMINI_API_KEY") ||
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
    (status === 400 && (errorDetail.includes("API key not valid") || errorDetail.includes("API_KEY_INVALID"))) ||
    errorDetail.includes("API_KEY_INVALID")
  ) {
    return {
      bucket: "auth",
      httpStatus: 502,
      message: "AI service authentication failed: Invalid or unauthorized API key",
      logDetail,
    };
  }

  if (
    status === 404 ||
    errorDetail.includes("models/") ||
    errorDetail.includes("not found") ||
    errorDetail.includes("is not supported") ||
    errorDetail.includes("NOT_FOUND")
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
    errorDetail.includes("RESOURCE_EXHAUSTED") ||
    errorDetail.includes("Quota exceeded") ||
    errorDetail.includes("rate limit")
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
    errorDetail.includes("UNAVAILABLE") ||
    errorDetail.includes("INTERNAL") ||
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
  timeoutMs = 25000,
  logger = console,
}) => {
  if (!client) {
    const err = new Error("AI service configuration error: API key is missing");
    err.status = 500;
    throw err;
  }

  let usedModel = model || getModelName();

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

      if (isNewUserDeprecation && usedModel !== FALLBACK_MODEL) {
        const originalModel = usedModel;
        usedModel = FALLBACK_MODEL;
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
  getGeminiClient,
  resetGeminiClient,
  getModelName,
  cleanMarkdownFences,
  classifyGeminiError,
  generateContentWithFallback,
};
