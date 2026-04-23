'use client';

/**
 * Google "Get it on Google Play" badge — inline SVG.
 *
 * Rendered at ~40px tall by default. Black background, white type, full-color
 * Play triangle (Google brand colors: blue / yellow / green / red).
 *
 * Google brand guidelines:
 *   https://play.google.com/intl/en_us/badges/
 *
 * Built from SVG primitives so no binary asset is shipped with the widget.
 * Proportions mirror the official badge (≈3.4:1 aspect, 135×40 at 1x).
 */

export default function PlayStoreBadge({
  height = 40,
  title = 'Get it on Google Play',
}: {
  height?: number;
  title?: string;
}) {
  // Badge native size: 135 × 40.
  const width = (height * 135) / 40;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 135 40"
      role="img"
      aria-label={title}
      style={{ display: 'block' }}
    >
      <title>{title}</title>

      {/* Rounded-rectangle badge background */}
      <rect x="0" y="0" width="135" height="40" rx="6" ry="6" fill="#000" />

      {/* Subtle 1px inner stroke */}
      <rect
        x="0.5"
        y="0.5"
        width="134"
        height="39"
        rx="5.5"
        ry="5.5"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />

      {/*
        Play triangle — four-color gradient simplified to solid-color facets.
        Four triangles forming the Play icon: top-left blue, bottom-left green,
        right-top red, right-bottom yellow. Positioned at left edge.
      */}
      <g transform="translate(11, 9) scale(0.9)">
        {/* Blue facet (top-left quad) */}
        <path
          d="M0.5 0.5 L13 12.5 L7.5 18 Z"
          fill="#00a0ff"
        />
        {/* Green facet (bottom-left quad) */}
        <path
          d="M0.5 23.5 L13 11.5 L7.5 6 Z"
          fill="#00de7a"
        />
        {/* Red facet (top-right) */}
        <path
          d="M13 12.3 L18.5 9.2 L8 3 Z"
          fill="#ff3a44"
        />
        {/* Yellow facet (bottom-right) */}
        <path
          d="M13 11.7 L18.5 14.8 L8 21 Z"
          fill="#ffce00"
        />
      </g>

      {/* "GET IT ON" — small eyebrow line */}
      <text
        x="38"
        y="16"
        fontFamily="Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
        fontSize="7"
        fill="#fff"
        fontWeight="400"
      >
        GET IT ON
      </text>

      {/* "Google Play" — display wordmark */}
      <text
        x="38"
        y="30"
        fontFamily="Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
        fontSize="15"
        fill="#fff"
        fontWeight="500"
        letterSpacing="-0.2"
      >
        Google Play
      </text>
    </svg>
  );
}
