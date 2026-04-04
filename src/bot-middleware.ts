/**
 * Bot detection + tracking middleware helper for Next.js sites.
 *
 * Detects bots via User-Agent and fire-and-forgets a webhook POST to the Apex
 * bot analytics endpoint. Uses NextFetchEvent.waitUntil so the tracking call
 * never blocks the response.
 *
 * Usage in a site's src/middleware.ts:
 *
 *   import { trackBot } from "@isimplifyme/ui/bot-middleware";
 *
 *   export function middleware(req: NextRequest, event: NextFetchEvent) {
 *     trackBot(req, event, {
 *       webhookUrl: "https://apex.isimplifyme.com/api/webhooks/bot-hit",
 *       webhookSecret: process.env.BOT_WEBHOOK_SECRET,
 *     });
 *     // ... other middleware logic
 *   }
 */
import type { NextRequest, NextFetchEvent } from "next/server";

export type BotCategory = "ai" | "search" | "seo" | "monitoring" | "social" | "other";

export interface BotMatch {
  name: string;
  company: string;
  type: BotCategory;
}

interface BotPattern extends BotMatch {
  pattern: RegExp;
}

/** 48 bots across 6 categories — kept in sync with apex-portal src/lib/bots/parser.ts */
export const BOT_PATTERNS: readonly BotPattern[] = [
  // AI crawlers
  { pattern: /GPTBot/i, name: "GPTBot", company: "OpenAI", type: "ai" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", company: "OpenAI", type: "ai" },
  { pattern: /OAI-SearchBot/i, name: "OAI-SearchBot", company: "OpenAI", type: "ai" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot", company: "Anthropic", type: "ai" },
  { pattern: /anthropic-ai/i, name: "anthropic-ai", company: "Anthropic", type: "ai" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", company: "Perplexity", type: "ai" },
  { pattern: /Google-Extended/i, name: "Google-Extended", company: "Google", type: "ai" },
  { pattern: /Bytespider/i, name: "Bytespider", company: "ByteDance", type: "ai" },
  { pattern: /Meta-ExternalAgent/i, name: "Meta-ExternalAgent", company: "Meta", type: "ai" },
  { pattern: /meta-externalfetcher/i, name: "meta-externalfetcher", company: "Meta", type: "ai" },
  { pattern: /FacebookBot/i, name: "FacebookBot", company: "Meta", type: "ai" },
  { pattern: /YouBot/i, name: "YouBot", company: "You.com", type: "ai" },
  { pattern: /cohere-ai/i, name: "Cohere-ai", company: "Cohere", type: "ai" },
  { pattern: /AI2Bot/i, name: "AI2Bot", company: "Allen AI", type: "ai" },
  { pattern: /Amazonbot/i, name: "Amazonbot", company: "Amazon", type: "ai" },
  { pattern: /Diffbot/i, name: "Diffbot", company: "Diffbot", type: "ai" },
  { pattern: /Applebot-Extended/i, name: "Applebot-Extended", company: "Apple", type: "ai" },
  { pattern: /Timpibot/i, name: "Timpibot", company: "Timpi", type: "ai" },
  { pattern: /webzio/i, name: "Webz.io", company: "Webz.io", type: "ai" },
  { pattern: /omgili/i, name: "omgili", company: "Webz.io", type: "ai" },
  { pattern: /PiplBot/i, name: "PiplBot", company: "Pipl", type: "ai" },
  { pattern: /iaskspider/i, name: "iaskspider", company: "iAsk.AI", type: "ai" },
  { pattern: /Velenpublicwebcrawler/i, name: "Velenpublicwebcrawler", company: "Velen", type: "ai" },
  { pattern: /img2dataset/i, name: "img2dataset", company: "LAION", type: "ai" },
  // Search
  { pattern: /Googlebot/i, name: "Googlebot", company: "Google", type: "search" },
  { pattern: /bingbot/i, name: "Bingbot", company: "Microsoft", type: "search" },
  { pattern: /Applebot/i, name: "Applebot", company: "Apple", type: "search" },
  { pattern: /YandexBot/i, name: "YandexBot", company: "Yandex", type: "search" },
  { pattern: /DuckDuckBot/i, name: "DuckDuckBot", company: "DuckDuckGo", type: "search" },
  // SEO
  { pattern: /AhrefsBot/i, name: "AhrefsBot", company: "Ahrefs", type: "seo" },
  { pattern: /SemrushBot/i, name: "SemrushBot", company: "Semrush", type: "seo" },
  { pattern: /MJ12bot/i, name: "MJ12bot", company: "Majestic", type: "seo" },
  // Monitoring
  { pattern: /UptimeRobot/i, name: "UptimeRobot", company: "UptimeRobot", type: "monitoring" },
  { pattern: /Pingdom/i, name: "Pingdom", company: "Pingdom", type: "monitoring" },
  // Social
  { pattern: /Twitterbot/i, name: "Twitterbot", company: "X/Twitter", type: "social" },
  { pattern: /facebookexternalhit/i, name: "facebookexternalhit", company: "Meta", type: "social" },
  { pattern: /LinkedInBot/i, name: "LinkedInBot", company: "LinkedIn", type: "social" },
  { pattern: /Slackbot/i, name: "Slackbot", company: "Slack", type: "social" },
  // Other
  { pattern: /WordPress/i, name: "WordPress", company: "WordPress", type: "other" },
  { pattern: /HubSpot/i, name: "HubSpot", company: "HubSpot", type: "other" },
  { pattern: /CCBot/i, name: "CCBot", company: "Common Crawl", type: "other" },
] as const;

/** Match a User-Agent string against the known bot patterns. Returns null if not matched. */
export function detectBot(userAgent: string | null | undefined): BotMatch | null {
  if (!userAgent) return null;
  for (const bot of BOT_PATTERNS) {
    if (bot.pattern.test(userAgent)) {
      return { name: bot.name, company: bot.company, type: bot.type };
    }
  }
  return null;
}

/**
 * Generic fallback — catches emerging/unknown bots whose UA contains common
 * crawler keywords but doesn't match any known pattern. Returned matches are
 * named "Unknown" so they group together, but the full UA is preserved in
 * the tracked payload so apex-portal can surface them for manual classification.
 */
const UNKNOWN_BOT_RE = /\b(bot|crawler|spider|scraper|fetcher|archiver|indexer|worm|mechanize|slurp)\b/i;

export function detectUnknownBot(userAgent: string | null | undefined): BotMatch | null {
  if (!userAgent) return null;
  if (UNKNOWN_BOT_RE.test(userAgent)) {
    return { name: "Unknown", company: "Unknown", type: "other" };
  }
  return null;
}

export interface TrackBotOptions {
  /** Full webhook URL, e.g. https://apex.isimplifyme.com/api/webhooks/bot-hit */
  webhookUrl: string;
  /** Shared secret sent as x-api-key. If empty or undefined, tracking is skipped. */
  webhookSecret: string | undefined;
  /**
   * Optional deployment region identifier, forwarded in the payload as `region`.
   * Typically `process.env.AWS_REGION` from the calling middleware. Left out of
   * the package code directly so @isimplifyme/ui doesn't depend on @types/node.
   */
  region?: string;
}

/**
 * Fire-and-forget bot tracking. Call from your middleware — it never throws,
 * never blocks the response, and silently skips non-bot requests.
 *
 * Known bots (from BOT_PATTERNS) are classified with name/company/type.
 * Unknown-but-bot-like UAs (matching UNKNOWN_BOT_RE) are sent as name="Unknown"
 * with the full UA preserved so apex-portal can surface them for classification.
 */
export function trackBot(
  req: NextRequest,
  event: NextFetchEvent,
  options: TrackBotOptions
): void {
  if (!options.webhookSecret) return;

  const ua = req.headers.get("user-agent");
  const bot = detectBot(ua) ?? detectUnknownBot(ua);
  if (!bot) return;

  const url = new URL(req.url);
  const now = new Date();
  const referer = req.headers.get("referer");

  const payload = {
    bot: bot.name,
    type: bot.type,
    company: bot.company,
    path: url.pathname,
    domain: url.hostname,
    status: 200,
    hour: now.getUTCHours(),
    timestamp: now.toISOString(),
    // v1.0.4 extensions
    fullUA: ua || "",
    referer: referer || null,
    region: options.region || "",
    unknown: bot.name === "Unknown",
  };

  event.waitUntil(
    fetch(options.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.webhookSecret,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail — bot tracking must never break a page load
    })
  );
}
