import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockRow {
  id?: string;
  [key: string]: unknown;
}

interface TableState {
  upsertResult?: { data: MockRow | null; error: unknown };
  selectMaybeSingle?: { data: MockRow | null; error: unknown };
  insertResult?: { data: MockRow | null; error: unknown };
  updateCalls: Array<Record<string, unknown>>;
  insertCalls: Array<Record<string, unknown>>;
  upsertCalls: Array<Record<string, unknown>>;
  upsertOpts: Array<Record<string, unknown> | undefined>;
}

const state: Record<string, TableState> = {};

function table(name: string): TableState {
  if (!state[name]) {
    state[name] = {
      updateCalls: [],
      insertCalls: [],
      upsertCalls: [],
      upsertOpts: [],
    };
  }
  return state[name]!;
}

function buildQuery(name: string) {
  const t = table(name);
  const chain = {
    upsert: (
      payload: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => {
      t.upsertCalls.push(payload);
      t.upsertOpts.push(opts);
      // Returns a hybrid: chainable via .select().single() AND awaitable
      // directly (resolves to { error }) for callers that don't read rows back.
      const direct = { error: t.upsertResult?.error ?? null };
      return {
        select: () => ({
          single: () =>
            Promise.resolve(
              t.upsertResult ?? { data: { id: "mock-id" }, error: null },
            ),
        }),
        then: (
          onFulfilled?: (v: typeof direct) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => Promise.resolve(direct).then(onFulfilled, onRejected),
      };
    },
    insert: (payload: Record<string, unknown>) => {
      t.insertCalls.push(payload);
      return {
        select: () => ({
          single: () =>
            Promise.resolve(
              t.insertResult ?? { data: { id: "mock-id" }, error: null },
            ),
        }),
      };
    },
    update: (payload: Record<string, unknown>) => {
      t.updateCalls.push(payload);
      return {
        eq: () => Promise.resolve({ data: null, error: null }),
      };
    },
    select: () => {
      const q: Record<string, unknown> = {};
      q.eq = () => q;
      q.maybeSingle = () =>
        Promise.resolve(t.selectMaybeSingle ?? { data: null, error: null });
      return q;
    },
  };
  return chain;
}

const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: (name: string) => buildQuery(name),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResult);
    },
  })),
}));

import {
  processIncomingMessage,
  applyMessageStatusUpdate,
} from "@/lib/inbox/message-processor";

const baseIncoming = {
  orgId: "org-1",
  socialProfileId: "profile-1",
  platform: "facebook" as const,
  conversationType: "message" as const,
  platformConversationId: "plat-conv-1",
  contact: {
    platformUserId: "fb-user-1",
    displayName: "Test User",
  },
  message: {
    platformMessageId: "msg-plat-1",
    content: "Hello from webhook",
    timestamp: new Date("2026-04-17T10:00:00Z"),
  },
};

describe("processIncomingMessage", () => {
  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
  });

  it("upserts contact, creates conversation, inserts message", async () => {
    table("contacts").upsertResult = {
      data: { id: "contact-1" },
      error: null,
    };
    table("conversations").selectMaybeSingle = { data: null, error: null };
    table("conversations").insertResult = {
      data: { id: "conv-1" },
      error: null,
    };
    table("messages").selectMaybeSingle = { data: null, error: null };
    table("messages").insertResult = {
      data: { id: "msg-1" },
      error: null,
    };

    const result = await processIncomingMessage(baseIncoming);

    expect(result.deduplicated).toBe(false);
    expect(result.conversationId).toBe("conv-1");
    expect(result.messageId).toBe("msg-1");
    expect(result.contactId).toBe("contact-1");

    expect(table("contacts").upsertCalls).toHaveLength(1);
    expect(table("conversations").insertCalls).toHaveLength(1);
    expect(table("messages").insertCalls).toHaveLength(1);
    expect(table("conversations").updateCalls).toHaveLength(1);

    // Lead seed: first inbound auto-creates a 'New' lead, idempotent.
    expect(table("leads").upsertCalls).toHaveLength(1);
    expect(table("leads").upsertCalls[0]).toEqual({
      org_id: "org-1",
      contact_id: "contact-1",
      status: "New",
    });
    expect(table("leads").upsertOpts[0]).toEqual({
      onConflict: "org_id,contact_id",
      ignoreDuplicates: true,
    });
  });

  it("reuses existing conversation when platform_conversation_id matches", async () => {
    table("contacts").upsertResult = {
      data: { id: "contact-1" },
      error: null,
    };
    table("conversations").selectMaybeSingle = {
      data: { id: "existing-conv" },
      error: null,
    };
    table("messages").selectMaybeSingle = { data: null, error: null };
    table("messages").insertResult = {
      data: { id: "msg-1" },
      error: null,
    };

    const result = await processIncomingMessage(baseIncoming);

    expect(result.conversationId).toBe("existing-conv");
    expect(table("conversations").insertCalls).toHaveLength(0);
    expect(table("messages").insertCalls).toHaveLength(1);
  });

  it("dedupes when platform_message_id already exists on the conversation", async () => {
    table("contacts").upsertResult = {
      data: { id: "contact-1" },
      error: null,
    };
    table("conversations").selectMaybeSingle = {
      data: { id: "existing-conv" },
      error: null,
    };
    table("messages").selectMaybeSingle = {
      data: { id: "existing-msg" },
      error: null,
    };

    const result = await processIncomingMessage(baseIncoming);

    expect(result.deduplicated).toBe(true);
    expect(result.messageId).toBe("existing-msg");
    expect(table("messages").insertCalls).toHaveLength(0);
    expect(table("conversations").updateCalls).toHaveLength(0);
    // Dedupe path returns early; no lead seed for already-known message.
    expect(table("leads").upsertCalls).toHaveLength(0);
  });

  it("does not throw if lead seed upsert fails (best-effort)", async () => {
    table("contacts").upsertResult = {
      data: { id: "contact-1" },
      error: null,
    };
    table("conversations").selectMaybeSingle = { data: null, error: null };
    table("conversations").insertResult = {
      data: { id: "conv-1" },
      error: null,
    };
    table("messages").selectMaybeSingle = { data: null, error: null };
    table("messages").insertResult = {
      data: { id: "msg-1" },
      error: null,
    };
    table("leads").upsertResult = {
      data: null,
      error: new Error("leads RLS denied"),
    };

    const result = await processIncomingMessage(baseIncoming);

    // Message processing still succeeds even though lead seed errored.
    expect(result.messageId).toBe("msg-1");
    expect(result.deduplicated).toBe(false);
    expect(table("leads").upsertCalls).toHaveLength(1);
  });

  it("throws when contact upsert fails", async () => {
    table("contacts").upsertResult = {
      data: null,
      error: new Error("contact upsert failed"),
    };
    await expect(processIncomingMessage(baseIncoming)).rejects.toThrow();
  });
});

describe("applyMessageStatusUpdate", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    rpcResult = { data: null, error: null };
  });

  it("calls apply_message_status RPC with the correct payload", async () => {
    await applyMessageStatusUpdate({
      platformMessageId: "wamid.ABC123",
      status: "delivered",
      timestamp: new Date("2026-04-17T10:00:00Z"),
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.name).toBe("apply_message_status");
    expect(rpcCalls[0]!.args).toEqual({
      p_platform_message_id: "wamid.ABC123",
      p_status: "delivered",
      p_ts: "2026-04-17T10:00:00.000Z",
    });
  });

  it("forwards each status value verbatim (precedence handled in SQL)", async () => {
    for (const status of ["sent", "delivered", "read", "failed"] as const) {
      await applyMessageStatusUpdate({
        platformMessageId: `wamid.${status}`,
        status,
        timestamp: new Date("2026-04-17T10:00:00Z"),
      });
    }
    expect(rpcCalls.map((c) => c.args.p_status)).toEqual([
      "sent",
      "delivered",
      "read",
      "failed",
    ]);
  });

  it("throws when the RPC reports an error", async () => {
    rpcResult = { data: null, error: new Error("rpc failed") };
    await expect(
      applyMessageStatusUpdate({
        platformMessageId: "wamid.X",
        status: "read",
        timestamp: new Date(),
      }),
    ).rejects.toThrow();
  });
});
