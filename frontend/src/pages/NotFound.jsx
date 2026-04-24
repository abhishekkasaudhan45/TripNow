import { Link } from "react-router-dom";

function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center text-center text-white">
      <h1 className="mb-4 text-6xl md:text-8xl font-bold text-amber-400">404</h1>
      <h2 className="mb-4 text-2xl md:text-3xl font-semibold">Page Not Found 😢</h2>
      <p className="mb-8 text-gray-400">Oops! The route you are looking for doesn't exist or has been moved.</p>
      
      <Link
        to="/"
        className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-8 py-3 font-bold text-black transition-all hover:scale-105 shadow-lg shadow-amber-400/20"
      >
        Return Home
      </Link>
    </section>
  );
}

export default NotFound;