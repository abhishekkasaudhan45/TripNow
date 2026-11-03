// frontend/src/utils/cookieConsent.js
/**
 * Single source of truth for Cookie Consent management on TripNow.
 * Manages consent persistence, versioning, category enforcement, and UI events.
 */

export const CONSENT_STORAGE_KEY = "tripnow_cookie_consent";
export const CONSENT_POLICY_VERSION = "1.0.0";

export const CONSENT_CATEGORIES = {
  NECESSARY: "necessary",
  ANALYTICS: "analytics",
  MARKETING: "marketing",
};

export const CONSENT_STATUS = {
  ACCEPTED_ALL: "accepted_all",
  REJECTED_OPTIONAL: "rejected_optional",
  CUSTOMIZED: "customized",
};

/**
 * Retrieves the stored consent object from localStorage.
 * Automatically invalidates if the stored version does not match CONSENT_POLICY_VERSION.
 */
export function getStoredConsent() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;

    // Invalidate stale consent if the policy version has bumped
    if (data.version !== CONSENT_POLICY_VERSION) {
      return null;
    }

    return {
      version: data.version,
      timestamp: data.timestamp,
      status: data.status,
      categories: {
        necessary: true, // Strictly necessary is always true
        analytics: Boolean(data.categories?.analytics),
        marketing: Boolean(data.categories?.marketing),
      },
    };
  } catch (_) {
    return null;
  }
}

/**
 * Returns true if the user has an active, valid consent choice.
 */
export function hasUserConsented() {
  return getStoredConsent() !== null;
}

/**
 * Persists the user's consent choice to localStorage and broadcasts a change event.
 */
export function saveConsentPreferences({ status, analytics = false, marketing = false }) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const consentRecord = {
    version: CONSENT_POLICY_VERSION,
    timestamp: new Date().toISOString(),
    status: status || CONSENT_STATUS.CUSTOMIZED,
    categories: {
      necessary: true,
      analytics: Boolean(analytics),
      marketing: Boolean(marketing),
    },
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentRecord));
  } catch (err) {
    console.warn("Unable to save cookie consent to localStorage:", err);
  }

  // Broadcast event so active listeners can immediately apply changes
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent("tripnow-consent-updated", { detail: consentRecord })
    );
  }

  return consentRecord;
}

/**
 * Convenience helper to accept all categories.
 */
export function acceptAllCookies() {
  return saveConsentPreferences({
    status: CONSENT_STATUS.ACCEPTED_ALL,
    analytics: true,
    marketing: true,
  });
}

/**
 * Convenience helper to reject all optional categories (strictly necessary remains active).
 */
export function rejectOptionalCookies() {
  return saveConsentPreferences({
    status: CONSENT_STATUS.REJECTED_OPTIONAL,
    analytics: false,
    marketing: false,
  });
}

/**
 * Dispatches an event to open the Cookie Preferences modal.
 */
export function openCookiePreferences() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("tripnow-open-cookie-preferences"));
  }
}

/**
 * Checks if a specific cookie category is currently consented to.
 */
export function isConsentCategoryAllowed(category) {
  if (category === CONSENT_CATEGORIES.NECESSARY) return true;
  const consent = getStoredConsent();
  if (!consent) return false;
  return Boolean(consent.categories?.[category]);
}

