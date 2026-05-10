import React from "react";

export default function MapView({ destination }) {
  // Encode the destination so it works perfectly in the Google Maps URL
  const encodedLocation = encodeURIComponent(destination || "Jaipur");

  return (
    <div
      className="
      overflow-hidden
      rounded-3xl
      border border-white/60
      shadow-xl
      bg-white/70
      backdrop-blur-xl
      "
    >
      {/* HEADER (Upgraded to Creamy White / Gold Theme) */}
      <div
        className="
        p-5
        border-b border-black/5
        bg-gradient-to-r from-amber-500/10 to-red-500/10
        "
      >
        <h2 className="text-gray-900 text-xl font-black font-['Playfair_Display']">
          🗺️ Explore {destination}
        </h2>

        <p className="text-gray-600 text-sm mt-1 font-medium">
          Interactive location preview
        </p>
      </div>

      {/* MAP (Now Fully Responsive for Mobile & Desktop) */}
      <iframe
        title={`Map of ${destination}`}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-[300px] sm:h-[450px] lg:h-[500px]" /* ✅ Responsive Heights */
        style={{ border: 0 }}
        src={`https://maps.google.com/maps?q=${encodedLocation}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
      />
    </div>
  );
}