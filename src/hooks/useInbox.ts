"use client";

import { useCallback, useEffect } from "react";
import { useInboxStore, type InboxMessage } from "@/stores/inbox-store";
import { useRealtime } from "./useRealtime";
import { logger } from "@/lib/logger";

/**
 * Primary inbox data hook. Fetches the conversation list with current filters,
 * loads the selected conversation's messages, and subscribes to Realtime inserts
 * on the `messages` table so new incoming messages appear live.
 */
export function useInbox() {
  const {
    conversations,
    selectedConversationId,
    messages,
    filters,
    isLoading,
    setConversations,
    appendMessage,
    setMessages,
    selectConversation,
    setFilters,
    setLoading,
    upsertConversation,
  } = useInboxStore();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.status) params.set("status", filters.status);
      if (filters.assigned_to) params.set("assigned_to", filters.assigned_to);
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/inbox/conversations?${params.toString()}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch (err) {
      logger.error("Failed to fetch conversations", err);
    } finally {
      setLoading(false);
    }
  }, [filters, setConversations, setLoading]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/inbox/conversations/${conversationId}`);
        const data = await res.json();
        setMessages(data.messages ?? []);
      } catch (err) {
        logger.error("Failed to fetch messages", err, { conversationId });
      }
    },
    [setMessages],
  );

  const sendReply = useCallback(
    async (
      conversationId: string,
      content: string,
      mediaUrls: string[] = [],
    ) => {
      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, media_urls: mediaUrls }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Reply failed" }));
        throw new Error(err.error ?? "Reply failed");
      }
      const { message } = await res.json();
      appendMessage(message as InboxMessage);
      return message as InboxMessage;
    },
    [appendMessage],
  );

  // Subscribe to INSERTs on messages for the selected conversation.
  useRealtime<InboxMessage>({
    table: "messages",
    event: "INSERT",
    filter: selectedConversationId
      ? `conversation_id=eq.${selectedConversationId}`
      : undefined,
    enabled: Boolean(selectedConversationId),
    onInsert: (payload) => {
      appendMessage(payload.new as InboxMessage);
    },
  });

  // Any conversation update (new last_message_at, status change) refreshes list.
  useRealtime({
    table: "conversations",
    event: "UPDATE",
    onUpdate: () => {
      void fetchConversations();
    },
  });

  // Initial load + refetch on filter change
  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Load messages when selection changes
  useEffect(() => {
    if (selectedConversationId) {
      void fetchMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, fetchMessages, setMessages]);

  return {
    conversations,
    selectedConversationId,
    messages,
    filters,
    isLoading,
    selectConversation,
    setFilters,
    sendReply,
    refresh: fetchConversations,
    upsertConversation,
  };
}
