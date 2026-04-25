import { describe, it, expect, beforeEach, vi } from "vitest";
import { classifyAndDraft } from "@/lib/agents/inbox-agent";

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

describe("classifyAndDraft", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("returns [] when there are no messages", async () => {
    const result = await classifyAndDraft({ systemPrompt: "", messages: [] });
    expect(result).toEqual([]);
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("maps classifications back to the requested conversation ids", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            classifications: [
              {
                conversationId: "c1",
                intent: "question",
                sentiment: "neutral",
                urgency: "normal",
                draftReply: "Yes, we ship pan-India.",
                flags: [],
              },
              {
                conversationId: "c2",
                intent: "spam",
                sentiment: "negative",
                urgency: "low",
                draftReply: null,
                flags: [],
              },
            ],
          }),
        },
      ],
    });

    const result = await classifyAndDraft({
      systemPrompt: "",
      messages: [
        {
          conversationId: "c1",
          platform: "instagram",
          latestMessage: "Do you ship to Pune?",
        },
        {
          conversationId: "c2",
          platform: "facebook",
          latestMessage: "CLICK HERE FOR FREE GIFT CARDS",
        },
      ],
    });

    expect(result).toHaveLength(2);
    const [first, second] = result;
    expect(first?.conversationId).toBe("c1");
    expect(first?.draftReply).toContain("pan-India");
    expect(second?.intent).toBe("spam");
    expect(second?.draftReply).toBeNull();
  });

  it("drops classifications that reference unknown conversation ids", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            classifications: [
              {
                conversationId: "not-in-batch",
                intent: "question",
                sentiment: "neutral",
                urgency: "normal",
                draftReply: "hi",
                flags: [],
              },
            ],
          }),
        },
      ],
    });

    const result = await classifyAndDraft({
      systemPrompt: "",
      messages: [
        {
          conversationId: "c1",
          platform: "instagram",
          latestMessage: "hello",
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it("throws when the response is missing the classifications array", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [{ type: "text", text: '{"wrong":"shape"}' }],
    });

    await expect(
      classifyAndDraft({
        systemPrompt: "",
        messages: [
          {
            conversationId: "c1",
            platform: "instagram",
            latestMessage: "hello",
          },
        ],
      }),
    ).rejects.toThrow(/missing classifications/);
  });
});
