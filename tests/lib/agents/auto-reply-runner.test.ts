import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

interface ConversationRow {
  id: string;
  org_id: string;
  contact_id: string;
  status: string;
  auto_reply_paused_at: string | null;
  assigned_to: string | null;
  language_detected: string | null;
}

interface ContactRow {
  id: string;
  platform_user_id: string;
  opted_out_at: string | null;
}

interface DBState {
  triggerMessage: MessageRow | null;
  conversation: ConversationRow | null;
  contact: ContactRow | null;
  knowledge: { body: string } | null;
  history: Array<{ sender_type: string; content: string; created_at: string }>;
  profile: {
    access_token_encrypted: string;
    metadata: { phone_number_id?: string };
  } | null;
  insertedMessages: Array<Record<string, unknown>>;
  insertedActions: Array<Record<string, unknown>>;
  conversationUpdates: Array<Record<string, unknown>>;
}

const db: DBState = {
  triggerMessage: null,
  conversation: null,
  contact: null,
  knowledge: null,
  history: [],
  profile: null,
  insertedMessages: [],
  insertedActions: [],
  conversationUpdates: [],
};

function reset() {
  db.triggerMessage = null;
  db.conversation = null;
  db.contact = null;
  db.knowledge = null;
  db.history = [];
  db.profile = null;
  db.insertedMessages = [];
  db.insertedActions = [];
  db.conversationUpdates = [];
}

function messagesTable() {
  return {
    select: () => ({
      // .eq("id", ...).maybeSingle() — load trigger
      eq: (col: string) => ({
        maybeSingle: () => {
          if (col === "id") {
            return Promise.resolve({ data: db.triggerMessage, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        // History path: .eq("conversation_id", ...).lt(...).order(...).limit(...)
        lt: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({ data: [...db.history], error: null }),
          }),
        }),
      }),
    }),
    insert: (row: Record<string, unknown>) => {
      db.insertedMessages.push(row);
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function conversationsTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: db.conversation, error: null }),
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      db.conversationUpdates.push(patch);
      return {
        eq: () => Promise.resolve({ data: null, error: null }),
      };
    },
  };
}

function contactsTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: db.contact, error: null }),
      }),
    }),
  };
}

function knowledgeTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: db.knowledge, error: null }),
      }),
    }),
  };
}

function brandVoicesTable() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  };
}

function profilesTable() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: db.profile, error: null }),
          }),
        }),
      }),
    }),
  };
}

function actionsTable() {
  return {
    insert: (row: Record<string, unknown>) => {
      db.insertedActions.push(row);
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      switch (table) {
        case "messages":
          return messagesTable();
        case "conversations":
          return conversationsTable();
        case "contacts":
          return contactsTable();
        case "org_agent_knowledge":
          return knowledgeTable();
        case "brand_voices":
          return brandVoicesTable();
        case "social_profiles":
          return profilesTable();
        case "agent_inbox_actions":
          return actionsTable();
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  }),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: (s: string) => `decrypted:${s}`,
}));

const sendMessageMock = vi.fn();
vi.mock("@/lib/platforms/whatsapp", () => ({
  WhatsAppConnector: class {
    sendMessage = sendMessageMock;
  },
}));

const decideAutoReplyMock = vi.fn();
vi.mock("@/lib/agents/auto-reply", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agents/auto-reply")
  >("@/lib/agents/auto-reply");
  return {
    ...actual,
    decideAutoReply: (...args: unknown[]) => decideAutoReplyMock(...args),
  };
});

import { runAutoReply } from "@/lib/agents/auto-reply-runner";

const ctx = {
  orgId: "org-1",
  conversationId: "conv-1",
  triggeringMessageId: "msg-1",
};

function seedHappyPath() {
  db.triggerMessage = {
    id: "msg-1",
    conversation_id: "conv-1",
    sender_type: "contact",
    content: "What are your hours?",
    created_at: "2026-04-28T10:00:00Z",
  };
  db.conversation = {
    id: "conv-1",
    org_id: "org-1",
    contact_id: "contact-1",
    status: "open",
    auto_reply_paused_at: null,
    assigned_to: null,
    language_detected: "en",
  };
  db.contact = {
    id: "contact-1",
    platform_user_id: "+919876543210",
    opted_out_at: null,
  };
  db.knowledge = { body: "Mon-Fri 9am-6pm IST." };
  db.history = [
    {
      sender_type: "contact",
      content: "Hi",
      created_at: "2026-04-28T09:50:00Z",
    },
    {
      sender_type: "agent",
      content: "Hello!",
      created_at: "2026-04-28T09:51:00Z",
    },
  ];
  db.profile = {
    access_token_encrypted: "cipher",
    metadata: { phone_number_id: "phone-1" },
  };
}

describe("runAutoReply", () => {
  beforeEach(() => {
    reset();
    sendMessageMock.mockReset();
    decideAutoReplyMock.mockReset();
  });

  it("sends and persists the outbound message on a confident send decision", async () => {
    seedHappyPath();
    decideAutoReplyMock.mockResolvedValueOnce({
      kind: "send",
      reply: "We're open Mon-Fri 9am-6pm IST.",
      confidence: 0.92,
    });
    sendMessageMock.mockResolvedValueOnce("wamid.OUT123");

    const res = await runAutoReply(ctx);

    expect(res.outcome).toBe("sent");
    expect(sendMessageMock).toHaveBeenCalledWith(
      "+919876543210",
      "We're open Mon-Fri 9am-6pm IST.",
    );
    expect(db.insertedMessages).toHaveLength(1);
    const inserted = db.insertedMessages[0]!;
    expect(inserted.sender_type).toBe("agent");
    expect(inserted.platform_message_id).toBe("wamid.OUT123");
    expect(
      (inserted.metadata as { auto_reply: { confidence: number } }).auto_reply
        .confidence,
    ).toBe(0.92);
    expect(
      (inserted.metadata as { auto_reply: { triggering_message_id: string } })
        .auto_reply.triggering_message_id,
    ).toBe("msg-1");
    expect(db.insertedActions).toHaveLength(0);
    expect(db.conversationUpdates).toHaveLength(1);
  });

  it("writes an agent_inbox_actions escape row on escape, and does NOT call sendMessage", async () => {
    seedHappyPath();
    decideAutoReplyMock.mockResolvedValueOnce({
      kind: "escape",
      draftReply: "Maybe Mon-Fri",
      reason: "low_confidence",
      confidence: 0.4,
    });

    const res = await runAutoReply(ctx);

    expect(res.outcome).toBe("escaped");
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(db.insertedActions).toHaveLength(1);
    const action = db.insertedActions[0]!;
    expect(action.intent).toBe("auto_reply");
    expect(action.draft_reply).toBe("Maybe Mon-Fri");
    expect(action.status).toBe("pending");
    expect(action.flags).toEqual(["low_confidence", "confidence:0.40"]);
    expect(db.insertedMessages).toHaveLength(0);
  });

  it("aborts when the triggering message is gone (deleted between enqueue and run)", async () => {
    db.triggerMessage = null;
    const res = await runAutoReply(ctx);
    expect(res.outcome).toBe("stale_message");
    expect(decideAutoReplyMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("aborts when the conversation has been paused since enqueue", async () => {
    seedHappyPath();
    db.conversation!.auto_reply_paused_at = "2026-04-28T10:00:30Z";

    const res = await runAutoReply(ctx);
    expect(res.outcome).toBe("stale_paused");
    expect(decideAutoReplyMock).not.toHaveBeenCalled();
  });

  it("aborts when a human has been assigned since enqueue", async () => {
    seedHappyPath();
    db.conversation!.assigned_to = "user-99";

    const res = await runAutoReply(ctx);
    expect(res.outcome).toBe("stale_human_assigned");
    expect(decideAutoReplyMock).not.toHaveBeenCalled();
  });

  it("aborts when conversation is closed since enqueue", async () => {
    seedHappyPath();
    db.conversation!.status = "closed";

    const res = await runAutoReply(ctx);
    expect(res.outcome).toBe("stale_status");
  });

  it("aborts when the contact opted out since enqueue", async () => {
    seedHappyPath();
    db.contact!.opted_out_at = "2026-04-28T10:00:30Z";

    const res = await runAutoReply(ctx);
    expect(res.outcome).toBe("stale_contact");
    expect(decideAutoReplyMock).not.toHaveBeenCalled();
  });

  it("propagates Meta send errors so BullMQ can retry", async () => {
    seedHappyPath();
    decideAutoReplyMock.mockResolvedValueOnce({
      kind: "send",
      reply: "Sure",
      confidence: 0.9,
    });
    sendMessageMock.mockRejectedValueOnce(new Error("rate limited"));

    await expect(runAutoReply(ctx)).rejects.toThrow("rate limited");
    expect(db.insertedMessages).toHaveLength(0);
  });

  it("throws when WhatsApp profile is not connected for the org", async () => {
    seedHappyPath();
    db.profile = null;
    decideAutoReplyMock.mockResolvedValueOnce({
      kind: "send",
      reply: "Hi",
      confidence: 0.9,
    });

    await expect(runAutoReply(ctx)).rejects.toThrow(/not connected/i);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
