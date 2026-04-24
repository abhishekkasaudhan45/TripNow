import { useEffect, useState } from "react";
import api from "../lib/api";

function Dashboard() {
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await api.get("/api/bookings");
        setTrips(res.data.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchTrips();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">

      <h1 className="text-3xl mb-6">✨ Your Saved Trips</h1>

      <div className="grid md:grid-cols-2 gap-6">

        {trips.map((trip) => (
          <div
            key={trip._id}
            className="bg-white/10 p-6 rounded-xl border border-white/20"
          >
            <h2 className="text-lg font-bold mb-2">
              {trip.destination}
            </h2>

            <pre className="text-sm text-gray-300 whitespace-pre-wrap">
              {trip.aiPlan}
            </pre>
          </div>
        ))}

      </div>

    </div>
  );
}

export default Dashboard;