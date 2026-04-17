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
import { cn } from "@/lib/utils";
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

  const statusColor =
    conversation.status === "open"
      ? "border-emerald-300 text-emerald-700 bg-emerald-50"
      : conversation.status === "snoozed"
        ? "border-amber-300 text-amber-700 bg-amber-50"
        : "border-slate-200 text-slate-500 bg-slate-50";

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
          <AvatarImage src={conversation.contact?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-sm">
            {conversation.contact?.display_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 text-sm">
            {conversation.contact?.display_name ?? "Unknown contact"}
          </p>
          <p className="text-xs capitalize text-slate-400">
            {conversation.platform} · {conversation.type}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("capitalize text-xs font-medium", statusColor)}
        >
          {conversation.status}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={onAssignClick}
          className="text-slate-600 hover:text-slate-900"
          aria-label="Assign conversation"
        >
          <UserPlus className="mr-1 h-3.5 w-3.5" />
          Assign
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-slate-700"
              aria-label="More actions"
            >
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

      {/* Messages */}
      <ScrollArea
        className="flex-1 bg-slate-50 px-4 py-4"
        aria-live="polite"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-400">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => {
              const isAgent = m.sender_type === "agent";
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-end gap-2",
                    isAgent ? "justify-end" : "justify-start",
                  )}
                >
                  {/* Inbound avatar */}
                  {!isAgent && (
                    <Avatar className="h-7 w-7 ring-2 ring-white shadow-sm shrink-0 mb-0.5">
                      <AvatarImage
                        src={conversation.contact?.avatar_url ?? undefined}
                      />
                      <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-medium">
                        {conversation.contact?.display_name?.[0]?.toUpperCase() ??
                          "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[72%] px-3.5 py-2.5 text-sm shadow-sm",
                      isAgent
                        ? "bg-brand-600 text-white rounded-xl rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-xl rounded-bl-sm",
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] tabular-nums",
                        isAgent ? "text-white/60 text-right" : "text-slate-400",
                      )}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Reply bar */}
      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Type a reply… (⌘Enter to send)"
            rows={2}
            value={replyDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="resize-none text-sm bg-slate-50 border-slate-200 focus:border-brand-400 focus:ring-brand-400"
            aria-label="Reply message"
          />
          <Button
            size="icon"
            variant="outline"
            type="button"
            aria-label="Attach file (coming soon)"
            disabled
            className="text-slate-400 shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            type="button"
            onClick={handleSend}
            disabled={sending || replyDraft.trim().length === 0}
            aria-label="Send reply"
            className="shrink-0 bg-brand-600 hover:bg-brand-700 active:scale-[0.96] transition-transform"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
