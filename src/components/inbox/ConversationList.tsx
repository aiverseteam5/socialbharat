"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Twitter,
} from "lucide-react";
import type {
  ConversationSummary,
  InboxFilters,
  InboxPlatform,
  ConversationStatus,
} from "@/stores/inbox-store";
import type { RealtimeStatus } from "@/hooks/useRealtime";
import { formatRelativeTime } from "@/lib/format-relative-time";

const platformIcon: Record<InboxPlatform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
};

const statusConfig: Record<RealtimeStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-emerald-500", label: "Live" },
  connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting" },
  disconnected: { dot: "bg-slate-400", label: "Offline" },
  error: { dot: "bg-red-500", label: "Error" },
};

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function countUnread(c: ConversationSummary): number {
  if (!Array.isArray(c.latest_message) || c.latest_message.length === 0) {
    return 0;
  }
  const lastAgent = [...c.latest_message]
    .filter((m) => m.sender_type === "agent")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  return c.latest_message.filter(
    (m) =>
      m.sender_type === "contact" &&
      (!lastAgent || m.created_at > lastAgent.created_at),
  ).length;
}

interface Props {
  conversations: ConversationSummary[];
  selectedId: string | null;
  filters: InboxFilters;
  isLoading: boolean;
  realtimeStatus: RealtimeStatus;
  onSelect: (id: string) => void;
  onFilterChange: (filters: InboxFilters) => void;
  /**
   * "default" — multi-platform inbox (FB/IG/Twitter/LinkedIn/WhatsApp filter shown).
   * "whatsapp" — WhatsApp-only chat. Hides platform filter, switches to client-side
   * search across name + phone, truncates previews to 40 chars, uses
   * `formatRelativeTime`, shows numeric unread badge (cap "9+").
   */
  mode?: "default" | "whatsapp";
}

export function ConversationList({
  conversations,
  selectedId,
  filters,
  isLoading,
  realtimeStatus,
  onSelect,
  onFilterChange,
  mode = "default",
}: Props) {
  const sc = statusConfig[realtimeStatus];
  const isWhatsApp = mode === "whatsapp";

  // WhatsApp mode does the search client-side over name OR phone so a user
  // can find a contact by typing the last 4 digits of their number.
  const visibleConversations = isWhatsApp
    ? conversations.filter((c) => {
        const needle = (filters.search ?? "").trim().toLowerCase();
        if (!needle) return true;
        const name = c.contact?.display_name?.toLowerCase() ?? "";
        const phone = c.contact?.platform_user_id?.toLowerCase() ?? "";
        return name.includes(needle) || phone.includes(needle);
      })
    : conversations;

  const emptyState = isWhatsApp
    ? "No conversations yet. Share your WhatsApp link to get started."
    : "No conversations yet. Incoming messages will appear here.";

  return (
    <div className="flex h-full flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <Input
            className="flex-1"
            placeholder={
              isWhatsApp ? "Search by name or phone…" : "Search contacts..."
            }
            value={filters.search ?? ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                search: e.target.value || undefined,
              })
            }
          />
          <div
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
            title={`Realtime: ${sc.label}`}
          >
            <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
            <span className="hidden sm:inline">{sc.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!isWhatsApp && (
            <Select
              value={filters.platform ?? "all"}
              onValueChange={(v) =>
                onFilterChange({
                  ...filters,
                  platform: v === "all" ? undefined : (v as InboxPlatform),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) =>
              onFilterChange({
                ...filters,
                status: v === "all" ? undefined : (v as ConversationStatus),
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="snoozed">Snoozed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && visibleConversations.length === 0 ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : visibleConversations.length === 0 ? (
          <Card className="m-3 p-6 text-center text-sm text-muted-foreground">
            {emptyState}
          </Card>
        ) : (
          <ul className="divide-y">
            {visibleConversations.map((c) => {
              const Icon = platformIcon[c.platform];
              const preview = Array.isArray(c.latest_message)
                ? c.latest_message[0]
                : undefined;
              const isSelected = c.id === selectedId;
              const previewText = preview?.content ?? "No messages yet";
              const displayPreview = isWhatsApp
                ? truncate(previewText, 40)
                : previewText;
              const timeLabel = isWhatsApp
                ? formatRelativeTime(c.last_message_at)
                : formatTimeAgo(c.last_message_at);
              const unreadCount = isWhatsApp ? countUnread(c) : 0;
              const hasUnreadDot =
                !isWhatsApp &&
                preview &&
                !preview.sender_type.includes("agent");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full gap-3 p-3 text-left transition ${
                      isSelected ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={c.contact?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {c.contact?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {c.contact?.display_name ??
                            c.contact?.platform_user_id ??
                            "Unknown contact"}
                        </span>
                        {!isWhatsApp && (
                          <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {timeLabel}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {displayPreview}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {c.status !== "open" && (
                          <Badge variant="secondary" className="text-[10px]">
                            {c.status}
                          </Badge>
                        )}
                        {hasUnreadDot && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        {isWhatsApp && unreadCount > 0 && (
                          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
