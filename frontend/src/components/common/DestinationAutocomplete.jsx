import React, { useState, useRef, useEffect, useId } from "react";
import {
  SUGGESTED_DESTINATIONS,
  getMatchingSuggestions,
} from "../../utils/destinationSuggestions";

export { SUGGESTED_DESTINATIONS, getMatchingSuggestions };

/**
 * Accessible Destination Autocomplete Combobox
 * Supports keyboard navigation (ArrowUp, ArrowDown, Enter, Escape, Tab),
 * ARIA combobox pattern, and keeps free-text typing completely unrestricted.
 */
export default function DestinationAutocomplete({
  value = "",
  onChange,
  onSelect,
  placeholder = "Where to? e.g. Goa, Paris, Bali",
  className = "",
  inputClassName = "inp-field",
  inputStyle = {},
  id = "destination-search-input",
  name = "destination",
  autoFocus = false,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);
  const listboxId = useId();

  const suggestions = getMatchingSuggestions(value, 8);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Ensure active option is scrolled into view during keyboard navigation
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex];
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    if (onChange) {
      onChange(nextVal, false);
    }
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleSelectOption = (dest) => {
    if (onChange) {
      onChange(dest.name, true);
    }
    if (onSelect) {
      onSelect(dest);
    }
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(suggestions.length - 1);
      } else if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelectOption(suggestions[activeIndex]);
      }
      // If dropdown is not open or no item active, allow standard form submission
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Tab") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeOptionId =
    activeIndex >= 0 && suggestions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      className={`tripnow-destination-autocomplete ${className}`}
    >
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        required={required}
        autoFocus={autoFocus}
        className={inputClassName}
        style={inputStyle}
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Destination suggestions"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 999,
            margin: 0,
            padding: "6px",
            listStyle: "none",
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "16px",
            border: "1px solid rgba(229, 231, 235, 0.9)",
            boxShadow: "0 16px 40px -10px rgba(0, 0, 0, 0.18), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
            maxHeight: "320px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {suggestions.map((dest, index) => {
            const isSelected = activeIndex === index;
            const isDomestic = dest.tier === "DOMESTIC";
            const isTierA = dest.tier === "GLOBAL_TIER_A";
            const isTierB = dest.tier === "GLOBAL_TIER_B";
            const isTierC = dest.tier === "GLOBAL_TIER_C";

            let badgeBg = "rgba(245, 158, 11, 0.12)";
            let badgeColor = "#b45309";
            if (isTierA) {
              badgeBg = "rgba(16, 185, 129, 0.12)";
              badgeColor = "#047857";
            } else if (isTierB) {
              badgeBg = "rgba(59, 130, 246, 0.12)";
              badgeColor = "#1d4ed8";
            } else if (isTierC) {
              badgeBg = "rgba(139, 92, 246, 0.12)";
              badgeColor = "#6d28d9";
            }

            return (
              <li
                key={`${dest.name}-${dest.region}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  // Prevent input blur before click resolves
                  e.preventDefault();
                  handleSelectOption(dest);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  background: isSelected ? "rgba(254, 243, 199, 0.7)" : "transparent",
                  transition: "background 0.12s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{dest.emoji}</span>
                  <div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#111827",
                        display: "inline-block",
                      }}
                    >
                      {dest.name}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        marginLeft: "6px",
                        fontWeight: 400,
                      }}
                    >
                      ({dest.region})
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background: badgeBg,
                    color: badgeColor,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dest.badge}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
