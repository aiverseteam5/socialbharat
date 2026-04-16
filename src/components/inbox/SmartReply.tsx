"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import type { ConversationSummary, InboxMessage } from "@/stores/inbox-store";

interface Props {
  conversation: ConversationSummary;
  messages: InboxMessage[];
  onPick: (suggestion: string) => void;
  /** true when the current org plan unlocks AI features */
  aiEnabled: boolean;
}

export function SmartReply({
  conversation,
  messages,
  onPick,
  aiEnabled,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!aiEnabled) return null;

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.sender_type,
        content: m.content ?? "",
      }));
      if (history.length === 0) {
        setSuggestions([]);
        return;
      }
      const res = await fetch("/api/ai/suggest-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation.id,
          messages: history,
          language: conversation.language_detected ?? "en",
          tone:
            conversation.language_detected === "hi" ? "hinglish" : "friendly",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to fetch suggestions");
      }
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch (err) {
      logger.error("SmartReply fetch failed", err);
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t bg-muted/30 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Smart replies
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          {suggestions.length === 0 ? "Generate" : "Refresh"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
