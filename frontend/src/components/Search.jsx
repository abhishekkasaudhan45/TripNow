import React, { useEffect, useMemo, useRef } from "react";
import debounce from "lodash.debounce";

export default function Search({ onSearch, placeholder = "Search destinations..." }) {
  const onSearchRef = useRef(onSearch);
  
  // Keep ref up to date so debounce always uses the latest callback without re-creating
  useEffect(() => { 
    onSearchRef.current = onSearch; 
  }, [onSearch]);

  const debounced = useMemo(
    () => debounce((q) => onSearchRef.current(q), 500, { leading: false, trailing: true }),
    []
  );

  // Cleanup to prevent memory leaks if component unmounts while typing
  useEffect(() => {
    return () => debounced.cancel();
  }, [debounced]);

  return (
    <div className="relative w-full sm:w-72">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
        🔍
      </span>
      <input 
        type="text"
        onChange={(e) => debounced(e.target.value)} 
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/5 bg-white/70 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all text-sm font-semibold text-gray-800 placeholder-gray-400 shadow-sm"
      />
    </div>
  );
}