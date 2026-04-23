'use client';

/**
 * ConciergeWidget — shared, persona-driven 3rd-turn CTA widget.
 *
 * Consumes SSE events from a same-origin proxy (`/api/concierge` →
 * `https://apex.isimplifyme.com/api/concierge`). The widget is
 * intentionally *config-free on the site side*: all behavior that
 * varies per tenant (form shape copy, emergency handling, HV-trigger
 * early form, transcript checkbox helper, secondary tel: CTA) is
 * driven by the `lead_form`, `high_value_form`, and `emergency`
 * persona blocks served from the apex stream.
 *
 * Backwards-compatible: when the stream doesn't surface a `lead_form`
 * block (legacy persona), the widget falls back to the built-in
 * name+email form so sites that upgrade the package can keep shipping
 * before the persona is updated in S3.
 *
 * Submits to `/api/concierge-lead` with shape:
 *   { name, email, phone, address?, notes?, transcript?, session_id,
 *     page, ...customFields }
 * Non-meta fields are persisted to DynamoDB as `custom_fields` via
 * apex-portal /api/leads/submit.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AppStoreBadge from './assets/app-store-badge';
import PlayStoreBadge from './assets/play-store-badge';

// ── Types ──────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LeadFormSecondaryCta {
  label: string;
  href: string;
}

/**
 * Classic lead-form config (shipped in v1.1.0/v1.1.1).
 * Selected when `type` is absent or `'lead'`. The 4 tenants live on this
 * shape today (SD/MMML/CTAL/AOE). No field changes — all new form types
 * are added as additional union members below.
 */
interface ClassicLeadFormConfig {
  type?: 'lead';
  intro: string;
  sla_label: string;
  submit_label: string;
  success_message: string;
  require_address?: boolean;
  include_transcript_default?: boolean;
  transcript_checkbox_helper?: string;
  notes_helper?: string;
  secondary_cta?: LeadFormSecondaryCta;
}

/**
 * Newsletter form — single email input + subscribe button. Submits to the
 * centralized apex newsletter endpoint (per-tenant suppression + DOI).
 */
interface NewsletterFormConfig {
  type: 'newsletter';
  title: string;
  subtitle?: string;
  email_placeholder?: string;
  submit_label: string;
  success_message: string;
  /** Override the default POST target. Defaults to `/api/newsletter/subscribe`
   *  which is expected to proxy to apex `/api/newsletter/subscribe`. */
  subscribe_endpoint?: string;
}

type MultiChoiceActionNewsletter = {
  kind: 'newsletter';
  sub_form: {
    email_placeholder?: string;
    submit_label: string;
    success_message: string;
    subscribe_endpoint?: string;
  };
};

type MultiChoiceActionLead = {
  kind: 'lead';
  /** Inline classic-form shape — rendered via the existing classic-form
   *  renderer with this sub_form merged over defaults. */
  sub_form: Omit<ClassicLeadFormConfig, 'type' | 'sla_label'> & {
    sla_label?: string;
  };
};

type MultiChoiceActionExternalLink = {
  kind: 'external_link';
  href: string;
  beacon_tag?: string;
};

type MultiChoiceAction =
  | MultiChoiceActionNewsletter
  | MultiChoiceActionLead
  | MultiChoiceActionExternalLink;

interface MultiChoiceFormConfig {
  type: 'multi-choice';
  title: string;
  subtitle?: string;
  choices: Array<{
    id: string;
    label: string;
    sub_label?: string;
    action: MultiChoiceAction;
  }>;
}

interface AppDownloadFormConfig {
  type: 'app-download';
  title: string;
  subtitle?: string;
  ios_url?: string;
  android_url?: string;
  /** Fallback when neither store URL is set — renders a single "Join the
   *  waitlist" pill button. */
  waitlist_url?: string;
  beacon_tags?: {
    ios?: string;
    android?: string;
    waitlist?: string;
  };
}

/**
 * Discriminated union of all supported lead-form shapes.
 * Default (type absent) = ClassicLeadFormConfig = backwards compat.
 */
type LeadFormConfig =
  | ClassicLeadFormConfig
  | NewsletterFormConfig
  | MultiChoiceFormConfig
  | AppDownloadFormConfig;

/** Narrow guard: is this the classic (original v1.1.1) shape? */
function isClassicForm(
  form: LeadFormConfig | null | undefined
): form is ClassicLeadFormConfig {
  return !!form && (form.type === undefined || form.type === 'lead');
}

interface HighValueFormConfig {
  intro: string;
  submit_label: string;
  success_message: string;
}

type EmergencySeverity = 'acute' | 'high' | 'info';

interface EmergencyPinnedButton {
  label: string;
  sub_label?: string;
  href: string;
  severity: EmergencySeverity;
}

export interface ConciergeWidgetProps {
  /** Local proxy endpoint for chat messages. Default `/api/concierge`. */
  endpoint?: string;
  /** Local lead capture endpoint. Receives the form payload and
   *  forwards server-side to apex `/api/leads/submit`. Default
   *  `/api/concierge-lead`. */
  leadEndpoint?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Send button fill color. */
  accentColor?: string;
  /** Bar width. Default 900px matches the iSM reference. */
  maxWidth?: number;
  /** Glass theme — `dark` (default) / `light` / `auto` (luminance
   *  sampling, for sites that don't tag sections with [data-theme]). */
  theme?: 'dark' | 'light' | 'auto';
}

// ── SSE event shapes ───────────────────────────────────────────────────

interface SseTokenEvent {
  type: 'token';
  content: string;
}
interface SseDoneEvent {
  type: 'done';
  sessionId: string;
  messageCount: number;
  isLastMessage: boolean;
  // Elaborated CTA surfaces — optional so legacy personas still work.
  lead_form?: LeadFormConfig | null;
  high_value_form?: HighValueFormConfig | null;
  hv_matched?: boolean;
  /** Tenant slug — emitted by apex (Phase 3). Required for newsletter POSTs;
   *  falls back to null for older apex deploys (Phase 2 can ship before
   *  Phase 3, newsletter subscribe will simply return 400 until upgraded). */
  tenant_id?: string | null;
}
interface SseEmergencyEvent {
  type: 'emergency';
  pinned_button: EmergencyPinnedButton;
}
interface SseErrorEvent {
  type: 'error';
  message: string;
}
type SseEvent = SseTokenEvent | SseDoneEvent | SseEmergencyEvent | SseErrorEvent;

// ── Utilities ──────────────────────────────────────────────────────────

function substituteTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) =>
    values[key] != null ? values[key] : `{${key}}`
  );
}

function serializeTranscript(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

// ── Main component ─────────────────────────────────────────────────────

// Exported as both default and named so consumers can use either
// `import ConciergeWidget from '@isimplifyme/ui/concierge'` (default)
// or `import { ConciergeWidget } from '@isimplifyme/ui/concierge'` (named).
// Default re-export lives at the bottom of the file.
function ConciergeWidget({
  endpoint = '/api/concierge',
  leadEndpoint = '/api/concierge-lead',
  placeholder = 'Ask a question...',
  accentColor = '#EB1C23',
  maxWidth = 900,
  theme = 'dark',
}: ConciergeWidgetProps) {
  // Conversation + session
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(true);

  // Lead form state — fires on session 3-turn cap OR tenant cap OR
  // immediately when the server signals `hv_matched`. Persists until
  // the user submits or the page reloads.
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadFormMode, setLeadFormMode] = useState<
    'session-cap' | 'tenant-cap' | 'hv-early'
  >('session-cap');
  const [leadForm, setLeadForm] = useState<LeadFormConfig | null>(null);
  const [hvForm, setHvForm] = useState<HighValueFormConfig | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSuccessMessage, setLeadSuccessMessage] = useState<string | null>(null);

  // Form field state (shared across lead/hv paths — keeps values across re-renders)
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadAddress, setLeadAddress] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [includeTranscript, setIncludeTranscript] = useState(true);

  // Tenant slug — filled from the `done` SSE event once apex Phase 3 lands.
  // Until then, newsletter POSTs will be rejected server-side (by design).
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Multi-choice branching — when the active form is `multi-choice`, track
  // which choice (if any) has been clicked so we can swap to an inline
  // sub-form. `null` = show the choice grid.
  const [activeChoiceId, setActiveChoiceId] = useState<string | null>(null);

  // Newsletter submit state (used by the newsletter renderer AND the
  // newsletter sub-form inside multi-choice).
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [newsletterSuccessMessage, setNewsletterSuccessMessage] = useState<string | null>(null);

  // Emergency pinned button — stays persistent for the rest of the
  // session once shown (decision 3 in the upgrade plan).
  const [emergencyButton, setEmergencyButton] = useState<EmergencyPinnedButton | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMac(navigator.platform?.toUpperCase().includes('MAC') ?? true);
  }, []);

  // ── Chameleon theme detection — two-pass (data-theme + luminance) ──
  const [autoTheme, setAutoTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme !== 'auto') return;

    function parseRgba(color: string): [number, number, number, number] | null {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
    }

    function luminance(r: number, g: number, b: number): number {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function sampleBackground(el: Element): 'dark' | 'light' {
      let current: Element | null = el;
      while (current && current !== document.documentElement) {
        const bg = getComputedStyle(current).backgroundColor;
        const rgba = parseRgba(bg);
        if (rgba && rgba[3] > 0.1) {
          return luminance(rgba[0], rgba[1], rgba[2]) > 0.5 ? 'light' : 'dark';
        }
        current = current.parentElement;
      }
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyRgba = parseRgba(bodyBg);
      if (bodyRgba && bodyRgba[3] > 0.1) {
        return luminance(bodyRgba[0], bodyRgba[1], bodyRgba[2]) > 0.5 ? 'light' : 'dark';
      }
      return 'light';
    }

    function detect() {
      const bar = barRef.current;
      if (!bar) return;
      const barRect = bar.getBoundingClientRect();
      const barMidY = barRect.top + barRect.height / 2;

      const sections = document.querySelectorAll('[data-theme]');
      let found = false;
      let match: 'dark' | 'light' = 'dark';
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (barMidY >= rect.top && barMidY < rect.bottom) {
          match = section.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
          found = true;
        }
      }

      if (!found) {
        bar.style.visibility = 'hidden';
        const el = document.elementFromPoint(barRect.left + barRect.width / 2, barMidY);
        bar.style.visibility = '';
        match = el ? sampleBackground(el) : 'light';
      }

      setAutoTheme(match);
    }

    detect();
    window.addEventListener('scroll', detect, { passive: true });
    window.addEventListener('resize', detect, { passive: true });
    return () => {
      window.removeEventListener('scroll', detect);
      window.removeEventListener('resize', detect);
    };
  }, [theme]);

  const resolvedTheme = theme === 'auto' ? autoTheme : theme;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cmd+K to focus the input
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const triggerLeadForm = useCallback(
    (
      mode: 'session-cap' | 'tenant-cap' | 'hv-early',
      form: LeadFormConfig | null,
      hv: HighValueFormConfig | null
    ) => {
      setLeadFormMode(mode);
      setLeadForm(form);
      setHvForm(hv);
      setShowLeadForm(true);
    },
    []
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || showLeadForm) return;

    setInput('');
    setError(null);
    setIsLoading(true);
    setIsOpen(true);

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          pathname: window.location.pathname,
          sessionId,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          const err = await resp.json().catch(() => ({}));
          if (err.leadFormEnabled || err.type === 'capacity') {
            // Tenant monthly cap — fall through to the lead form.
            triggerLeadForm('tenant-cap', null, null);
            setMessages((prev) => prev.filter((m) => m.content || m.role === 'user'));
            return;
          }
          throw new Error(err.message || 'Daily capacity reached.');
        }
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Something went wrong.');
      }

      const contentType = resp.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let assistantText = '';
        let sessionCapHit = false;
        let hvMatched = false;
        let pendingLeadForm: LeadFormConfig | null = null;
        let pendingHvForm: HighValueFormConfig | null = null;

        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = JSON.parse(line.slice(6)) as SseEvent;

              if (data.type === 'token') {
                assistantText += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                  return updated;
                });
              } else if (data.type === 'emergency') {
                // Persistent — server emits on first match within a session,
                // widget keeps it pinned for the rest of the session.
                setEmergencyButton((current) => current ?? data.pinned_button);
              } else if (data.type === 'done') {
                setSessionId(data.sessionId);
                // tenant_id is optional (apex Phase 3 emits it). Fall back
                // to null — newsletter POST will 400 until upgraded, which
                // is the expected Phase-2-before-Phase-3 behavior.
                if (data.tenant_id !== undefined) setTenantId(data.tenant_id ?? null);
                if (data.isLastMessage) sessionCapHit = true;
                if (data.hv_matched) hvMatched = true;
                if (data.lead_form) pendingLeadForm = data.lead_form;
                if (data.high_value_form) pendingHvForm = data.high_value_form;
                // Initialize transcript-inclusion default from persona.
                // Only the classic shape carries this flag.
                if (isClassicForm(data.lead_form) && data.lead_form.include_transcript_default === false) {
                  setIncludeTranscript(false);
                }
              } else if (data.type === 'error') {
                setError(data.message);
              }
            }
          }
        }

        // Decide whether the form fires now:
        //  - HV match → reduced form immediately after turn 1
        //  - 3-turn cap → full form
        if (hvMatched) {
          triggerLeadForm('hv-early', pendingLeadForm, pendingHvForm);
        } else if (sessionCapHit) {
          triggerLeadForm('session-cap', pendingLeadForm, pendingHvForm);
        }
      } else {
        // Sync-fallback path (Bedrock streaming unavailable)
        const data = await resp.json();
        if (data.type === 'message') {
          setSessionId(data.sessionId);
          if (data.tenant_id !== undefined) setTenantId(data.tenant_id ?? null);
          setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);

          if (data.emergency) {
            setEmergencyButton((current) => current ?? (data.emergency as EmergencyPinnedButton));
          }
          if (isClassicForm(data.lead_form) && data.lead_form.include_transcript_default === false) {
            setIncludeTranscript(false);
          }

          const pendingLeadForm = (data.lead_form as LeadFormConfig | null) ?? null;
          const pendingHvForm = (data.high_value_form as HighValueFormConfig | null) ?? null;

          if (data.hv_matched) {
            triggerLeadForm('hv-early', pendingLeadForm, pendingHvForm);
          } else if (data.isLastMessage) {
            triggerLeadForm('session-cap', pendingLeadForm, pendingHvForm);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, showLeadForm, endpoint, sessionId, triggerLeadForm]);

  // ── Form classification ──
  // Which config + field set do we render?
  //
  // `leadForm` is the v1.1.2 discriminated union — we render the classic
  // path only when `type` is 'lead' (or absent). Newsletter / multi-choice
  // / app-download render via dedicated inline sections further below.
  //
  //  - hv-early + hvForm  → HV reduced form (intro, submit, success from hvForm;
  //                         fields narrowed to name + phone (+ address if required))
  //  - otherwise if classic leadForm → full form from leadForm
  //  - otherwise → legacy name+email fallback (backwards compat for tenants
  //    that haven't authored any lead_form block yet)
  const classicLeadForm: ClassicLeadFormConfig | null = isClassicForm(leadForm)
    ? leadForm
    : null;
  const isClassicPath = showLeadForm && (classicLeadForm !== null || leadForm === null);
  const useElaborated = showLeadForm && classicLeadForm !== null;
  const useHvEarly = showLeadForm && leadFormMode === 'hv-early' && hvForm !== null;
  const useLegacyFallback = showLeadForm && leadForm === null;

  const activeIntro = useHvEarly && hvForm
    ? hvForm.intro
    : useElaborated && classicLeadForm
    ? classicLeadForm.intro
    : leadFormMode === 'tenant-cap'
    ? "Our concierge is taking a break — leave your details and we'll get back to you."
    : "Enjoying the chat? Drop your email and our team will follow up directly.";

  const activeSubmitLabel = useHvEarly && hvForm
    ? hvForm.submit_label
    : useElaborated && classicLeadForm
    ? classicLeadForm.submit_label
    : 'Get in touch';

  const activeSlaLabel = useElaborated && classicLeadForm ? classicLeadForm.sla_label : null;

  const activeSecondaryCta = useElaborated && classicLeadForm ? classicLeadForm.secondary_cta : undefined;

  const requireAddress = useElaborated && classicLeadForm?.require_address === true;

  // HV-early paths collect only name + phone (+ address for AOE).
  // Full form collects name + phone + email + optional notes + transcript toggle.
  // Legacy fallback: email + phone only (no phone for B2B; we render phone as optional).
  const showEmailField = !useHvEarly;
  const showNotesField = useElaborated && !useHvEarly;
  const showTranscriptCheckbox = useElaborated && !useHvEarly && messages.length > 0;

  const submitLead = useCallback(async () => {
    const name = leadName.trim();
    const email = leadEmail.trim();
    const phone = leadPhone.trim();
    const address = leadAddress.trim();
    const notes = leadNotes.trim();

    // Validation — field requirements vary by form mode.
    if (useHvEarly) {
      if (!name) return setError('Please enter your name.');
      if (!phone) return setError('Please enter your phone number.');
    } else if (useElaborated) {
      if (!name) return setError('Please enter your name.');
      if (!phone) return setError('Please enter your phone number.');
      if (!email) return setError('Please enter your email.');
    } else {
      if (!email) return setError('Please enter your email.');
    }
    if (requireAddress && !address) return setError('Please enter your property address.');
    if (email) {
      const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!basicEmailRegex.test(email)) return setError('Please enter a valid email.');
    }

    setError(null);
    setLeadSubmitting(true);

    // Transcript attachment — included only when checkbox is checked AND
    // this is the elaborated form. Capped client-side at 32KB to match
    // server-side limit; unlikely to trigger given the 3-turn cap.
    const transcript = showTranscriptCheckbox && includeTranscript
      ? serializeTranscript(messages).slice(0, 32 * 1024)
      : undefined;

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUserMsg?.content || '';

    try {
      const resp = await fetch(leadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          phone: phone || null,
          address: address || undefined,
          notes: notes || undefined,
          question,
          transcript,
          include_transcript: !!transcript,
          lead_mode: useHvEarly ? 'concierge-urgent' : 'concierge-normal',
          pathname: window.location.pathname,
          sessionId,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Unable to submit — please try again.');
      }

      // Build success message — prefer the persona-authored template,
      // fall back to a generic thank-you.
      const successTemplate = useHvEarly && hvForm
        ? hvForm.success_message
        : useElaborated && classicLeadForm
        ? classicLeadForm.success_message
        : null;
      const successMessage = successTemplate
        ? substituteTokens(successTemplate, { phone, email, name })
        : null;
      setLeadSuccessMessage(successMessage);
      setLeadSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit — please try again.');
    } finally {
      setLeadSubmitting(false);
    }
  }, [
    leadName, leadEmail, leadPhone, leadAddress, leadNotes,
    leadSubmitting, leadEndpoint, messages, sessionId, includeTranscript,
    useHvEarly, useElaborated, hvForm, classicLeadForm, requireAddress, showTranscriptCheckbox,
  ]);

  const showShortcut = !isFocused && !input && !isLoading;

  // ── Theme tokens ──
  // Light-mode bar + panel opacities intentionally kept low (<=0.75) so
  // the backdrop-filter blur reads as actual frosted glass on white pages.
  // Earlier versions bumped these to 0.92-0.96 and lost the frost effect
  // — against a white page background, 96% opaque white is indistinguishable
  // from solid. Keep dark-mode values unchanged; they land on dark surfaces
  // where 0.55-0.85 is appropriate.
  const isDark = resolvedTheme === 'dark';
  const barBg = isDark ? 'rgba(15, 18, 33, 0.55)' : 'rgba(255, 255, 255, 0.55)';
  const barBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const barTopHighlight = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
  const barTopHighlightFocused = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.85)';
  const barShadow = isDark ? '0 20px 60px rgba(0, 0, 0, 0.35)' : '0 20px 60px rgba(0, 0, 0, 0.12)';
  const barShadowFocused = isDark
    ? '0 20px 60px rgba(0, 0, 0, 0.45)'
    : '0 20px 60px rgba(0, 0, 0, 0.18)';
  const textColor = isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(10, 10, 10, 0.88)';
  const placeholderColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(10, 10, 10, 0.4)';
  const kbdBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(10, 10, 10, 0.04)';
  const kbdBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(10, 10, 10, 0.12)';
  const kbdColor = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(10, 10, 10, 0.4)';
  const panelBg = isDark ? 'rgba(15, 18, 33, 0.85)' : 'rgba(255, 255, 255, 0.75)';
  const panelBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const userBubbleBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f7f6f3';
  const userBubbleText = isDark ? 'rgba(255, 255, 255, 0.92)' : '#0a0a0a';
  const aiTextColor = isDark ? 'rgba(255, 255, 255, 0.82)' : '#333';
  const mutedText = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(10, 10, 10, 0.55)';

  // 16px font-size prevents iOS Safari's focus-zoom. 10px radius keeps
  // fields distinct from the 100px pill button (CTA hierarchy) while
  // still feeling rounded against the glass panel.
  const inputFieldStyle = {
    width: '100%',
    border: `1px solid ${panelBorder}`,
    background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '16px',
    fontWeight: 500,
    color: textColor,
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    transition: 'border-color 200ms ease, background 200ms ease',
  } as const;

  // Emergency button severity → color map.
  // acute (legal/medical crisis) → red
  // high (property / trade urgency) → safety orange (distinct from brand orange)
  // info (low stakes) → neutral accent
  const emergencyColor =
    emergencyButton?.severity === 'acute'
      ? '#d92626'
      : emergencyButton?.severity === 'high'
      ? '#ff6b1a'
      : '#1a9ba6';

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 48px)',
        maxWidth: `${maxWidth}px`,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'inherit',
      }}
    >
      {/* Chat panel — expands upward from the bar when messages are present */}
      {isOpen && messages.length > 0 && (
        <div
          style={{
            position: 'relative',
            background: panelBg,
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${panelBorder}`,
            borderRadius: '20px',
            boxShadow: barShadow,
            padding: emergencyButton ? '0 24px 24px' : '48px 24px 24px',
            overflowY: 'auto',
            maxHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Emergency pinned button — persistent, rendered at top of panel,
              severity-colored. Click opens tel: URL. */}
          {emergencyButton && (
            <a
              href={emergencyButton.href}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                margin: '0 -24px 12px',
                padding: '14px 24px',
                background: emergencyColor,
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '20px 20px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                fontSize: '15px',
                fontWeight: 600,
                textAlign: 'center',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}
              onClick={() => {
                // Best-effort analytics beacon — non-blocking.
                try {
                  navigator.sendBeacon?.(
                    '/api/concierge-emergency-tap',
                    JSON.stringify({
                      sessionId,
                      phone: emergencyButton.href,
                      severity: emergencyButton.severity,
                      pathname: window.location.pathname,
                    })
                  );
                } catch { /* no-op */ }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="currentColor"
                  />
                </svg>
                {emergencyButton.label}
              </span>
              {emergencyButton.sub_label && (
                <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.9 }}>
                  {emergencyButton.sub_label}
                </span>
              )}
            </a>
          )}

          <button
            type="button"
            aria-label="Minimize chat"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: emergencyButton ? '14px' : '14px',
              right: '14px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              color: emergencyButton ? '#fff' : aiTextColor,
              opacity: 0.7,
              transition: 'opacity 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Message thread */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                lineHeight: 1.6,
                maxWidth: '85%',
                fontSize: '15px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? userBubbleBg : 'transparent',
                padding: msg.role === 'user' ? '12px 16px' : 0,
                borderRadius: msg.role === 'user' ? '12px' : 0,
                color: msg.role === 'user' ? userBubbleText : aiTextColor,
                marginLeft: msg.role === 'user' ? 'auto' : 0,
                wordWrap: 'break-word',
              }}
            >
              {msg.content || (isLoading && i === messages.length - 1 ? '...' : '')}
            </div>
          ))}

          {error && (
            <div
              style={{
                color: '#EB1C23',
                fontSize: '14px',
                padding: '8px 12px',
                background: 'rgba(235, 28, 35, 0.05)',
                borderRadius: '8px',
                alignSelf: 'flex-start',
              }}
            >
              {error}
            </div>
          )}

          {/* Classic lead form — elaborated (type === 'lead') or legacy fallback
              (no lead_form block at all). Newsletter / multi-choice /
              app-download renderers live after this block. */}
          {isClassicPath && showLeadForm && !leadSubmitted && (
            <div
              style={{
                position: 'relative', // anchor for the iOS-style dismiss chevron
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: `1px solid ${panelBorder}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* iOS-style dismiss chevron — centered, subtle. Collapses the
                  form and returns the user to the conversation. Matches the
                  iOS sheet-dismiss affordance users already know. */}
              <button
                type="button"
                onClick={() => setShowLeadForm(false)}
                aria-label="Dismiss — return to the conversation"
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '34px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: `1px solid ${panelBorder}`,
                  borderRadius: '10px',
                  color: mutedText,
                  cursor: 'pointer',
                  transition: 'color 200ms ease, background 200ms ease, border-color 200ms ease',
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = accentColor;
                  e.currentTarget.style.borderColor = `${accentColor}55`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.color = mutedText;
                  e.currentTarget.style.borderColor = panelBorder;
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <polyline
                    points="6 9 12 15 18 9"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Intro — display font via CSS var (sites set --font-display)
                  with fallback to the inherited sans. Tight tracking matches
                  the h1-h6 convention used across client sites (~-0.02em). */}
              <div style={{
                fontSize: '17px',
                fontWeight: 700,
                color: textColor,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-display, inherit)',
                margin: '18px 40px 0 0',
              }}>
                {activeIntro}
              </div>

              {/* SLA line — eyebrow pattern: small uppercase w/ 0.18em tracking
                  in accent color. Echoes .eyebrow from each site's globals.css. */}
              {activeSlaLabel && (
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: accentColor,
                  lineHeight: 1.45,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  margin: '2px 0 8px',
                }}>
                  {activeSlaLabel}
                </div>
              )}

              {/* Name — required on elaborated + HV paths */}
              {(useElaborated || useHvEarly) && (
                <FormField label="Full name" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Your name"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="name"
                  />
                </FormField>
              )}
              {useLegacyFallback && (
                <FormField label="Name (optional)" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Your name"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="name"
                  />
                </FormField>
              )}

              {/* Phone — required on elaborated + HV paths, optional on legacy */}
              {(useElaborated || useHvEarly) && (
                <FormField label="Phone" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="(___) ___-____"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="tel"
                  />
                </FormField>
              )}
              {useLegacyFallback && (
                <FormField label="Phone (optional)" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="(___) ___-____"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="tel"
                  />
                </FormField>
              )}

              {/* Property address — AOE only (require_address flag) */}
              {requireAddress && (
                <FormField label="Property address" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="text"
                    value={leadAddress}
                    onChange={(e) => setLeadAddress(e.target.value)}
                    placeholder="Street, city, ZIP"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="street-address"
                  />
                </FormField>
              )}

              {/* Email — hidden on HV-early (we want to minimize friction) */}
              {showEmailField && (
                <FormField label="Email" textColor={textColor} mutedText={mutedText}>
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitLead();
                      }
                    }}
                    placeholder="you@example.com"
                    disabled={leadSubmitting}
                    style={inputFieldStyle}
                    autoComplete="email"
                  />
                </FormField>
              )}

              {/* "Anything else?" textarea (elaborated only, optional) */}
              {showNotesField && (
                <FormField
                  label="Anything else? (optional)"
                  textColor={textColor}
                  mutedText={mutedText}
                  helper={classicLeadForm?.notes_helper}
                >
                  <textarea
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    disabled={leadSubmitting}
                    rows={2}
                    style={{ ...inputFieldStyle, resize: 'vertical', minHeight: '52px' }}
                  />
                </FormField>
              )}

              {/* Include-transcript checkbox (elaborated, non-HV, messages present) */}
              {showTranscriptCheckbox && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginTop: '6px',
                    padding: '10px 12px',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${panelBorder}`,
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: textColor,
                    cursor: 'pointer',
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeTranscript}
                    onChange={(e) => setIncludeTranscript(e.target.checked)}
                    disabled={leadSubmitting}
                    style={{
                      marginTop: '2px',
                      width: '16px',
                      height: '16px',
                      accentColor: accentColor,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontWeight: 500 }}>
                      Include this conversation ({messages.length} {messages.length === 1 ? 'message' : 'messages'})
                    </span>
                    {classicLeadForm?.transcript_checkbox_helper && (
                      <span style={{ fontSize: '11px', color: mutedText, fontWeight: 400 }}>
                        {classicLeadForm.transcript_checkbox_helper}
                      </span>
                    )}
                  </span>
                </label>
              )}

              {/* Submit — pill button (matches .btn-primary in every site's
                  globals.css: 100px radius, 14px 32px padding, 700 weight). */}
              <button
                onClick={submitLead}
                disabled={leadSubmitting}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '8px',
                  background: accentColor,
                  color: '#fff',
                  border: `1px solid ${accentColor}`,
                  borderRadius: 'var(--radius-pill, 100px)',
                  padding: '14px 32px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                  cursor: leadSubmitting ? 'default' : 'pointer',
                  opacity: leadSubmitting ? 0.5 : 1,
                  boxShadow: `0 10px 30px -8px ${accentColor}40`,
                  transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!leadSubmitting) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = `0 14px 36px -10px ${accentColor}55`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 10px 30px -8px ${accentColor}40`;
                }}
              >
                {leadSubmitting ? 'Sending…' : activeSubmitLabel}
              </button>

              {/* Secondary CTA — tel: link or similar (elaborated only).
                  Eyebrow treatment: uppercase 10px, 0.18em tracking, muted →
                  accent on hover. Matches the site's .eyebrow convention. */}
              {activeSecondaryCta && (
                <a
                  href={activeSecondaryCta.href}
                  style={{
                    display: 'block',
                    marginTop: '2px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: mutedText,
                    textAlign: 'center',
                    textDecoration: 'none',
                    padding: '6px 4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    transition: 'color 200ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = accentColor; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = mutedText; }}
                >
                  {activeSecondaryCta.label}
                </a>
              )}
            </div>
          )}

          {/* Classic success state */}
          {isClassicPath && showLeadForm && leadSubmitted && (
            <div
              style={{
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: `1px solid ${panelBorder}`,
                fontSize: '14px',
                color: aiTextColor,
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {leadSuccessMessage || (
                <>Thanks — we&apos;ll be in touch at <strong>{leadEmail || leadPhone}</strong>.</>
              )}
            </div>
          )}

          {/* Newsletter form — single email input, POSTs to centralized apex
              subscribe endpoint. Shown when lead_form.type === 'newsletter'. */}
          {showLeadForm && leadForm?.type === 'newsletter' && (
            <NewsletterFormRenderer
              config={leadForm}
              tenantId={tenantId}
              accentColor={accentColor}
              textColor={textColor}
              mutedText={mutedText}
              panelBorder={panelBorder}
              inputFieldStyle={inputFieldStyle}
              submitting={newsletterSubmitting}
              submitted={newsletterSubmitted}
              successMessage={newsletterSuccessMessage}
              onDismiss={() => setShowLeadForm(false)}
              onSubmitting={setNewsletterSubmitting}
              onSubmitted={(msg) => {
                setNewsletterSuccessMessage(msg);
                setNewsletterSubmitted(true);
              }}
              onError={setError}
              error={error}
            />
          )}

          {/* Multi-choice picker — button grid that dispatches to inline
              newsletter / lead sub-form or external link. */}
          {showLeadForm && leadForm?.type === 'multi-choice' && (
            <MultiChoiceFormRenderer
              config={leadForm}
              activeChoiceId={activeChoiceId}
              setActiveChoiceId={setActiveChoiceId}
              tenantId={tenantId}
              accentColor={accentColor}
              textColor={textColor}
              mutedText={mutedText}
              panelBorder={panelBorder}
              panelBg={panelBg}
              isDark={isDark}
              inputFieldStyle={inputFieldStyle}
              newsletterSubmitting={newsletterSubmitting}
              newsletterSubmitted={newsletterSubmitted}
              newsletterSuccessMessage={newsletterSuccessMessage}
              leadSubmitting={leadSubmitting}
              leadSubmitted={leadSubmitted}
              leadSuccessMessage={leadSuccessMessage}
              leadName={leadName}
              leadEmail={leadEmail}
              leadPhone={leadPhone}
              leadNotes={leadNotes}
              setLeadName={setLeadName}
              setLeadEmail={setLeadEmail}
              setLeadPhone={setLeadPhone}
              setLeadNotes={setLeadNotes}
              onDismiss={() => {
                setShowLeadForm(false);
                setActiveChoiceId(null);
              }}
              onNewsletterSubmitting={setNewsletterSubmitting}
              onNewsletterSubmitted={(msg) => {
                setNewsletterSuccessMessage(msg);
                setNewsletterSubmitted(true);
              }}
              onLeadSubmitting={setLeadSubmitting}
              onLeadSubmitted={(msg) => {
                setLeadSuccessMessage(msg);
                setLeadSubmitted(true);
              }}
              leadEndpoint={leadEndpoint}
              sessionId={sessionId}
              messages={messages}
              includeTranscript={includeTranscript}
              error={error}
              setError={setError}
            />
          )}

          {/* App-download — store badges + waitlist fallback */}
          {showLeadForm && leadForm?.type === 'app-download' && (
            <AppDownloadFormRenderer
              config={leadForm}
              sessionId={sessionId}
              tenantId={tenantId}
              accentColor={accentColor}
              textColor={textColor}
              mutedText={mutedText}
              panelBorder={panelBorder}
              onDismiss={() => setShowLeadForm(false)}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Command bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          background: barBg,
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: `1px solid ${barBorder}`,
          borderRadius: '28px',
          padding: '10px 12px 10px 24px',
          boxShadow: isFocused
            ? `inset 0 1px 0 ${barTopHighlightFocused}, ${barShadowFocused}, 0 0 0 1px ${accentColor}26`
            : `inset 0 1px 0 ${barTopHighlight}, ${barShadow}`,
          transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isFocused ? 'scale(1.005)' : 'scale(1)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={placeholder}
          aria-label="Chat with concierge"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '16px',
            fontFamily: 'inherit',
            fontWeight: 400,
            outline: 'none',
            padding: '10px 8px',
            color: textColor,
            minWidth: 0,
            ['--concierge-placeholder' as string]: placeholderColor,
          }}
        />

        {showShortcut && (
          <span
            style={{
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 500,
              color: kbdColor,
              border: `1px solid ${kbdBorder}`,
              background: kbdBg,
              borderRadius: '6px',
              padding: '4px 8px',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              marginRight: '10px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {isMac ? '⌘' : 'Ctrl'} K
          </span>
        )}

        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          type="button"
          aria-label="Send message"
          style={{
            background: accentColor,
            color: '#fff',
            border: 'none',
            borderRadius: '20px',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            boxShadow: `0 4px 12px ${accentColor}40`,
            cursor: !input.trim() || isLoading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 200ms ease, opacity 200ms ease',
            opacity: !input.trim() || isLoading ? 0.5 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Internal form-field helper ────────────────────────────────────────
// Wraps each input with an eyebrow-style label + optional helper line,
// matching the .eyebrow / .contact-home-meta dt pattern every client
// site already uses (10px 700 uppercase, 0.18em tracking). Keeps the
// main component render lean.
function FormField({
  label,
  helper,
  children,
  textColor,
  mutedText,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  textColor: string;
  mutedText: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: mutedText,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      {children}
      {helper && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 400,
            color: mutedText,
            lineHeight: 1.5,
            marginTop: '2px',
          }}
        >
          {helper}
        </span>
      )}
    </label>
  );
}

// ── Shared dismiss chevron ───────────────────────────────────────────
// Matches the iOS sheet-dismiss affordance used on the classic form.
// Extracted here because newsletter / multi-choice / app-download
// renderers all need the same top-center chevron.
function DismissChevron({
  onClick,
  accentColor,
  mutedText,
  panelBorder,
}: {
  onClick: () => void;
  accentColor: string;
  mutedText: string;
  panelBorder: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss — return to the conversation"
      style={{
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '34px',
        height: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${panelBorder}`,
        borderRadius: '10px',
        color: mutedText,
        cursor: 'pointer',
        transition: 'color 200ms ease, background 200ms ease, border-color 200ms ease',
        opacity: 0.7,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.color = accentColor;
        e.currentTarget.style.borderColor = `${accentColor}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.7';
        e.currentTarget.style.color = mutedText;
        e.currentTarget.style.borderColor = panelBorder;
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <polyline
          points="6 9 12 15 18 9"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ── Shared pill-button style ────────────────────────────────────────
// Mirrors the classic form's submit button — matches every site's
// .btn-primary (100px radius, 14px 32px padding, 700 weight).
function pillButtonStyle(accentColor: string, disabled: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
    background: accentColor,
    color: '#fff',
    border: `1px solid ${accentColor}`,
    borderRadius: 'var(--radius-pill, 100px)',
    padding: '14px 32px',
    fontSize: '0.95rem',
    fontWeight: 700,
    lineHeight: 1,
    fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    boxShadow: `0 10px 30px -8px ${accentColor}40`,
    transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
  } as const;
}

// ── Shared title + subtitle (matches classic-form intro) ────────────
function FormHeader({
  title,
  subtitle,
  textColor,
  mutedText,
}: {
  title: string;
  subtitle?: string;
  textColor: string;
  mutedText: string;
}) {
  return (
    <>
      <div style={{
        fontSize: '17px',
        fontWeight: 700,
        color: textColor,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-display, inherit)',
        margin: '18px 40px 0 0',
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '13px',
          fontWeight: 400,
          color: mutedText,
          lineHeight: 1.5,
          marginTop: '4px',
          marginRight: '40px',
        }}>
          {subtitle}
        </div>
      )}
    </>
  );
}

// ── Newsletter renderer ─────────────────────────────────────────────
// Single email input + pill submit. POSTs `{ email, tenant_id, source }`
// to the tenant-configured subscribe_endpoint (defaults to the site's
// local proxy at `/api/newsletter/subscribe`). When tenant_id isn't yet
// emitted by apex (Phase 2 shipped before Phase 3), the request still
// sends with tenant_id=null — apex is expected to 400 it, which the
// renderer surfaces as an error.
function NewsletterFormRenderer({
  config,
  tenantId,
  accentColor,
  textColor,
  mutedText,
  panelBorder,
  inputFieldStyle,
  submitting,
  submitted,
  successMessage,
  onDismiss,
  onSubmitting,
  onSubmitted,
  onError,
  error,
}: {
  config: NewsletterFormConfig;
  tenantId: string | null;
  accentColor: string;
  textColor: string;
  mutedText: string;
  panelBorder: string;
  inputFieldStyle: React.CSSProperties;
  submitting: boolean;
  submitted: boolean;
  successMessage: string | null;
  onDismiss: () => void;
  onSubmitting: (v: boolean) => void;
  onSubmitted: (msg: string) => void;
  onError: (msg: string | null) => void;
  error: string | null;
}) {
  const [email, setEmail] = useState('');

  const submit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return onError('Please enter your email.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return onError('Please enter a valid email.');

    onError(null);
    onSubmitting(true);
    try {
      const endpoint = config.subscribe_endpoint || '/api/newsletter/subscribe';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          tenant_id: tenantId,
          source: 'concierge',
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Unable to subscribe — please try again.');
      }
      const success = substituteTokens(config.success_message, { email: trimmed });
      onSubmitted(success);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to subscribe — please try again.');
    } finally {
      onSubmitting(false);
    }
  }, [email, tenantId, config, onError, onSubmitting, onSubmitted]);

  if (submitted) {
    return (
      <div style={{
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: `1px solid ${panelBorder}`,
        fontSize: '14px',
        color: textColor,
        lineHeight: 1.5,
        textAlign: 'center',
      }}>
        {successMessage || 'Thanks — check your email to confirm.'}
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      marginTop: '8px',
      paddingTop: '16px',
      borderTop: `1px solid ${panelBorder}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <DismissChevron
        onClick={onDismiss}
        accentColor={accentColor}
        mutedText={mutedText}
        panelBorder={panelBorder}
      />

      <FormHeader title={config.title} subtitle={config.subtitle} textColor={textColor} mutedText={mutedText} />

      <FormField label="Email" textColor={textColor} mutedText={mutedText}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={config.email_placeholder || 'you@example.com'}
          disabled={submitting}
          style={inputFieldStyle}
          autoComplete="email"
        />
      </FormField>

      {error && (
        <div style={{
          color: '#EB1C23',
          fontSize: '13px',
          padding: '6px 10px',
          background: 'rgba(235, 28, 35, 0.05)',
          borderRadius: '8px',
        }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        style={pillButtonStyle(accentColor, submitting)}
        onMouseEnter={(e) => {
          if (!submitting) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 14px 36px -10px ${accentColor}55`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 10px 30px -8px ${accentColor}40`;
        }}
      >
        {submitting ? 'Subscribing…' : config.submit_label}
      </button>
    </div>
  );
}

// ── Multi-choice renderer ──────────────────────────────────────────
// Picker → inline sub-form. `activeChoiceId === null` renders the
// button grid. Tapping a choice either:
//   • newsletter → inline email-only sub-form
//   • lead       → inline classic lead sub-form (minimal: name + email
//                  + phone + notes, matching the MMML/CTAL/AOE pattern)
//   • external_link → sendBeacon + window.open + dismiss
function MultiChoiceFormRenderer({
  config,
  activeChoiceId,
  setActiveChoiceId,
  tenantId,
  accentColor,
  textColor,
  mutedText,
  panelBorder,
  panelBg,
  isDark,
  inputFieldStyle,
  newsletterSubmitting,
  newsletterSubmitted,
  newsletterSuccessMessage,
  leadSubmitting,
  leadSubmitted,
  leadSuccessMessage,
  leadName,
  leadEmail,
  leadPhone,
  leadNotes,
  setLeadName,
  setLeadEmail,
  setLeadPhone,
  setLeadNotes,
  onDismiss,
  onNewsletterSubmitting,
  onNewsletterSubmitted,
  onLeadSubmitting,
  onLeadSubmitted,
  leadEndpoint,
  sessionId,
  messages,
  includeTranscript,
  error,
  setError,
}: {
  config: MultiChoiceFormConfig;
  activeChoiceId: string | null;
  setActiveChoiceId: (id: string | null) => void;
  tenantId: string | null;
  accentColor: string;
  textColor: string;
  mutedText: string;
  panelBorder: string;
  panelBg: string;
  isDark: boolean;
  inputFieldStyle: React.CSSProperties;
  newsletterSubmitting: boolean;
  newsletterSubmitted: boolean;
  newsletterSuccessMessage: string | null;
  leadSubmitting: boolean;
  leadSubmitted: boolean;
  leadSuccessMessage: string | null;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadNotes: string;
  setLeadName: (v: string) => void;
  setLeadEmail: (v: string) => void;
  setLeadPhone: (v: string) => void;
  setLeadNotes: (v: string) => void;
  onDismiss: () => void;
  onNewsletterSubmitting: (v: boolean) => void;
  onNewsletterSubmitted: (msg: string) => void;
  onLeadSubmitting: (v: boolean) => void;
  onLeadSubmitted: (msg: string) => void;
  leadEndpoint: string;
  sessionId: string | null;
  messages: Message[];
  includeTranscript: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
}) {
  const activeChoice = activeChoiceId
    ? config.choices.find((c) => c.id === activeChoiceId) ?? null
    : null;

  // Sub-form: newsletter
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const submitNewsletterSub = useCallback(async () => {
    if (activeChoice?.action.kind !== 'newsletter') return;
    const sub = activeChoice.action.sub_form;
    const trimmed = newsletterEmail.trim();
    if (!trimmed) return setError('Please enter your email.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return setError('Please enter a valid email.');

    setError(null);
    onNewsletterSubmitting(true);
    try {
      const endpoint = sub.subscribe_endpoint || '/api/newsletter/subscribe';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          tenant_id: tenantId,
          source: 'concierge',
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Unable to subscribe — please try again.');
      }
      const success = substituteTokens(sub.success_message, { email: trimmed });
      onNewsletterSubmitted(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to subscribe — please try again.');
    } finally {
      onNewsletterSubmitting(false);
    }
  }, [newsletterEmail, tenantId, activeChoice, setError, onNewsletterSubmitting, onNewsletterSubmitted]);

  // Sub-form: lead
  const submitLeadSub = useCallback(async () => {
    if (activeChoice?.action.kind !== 'lead') return;
    const name = leadName.trim();
    const email = leadEmail.trim();
    const phone = leadPhone.trim();
    const notes = leadNotes.trim();

    if (!name) return setError('Please enter your name.');
    if (!email) return setError('Please enter your email.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return setError('Please enter a valid email.');

    setError(null);
    onLeadSubmitting(true);
    try {
      const transcript = includeTranscript && messages.length > 0
        ? serializeTranscript(messages).slice(0, 32 * 1024)
        : undefined;
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const resp = await fetch(leadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          phone: phone || null,
          notes: notes || undefined,
          question: lastUserMsg?.content || '',
          transcript,
          include_transcript: !!transcript,
          lead_mode: 'concierge-multi-choice',
          pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
          sessionId,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Unable to submit — please try again.');
      }
      const template = activeChoice.action.sub_form.success_message;
      const success = substituteTokens(template, { name, email, phone });
      onLeadSubmitted(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit — please try again.');
    } finally {
      onLeadSubmitting(false);
    }
  }, [activeChoice, leadName, leadEmail, leadPhone, leadNotes, leadEndpoint, sessionId, messages, includeTranscript, onLeadSubmitting, onLeadSubmitted, setError]);

  // External-link tap — fire beacon before navigating. Non-blocking.
  const handleExternalTap = useCallback(
    (href: string, beaconTag: string | undefined) => {
      try {
        if (beaconTag && typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/concierge-choice-tap',
            JSON.stringify({
              beacon_tag: beaconTag,
              tenant_id: tenantId,
              href,
              pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
            })
          );
        }
      } catch {
        /* no-op */
      }
      if (typeof window !== 'undefined') {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
      onDismiss();
    },
    [tenantId, onDismiss]
  );

  // ── Render: newsletter sub-form success ──
  if (activeChoice?.action.kind === 'newsletter' && newsletterSubmitted) {
    return (
      <div style={{
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: `1px solid ${panelBorder}`,
        fontSize: '14px',
        color: textColor,
        lineHeight: 1.5,
        textAlign: 'center',
      }}>
        {newsletterSuccessMessage || 'Thanks — check your email to confirm.'}
      </div>
    );
  }

  // ── Render: lead sub-form success ──
  if (activeChoice?.action.kind === 'lead' && leadSubmitted) {
    return (
      <div style={{
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: `1px solid ${panelBorder}`,
        fontSize: '14px',
        color: textColor,
        lineHeight: 1.5,
        textAlign: 'center',
      }}>
        {leadSuccessMessage || 'Thanks — we\'ll be in touch soon.'}
      </div>
    );
  }

  // ── Render: newsletter sub-form ──
  if (activeChoice?.action.kind === 'newsletter') {
    const sub = activeChoice.action.sub_form;
    return (
      <div style={{
        position: 'relative',
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: `1px solid ${panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <DismissChevron
          onClick={onDismiss}
          accentColor={accentColor}
          mutedText={mutedText}
          panelBorder={panelBorder}
        />

        <FormHeader title={activeChoice.label} subtitle={activeChoice.sub_label} textColor={textColor} mutedText={mutedText} />

        <FormField label="Email" textColor={textColor} mutedText={mutedText}>
          <input
            type="email"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitNewsletterSub();
              }
            }}
            placeholder={sub.email_placeholder || 'you@example.com'}
            disabled={newsletterSubmitting}
            style={inputFieldStyle}
            autoComplete="email"
          />
        </FormField>

        {error && (
          <div style={{
            color: '#EB1C23',
            fontSize: '13px',
            padding: '6px 10px',
            background: 'rgba(235, 28, 35, 0.05)',
            borderRadius: '8px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => { setActiveChoiceId(null); setError(null); }}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: mutedText,
              background: 'transparent',
              border: 'none',
              padding: '8px 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={submitNewsletterSub}
            disabled={newsletterSubmitting}
            style={{ ...pillButtonStyle(accentColor, newsletterSubmitting), marginTop: 0, flex: 1 }}
          >
            {newsletterSubmitting ? 'Subscribing…' : sub.submit_label}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: lead sub-form ──
  if (activeChoice?.action.kind === 'lead') {
    const sub = activeChoice.action.sub_form;
    return (
      <div style={{
        position: 'relative',
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: `1px solid ${panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <DismissChevron
          onClick={onDismiss}
          accentColor={accentColor}
          mutedText={mutedText}
          panelBorder={panelBorder}
        />

        <FormHeader title={sub.intro} textColor={textColor} mutedText={mutedText} />

        {sub.sla_label && (
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            color: accentColor,
            lineHeight: 1.45,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            margin: '2px 0 8px',
          }}>
            {sub.sla_label}
          </div>
        )}

        <FormField label="Full name" textColor={textColor} mutedText={mutedText}>
          <input
            type="text"
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
            placeholder="Your name"
            disabled={leadSubmitting}
            style={inputFieldStyle}
            autoComplete="name"
          />
        </FormField>
        <FormField label="Phone" textColor={textColor} mutedText={mutedText}>
          <input
            type="tel"
            value={leadPhone}
            onChange={(e) => setLeadPhone(e.target.value)}
            placeholder="(___) ___-____"
            disabled={leadSubmitting}
            style={inputFieldStyle}
            autoComplete="tel"
          />
        </FormField>
        <FormField label="Email" textColor={textColor} mutedText={mutedText}>
          <input
            type="email"
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitLeadSub();
              }
            }}
            placeholder="you@example.com"
            disabled={leadSubmitting}
            style={inputFieldStyle}
            autoComplete="email"
          />
        </FormField>
        <FormField label="Notes (optional)" textColor={textColor} mutedText={mutedText} helper={sub.notes_helper}>
          <textarea
            value={leadNotes}
            onChange={(e) => setLeadNotes(e.target.value)}
            disabled={leadSubmitting}
            rows={2}
            style={{ ...inputFieldStyle, resize: 'vertical', minHeight: '52px' }}
          />
        </FormField>

        {error && (
          <div style={{
            color: '#EB1C23',
            fontSize: '13px',
            padding: '6px 10px',
            background: 'rgba(235, 28, 35, 0.05)',
            borderRadius: '8px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => { setActiveChoiceId(null); setError(null); }}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: mutedText,
              background: 'transparent',
              border: 'none',
              padding: '8px 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={submitLeadSub}
            disabled={leadSubmitting}
            style={{ ...pillButtonStyle(accentColor, leadSubmitting), marginTop: 0, flex: 1 }}
          >
            {leadSubmitting ? 'Sending…' : sub.submit_label}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: choice grid (default) ──
  // Suppress unused-var warnings for refs that only apply in sub-form branches.
  void panelBg; void isDark;

  return (
    <div style={{
      position: 'relative',
      marginTop: '8px',
      paddingTop: '16px',
      borderTop: `1px solid ${panelBorder}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <DismissChevron
        onClick={onDismiss}
        accentColor={accentColor}
        mutedText={mutedText}
        panelBorder={panelBorder}
      />

      <FormHeader title={config.title} subtitle={config.subtitle} textColor={textColor} mutedText={mutedText} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        {config.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => {
              if (choice.action.kind === 'external_link') {
                handleExternalTap(choice.action.href, choice.action.beacon_tag);
              } else {
                setError(null);
                setActiveChoiceId(choice.id);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '3px',
              padding: '14px 18px',
              background: 'transparent',
              border: `1px solid ${panelBorder}`,
              borderRadius: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'border-color 200ms ease, background 200ms ease, transform 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${accentColor}66`;
              e.currentTarget.style.background = `${accentColor}0a`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = panelBorder;
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: textColor,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}>
              {choice.label}
            </span>
            {choice.sub_label && (
              <span style={{
                fontSize: '12px',
                fontWeight: 400,
                color: mutedText,
                lineHeight: 1.45,
              }}>
                {choice.sub_label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App-download renderer ──────────────────────────────────────────
// Renders App Store + Play Store badges when URLs are configured.
// When neither store URL is set, falls back to a single pill button
// pointing to waitlist_url. Each tap fires a sendBeacon before
// navigation so apex can track install-intent by platform.
function AppDownloadFormRenderer({
  config,
  sessionId,
  tenantId,
  accentColor,
  textColor,
  mutedText,
  panelBorder,
  onDismiss,
}: {
  config: AppDownloadFormConfig;
  sessionId: string | null;
  tenantId: string | null;
  accentColor: string;
  textColor: string;
  mutedText: string;
  panelBorder: string;
  onDismiss: () => void;
}) {
  const emitBeacon = useCallback(
    (beaconTag: string | undefined, href: string) => {
      try {
        if (beaconTag && typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/concierge-choice-tap',
            JSON.stringify({
              beacon_tag: beaconTag,
              tenant_id: tenantId,
              sessionId,
              href,
              pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
            })
          );
        }
      } catch {
        /* no-op */
      }
    },
    [tenantId, sessionId]
  );

  const hasStoreUrl = !!(config.ios_url || config.android_url);

  return (
    <div style={{
      position: 'relative',
      marginTop: '8px',
      paddingTop: '16px',
      borderTop: `1px solid ${panelBorder}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <DismissChevron
        onClick={onDismiss}
        accentColor={accentColor}
        mutedText={mutedText}
        panelBorder={panelBorder}
      />

      <FormHeader title={config.title} subtitle={config.subtitle} textColor={textColor} mutedText={mutedText} />

      {hasStoreUrl && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '10px',
          justifyContent: 'flex-start',
          alignItems: 'center',
        }}>
          {config.ios_url && (
            <a
              href={config.ios_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitBeacon(config.beacon_tags?.ios, config.ios_url!)}
              aria-label="Download on the App Store"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                transition: 'transform 200ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <AppStoreBadge height={44} />
            </a>
          )}
          {config.android_url && (
            <a
              href={config.android_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => emitBeacon(config.beacon_tags?.android, config.android_url!)}
              aria-label="Get it on Google Play"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                transition: 'transform 200ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <PlayStoreBadge height={44} />
            </a>
          )}
        </div>
      )}

      {!hasStoreUrl && config.waitlist_url && (
        <a
          href={config.waitlist_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => emitBeacon(config.beacon_tags?.waitlist, config.waitlist_url!)}
          style={{
            ...pillButtonStyle(accentColor, false),
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 14px 36px -10px ${accentColor}55`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 10px 30px -8px ${accentColor}40`;
          }}
        >
          Join the waitlist
        </a>
      )}
    </div>
  );
}

export { ConciergeWidget };
export default ConciergeWidget;
