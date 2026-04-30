import { useNavigate } from "react-router-dom";

function DestinationCard({ destination }) {
  const navigate = useNavigate();

const handleBooking = () => {
  localStorage.setItem("selectedDestinationId", destination.id);
  navigate("/plan-trip", {
  state: {
    destination: destination.name,
    budget: destination.price,
    checkin: "2026-05-01",   // temporary or dynamic
    checkout: "2026-05-03"
  }
});
};

  return (  
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg 
    group transition duration-500 hover:scale-105 hover:shadow-2xl">

      <div className="overflow-hidden">
        <img
          src={destination.image}
          alt={destination.name}
          className="h-60 w-full object-cover transition duration-500 group-hover:scale-110"
        />
      </div>

      <div className="p-5">
        <h3 className="text-xl font-semibold text-white">
          {destination.name}
        </h3>

        <p className="text-gray-400 mt-2">
          {destination.description}
        </p>

        <div className="flex justify-between items-center mt-4">

          <span className="text-amber-400 font-bold text-lg">
            {destination.price}
          </span>

          <button
            onClick={handleBooking}
            className="bg-gradient-to-r from-amber-400 to-yellow-500 
            text-black px-4 py-2 rounded-lg font-semibold 
            hover:scale-110 transition"
          >
            ✈️ Book Now
          </button>

        </div>
      </div>
    </div>
  );
}

export default DestinationCard;