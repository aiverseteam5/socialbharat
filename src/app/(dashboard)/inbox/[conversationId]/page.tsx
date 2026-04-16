"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useInbox } from "@/hooks/useInbox";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageThread } from "@/components/inbox/MessageThread";
import { SmartReply } from "@/components/inbox/SmartReply";
import { ContactProfile } from "@/components/inbox/ContactProfile";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

const AI_PLANS = new Set(["growth", "business", "enterprise"]);

export default function InboxConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const {
    conversations,
    selectedConversationId,
    messages,
    filters,
    isLoading,
    selectConversation,
    setFilters,
    sendReply,
    refresh,
  } = useInbox();
  const [draft, setDraft] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (conversationId && conversationId !== selectedConversationId) {
      selectConversation(conversationId);
    }
  }, [conversationId, selectedConversationId, selectConversation]);

  const selected =
    conversations.find((c) => c.id === selectedConversationId) ?? null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const { data: membership } = await supabase
          .from("org_members")
          .select("org_id, organizations:org_id(plan)")
          .eq("user_id", userData.user.id)
          .limit(1)
          .maybeSingle();
        const plan = (membership?.organizations as { plan?: string } | null)
          ?.plan;
        if (mounted && plan) setAiEnabled(AI_PLANS.has(plan));
      } catch (err) {
        logger.error("Failed to resolve AI plan gate", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (status: "closed" | "snoozed" | "open") => {
    if (!selectedConversationId) return;
    try {
      const res = await fetch(
        `/api/inbox/conversations/${selectedConversationId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Status update failed");
      await refresh();
    } catch (err) {
      logger.error("Status change failed", err);
    }
  };

  const handleAssignClick = () => {
    logger.info("Assign dialog not implemented in Phase 3 MVP");
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="w-80 shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          filters={filters}
          isLoading={isLoading}
          onSelect={selectConversation}
          onFilterChange={setFilters}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="min-h-0 flex-1">
              <MessageThread
                conversation={selected}
                messages={messages}
                replyDraft={draft}
                onDraftChange={setDraft}
                onSend={async (text) => {
                  await sendReply(selected.id, text);
                }}
                onStatusChange={handleStatusChange}
                onAssignClick={handleAssignClick}
              />
            </div>
            <SmartReply
              conversation={selected}
              messages={messages}
              onPick={(s) => setDraft(s)}
              aiEnabled={aiEnabled}
            />
          </>
        ) : (
          <Card className="m-6 flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conversation...
          </Card>
        )}
      </div>

      {selected && (
        <div className="hidden lg:block">
          <ContactProfile conversation={selected} />
        </div>
      )}
    </div>
  );
}
