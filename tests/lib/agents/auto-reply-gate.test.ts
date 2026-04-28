import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the agent queue so enqueue is observable ──────────────────────────
const queueAddMock = vi.fn(async () => ({ id: "job-1" }));
vi.mock("@/lib/queue/queues", () => ({
  agentQueue: () => ({ add: queueAddMock }),
}));

// ── Hand-rolled Supabase mock just expressive enough for the gate ──────────
interface QueryState {
  organizations: { opted_in_to_agent_automation: boolean } | null;
  conversation: {
    status?: string | null;
    auto_reply_paused_at?: string | null;
    assigned_to?: string | null;
  } | null;
  contact: { opted_out_at: string | null } | null;
  lead: { status: string } | null;
  dailyCount: number;
  burstCount: number;
}

let s: QueryState;

function defaults(): QueryState {
  return {
    organizations: { opted_in_to_agent_automation: true },
    conversation: {
      status: "open",
      auto_reply_paused_at: null,
      assigned_to: null,
    },
    contact: { opted_out_at: null },
    lead: null,
    dailyCount: 0,
    burstCount: 0,
  };
}

function makeMessagesChain(count: number) {
  // .select(_, { count: head: true }).eq(_, _).not(_, _, _).gte(_, _) => awaitable
  const result = { data: null, error: null, count };
  const obj = {
    eq: () => obj,
    not: () => obj,
    gte: () => Promise.resolve(result),
    then: <T>(
      onFulfilled?: (v: typeof result) => T,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return obj;
}

function makeSupabase() {
  let messagesCallIndex = 0;
  return {
    from(name: string) {
      if (name === "messages") {
        // Two parallel COUNT queries — first = daily, second = burst
        return {
          select: () => {
            const isFirst = messagesCallIndex === 0;
            messagesCallIndex++;
            return makeMessagesChain(isFirst ? s.dailyCount : s.burstCount);
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => {
                if (name === "leads") {
                  return Promise.resolve({ data: s.lead, error: null });
                }
                return Promise.resolve({ data: null, error: null });
              },
            }),
            maybeSingle: () => {
              if (name === "organizations") {
                return Promise.resolve({
                  data: s.organizations,
                  error: null,
                });
              }
              if (name === "conversations") {
                return Promise.resolve({
                  data: s.conversation,
                  error: null,
                });
              }
              if (name === "contacts") {
                return Promise.resolve({ data: s.contact, error: null });
              }
              if (name === "leads") {
                return Promise.resolve({ data: s.lead, error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      };
    },
  } as unknown as Parameters<
    typeof import("@/lib/agents/auto-reply-gate").maybeEnqueueAutoReply
  >[0];
}

import { maybeEnqueueAutoReply } from "@/lib/agents/auto-reply-gate";

const ctx = {
  orgId: "org-1",
  conversationId: "conv-1",
  contactId: "contact-1",
  triggeringMessageId: "msg-1",
};

describe("maybeEnqueueAutoReply", () => {
  beforeEach(() => {
    s = defaults();
    queueAddMock.mockClear();
  });

  it("enqueues when every gate passes", async () => {
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.enqueued).toBe(true);
    expect(queueAddMock).toHaveBeenCalledOnce();
    expect(queueAddMock).toHaveBeenCalledWith(
      "auto_reply",
      expect.objectContaining({
        kind: "auto_reply",
        orgId: "org-1",
        conversationId: "conv-1",
        triggeringMessageId: "msg-1",
        triggeredBy: "webhook",
      }),
    );
  });

  it("skips when contact opted out", async () => {
    s.contact = { opted_out_at: "2026-04-01T00:00:00Z" };
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res).toEqual({ enqueued: false, reason: "opted_out" });
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("skips when org has not opted in to automation", async () => {
    s.organizations = { opted_in_to_agent_automation: false };
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res).toEqual({ enqueued: false, reason: "org_not_opted_in" });
  });

  it("skips when conversation row is missing", async () => {
    s.conversation = null;
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("conversation_missing");
  });

  it("skips when conversation is closed", async () => {
    s.conversation!.status = "closed";
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("conversation_closed");
  });

  it("skips when conversation is snoozed", async () => {
    s.conversation!.status = "snoozed";
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("conversation_snoozed");
  });

  it("skips when conversation auto-reply is paused", async () => {
    s.conversation!.auto_reply_paused_at = "2026-04-01T00:00:00Z";
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("conversation_paused");
  });

  it("skips when a human is assigned to the conversation", async () => {
    s.conversation!.assigned_to = "user-99";
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("human_assigned");
  });

  it("skips when lead is Hot", async () => {
    s.lead = { status: "Hot" };
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("lead_hot");
  });

  it("skips when lead is Paid", async () => {
    s.lead = { status: "Paid" };
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("lead_paid");
  });

  it("skips at the daily cap", async () => {
    s.dailyCount = 5;
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("daily_cap");
  });

  it("skips when another auto-reply was sent inside the burst window", async () => {
    s.burstCount = 1;
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.reason).toBe("rate_limit");
  });

  it("treats lead status 'New' or 'Interested' as eligible", async () => {
    s.lead = { status: "Interested" };
    const res = await maybeEnqueueAutoReply(makeSupabase(), ctx);
    expect(res.enqueued).toBe(true);
  });
});
