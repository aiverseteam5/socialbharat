import { describe, it, expect } from "vitest";
import {
  extractText,
  parseJsonFromResponse,
} from "@/lib/agents/anthropic-client";

// Narrow Anthropic content block type just enough for extractText input.
type TextBlock = { type: "text"; text: string };
type ToolBlock = { type: "tool_use"; id: string; name: string; input: unknown };

describe("extractText", () => {
  it("joins text blocks and ignores tool_use blocks", () => {
    const blocks: Array<TextBlock | ToolBlock> = [
      { type: "text", text: "hello" },
      { type: "tool_use", id: "t1", name: "search", input: {} },
      { type: "text", text: "world" },
    ];
    // Anthropic's real type is wider; the function ignores non-text blocks.
    const result = extractText(
      blocks as unknown as Parameters<typeof extractText>[0],
    );
    expect(result).toBe("hello\nworld");
  });

  it("trims surrounding whitespace", () => {
    const blocks: TextBlock[] = [{ type: "text", text: "  \n  hi  \n " }];
    expect(
      extractText(blocks as unknown as Parameters<typeof extractText>[0]),
    ).toBe("hi");
  });
});

describe("parseJsonFromResponse", () => {
  it("parses raw JSON", () => {
    expect(parseJsonFromResponse<{ a: number }>('{"a":1}').a).toBe(1);
  });

  it("strips markdown code fences", () => {
    const res = parseJsonFromResponse<{ k: string }>('```json\n{"k":"v"}\n```');
    expect(res.k).toBe("v");
  });

  it("recovers JSON embedded in prose", () => {
    const res = parseJsonFromResponse<{ x: number }>(
      'Sure! Here you go: {"x":42}. Hope this helps.',
    );
    expect(res.x).toBe(42);
  });

  it("throws on non-JSON response", () => {
    expect(() => parseJsonFromResponse("not json at all")).toThrow(
      /not valid JSON/,
    );
  });
});
