"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ConversationSummary } from "@/stores/inbox-store";

interface Props {
  conversation: ConversationSummary;
}

/**
 * CRM-lite profile panel shown alongside a conversation. Currently renders
 * the contact attached to the conversation; cross-platform conversation
 * history per contact is tracked for Phase 4 (CRM module).
 */
export function ContactProfile({ conversation }: Props) {
  const contact = conversation.contact;
  if (!contact) {
    return (
      <aside className="w-64 border-l p-4 text-sm text-muted-foreground">
        No contact linked yet.
      </aside>
    );
  }

  return (
    <aside className="w-64 border-l p-4">
      <div className="flex flex-col items-center text-center">
        <Avatar className="h-16 w-16">
          <AvatarImage src={contact.avatar_url ?? undefined} />
          <AvatarFallback>
            {contact.display_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <p className="mt-2 font-medium">
          {contact.display_name ?? "Unknown contact"}
        </p>
        <p className="text-xs capitalize text-muted-foreground">
          {conversation.platform}
        </p>
      </div>

      <Separator className="my-4" />

      <dl className="space-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Platform ID</dt>
          <dd className="font-mono">{contact.platform_user_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conversation type</dt>
          <dd className="capitalize">{conversation.type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Language</dt>
          <dd>{conversation.language_detected ?? "Unknown"}</dd>
        </div>
        {conversation.tags.length > 0 && (
          <div>
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {conversation.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
