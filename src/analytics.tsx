'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

declare global {
  interface Window { gtag: (...args: any[]) => void }
}

export function Analytics({ gaId }: { gaId?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!gaId || !window.gtag) return
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    window.gtag('config', gaId, { page_path: url })
  }, [pathname, searchParams, gaId])

  if (!gaId) return null

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
      <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}')` }} />
    </>
  )
}

/** Fire a custom GA4 event */
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  })
}

/** Pre-built event helpers */
export function WebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.gtag) return

    import('web-vitals').then(({ onCLS, onLCP, onFCP, onTTFB, onINP }) => {
      const sendToGA = ({ name, value, id }: { name: string; value: number; id: string }) => {
        window.gtag('event', name, {
          event_category: 'Web Vitals',
          event_label: id,
          value: Math.round(name === 'CLS' ? value * 1000 : value),
          non_interaction: true,
        })
      }
      onCLS(sendToGA)
      onINP(sendToGA)
      onLCP(sendToGA)
      onFCP(sendToGA)
      onTTFB(sendToGA)
    }).catch(() => {
      // web-vitals not available, skip silently
    })
  }, [])

  return null
}

export const analytics = {
  // Navigation
  navClick: (label: string) => trackEvent('nav_click', 'navigation', label),
  mobileMenuToggle: (open: boolean) => trackEvent('mobile_menu_toggle', 'navigation', open ? 'open' : 'close'),

  // Content engagement
  articleView: (slug: string, category: string) => trackEvent('article_view', 'content', `${category}/${slug}`),
  categoryView: (slug: string) => trackEvent('category_view', 'content', slug),
  readComplete: (slug: string) => trackEvent('read_complete', 'content', slug),

  // CTA / Forms
  formSubmit: (formType: string, status: 'success' | 'error') => trackEvent('form_submit', 'engagement', `${formType}_${status}`),
  newsletterSignup: (status: 'success' | 'error') => trackEvent('newsletter_signup', 'engagement', status),
  contactSubmit: (status: 'success' | 'error') => trackEvent('contact_submit', 'engagement', status),

  // Clicks
  ctaClick: (label: string) => trackEvent('cta_click', 'engagement', label),
  externalLink: (url: string) => trackEvent('external_link', 'engagement', url),
  socialClick: (platform: string) => trackEvent('social_click', 'engagement', platform),
  shareClick: (platform: string, slug: string) => trackEvent('share_click', 'engagement', `${platform}/${slug}`),

  // Site network
  networkSiteClick: (site: string) => trackEvent('network_site_click', 'navigation', site),

  // Scroll depth
  scrollDepth: (percent: number) => trackEvent('scroll_depth', 'engagement', `${percent}%`, percent),

  // Search / Filter
  categoryFilter: (category: string) => trackEvent('category_filter', 'navigation', category),

  // 3D / Interactive (Studio)
  modelView: (modelName: string) => trackEvent('model_view', 'engagement', modelName),
  projectClick: (projectName: string) => trackEvent('project_click', 'engagement', projectName),
}
