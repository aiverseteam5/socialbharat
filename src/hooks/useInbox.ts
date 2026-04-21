"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  useInboxStore,
  type InboxMessage,
  type ConversationSummary,
  type InboxFilters,
} from "@/stores/inbox-store";
import { useAuthStore } from "@/stores/auth-store";
import { useRealtime, type RealtimeStatus } from "./useRealtime";
import { logger } from "@/lib/logger";

/**
 * Primary inbox data hook. Fetches the conversation list with current filters,
 * loads the selected conversation's messages, subscribes to Realtime inserts
 * on the `messages` table so new incoming messages appear live, and subscribes
 * to `conversations` updates to bump the list and show toast notifications.
 */
export function useInbox(): {
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  messages: InboxMessage[];
  filters: InboxFilters;
  isLoading: boolean;
  realtimeStatus: RealtimeStatus;
  selectConversation: (id: string | null) => void;
  setFilters: (f: InboxFilters) => void;
  sendReply: (
    conversationId: string,
    content: string,
    mediaUrls?: string[],
  ) => Promise<InboxMessage>;
  refresh: () => Promise<void>;
  upsertConversation: (c: ConversationSummary) => void;
} {
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

  const { currentOrg } = useAuthStore();
  const orgId = (currentOrg as { id?: string } | null)?.id;

  // Stable refs so callbacks don't capture stale closures
  const selectedIdRef = useRef(selectedConversationId);
  selectedIdRef.current = selectedConversationId;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

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

  // Subscribe to INSERT on messages for the open conversation thread.
  const { status: realtimeStatus } = useRealtime<InboxMessage>({
    table: "messages",
    event: "INSERT",
    filter: selectedConversationId
      ? `conversation_id=eq.${selectedConversationId}`
      : undefined,
    enabled: Boolean(selectedConversationId),
    onInsert: (payload) => {
      appendMessage(payload.new);
    },
  });

  // Subscribe to conversation updates scoped to this org.
  // Refresh the list and toast for messages on non-selected conversations.
  useRealtime({
    table: "conversations",
    event: "UPDATE",
    filter: orgId ? `org_id=eq.${orgId}` : undefined,
    onUpdate: (payload) => {
      const updated = payload.new as { id?: string };
      void fetchConversations();

      if (updated.id && updated.id !== selectedIdRef.current) {
        const conv = conversationsRef.current.find((c) => c.id === updated.id);
        const contactName =
          conv?.contact?.display_name ??
          conv?.contact?.platform_user_id ??
          "Someone";
        toast.message("New message", {
          description: `${contactName} sent you a message`,
          duration: 4000,
        });
      }
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
    realtimeStatus,
    selectConversation,
    setFilters,
    sendReply,
    refresh: fetchConversations,
    upsertConversation,
  };
}
