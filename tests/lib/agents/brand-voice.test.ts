import { describe, it, expect } from "vitest";
import {
  buildBrandSystemPrompt,
  getDefaultSystemPrompt,
} from "@/lib/agents/brand-voice";
import type { BrandVoice } from "@/lib/agents/types";

describe("buildBrandSystemPrompt", () => {
  it("returns the default prompt when voice is null", () => {
    const prompt = buildBrandSystemPrompt(null);
    expect(prompt).toBe(getDefaultSystemPrompt());
    expect(prompt).toContain("SocialBharat");
    expect(prompt).toContain("India-first");
  });

  it("appends tone, audience, values, and avoid when voice is present", () => {
    const voice: BrandVoice = {
      orgId: "org-1",
      tone: "warm-festive",
      coreValues: "craft, affordability",
      avoid: "no slang, no politics",
      exampleCaptions: "Example — Diwali mein roshni.",
      primaryLanguage: "hi-en",
      targetAudience: "urban millennials",
    };
    const prompt = buildBrandSystemPrompt(voice);
    expect(prompt).toContain("Tone: warm-festive");
    expect(prompt).toContain("Audience: urban millennials");
    expect(prompt).toContain("Primary language: hi-en");
    expect(prompt).toContain("Core values: craft, affordability");
    expect(prompt).toContain("Avoid: no slang, no politics");
    expect(prompt).toContain("Example — Diwali mein roshni.");
  });

  it("omits missing optional fields without leaving placeholders", () => {
    const voice: BrandVoice = {
      orgId: "org-1",
      tone: "professional",
      coreValues: "",
      avoid: "",
      exampleCaptions: "",
      primaryLanguage: null,
      targetAudience: "",
    };
    const prompt = buildBrandSystemPrompt(voice);
    expect(prompt).toContain("Tone: professional");
    expect(prompt).not.toContain("Audience:");
    expect(prompt).not.toContain("Primary language:");
    expect(prompt).not.toContain("Core values:");
    expect(prompt).not.toContain("Avoid:");
    expect(prompt).not.toContain("example captions");
  });
});
