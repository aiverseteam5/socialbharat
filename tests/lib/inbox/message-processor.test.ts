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
  isCalls: Array<{ col: string; val: unknown }>;
  eqCalls: Array<{ col: string; val: unknown }>;
  inCalls: Array<{ col: string; vals: unknown[] }>;
}

const state: Record<string, TableState> = {};

function table(name: string): TableState {
  if (!state[name]) {
    state[name] = {
      updateCalls: [],
      insertCalls: [],
      upsertCalls: [],
      upsertOpts: [],
      isCalls: [],
      eqCalls: [],
      inCalls: [],
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
      // .eq() must be awaitable (existing last_message_at bump) AND
      // chainable into .is() (opt-out: .eq().is()) AND .in() (broadcast
      // recipient status: .eq().in()).
      const eqResult: { data: null; error: null } = { data: null, error: null };
      const eqChain = {
        is: (col: string, val: unknown) => {
          t.isCalls.push({ col, val });
          return Promise.resolve(eqResult);
        },
        in: (col: string, vals: unknown[]) => {
          t.inCalls.push({ col, vals });
          return Promise.resolve(eqResult);
        },
        then: (
          onFulfilled?: (v: typeof eqResult) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => Promise.resolve(eqResult).then(onFulfilled, onRejected),
      };
      return {
        eq: (col: string, val: unknown) => {
          t.eqCalls.push({ col, val });
          return eqChain;
        },
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

  describe("STOP-keyword opt-out", () => {
    function seedHappyPath() {
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
      table("messages").insertResult = { data: { id: "msg-1" }, error: null };
    }

    it("WhatsApp STOP message marks contact opted_out_at", async () => {
      seedHappyPath();
      await processIncomingMessage({
        ...baseIncoming,
        platform: "whatsapp",
        message: { ...baseIncoming.message, content: "STOP" },
      });

      // contacts.update is called once for opt-out (conversations.update is
      // for last_message_at on a different table).
      const optOutCalls = table("contacts").updateCalls;
      expect(optOutCalls).toHaveLength(1);
      expect(optOutCalls[0]).toHaveProperty("opted_out_at");
      // .is(opted_out_at, null) guard — repeat STOPs are SQL no-ops.
      expect(table("contacts").isCalls).toContainEqual({
        col: "opted_out_at",
        val: null,
      });
      // Message still recorded — STOP doesn't short-circuit processing.
      expect(table("messages").insertCalls).toHaveLength(1);
    });

    it("matches STOP variants case-insensitively", async () => {
      for (const text of [
        "stop",
        "STOP",
        "  Stop  ",
        "unsubscribe",
        "REMOVE",
        "Cancel",
      ]) {
        for (const key of Object.keys(state)) delete state[key];
        seedHappyPath();
        await processIncomingMessage({
          ...baseIncoming,
          platform: "whatsapp",
          message: { ...baseIncoming.message, content: text },
        });
        expect(
          table("contacts").updateCalls,
          `expected ${JSON.stringify(text)} to trigger opt-out`,
        ).toHaveLength(1);
      }
    });

    it("non-STOP message does not opt the contact out", async () => {
      seedHappyPath();
      await processIncomingMessage({
        ...baseIncoming,
        platform: "whatsapp",
        message: { ...baseIncoming.message, content: "Hi, I have a question" },
      });
      expect(table("contacts").updateCalls).toHaveLength(0);
    });

    it("STOP on a non-WhatsApp platform is ignored", async () => {
      seedHappyPath();
      await processIncomingMessage({
        ...baseIncoming,
        platform: "facebook",
        message: { ...baseIncoming.message, content: "STOP" },
      });
      // Opt-out is WhatsApp-scoped; FB STOP must not flip the flag.
      expect(table("contacts").updateCalls).toHaveLength(0);
    });
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

  describe("broadcast recipient mirror", () => {
    beforeEach(() => {
      delete state.whatsapp_broadcast_recipients;
    });

    it("mirrors 'sent' onto the recipient row", async () => {
      await applyMessageStatusUpdate({
        platformMessageId: "wamid.SENT1",
        status: "sent",
        timestamp: new Date("2026-04-17T10:00:00Z"),
      });
      const t = table("whatsapp_broadcast_recipients");
      expect(t.updateCalls).toEqual([{ status: "sent" }]);
      expect(t.eqCalls).toEqual([
        { col: "platform_message_id", val: "wamid.SENT1" },
      ]);
      expect(t.inCalls).toEqual([{ col: "status", vals: ["pending"] }]);
    });

    it("mirrors 'delivered' with allowed-from set [pending, sent]", async () => {
      await applyMessageStatusUpdate({
        platformMessageId: "wamid.DEL1",
        status: "delivered",
        timestamp: new Date(),
      });
      const t = table("whatsapp_broadcast_recipients");
      expect(t.inCalls).toEqual([{ col: "status", vals: ["pending", "sent"] }]);
    });

    it("mirrors 'read' with allowed-from set [pending, sent, delivered]", async () => {
      await applyMessageStatusUpdate({
        platformMessageId: "wamid.READ1",
        status: "read",
        timestamp: new Date(),
      });
      const t = table("whatsapp_broadcast_recipients");
      expect(t.inCalls).toEqual([
        { col: "status", vals: ["pending", "sent", "delivered"] },
      ]);
    });

    it("mirrors 'failed' with allowed-from set excluding 'skipped'", async () => {
      await applyMessageStatusUpdate({
        platformMessageId: "wamid.FAIL1",
        status: "failed",
        timestamp: new Date(),
      });
      const t = table("whatsapp_broadcast_recipients");
      // 'skipped' is intentionally absent — operator cancellations stay sticky.
      expect(t.inCalls).toEqual([
        { col: "status", vals: ["pending", "sent", "delivered", "read"] },
      ]);
    });
  });
});
