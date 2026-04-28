import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyEscapeRegex,
  decideAutoReply,
  AUTO_REPLY_CONFIDENCE_THRESHOLD,
} from "@/lib/agents/auto-reply";

const messagesCreateMock = vi.fn();
vi.mock("@/lib/agents/anthropic-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agents/anthropic-client")
  >("@/lib/agents/anthropic-client");
  return {
    ...actual,
    getAnthropicClient: () => ({
      messages: { create: messagesCreateMock },
    }),
  };
});

const baseCtx = {
  inboundContent: "What are your hours?",
  detectedLanguage: "en",
  history: [
    { role: "contact" as const, content: "Hi" },
    { role: "agent" as const, content: "Hello! How can I help?" },
  ],
  knowledge: "We are open Mon-Fri, 9am-6pm IST.",
  brandSystemPrompt: "You are a friendly assistant for SocialBharat.",
};

function claudeText(payload: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

describe("applyEscapeRegex", () => {
  it("escapes empty / whitespace-only input", () => {
    expect(applyEscapeRegex("")).toBe("empty_input");
    expect(applyEscapeRegex("   ")).toBe("empty_input");
  });

  it("escapes anger / refund / legal triggers (case-insensitive)", () => {
    expect(applyEscapeRegex("I want a refund now")).toBe("regex_anger");
    expect(applyEscapeRegex("This is a SCAM")).toBe("regex_anger");
    expect(applyEscapeRegex("I will sue you")).toBe("regex_anger");
    expect(applyEscapeRegex("Filing a complaint")).toBe("regex_anger");
    expect(applyEscapeRegex("CHARGEBACK incoming")).toBe("regex_anger");
  });

  it("escapes explicit human-handoff requests", () => {
    expect(applyEscapeRegex("Can I talk to a human?")).toBe(
      "regex_human_request",
    );
    expect(applyEscapeRegex("I need a manager")).toBe("regex_human_request");
    expect(applyEscapeRegex("connect me to an operator please")).toBe(
      "regex_human_request",
    );
  });

  it("returns null for benign input", () => {
    expect(applyEscapeRegex("What are your hours?")).toBeNull();
    expect(applyEscapeRegex("Hi, do you ship to Mumbai?")).toBeNull();
  });

  it("does not false-positive on unrelated substrings", () => {
    expect(applyEscapeRegex("humanity is great")).toBeNull();
    expect(applyEscapeRegex("humans are funny")).toBeNull();
    expect(applyEscapeRegex("issuer details please")).toBeNull();
  });
});

describe("decideAutoReply", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("regex hit short-circuits before any Claude call", async () => {
    const res = await decideAutoReply({
      ...baseCtx,
      inboundContent: "I want a refund",
    });
    expect(res).toEqual({
      kind: "escape",
      draftReply: null,
      reason: "regex_anger",
      confidence: 0,
    });
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("sends when confidence is high and requires_human is false", async () => {
    messagesCreateMock.mockResolvedValue(
      claudeText({
        reply: "We're open Mon-Fri 9am-6pm IST.",
        confidence: 0.92,
        requires_human: false,
        escape_reason: null,
      }),
    );
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("send");
    if (res.kind === "send") {
      expect(res.reply).toBe("We're open Mon-Fri 9am-6pm IST.");
      expect(res.confidence).toBe(0.92);
    }
  });

  it("escapes when confidence is below the threshold", async () => {
    messagesCreateMock.mockResolvedValue(
      claudeText({
        reply: "I think we might be open during business hours",
        confidence: 0.4,
        requires_human: false,
        escape_reason: null,
      }),
    );
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("escape");
    if (res.kind === "escape") {
      expect(res.reason).toBe("low_confidence");
      // The reply text becomes a draft for the operator.
      expect(res.draftReply).toBe(
        "I think we might be open during business hours",
      );
      expect(res.confidence).toBeLessThan(AUTO_REPLY_CONFIDENCE_THRESHOLD);
    }
  });

  it("escapes when the model sets requires_human, preserving any draft", async () => {
    messagesCreateMock.mockResolvedValue(
      claudeText({
        reply: "Let me get a teammate to help with that.",
        confidence: 0.95,
        requires_human: true,
        escape_reason: "complex_request",
      }),
    );
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("escape");
    if (res.kind === "escape") {
      expect(res.reason).toBe("requires_human");
      expect(res.draftReply).toBe("Let me get a teammate to help with that.");
    }
  });

  it("escapes when the model returns an empty reply", async () => {
    messagesCreateMock.mockResolvedValue(
      claudeText({
        reply: "",
        confidence: 0.9,
        requires_human: false,
        escape_reason: null,
      }),
    );
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("escape");
    if (res.kind === "escape") {
      expect(res.reason).toBe("model_flagged");
      expect(res.draftReply).toBeNull();
    }
  });

  it("escapes (does not throw) when Claude returns malformed JSON", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [{ type: "text", text: "this is not json at all" }],
    });
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("escape");
    if (res.kind === "escape") {
      expect(res.reason).toBe("parse_failure");
    }
  });

  it("clamps confidence to the [0, 1] range", async () => {
    messagesCreateMock.mockResolvedValue(
      claudeText({
        reply: "Sure thing.",
        confidence: 5,
        requires_human: false,
      }),
    );
    const res = await decideAutoReply(baseCtx);
    expect(res.kind).toBe("send");
    if (res.kind === "send") expect(res.confidence).toBe(1);
  });

  it("propagates real Claude API errors so BullMQ can retry", async () => {
    messagesCreateMock.mockRejectedValue(new Error("rate limited"));
    await expect(decideAutoReply(baseCtx)).rejects.toThrow("rate limited");
  });
});
