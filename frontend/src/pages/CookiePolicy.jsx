import React from "react";
import LegalLayout from "../components/LegalLayout";
import { openCookiePreferences } from "../utils/cookieConsent";

function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy" updated="November 1, 2026">
      <p>
        This Cookie Policy explains how TripNow (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) uses
        cookies and similar browser storage technologies when you access our AI-powered travel planning
        service at <a href="https://tripnow.abhishektech.me">tripnow.abhishektech.me</a>. We believe in complete
        transparency: we do not sell your personal data, and we do not deploy invasive advertising or tracking cookies.
      </p>

      <h2>1. What are cookies and browser storage?</h2>
      <p>
        Cookies are small text files that a website stores on your computer or mobile device when you visit.
        They allow the service to recognize your device, maintain your authenticated session, and protect against
        unauthorized requests.
      </p>
      <p>
        In addition to cookies, TripNow utilizes <strong>localStorage</strong>—a standard browser feature that
        stores non-sensitive configuration data (such as your cookie preferences and interface state) directly
        within your browser.
      </p>

      <h2>2. Categories of cookies we use</h2>
      <p>
        TripNow strictly classifies cookies and local storage items into the following categories:
      </p>
      <ul>
        <li>
          <strong>Strictly Necessary:</strong> Essential for the operation of the website, user authentication,
          and security defenses. The service cannot function properly without these.
        </li>
        <li>
          <strong>Analytics &amp; Performance (Optional):</strong> Measures aggregate platform performance to help
          us improve user experience. <em>TripNow does not currently deploy any third-party analytics trackers (such as Google Analytics or Mixpanel).</em>
        </li>
        <li>
          <strong>Marketing &amp; Social (Optional):</strong> Used to track visitors across websites for targeted advertising.
          <em>TripNow does not use any advertising or marketing cookies (such as Meta Pixel or Google Ads).</em>
        </li>
      </ul>

      <h2>3. Complete inventory of cookies and local storage</h2>
      <p>
        The following table outlines all cookies and storage keys utilized by TripNow:
      </p>

      <div className="overflow-x-auto my-4">
        <table className="w-full text-left text-xs sm:text-sm border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="p-2.5 border border-slate-200 font-semibold">Identifier</th>
              <th className="p-2.5 border border-slate-200 font-semibold">Type</th>
              <th className="p-2.5 border border-slate-200 font-semibold">Classification</th>
              <th className="p-2.5 border border-slate-200 font-semibold">Duration</th>
              <th className="p-2.5 border border-slate-200 font-semibold">Purpose &amp; Security Attributes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-slate-50/50">
              <td className="p-2.5 border border-slate-200 font-mono text-amber-700 font-semibold">token</td>
              <td className="p-2.5 border border-slate-200">HttpOnly Cookie</td>
              <td className="p-2.5 border border-slate-200 font-semibold text-emerald-700">Strictly Necessary</td>
              <td className="p-2.5 border border-slate-200">2 Hours</td>
              <td className="p-2.5 border border-slate-200">
                JWT session authentication token. Configured with <code>HttpOnly</code> (inaccessible to JavaScript,
                protecting against XSS), <code>SameSite=Lax</code> (protecting against CSRF), and <code>Secure</code> in production.
              </td>
            </tr>
            <tr className="hover:bg-slate-50/50">
              <td className="p-2.5 border border-slate-200 font-mono text-amber-700 font-semibold">tripnow_cookie_consent</td>
              <td className="p-2.5 border border-slate-200">Local Storage</td>
              <td className="p-2.5 border border-slate-200 font-semibold text-emerald-700">Strictly Necessary</td>
              <td className="p-2.5 border border-slate-200">Persistent</td>
              <td className="p-2.5 border border-slate-200">
                Stores your cookie consent preferences, policy version (<code>1.0.0</code>), and timestamp so you are not prompted repeatedly.
              </td>
            </tr>
            <tr className="hover:bg-slate-50/50">
              <td className="p-2.5 border border-slate-200 font-mono text-amber-700 font-semibold">user</td>
              <td className="p-2.5 border border-slate-200">Local Storage</td>
              <td className="p-2.5 border border-slate-200 font-semibold text-emerald-700">Strictly Necessary</td>
              <td className="p-2.5 border border-slate-200">Persistent</td>
              <td className="p-2.5 border border-slate-200">
                Caches non-sensitive account metadata (ID, display name, email, avatar URL, role) to populate UI navigation without redundant API round-trips.
              </td>
            </tr>
            <tr className="hover:bg-slate-50/50">
              <td className="p-2.5 border border-slate-200 font-mono text-amber-700 font-semibold">selectedDestinationId</td>
              <td className="p-2.5 border border-slate-200">Local Storage</td>
              <td className="p-2.5 border border-slate-200 font-semibold text-emerald-700">Strictly Necessary</td>
              <td className="p-2.5 border border-slate-200">Session/Local</td>
              <td className="p-2.5 border border-slate-200">
                Remembers the user&apos;s selected destination card during trip creation to restore form context.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 italic">
        Note: CSRF security tokens on TripNow are stored purely in-memory and are never written to cookies or browser storage.
      </p>

      <h2>4. Third-party integrations &amp; external scripts</h2>
      <p>TripNow integrates with a minimal set of external service providers to deliver our core features:</p>
      <ul>
        <li>
          <strong>Google Identity Services (GIS):</strong> When using Google Sign-In, the official Google client library
          (<code>https://accounts.google.com/gsi/client</code>) is loaded to display the Google authentication prompt.
          Google may process technical identifiers under its own privacy policies.
        </li>
        <li>
          <strong>EmailJS:</strong> When submitting feedback or contact messages in the footer, the EmailJS client SDK is loaded
          on demand to route user messages directly to our inbox.
        </li>
        <li>
          <strong>Cloudinary:</strong> Stores and serves uploaded trip cover photos. Images are delivered via CDN and do not set tracking cookies.
        </li>
        <li>
          <strong>Google Gemini:</strong> Our AI itinerary generation runs server-to-server. No client-side Google AI cookies or trackers are placed in your browser.
        </li>
      </ul>

      <h2>5. How to manage or change your cookie preferences</h2>
      <p>
        You have complete control over optional cookie categories on TripNow. You can review or modify your consent settings at any time:
      </p>

      <div className="my-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-amber-900 m-0">TripNow Consent Manager</h3>
          <p className="text-xs text-amber-800 m-0 mt-1">
            Open the preferences dialog to inspect categories, toggle optional choices, or revoke prior consent.
          </p>
        </div>
        <button
          type="button"
          onClick={openCookiePreferences}
          className="whitespace-nowrap px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition-all"
        >
          Manage Cookie Preferences
        </button>
      </div>

      <h2>6. Browser-level cookie controls</h2>
      <p>
        In addition to TripNow&apos;s preference manager, most modern web browsers allow you to manage or block cookies
        through browser settings:
      </p>
      <ul>
        <li>
          <strong>Google Chrome:</strong> Settings &rarr; Privacy and security &rarr; Third-party cookies.
        </li>
        <li>
          <strong>Mozilla Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Enhanced Tracking Protection.
        </li>
        <li>
          <strong>Apple Safari:</strong> Preferences &rarr; Privacy &rarr; Manage Website Data.
        </li>
        <li>
          <strong>Microsoft Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Manage and delete cookies.
        </li>
      </ul>
      <p className="text-sm text-slate-500">
        Please note: Disabling strictly necessary cookies (such as the authentication cookie) will prevent you from signing in or saving itineraries.
      </p>

      <h2>7. Updates to this Cookie Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect operational, legal, or regulatory changes.
        If we introduce new cookie categories or make material changes, we will bump our policy version and present
        a renewed consent prompt upon your next visit.
      </p>

      <h2>8. Contact us</h2>
      <p>
        If you have questions about this Cookie Policy or how we handle your browser data, please contact:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>
      </p>
    </LegalLayout>
  );
}

export default CookiePolicy;

