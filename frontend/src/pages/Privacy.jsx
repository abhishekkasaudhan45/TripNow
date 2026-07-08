import LegalLayout from "../components/LegalLayout";

function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 6, 2026">
      <p>
        This Privacy Policy explains what information TripNow ("we", "us") collects when you
        use our AI travel-planning service, how we use it, and the choices you have. By using
        TripNow you agree to the practices described here.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name and email address when you sign up.</li>
        <li><strong>Password:</strong> stored only as a secure one-way hash — we never see or store your plain-text password.</li>
        <li><strong>Trip data:</strong> the destinations, dates, budgets, and preferences you enter to generate itineraries, and the itineraries you save.</li>
        <li><strong>Feedback:</strong> any rating or message you submit through our feedback form.</li>
        <li><strong>Basic technical data:</strong> standard server logs such as IP address, used for security and rate limiting.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and secure your account and authenticate you.</li>
        <li>To generate, save, and display your travel itineraries.</li>
        <li>To protect the service from abuse (for example, rate limiting the AI endpoint).</li>
        <li>To respond to feedback and improve the product.</li>
      </ul>

      <h2>3. Third-party services</h2>
      <p>We rely on a small number of trusted providers to run TripNow:</p>
      <ul>
        <li><strong>Groq</strong> — processes your trip prompts to generate itineraries.</li>
        <li><strong>MongoDB Atlas</strong> — stores your account and trip data.</li>
        <li><strong>Vercel</strong> and <strong>Render</strong> — host the app and API.</li>
        <li><strong>EmailJS</strong> — delivers feedback-form messages.</li>
      </ul>
      <p>We do not sell your personal data to anyone.</p>

      <h2>4. Data retention</h2>
      <p>
        We keep your account and trip data for as long as your account is active. You can ask us
        to delete your account and associated data at any time (see Contact below).
      </p>

      <h2>5. Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data. To exercise
        these rights, contact us using the details below.
      </p>

      <h2>6. Children</h2>
      <p>TripNow is not directed to children under 13, and we do not knowingly collect their data.</p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be reflected by the
        "Last updated" date at the top of this page.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions or requests? Email <a href="mailto:kasaudhan622@gmail.com">kasaudhan622@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}

export default Privacy;
