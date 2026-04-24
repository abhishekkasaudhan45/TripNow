import { useParams, useNavigate } from "react-router-dom";

function Booking() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-6">
      <div className="glass-card p-8 rounded-xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Ready to Plan?</h1>
        <p className="text-gray-400 mb-6">Let's customize your perfect itinerary.</p>
        
        <button
          onClick={() => navigate(`/plan-trip/${id || 1}`)}
          className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 rounded-xl text-black font-bold shadow-lg hover:scale-105 transition-all"
        >
          Continue to Planner →
        </button>
      </div>
    </div>
  );
}

export default Booking;