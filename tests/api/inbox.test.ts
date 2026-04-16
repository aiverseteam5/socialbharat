import { describe, it, expect } from "vitest";
import {
  replyMessageSchema,
  assignConversationSchema,
  updateConversationStatusSchema,
  addConversationTagsSchema,
  listConversationsSchema,
  updateConversationSchema,
  suggestRepliesSchema,
} from "@/types/schemas";

describe("inbox schemas", () => {
  describe("replyMessageSchema", () => {
    it("accepts minimal content", () => {
      const out = replyMessageSchema.parse({ content: "hi" });
      expect(out.media_urls).toEqual([]);
    });

    it("rejects empty content", () => {
      expect(() => replyMessageSchema.parse({ content: "" })).toThrow();
    });

    it("rejects non-URL media entries", () => {
      expect(() =>
        replyMessageSchema.parse({ content: "ok", media_urls: ["not-a-url"] }),
      ).toThrow();
    });
  });

  describe("assignConversationSchema", () => {
    it("requires a uuid", () => {
      expect(() =>
        assignConversationSchema.parse({ assigned_to: "abc" }),
      ).toThrow();
      expect(
        assignConversationSchema.parse({
          assigned_to: "123e4567-e89b-12d3-a456-426614174000",
        }),
      ).toBeTruthy();
    });
  });

  describe("updateConversationStatusSchema", () => {
    it("accepts open/closed/snoozed", () => {
      expect(updateConversationStatusSchema.parse({ status: "open" })).toEqual({
        status: "open",
      });
      expect(
        updateConversationStatusSchema.parse({ status: "closed" }),
      ).toEqual({ status: "closed" });
      expect(
        updateConversationStatusSchema.parse({ status: "snoozed" }),
      ).toEqual({ status: "snoozed" });
    });

    it("rejects arbitrary status", () => {
      expect(() =>
        updateConversationStatusSchema.parse({ status: "paused" }),
      ).toThrow();
    });
  });

  describe("addConversationTagsSchema", () => {
    it("requires at least one tag", () => {
      expect(() => addConversationTagsSchema.parse({ tags: [] })).toThrow();
    });

    it("accepts a list of short tags", () => {
      expect(
        addConversationTagsSchema.parse({ tags: ["vip", "billing"] }),
      ).toEqual({ tags: ["vip", "billing"] });
    });
  });

  describe("listConversationsSchema", () => {
    it("defaults limit to 20 with no filters", () => {
      const out = listConversationsSchema.parse({});
      expect(out.limit).toBe(20);
    });

    it("coerces limit from string", () => {
      const out = listConversationsSchema.parse({ limit: "5" });
      expect(out.limit).toBe(5);
    });

    it("rejects unknown platform", () => {
      expect(() =>
        listConversationsSchema.parse({ platform: "sharechat" }),
      ).toThrow();
    });
  });

  describe("updateConversationSchema", () => {
    it("accepts partial updates", () => {
      expect(updateConversationSchema.parse({ status: "closed" })).toEqual({
        status: "closed",
      });
      expect(updateConversationSchema.parse({ tags: ["urgent"] })).toEqual({
        tags: ["urgent"],
      });
    });

    it("accepts sentiment_score in [-1, 1]", () => {
      expect(updateConversationSchema.parse({ sentiment_score: 0.5 })).toEqual({
        sentiment_score: 0.5,
      });
      expect(() =>
        updateConversationSchema.parse({ sentiment_score: 2 }),
      ).toThrow();
    });
  });

  describe("suggestRepliesSchema", () => {
    it("requires conversation_id uuid and at least one message", () => {
      expect(() =>
        suggestRepliesSchema.parse({ conversation_id: "x", messages: [] }),
      ).toThrow();
      const out = suggestRepliesSchema.parse({
        conversation_id: "123e4567-e89b-12d3-a456-426614174000",
        messages: [{ role: "contact", content: "hi" }],
      });
      expect(out.language).toBe("en");
      expect(out.tone).toBe("professional");
    });

    it("accepts hinglish tone and hi language", () => {
      const out = suggestRepliesSchema.parse({
        conversation_id: "123e4567-e89b-12d3-a456-426614174000",
        messages: [{ role: "contact", content: "namaste" }],
        language: "hi",
        tone: "hinglish",
      });
      expect(out.tone).toBe("hinglish");
      expect(out.language).toBe("hi");
    });
  });
});
