import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../layouts/Header";
import DestinationCard from "../components/DestinationCard";
import destinations from "../utils/destinations";
import useReveal from "../utils/useReveal";

function Home() {
  useReveal();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    destination: "",
    checkin: "",
    checkout: "",
    budget: "",
  });

  const handlePlan = () => {
    if (!form.destination || !form.checkin || !form.checkout || !form.budget) {
      alert("Please fill all fields ❗");
      return;
    }

    navigate("/plan-trip", { state: form });
  };

  return (
    <>
      <Header />

      {/* HERO */}
      <section className="h-screen flex items-center justify-center text-center relative">

        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470')",
          }}
        />
        <div className="absolute inset-0 bg-black/60" />

        {/* Content - 🛠️ Expanded max-w-6xl so the 5xl form fits perfectly */}
        <div className="relative z-10 w-full max-w-6xl px-4">

          <h1 className="text-5xl md:text-6xl font-bold text-white">
            Plan Your <span className="text-amber-400">Dream Trip</span>
          </h1>

          <p className="mt-4 text-gray-300">
            AI-powered travel planning for modern explorers
          </p>

          {/* 🔥 PROFESSIONAL AI PLANNER */}
          <div className="mt-10 w-full max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-xl text-left">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                {/* Destination */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-300 mb-1 font-medium">Destination</label>
                  <input
                    placeholder="Where to go?"
                    className="p-3 rounded-lg bg-white/10 text-white outline-none border border-white/10 focus:border-amber-400 focus:bg-white/20 transition"
                    onChange={(e) =>
                      setForm({ ...form, destination: e.target.value })
                    }
                  />
                </div>

                {/* Check-in */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-300 mb-1 font-medium">Check-in</label>
                  <input
                    type="date"
                    className="p-3 rounded-lg bg-white/10 text-white outline-none border border-white/10 focus:border-amber-400 focus:bg-white/20 transition [color-scheme:dark]"
                    onChange={(e) =>
                      setForm({ ...form, checkin: e.target.value })
                    }
                  />
                </div>

                {/* Check-out */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-300 mb-1 font-medium">Check-out</label>
                  <input
                    type="date"
                    className="p-3 rounded-lg bg-white/10 text-white outline-none border border-white/10 focus:border-amber-400 focus:bg-white/20 transition [color-scheme:dark]"
                    onChange={(e) =>
                      setForm({ ...form, checkout: e.target.value })
                    }
                  />
                </div>

                {/* Budget */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-300 mb-1 font-medium">Budget</label>
                  <input
                    placeholder="₹ Budget"
                    className="p-3 rounded-lg bg-white/10 text-white outline-none border border-white/10 focus:border-amber-400 focus:bg-white/20 transition"
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                  />
                </div>

                {/* Button */}
                <div className="flex items-end">
                  <button
                    onClick={handlePlan}
                    className="w-full h-[48px] bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold rounded-lg shadow-lg hover:scale-105 active:scale-95 transition duration-300"
                  >
                    AI Planner 🚀
                  </button>
                </div>

              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="py-20 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto">

          <h2 className="text-3xl font-bold mb-10 text-center text-white">
            Featured Destinations
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {destinations.map((item) => (
              <DestinationCard key={item.id} destination={item} />
            ))}
          </div>

        </div>
      </section>
    </>
  );
}

export default Home;