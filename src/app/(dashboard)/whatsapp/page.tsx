"use client";

import { useEffect, useMemo, useState } from "react";
import { useInbox } from "@/hooks/useInbox";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageThread } from "@/components/inbox/MessageThread";
import { LeadCard } from "@/components/inbox/LeadCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";

const STUB_TEMPLATES = [
  { name: "welcome_message", language: "en" },
  { name: "order_update_hi", language: "hi" },
  { name: "festival_greeting", language: "en" },
];

export default function WhatsAppPage() {
  const {
    conversations,
    selectedConversationId,
    messages,
    filters,
    isLoading,
    realtimeStatus,
    selectConversation,
    setFilters,
    sendReply,
    refresh,
  } = useInbox();

  const [draft, setDraft] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(
    STUB_TEMPLATES[0]!.name,
  );

  // Pin the platform filter to whatsapp on mount.
  useEffect(() => {
    setFilters({ ...filters, platform: "whatsapp" });
    // Run once — `setFilters` is store-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

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
      logger.error("WhatsApp status change failed", err);
    }
  };

  const handleSendTemplate = async () => {
    if (!selected) return;
    const t = STUB_TEMPLATES.find((x) => x.name === selectedTemplate);
    if (!t) return;
    try {
      const res = await fetch(`/api/inbox/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[template:${t.name}:${t.language}]`,
          media_urls: [],
        }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Template send failed" }));
        throw new Error(err.error ?? "Template send failed");
      }
      await refresh();
      setTemplateOpen(false);
    } catch (err) {
      logger.error("WhatsApp template send failed", err);
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="w-80 shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          filters={filters}
          isLoading={isLoading}
          realtimeStatus={realtimeStatus}
          onSelect={selectConversation}
          onFilterChange={setFilters}
          mode="whatsapp"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-end gap-2 border-b bg-white px-4 py-2">
              <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Send template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send WhatsApp template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Select
                      value={selectedTemplate}
                      onValueChange={setSelectedTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STUB_TEMPLATES.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      Template messages are required for conversations outside
                      the 24-hour service window. Live template catalogue
                      integration is pending.
                    </p>
                    <Button onClick={handleSendTemplate}>Send</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                onAssignClick={() => {}}
                sendKey="enter"
              />
            </div>
          </>
        ) : (
          <Card className="m-6 flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view lead details.
          </Card>
        )}
      </div>

      {selected && (
        <div className="hidden w-80 shrink-0 lg:block">
          <LeadCard conversation={selected} />
        </div>
      )}
    </div>
  );
}
