"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Send, MoreHorizontal, Paperclip, UserPlus } from "lucide-react";
import type { ConversationSummary, InboxMessage } from "@/stores/inbox-store";
import { logger } from "@/lib/logger";

interface Props {
  conversation: ConversationSummary;
  messages: InboxMessage[];
  replyDraft: string;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => Promise<void>;
  onStatusChange: (status: "closed" | "snoozed" | "open") => Promise<void>;
  onAssignClick: () => void;
}

export function MessageThread({
  conversation,
  messages,
  replyDraft,
  onDraftChange,
  onSend,
  onStatusChange,
  onAssignClick,
}: Props) {
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = replyDraft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend(text);
      onDraftChange("");
    } catch (err) {
      logger.error("Send reply failed", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b p-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={conversation.contact?.avatar_url ?? undefined} />
          <AvatarFallback>
            {conversation.contact?.display_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {conversation.contact?.display_name ?? "Unknown contact"}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {conversation.platform} · {conversation.type}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {conversation.status}
        </Badge>
        <Button size="sm" variant="outline" onClick={onAssignClick}>
          <UserPlus className="mr-1 h-3.5 w-3.5" /> Assign
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange("closed")}>
              Close conversation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("snoozed")}>
              Snooze
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("open")}>
              Reopen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const isAgent = m.sender_type === "agent";
              return (
                <li
                  key={m.id}
                  className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      isAgent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                    <p
                      className={`mt-1 text-[10px] ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Type a reply..."
            rows={2}
            value={replyDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="resize-none"
          />
          <Button
            size="icon"
            variant="outline"
            type="button"
            title="Attach (coming soon)"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            type="button"
            onClick={handleSend}
            disabled={sending || replyDraft.trim().length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
