'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { analytics } from './analytics'

// reCAPTCHA v3 helper
function loadRecaptcha(siteKey: string): Promise<void> {
  if (document.querySelector(`script[src*="recaptcha"]`)) return Promise.resolve()
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

async function getRecaptchaToken(siteKey: string, action: string): Promise<string> {
  await loadRecaptcha(siteKey)
  return new Promise((resolve) => {
    ;(window as any).grecaptcha.ready(() => {
      ;(window as any).grecaptcha.execute(siteKey, { action }).then(resolve)
    })
  })
}

// Default reCAPTCHA site key — override via prop
const DEFAULT_RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''

interface ContactFormProps {
  accentColor?: 'cobalt' | 'hazard' | 'fallout'
  variant?: 'newsletter' | 'contact'
  heading?: string
  subheading?: string
  emailTo?: string
  recaptchaSiteKey?: string
}

const accentStyles = {
  cobalt: {
    border: 'focus:border-[#4a77ff]/50 focus:ring-[#4a77ff]/20',
    button: 'bg-[#4a77ff] hover:bg-[#7496ff] hover:shadow-[0_0_20px_rgba(74,119,255,0.3)]',
    dot: 'bg-[#4a77ff]',
  },
  hazard: {
    border: 'focus:border-[#0EA5D6]/50 focus:ring-[#0EA5D6]/20',
    button: 'bg-[#0EA5D6] hover:bg-[#29C4F8] hover:shadow-[0_0_20px_rgba(41,196,248,0.3)]',
    dot: 'bg-[#0EA5D6]',
  },
  fallout: {
    border: 'focus:border-[#1aff28]/50 focus:ring-[#1aff28]/20',
    button: 'bg-[#1aff28] text-[#111] hover:bg-[#44ff88] hover:shadow-[0_0_20px_rgba(26,255,40,0.3)]',
    dot: 'bg-[#1aff28]',
  },
}

export function ContactForm({
  accentColor = 'cobalt',
  variant = 'newsletter',
  heading,
  subheading,
  emailTo = 'nexus@simplified.media',
  recaptchaSiteKey = DEFAULT_RECAPTCHA_KEY,
}: ContactFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const formRef = useRef<HTMLFormElement>(null)
  const accent = accentStyles[accentColor]
  const isContact = variant === 'contact'

  const defaultHeading = isContact ? 'Get in Touch' : 'Stay in the Loop'
  const defaultSub = isContact
    ? 'Have a project in mind? Drop us a line.'
    : 'Get the latest updates delivered straight to your inbox. No spam, just signal.'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    const form = formRef.current
    if (!form) return

    const data = new FormData(form)
    const body: Record<string, string> = {}
    data.forEach((v, k) => { body[k] = v.toString() })

    // Get reCAPTCHA token
    let recaptchaToken = ''
    if (recaptchaSiteKey) {
      try {
        recaptchaToken = await getRecaptchaToken(recaptchaSiteKey, isContact ? 'contact' : 'subscribe')
      } catch { /* continue without token */ }
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, to: emailTo, variant, recaptchaToken }),
      })
      if (res.ok) {
        setStatus('sent')
        isContact ? analytics.contactSubmit('success') : analytics.newsletterSignup('success')
        form.reset()
      } else {
        setStatus('error')
        isContact ? analytics.contactSubmit('error') : analytics.newsletterSignup('error')
      }
    } catch {
      const subject = isContact ? `Contact from ${body.name || 'website'}` : 'Newsletter signup'
      const mailBody = isContact
        ? `Name: ${body.name}\nEmail: ${body.email}\n\n${body.message}`
        : `Newsletter signup: ${body.email}`
      window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`
      setStatus('sent')
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E5E5E5] bg-[#EDEDEB] p-8 md:p-14">
      <div className="absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full opacity-60 blur-[100px] pointer-events-none" style={{ background: accentColor === 'cobalt' ? 'rgba(74,119,255,0.06)' : accentColor === 'hazard' ? 'rgba(41,196,248,0.06)' : 'rgba(26,255,40,0.06)' }} />

      <div className="relative z-10 max-w-xl">
        <div className="mb-2 flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#78716c]">
            {isContact ? 'Contact' : 'Newsletter'}
          </span>
        </div>

        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-black tracking-tight text-[#1A1A1A]">
          {heading || defaultHeading}
        </h2>
        <p className="mt-3 text-base text-[#57534e] leading-relaxed max-w-lg">
          {subheading || defaultSub}
        </p>

        <AnimatePresence mode="wait">
          {status === 'sent' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex items-center gap-3 rounded-lg border border-[#1aff28]/30 bg-[#1aff28]/5 px-5 py-4"
            >
              <svg className="h-5 w-5 text-[#1aff28] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-mono text-sm text-[#1A1A1A]">
                {isContact ? "Message sent. We'll be in touch." : "You're in. Welcome aboard."}
              </span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              ref={formRef}
              onSubmit={handleSubmit}
              className="mt-8 space-y-4"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isContact && (
                <input name="name" type="text" required placeholder="Your name" className={`w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-mono text-sm text-[#1A1A1A] placeholder:text-[#a8a29e] outline-none transition-all duration-300 ${accent.border} focus:ring-1`} />
              )}

              <div className={`flex ${isContact ? 'flex-col' : 'flex-col sm:flex-row'} gap-3`}>
                <input name="email" type="email" required placeholder="you@email.com" className={`flex-1 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-mono text-sm text-[#1A1A1A] placeholder:text-[#a8a29e] outline-none transition-all duration-300 ${accent.border} focus:ring-1`} />
                {!isContact && (
                  <button type="submit" disabled={status === 'sending'} className={`shrink-0 rounded-lg ${accent.button} px-6 py-3 font-mono text-sm font-medium uppercase tracking-wider text-white transition-all duration-300 active:scale-[0.98] disabled:opacity-60`}>
                    {status === 'sending' ? 'Sending...' : 'Subscribe'}
                  </button>
                )}
              </div>

              {isContact && (
                <>
                  <textarea name="message" required rows={4} placeholder="Tell us about your project..." className={`w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-mono text-sm text-[#1A1A1A] placeholder:text-[#a8a29e] outline-none transition-all duration-300 resize-none ${accent.border} focus:ring-1`} />
                  <button type="submit" disabled={status === 'sending'} className={`rounded-lg ${accent.button} px-8 py-3 font-mono text-sm font-medium uppercase tracking-wider text-white transition-all duration-300 active:scale-[0.98] disabled:opacity-60`}>
                    {status === 'sending' ? 'Sending...' : 'Send Message'}
                  </button>
                </>
              )}

              {status === 'error' && <p className="font-mono text-[11px] text-red-500">Something went wrong. Try again or email us directly.</p>}

              <p className="font-mono text-[10px] uppercase tracking-wider text-[#a8a29e]">
                {isContact ? `Or email us directly at ${emailTo}` : 'Free forever. Unsubscribe anytime.'}
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Dark variant for Studio
export function ContactFormDark({
  heading = "Let's build something.",
  subheading = 'Have a project in mind? Drop us a line.',
  emailTo = 'nexus@simplified.media',
  recaptchaSiteKey = DEFAULT_RECAPTCHA_KEY,
}: {
  heading?: string
  subheading?: string
  emailTo?: string
  recaptchaSiteKey?: string
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const form = formRef.current
    if (!form) return
    const data = new FormData(form)
    const body: Record<string, string> = {}
    data.forEach((v, k) => { body[k] = v.toString() })

    let recaptchaToken = ''
    if (recaptchaSiteKey) {
      try {
        recaptchaToken = await getRecaptchaToken(recaptchaSiteKey, 'contact')
      } catch { /* continue */ }
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, to: emailTo, variant: 'contact', recaptchaToken }),
      })
      if (res.ok) { setStatus('sent'); analytics.contactSubmit('success'); form.reset() }
      else { setStatus('error'); analytics.contactSubmit('error') }
    } catch {
      window.location.href = `mailto:${emailTo}?subject=${encodeURIComponent(`Contact from ${body.name || 'website'}`)}&body=${encodeURIComponent(`Name: ${body.name}\nEmail: ${body.email}\n\n${body.message}`)}`
      setStatus('sent')
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-5xl md:text-7xl font-display font-bold text-[#f5f5f4] mb-4 tracking-tight leading-none">
        {heading}
      </h2>
      <p className="text-[#a8a29e] text-base md:text-lg leading-relaxed mb-10 max-w-lg">
        {subheading}
      </p>

      <AnimatePresence mode="wait">
        {status === 'sent' ? (
          <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-lg border border-[#1aff28]/30 bg-[#1aff28]/5 px-5 py-4">
            <svg className="h-5 w-5 text-[#1aff28] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span className="font-mono text-sm text-[#f5f5f4]">Message sent. We'll be in touch.</span>
          </motion.div>
        ) : (
          <motion.form key="form" ref={formRef} onSubmit={handleSubmit} className="space-y-4" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex flex-col sm:flex-row gap-4">
              <input name="name" type="text" required placeholder="Your name" className="flex-1 rounded-lg border border-[#292524] bg-[#1A1A1A] px-4 py-3 font-mono text-sm text-[#f5f5f4] placeholder:text-[#57534e] outline-none transition-all duration-300 focus:border-[#1aff28]/40 focus:ring-1 focus:ring-[#1aff28]/20" />
              <input name="email" type="email" required placeholder="you@email.com" className="flex-1 rounded-lg border border-[#292524] bg-[#1A1A1A] px-4 py-3 font-mono text-sm text-[#f5f5f4] placeholder:text-[#57534e] outline-none transition-all duration-300 focus:border-[#1aff28]/40 focus:ring-1 focus:ring-[#1aff28]/20" />
            </div>
            <textarea name="message" required rows={4} placeholder="Tell us about your project..." className="w-full rounded-lg border border-[#292524] bg-[#1A1A1A] px-4 py-3 font-mono text-sm text-[#f5f5f4] placeholder:text-[#57534e] outline-none transition-all duration-300 resize-none focus:border-[#1aff28]/40 focus:ring-1 focus:ring-[#1aff28]/20" />
            <div className="flex items-center gap-6">
              <button type="submit" disabled={status === 'sending'} className="cta-button inline-block disabled:opacity-60">
                {status === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
              <a href={`mailto:${emailTo}`} className="font-mono text-xs text-[#78716c] hover:text-[#a8a29e] transition-colors">or email {emailTo}</a>
            </div>
            {status === 'error' && <p className="font-mono text-[11px] text-red-500">Something went wrong. Try again.</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
