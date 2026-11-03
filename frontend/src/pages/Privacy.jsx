import React from "react";
import LegalLayout from "../components/LegalLayout";
import { Link } from "react-router-dom";

function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="November 1, 2026">
      <p>
        This Privacy Policy explains how TripNow (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects,
        uses, stores, and protects personal information when you access or use our travel planning platform
        at <a href="https://tripnow.abhishektech.me">tripnow.abhishektech.me</a>.
      </p>
      <p>
        Your privacy is paramount. We adhere to a strict principle of data minimization: we only collect information
        strictly necessary to deliver AI-powered travel itineraries, secure your account, and operate the service.
        We do not sell, rent, or monetize your personal data.
      </p>

      <h2>1. Information we collect</h2>
      <p>Depending on how you interact with TripNow, we collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account &amp; Profile Details:</strong> When you register via email, we collect your name and email address.
          If you sign in using <em>Google Sign-In</em>, we receive your verified email address, full name, Google account identifier,
          and public avatar picture URL from Google Identity Services.
        </li>
        <li>
          <strong>Credentials:</strong> For email/password accounts, your password is encrypted using the <code>bcrypt</code> one-way
          hashing algorithm with 10 salt rounds prior to database persistence. We never store or have access to plain-text passwords.
          Google Sign-In accounts do not have passwords stored on our servers.
        </li>
        <li>
          <strong>Trip &amp; Itinerary Data:</strong> When you generate or save trips, we store your travel parameters (destination,
          dates, traveler count, budget tier, travel style, interests), AI-generated itineraries, custom notes, locked activities,
          and adaptive pivot changes.
        </li>
        <li>
          <strong>Media Uploads:</strong> If you upload a custom cover photo for an itinerary, the image file is uploaded directly
          to our Cloudinary CDN storage and associated with your trip record.
        </li>
        <li>
          <strong>Feedback &amp; Inquiries:</strong> Any feedback, star ratings, or messages submitted through our feedback form
          or direct email correspondence.
        </li>
        <li>
          <strong>Technical &amp; Security Logs:</strong> Standard web server logs including your IP address, browser user-agent,
          HTTP request timestamps, and rate-limiting metadata used exclusively to defend against malicious traffic and brute-force attacks.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <p>We process your data exclusively for the following legitimate product functions:</p>
      <ul>
        <li>
          <strong>Authentication &amp; Account Security:</strong> To verify your identity, maintain authenticated sessions via
          HttpOnly cookies, protect against Cross-Site Request Forgery (CSRF), and safeguard user accounts.
        </li>
        <li>
          <strong>AI Travel Planning:</strong> To prompt the Google Gemini API with your destination and preferences to construct
          personalized daily schedules, budget breakdowns, and recommendations.
        </li>
        <li>
          <strong>Itinerary Persistence &amp; Sharing:</strong> To store your trips in our MongoDB Atlas database, synchronize
          edits across devices, and generate secure read-only links when you choose to share a trip.
        </li>
        <li>
          <strong>Abuse Prevention &amp; Rate Limiting:</strong> To protect public endpoints against automated scraping, denial of
          service, or unauthorized resource exhaustion.
        </li>
        <li>
          <strong>Product Support &amp; Feedback:</strong> To review user ratings and resolve reported bugs.
        </li>
      </ul>

      <h2>3. Third-party service providers &amp; data sharing</h2>
      <p>
        We do not sell your personal data. We disclose information only to a carefully selected group of infrastructure
        and service providers strictly required to operate TripNow:
      </p>
      <ul>
        <li>
          <strong>Google Gemini AI:</strong> Processes trip planning prompts (destinations, dates, budgets, traveler preferences)
          to synthesize itineraries. We never transmit passwords, authentication cookies, or unrelated personal identifiers to the Gemini API.
        </li>
        <li>
          <strong>MongoDB Atlas:</strong> Provides cloud database hosting with encryption at rest and in transit (TLS) for user
          accounts and saved itineraries.
        </li>
        <li>
          <strong>Cloudinary:</strong> Provides media storage and CDN optimization for user-uploaded trip cover photos.
        </li>
        <li>
          <strong>Google Identity Services:</strong> Provides OAuth 2.0 / OpenID Connect authentication when you choose to sign in
          with Google.
        </li>
        <li>
          <strong>EmailJS:</strong> Delivers feedback-form submissions directly to our administration team.
        </li>
        <li>
          <strong>Hosting Infrastructure:</strong> Vercel hosts our frontend client application, and Render hosts our backend API.
        </li>
        <li>
          <strong>Geocoding &amp; Weather:</strong> We query public endpoints from OpenStreetMap (Nominatim) and Open-Meteo for map
          coordinates and weather forecasts. No user accounts or personal identifiers are sent to these services.
        </li>
      </ul>

      <h2>4. Cookies and local storage</h2>
      <p>
        TripNow relies solely on strictly necessary cookies and browser storage essential for security and account functionality.
        Specifically, we issue an <code>HttpOnly</code>, <code>SameSite=Lax</code>, <code>Secure</code> session cookie (<code>token</code>)
        to keep you logged in safely without exposure to client-side scripts.
      </p>
      <p>
        For full technical details on our cookie inventory and how to manage your preferences, please review our dedicated{" "}
        <Link to="/cookies" className="text-amber-600 font-semibold underline hover:text-amber-700">
          Cookie Policy
        </Link>
        .
      </p>

      <h2>5. Security safeguards</h2>
      <p>We implement multi-layered technical and organizational safeguards to protect your personal data:</p>
      <ul>
        <li>All communications between your browser, our API, and external service providers are encrypted via TLS/HTTPS.</li>
        <li>Session tokens are stored exclusively in <code>HttpOnly</code> cookies inaccessible to browser JavaScript, mitigating XSS risks.</li>
        <li>All mutating API requests require session-bound HMAC CSRF validation tokens.</li>
        <li>Helmet HTTP headers enforce strict transport security, frame protection, and content sniffing defenses.</li>
        <li>Passwords are salted and hashed with <code>bcrypt</code> (10 rounds).</li>
        <li>Granular IP-based rate limiters protect authentication, AI generation, and password-reset endpoints against brute-force attacks.</li>
      </ul>

      <h2>6. Data retention and account deletion</h2>
      <p>
        We retain your personal data and itineraries for as long as your account remains active. You may request the export or permanent
        deletion of your account and all associated trip records at any time by contacting us at{" "}
        <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>. Upon receiving your verified request, your personal
        information and saved itineraries will be permanently deleted from our primary databases within 30 days.
      </p>

      <h2>7. Your rights</h2>
      <p>Depending on your jurisdiction, you may have rights regarding your personal information, including:</p>
      <ul>
        <li>The right to access and receive a copy of your personal data.</li>
        <li>The right to rectify inaccurate or incomplete information.</li>
        <li>The right to request erasure of your personal data (&ldquo;right to be forgotten&rdquo;).</li>
        <li>The right to restrict or object to the processing of your data.</li>
        <li>The right to data portability.</li>
      </ul>
      <p>
        To exercise any of these rights, please email us directly at <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>.
      </p>

      <h2>8. Children&apos;s privacy</h2>
      <p>
        TripNow is not directed toward individuals under the age of 13, and we do not knowingly collect personal data from children.
        If we become aware that a child under 13 has provided us with personal information, we will take immediate steps to delete it.
      </p>

      <h2>9. Changes to this Privacy Policy</h2>
      <p>
        We may occasionally update this Privacy Policy to reflect enhancements to our service, legal obligations, or industry practices.
        When changes occur, we will update the &ldquo;Last updated&rdquo; date at the top of this page. Significant modifications will
        be accompanied by a prominent notice on our website.
      </p>

      <h2>10. Contact information</h2>
      <p>
        If you have questions, feedback, or data privacy requests, please contact our privacy administrator:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>
        <br />
        <strong>Service:</strong> TripNow AI Travel Planner
      </p>
    </LegalLayout>
  );
}

export default Privacy;
