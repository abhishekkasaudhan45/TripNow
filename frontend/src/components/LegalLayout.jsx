import { Link } from "react-router-dom";

// Shared shell for the Privacy Policy and Terms pages.
// NOTE: These documents are a solid, honest starting point tailored to what
// TripNow actually does. Have them reviewed against the laws of your
// jurisdiction before relying on them commercially.
function LegalLayout({ title, updated, children }) {
  return (
    <section className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-100 to-blue-50 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/60 bg-white/70 p-8 shadow-xl backdrop-blur md:p-12">
        <Link to="/" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
          ← Back to TripNow
        </Link>

        <h1 className="mt-6 font-serif text-3xl font-extrabold text-slate-900 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>

        <div className="legal-prose mt-8 space-y-6 text-slate-700 leading-relaxed">
          {children}
        </div>
      </div>

      <style>{`
        .legal-prose h2 { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin-top: 1.25rem; }
        .legal-prose p { margin-top: 0.5rem; }
        .legal-prose ul { list-style: disc; padding-left: 1.4rem; margin-top: 0.5rem; }
        .legal-prose li { margin-top: 0.3rem; }
        .legal-prose a { color: #d97706; font-weight: 600; }
      `}</style>
    </section>
  );
}

export default LegalLayout;
