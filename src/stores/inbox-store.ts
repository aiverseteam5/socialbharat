import { create } from "zustand";

export type InboxPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "whatsapp";

export type ConversationStatus = "open" | "assigned" | "closed" | "snoozed";
export type ConversationType = "message" | "comment" | "mention" | "review";
export type SenderType = "contact" | "agent" | "system";
export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export interface ContactSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  platform_user_id: string | null;
  platform?: string;
}

export interface ConversationSummary {
  id: string;
  platform: InboxPlatform;
  type: ConversationType;
  status: ConversationStatus;
  assigned_to: string | null;
  tags: string[];
  sentiment_score: number | null;
  language_detected: string | null;
  last_message_at: string | null;
  created_at: string;
  contact: ContactSummary | null;
  latest_message?: Array<{
    id: string;
    content: string | null;
    sender_type: SenderType;
    created_at: string;
  }>;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string | null;
  media_urls: string[];
  platform_message_id: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  delivery_status?: DeliveryStatus;
  delivered_at?: string | null;
  read_at?: string | null;
}

export interface InboxFilters {
  platform?: InboxPlatform;
  status?: ConversationStatus;
  assigned_to?: string;
  search?: string;
}

interface InboxState {
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  messages: InboxMessage[];
  filters: InboxFilters;
  isLoading: boolean;

  setConversations: (c: ConversationSummary[]) => void;
  upsertConversation: (c: ConversationSummary) => void;
  selectConversation: (id: string | null) => void;
  setMessages: (m: InboxMessage[]) => void;
  appendMessage: (m: InboxMessage) => void;
  patchMessage: (id: string, partial: Partial<InboxMessage>) => void;
  setFilters: (f: InboxFilters) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useInboxStore = create<InboxState>((set) => ({
  conversations: [],
  selectedConversationId: null,
  messages: [],
  filters: {},
  isLoading: false,

  setConversations: (conversations) => set({ conversations }),
  upsertConversation: (conv) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      if (idx === -1) return { conversations: [conv, ...state.conversations] };
      const next = [...state.conversations];
      next[idx] = conv;
      return { conversations: next };
    }),
  selectConversation: (id) => set({ selectedConversationId: id }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return {};
      return { messages: [...state.messages, message] };
    }),
  patchMessage: (id, partial) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx === -1) return {};
      const next = [...state.messages];
      next[idx] = { ...next[idx]!, ...partial };
      return { messages: next };
    }),
  setFilters: (filters) => set({ filters }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({
      conversations: [],
      selectedConversationId: null,
      messages: [],
      filters: {},
      isLoading: false,
    }),
}));
