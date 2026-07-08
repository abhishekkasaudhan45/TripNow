import LegalLayout from "../components/LegalLayout";

function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="July 6, 2026">
      <p>
        These Terms govern your use of TripNow. By creating an account or using the service, you
        agree to these Terms. If you do not agree, please do not use TripNow.
      </p>

      <h2>1. The service</h2>
      <p>
        TripNow uses AI to generate suggested travel itineraries, budgets, and recommendations.
        It is a planning aid provided for your convenience.
      </p>

      <h2>2. AI-generated content — no guarantees</h2>
      <p>
        Itineraries are generated automatically and may be inaccurate, incomplete, or out of date.
        Prices, opening hours, availability, travel requirements, and safety conditions change
        constantly. Always verify important details (bookings, visas, transport, local laws) with
        official sources before you travel. You use AI suggestions at your own risk.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password confidential.</li>
        <li>You are responsible for activity that happens under your account.</li>
        <li>You must be old enough to form a binding contract in your country.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Abuse, overload, or attempt to bypass rate limits on the service or its AI endpoint.</li>
        <li>Attempt to access other users' data or the admin area without authorization.</li>
        <li>Use the service for any unlawful purpose or to generate harmful content.</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        The TripNow name, design, and code belong to us. Itineraries you generate are yours to use
        for your personal travel planning.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        TripNow is provided "as is" without warranties of any kind. To the maximum extent permitted
        by law, we are not liable for any loss or damage arising from your use of the service or
        reliance on AI-generated suggestions.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms or abuse the service. You may
        stop using TripNow and request account deletion at any time.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms; the "Last updated" date reflects the latest version. Continued
        use after changes means you accept the updated Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms? Email <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}

export default Terms;
