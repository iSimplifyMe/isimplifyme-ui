import { describe, it, expect, vi } from "vitest";
import {
  AGENT_FETCHERS,
  botKind,
  declaredAgentBot,
  detectBot,
  detectDeclaredAgent,
  trackBot,
} from "./bot-middleware";

const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

describe("detectDeclaredAgent (Web Bot Auth)", () => {
  it("reads a quoted Signature-Agent URL and the signature headers", () => {
    expect(
      detectDeclaredAgent(headers({
        "signature-agent": '"https://chatgpt.com"',
        "signature-input": 'sig1=("@authority" "signature-agent");created=1758600000;keyid="k1"',
        signature: "sig1=:abc=:",
      })),
    ).toEqual({ directory: "chatgpt.com", signed: true });
  });
  it("accepts a bare host and reports unsigned when the signature is missing", () => {
    expect(detectDeclaredAgent(headers({ "signature-agent": "Agent.Example.com" })))
      .toEqual({ directory: "agent.example.com", signed: false });
  });
  it("is null without the header", () => {
    expect(detectDeclaredAgent(headers({ "user-agent": "Mozilla/5.0" }))).toBeNull();
    expect(detectDeclaredAgent(headers({ "signature-agent": '""' }))).toBeNull();
  });
});

describe("botKind", () => {
  it("declared beats every User-Agent class", () => {
    const d = { directory: "chatgpt.com", signed: true };
    expect(botKind("GPTBot", d)).toBe("declared_agent");
    expect(botKind("Unknown", d)).toBe("declared_agent");
  });
  it("fetchers are agent_fetch; other bots are crawlers; Unknown is unknown_bot", () => {
    for (const name of AGENT_FETCHERS) expect(botKind(name, null)).toBe("agent_fetch");
    expect(botKind("GPTBot", null)).toBe("crawler");
    expect(botKind("Meta-ExternalAgent", null)).toBe("crawler");
    expect(botKind("Googlebot", null)).toBe("crawler");
    expect(botKind("Unknown", null)).toBe("unknown_bot");
  });
});

describe("new fetcher patterns", () => {
  it("recognizes the user-triggered fetchers by name", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Claude-User/1.0; +claude.ai)")?.name).toBe("Claude-User");
    expect(detectBot("Perplexity-User/1.0")?.name).toBe("Perplexity-User");
    expect(detectBot("MistralAI-User/1.0")?.name).toBe("MistralAI-User");
    expect(detectBot("DuckAssistBot/1.0")?.name).toBe("DuckAssistBot");
    expect(detectBot("Mozilla/5.0 Claude-SearchBot")?.name).toBe("Claude-SearchBot");
    // ClaudeBot and PerplexityBot still win for their own UAs
    expect(detectBot("ClaudeBot/1.0")?.name).toBe("ClaudeBot");
    expect(detectBot("PerplexityBot/1.0")?.name).toBe("PerplexityBot");
  });
});

describe("trackBot payload", () => {
  const fakeReq = (ua: string | null, extra: Record<string, string> = {}) => ({
    url: "https://example.com/pricing",
    headers: headers({ ...(ua ? { "user-agent": ua } : {}), ...extra }),
  });
  const run = (req: unknown) => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const waited: Promise<unknown>[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackBot(req as any, { waitUntil: (p: Promise<unknown>) => waited.push(p) } as any, {
      webhookUrl: "https://apex.example/api/webhooks/bot-hit",
      webhookSecret: "s",
    });
    vi.unstubAllGlobals();
    if (!fetchMock.mock.calls.length) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
  };

  it("labels a fetcher as agent_fetch", () => {
    const body = run(fakeReq("Mozilla/5.0 ChatGPT-User/1.0"));
    expect(body).toMatchObject({ bot: "ChatGPT-User", kind: "agent_fetch", signed: false, agentDirectory: null });
  });
  it("labels a crawler as crawler", () => {
    expect(run(fakeReq("GPTBot/1.0"))).toMatchObject({ bot: "GPTBot", kind: "crawler" });
  });
  it("counts a signing agent with a browser UA under its directory host", () => {
    const body = run(fakeReq("Mozilla/5.0 (Macintosh) Chrome/130", {
      "signature-agent": '"https://muse.meta.com"',
      "signature-input": "sig1=()",
      signature: "sig1=:x:",
    }));
    expect(body).toMatchObject({
      bot: "agent:muse.meta.com", type: "ai", kind: "declared_agent", signed: true, agentDirectory: "muse.meta.com",
    });
  });
  it("still ignores a plain browser", () => {
    expect(run(fakeReq("Mozilla/5.0 (Macintosh) Chrome/130"))).toBeNull();
  });
  it("declaredAgentBot shape", () => {
    expect(declaredAgentBot({ directory: "chatgpt.com", signed: true }))
      .toEqual({ name: "agent:chatgpt.com", company: "chatgpt.com", type: "ai" });
  });
});
