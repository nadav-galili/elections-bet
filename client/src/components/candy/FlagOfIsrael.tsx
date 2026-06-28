/**
 * Flag of Israel as a clean, flat SVG emblem — white field, two flag-blue
 * (#0038B8) stripes, and a Magen David drawn as two overlapping stroked
 * triangles. Scales to its container; decorative card chrome lives at the call
 * site. `aria-label` carries the meaning, so the surrounding markup stays quiet.
 */
export function FlagOfIsrael({ className }: { className?: string }) {
  const blue = '#0038B8';
  return (
    <svg
      viewBox="0 0 220 160"
      className={className}
      role="img"
      aria-label="דגל ישראל"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="220" height="160" fill="#ffffff" />
      <rect y="26" width="220" height="15" fill={blue} />
      <rect y="119" width="220" height="15" fill={blue} />
      <g fill="none" stroke={blue} strokeWidth="4.6" strokeLinejoin="round">
        <polygon points="110,50 135.98,95 84.02,95" />
        <polygon points="110,110 84.02,65 135.98,65" />
      </g>
    </svg>
  );
}
