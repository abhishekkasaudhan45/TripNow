import { useId } from "react";

/**
 * TripNow Unified Brand Logo Component (Concept 06).
 *
 * Features:
 * - Recognizable map/location pin silhouette with transparent aperture.
 * - Sunset/coral gradient (#F59E0B -> #EF4444).
 * - Golden orbital launch arrow sweeping around the pin and pointing northeast (#FBBF24).
 * - High-contrast typography in Playfair Display (Dark: #172033 | Light: #FFFFFF).
 * - Clean scalable vector geometry, zero external image assets, zero icon dependencies.
 *
 * @param {object} props
 * @param {number|string} [props.size=32] - Icon size in px (number) or CSS string.
 * @param {"full"|"icon"} [props.variant="full"] - "full" (icon + wordmark) or "icon" (icon only).
 * @param {boolean} [props.showWordmark] - Explicit override to show/hide the wordmark.
 * @param {"light"|"dark"} [props.theme="light"] - "light" (dark text for light bg) or "dark" (white text for dark bg).
 * @param {string} [props.subtitle] - Optional subtitle displayed under the wordmark (e.g. "AI Travel Planning").
 * @param {string} [props.className=""] - Additional class name for outer wrapper.
 * @param {React.CSSProperties} [props.style={}] - Additional inline styles for outer wrapper.
 * @param {string} [props.wordmarkClassName=""] - Additional class name for wordmark text.
 * @param {string} [props.title="TripNow"] - Accessible label / title.
 */
export default function TripNowLogo({
  size = 32,
  variant = "full",
  showWordmark,
  theme = "light",
  subtitle,
  className = "",
  style = {},
  wordmarkClassName = "",
  title = "TripNow",
  ...props
}) {
  const id = useId();
  const safeId = id ? id.replace(/[^a-zA-Z0-9_-]/g, "") : "tn";

  const pinGradId = `tn-pin-${safeId}`;
  const orbitGradId = `tn-orbit-${safeId}`;
  const arrowGradId = `tn-arrow-${safeId}`;

  // Parse size
  const isNumeric = typeof size === "number";
  const numSize = isNumeric ? size : parseFloat(size) || 32;
  const iconDimension = isNumeric ? `${size}px` : size;

  // Determine if wordmark should display
  const shouldShowWordmark =
    typeof showWordmark === "boolean" ? showWordmark : variant === "full";

  // Proportional font sizing and spacing
  const fontSize = isNumeric ? Math.max(14, Math.round(numSize * 0.56)) : "1.15em";
  const gap = isNumeric ? Math.max(6, Math.round(numSize * 0.28)) : "0.5em";

  // Wordmark colors based on theme
  const textColor = theme === "dark" ? "#FFFFFF" : "#172033";
  const subtitleColor = theme === "dark" ? "rgba(255, 255, 255, 0.42)" : "#6B7280";

  return (
    <div
      className={`tripnow-logo inline-flex items-center select-none ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        textDecoration: "none",
        ...style,
      }}
      role={shouldShowWordmark ? "group" : "img"}
      aria-label={title}
      {...props}
    >
      {/* SVG Icon (Concept 06: Map Pin + Golden Orbital Launch Arrow) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={iconDimension}
        height={iconDimension}
        fill="none"
        aria-hidden={shouldShowWordmark ? "true" : undefined}
        style={{ flexShrink: 0, display: "block" }}
      >
        {!shouldShowWordmark && <title>{title}</title>}
        <defs>
          {/* Sunset/Coral Gradient for Map Pin Silhouette */}
          <linearGradient id={pinGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>

          {/* Golden Gradient for Orbital Launch Path */}
          <linearGradient id={orbitGradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="55%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>

          {/* Arrowhead Gradient */}
          <linearGradient id={arrowGradId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* 1. Map Pin Silhouette (with genuine evenodd cutout aperture) */}
        <path
          d="M 13.5 5 C 9.63 5 6.5 8.13 6.5 12 C 6.5 17.2 13.5 25 13.5 25 C 13.5 25 20.5 17.2 20.5 12 C 20.5 8.13 17.37 5 13.5 5 Z M 13.5 9.5 A 2.5 2.5 0 1 0 13.5 14.5 A 2.5 2.5 0 1 0 13.5 9.5 Z"
          fill={`url(#${pinGradId})`}
          fillRule="evenodd"
        />

        {/* 2. Golden Orbital Launch Curve */}
        <path
          d="M 5 19.5 C 6.5 25 10 27.5 14.5 27.5 C 19.8 27.5 24.5 22.8 25 14.5 C 25.3 11 24.2 8.5 22.8 6.5"
          stroke={`url(#${orbitGradId})`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Launch Arrowhead pointing Northeast */}
        <path
          d="M 28.5 3.5 L 22.5 5 L 24.8 7.3 L 26.2 9.5 Z"
          fill={`url(#${arrowGradId})`}
        />
      </svg>

      {/* Wordmark (displayed when variant === "full" or showWordmark === true) */}
      {shouldShowWordmark && (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <span
            className={`tripnow-wordmark ${wordmarkClassName}`}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 900,
              fontSize,
              color: textColor,
              letterSpacing: "-0.5px",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            TripNow
          </span>
          {subtitle && (
            <span
              className="tripnow-subtitle"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: subtitleColor,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginTop: "3px",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
