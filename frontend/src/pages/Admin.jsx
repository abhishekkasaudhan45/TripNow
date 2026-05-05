import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import BookingsTable from "../components/admin/BookingsTable";
import Button from "../components/ui/Button";
import FeedbackMessage from "../components/ui/FeedbackMessage";
import Pagination from "../components/ui/Pagination";
import { getAdminBookings } from "../services/bookingService";

const PAGE_SIZE = 6;
const DEFAULT_PAGINATION = { page:1, total:0, totalPages:1, limit:PAGE_SIZE };

// ✅ FIX: Read from localStorage (consistent with Login.jsx and api.js)
const getStoredToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};
const clearStoredToken = () => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1);

  const [reloadToken, setReloadToken] = useState(0);
  const [token, setToken]             = useState(getStoredToken);
  const [bookings, setBookings]       = useState([]);
  const [pagination, setPagination]   = useState(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState("");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const load = async () => {
      setIsLoading(true); setError("");
      try {
        const res = await getAdminBookings(token, { page, limit: PAGE_SIZE });
        setBookings(res.data.data || []);
        setPagination(res.data.meta || { ...DEFAULT_PAGINATION, page });
      } catch (err) {
        if (err?.response?.status === 401) {
          clearStoredToken(); setToken(""); navigate("/login"); return;
        }
        setError(getErrorMessage(err, "Unable to load bookings. Please try again."));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [page, reloadToken, token, navigate]);

  const handlePageChange = (next) => {
    if (next < 1 || next > pagination.totalPages) return;
    setSearchParams({ page: String(next) });
  };

  const handleLogout = () => {
    clearStoredToken(); setToken(""); navigate("/login");
  };

  const loadingRows = Array.from({ length: 5 }, (_, i) => i);

  return (
    <section className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="glass-card p-6 rounded-2xl mb-10 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-bold text-2xl shadow-lg">A</div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome back, Admin</h2>
              <p className="text-gray-400 text-sm">Review and manage platform reservations</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white px-6 py-2.5 rounded-full font-bold transition duration-300 shadow-md">
            Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-6 sm:grid-cols-3 mb-10">
          {[
            { label:"Total Bookings", value: pagination.total },
            { label:"Current Page",   value: pagination.page },
            { label:"Page Size",      value: pagination.limit },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">{s.label}</p>
              <p className="mt-3 text-4xl font-bold text-amber-400">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-5 md:flex-row md:items-center md:justify-between bg-black/20">
            <div>
              <h2 className="text-xl font-semibold text-white">Recent bookings</h2>
              <p className="mt-1 text-sm text-gray-400">Sorted by newest first.</p>
            </div>
            {!isLoading && !error && bookings.length > 0 && (
              <p className="text-sm text-amber-400 font-medium bg-amber-400/10 px-4 py-1.5 rounded-full border border-amber-400/20">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            )}
          </div>

          {isLoading && (
            <div className="p-6">
              <div className="hidden divide-y divide-white/5 md:block">
                {loadingRows.map(r => (
                  <div key={r} className="grid grid-cols-5 gap-4 py-4">
                    {loadingRows.map(c => <div key={c} className="h-5 animate-pulse rounded bg-white/10" />)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="space-y-4 p-6">
              <FeedbackMessage message={error} />
              <Button onClick={() => setReloadToken(t => t+1)} className="bg-amber-500 text-black px-4 py-2 font-bold rounded-lg hover:scale-105 transition">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && bookings.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-lg">No bookings available yet.</div>
          )}

          {!isLoading && !error && bookings.length > 0 && (
            <div className="p-2">
              <BookingsTable bookings={bookings} />
              <div className="p-4 flex justify-center">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pagination.limit}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Admin;