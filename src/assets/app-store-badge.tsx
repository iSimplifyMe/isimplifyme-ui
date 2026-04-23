'use client';

/**
 * Apple "Download on the App Store" badge — inline SVG.
 *
 * Rendered at ~40px tall by default (matches Apple's minimum size guidance).
 * Pure black fill, white type + logo, 8px corner radius — matches the current
 * App Store marketing badge grammar.
 *
 * Apple marketing guidelines:
 *   https://developer.apple.com/app-store/marketing/guidelines/
 *
 * The badge is built from SVG primitives rather than embedded as a licensed
 * asset so the widget can ship without binary blobs. Proportions follow the
 * official badge (≈3:1 aspect ratio, 120×40 at 1x).
 */

export default function AppStoreBadge({
  height = 40,
  title = 'Download on the App Store',
}: {
  height?: number;
  title?: string;
}) {
  // Badge native size: 120 × 40. Scales uniformly via height prop.
  const width = (height * 120) / 40;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 120 40"
      role="img"
      aria-label={title}
      style={{ display: 'block' }}
    >
      <title>{title}</title>

      {/* Rounded-rectangle badge background */}
      <rect x="0" y="0" width="120" height="40" rx="6" ry="6" fill="#000" />

      {/* Subtle 1px inner stroke — matches Apple's light-mode guidance */}
      <rect
        x="0.5"
        y="0.5"
        width="119"
        height="39"
        rx="5.5"
        ry="5.5"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />

      {/* Apple logo — simplified single-path glyph. Positioned left-center. */}
      <g transform="translate(11, 8) scale(0.055)" fill="#fff">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
      </g>

      {/* "Download on the" — small eyebrow line */}
      <text
        x="35"
        y="16"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        fontSize="7"
        fill="#fff"
        fontWeight="400"
      >
        Download on the
      </text>

      {/* "App Store" — display wordmark */}
      <text
        x="35"
        y="30"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        fontSize="15"
        fill="#fff"
        fontWeight="500"
        letterSpacing="-0.3"
      >
        App Store
      </text>
    </svg>
  );
}
