import axios from "axios";

const baseURL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

const api = axios.create({
  baseURL,
  // ⏱️ 65 seconds: Prevents client abort while Gemini generates multi-day structured plans
  timeout: 65000,
  headers: { "Content-Type": "application/json" },
  // 🔒 Enable cookies for cross-origin / same-site requests
  withCredentials: true,
});

// In-memory CSRF token store (never stored in localStorage or sessionStorage)
let inMemoryCsrfToken = null;
let activeCsrfFetchPromise = null;

/**
 * Retrieves the CSRF token in memory, fetching a fresh one from the server if not present.
 * Deduplicates concurrent calls via a shared promise to prevent race conditions.
 */
export async function getCsrfToken(forceRefresh = false) {
  if (inMemoryCsrfToken && !forceRefresh) {
    return inMemoryCsrfToken;
  }

  if (activeCsrfFetchPromise && !forceRefresh) {
    return activeCsrfFetchPromise;
  }

  activeCsrfFetchPromise = (async () => {
    try {
      const res = await axios.get(`${baseURL}/api/csrf-token`, {
        withCredentials: true,
        timeout: 10000, // 10s safeguard for CSRF handshake
      });
      inMemoryCsrfToken = res.data?.csrfToken || null;
      return inMemoryCsrfToken;
    } catch (err) {
      inMemoryCsrfToken = null;
      return null;
    } finally {
      activeCsrfFetchPromise = null;
    }
  })();

  return activeCsrfFetchPromise;
}

/**
 * Clears the cached CSRF token (called during logout or login transitions).
 */
export function clearCsrfToken() {
  inMemoryCsrfToken = null;
  activeCsrfFetchPromise = null;
}

// Request Interceptor: Attach X-CSRF-Token to mutating HTTP methods
api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();

  // Safe HTTP methods do NOT require a CSRF token
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return config;
  }

  // Mutating methods (POST, PUT, PATCH, DELETE): acquire and attach token
  try {
    const token = await getCsrfToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers["X-CSRF-Token"] = token;
    }
  } catch (_) {
    // If token fetch fails, continue and allow backend to return appropriate status
  }

  return config;
});

// Response Interceptor: Invalidate token on auth changes & auto-retry on CSRF rejection
api.interceptors.response.use(
  (response) => {
    // When authentication state changes (login/signup/google), invalidate cached token
    const url = response.config?.url || "";
    if (
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/signup") ||
      url.includes("/api/auth/logout") ||
      url.includes("/api/auth/google")
    ) {
      clearCsrfToken();
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Auto-retry once if backend rejected due to stale/missing CSRF token
    if (
      error.response?.status === 403 &&
      error.response?.data?.code?.startsWith("CSRF_TOKEN") &&
      originalRequest &&
      !originalRequest._retryCsrf
    ) {
      originalRequest._retryCsrf = true;
      try {
        const freshToken = await getCsrfToken(true);
        if (freshToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["X-CSRF-Token"] = freshToken;
          return api(originalRequest);
        }
      } catch (_) { }
    }

    return Promise.reject(error);
  }
);

export default api;