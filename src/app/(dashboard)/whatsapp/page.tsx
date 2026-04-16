"use client";

import { useInbox } from "@/hooks/useInbox";
import { WhatsAppInbox } from "@/components/inbox/WhatsAppInbox";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";

export default function WhatsAppPage() {
  const { conversations, isLoading, refresh } = useInbox();

  const handleSendTemplate = async ({
    conversationId,
    templateName,
    language,
  }: {
    conversationId: string;
    templateName: string;
    language: string;
  }) => {
    try {
      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `[template:${templateName}:${language}]`,
            media_urls: [],
          }),
        },
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Template send failed" }));
        throw new Error(err.error ?? "Template send failed");
      }
      await refresh();
    } catch (err) {
      logger.error("WhatsApp template send failed", err);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp Business</h1>
        <p className="text-muted-foreground">
          Manage WhatsApp conversations and send template messages outside the
          24-hour service window.
        </p>
      </div>
      {isLoading && conversations.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <WhatsAppInbox
          conversations={conversations}
          onSendTemplate={handleSendTemplate}
        />
      )}
    </div>
  );
}
