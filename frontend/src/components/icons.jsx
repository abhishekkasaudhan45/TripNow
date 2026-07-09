// Cohesive stroke-based icon set for TripNow. All share the same 24×24 grid,
// 1.8 stroke, round caps — so they read as one family (unlike mixed emoji).
// Color is inherited via `currentColor`; size via the `size` prop.

const base = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function IconRoute({ size = 24 }) {
  return (
    <svg {...base(size)}>
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8 19h6a4 4 0 0 0 4-4V8" />
      <path d="M16 5H9a3 3 0 0 0 0 6h4" />
    </svg>
  );
}

export function IconWallet({ size = 24 }) {
  return (
    <svg {...base(size)}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBolt({ size = 24 }) {
  return (
    <svg {...base(size)}>
      <path d="M13 2 4.5 13.5a.6.6 0 0 0 .5 1h5l-1 7L18.5 10a.6.6 0 0 0-.5-1h-5l1-7Z" />
    </svg>
  );
}

export function IconBookmark({ size = 24 }) {
  return (
    <svg {...base(size)}>
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z" />
    </svg>
  );
}
