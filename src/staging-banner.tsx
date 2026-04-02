'use client'

/**
 * StagingBanner — fixed top banner visible only on staging deployments.
 * Reads NEXT_PUBLIC_STAGE env var. Shows nothing on production.
 */
export function StagingBanner() {
  const isStaging = process.env.NEXT_PUBLIC_STAGE === 'staging'
  if (!isStaging) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: '#FF6B00',
        color: '#fff',
        textAlign: 'center',
        padding: '6px 16px',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}
    >
      STAGING PREVIEW — NOT INDEXED — DO NOT SHARE
    </div>
  )
}
