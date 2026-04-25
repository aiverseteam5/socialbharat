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

interface Props {
  conversations: ConversationSummary[];
  selectedId: string | null;
  filters: InboxFilters;
  isLoading: boolean;
  realtimeStatus: RealtimeStatus;
  onSelect: (id: string) => void;
  onFilterChange: (filters: InboxFilters) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  filters,
  isLoading,
  realtimeStatus,
  onSelect,
  onFilterChange,
}: Props) {
  const sc = statusConfig[realtimeStatus];

  return (
    <div className="flex h-full flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center gap-2">
          <Input
            className="flex-1"
            placeholder="Search contacts..."
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
        {isLoading && conversations.length === 0 ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <Card className="m-3 p-6 text-center text-sm text-muted-foreground">
            No conversations yet. Incoming messages will appear here.
          </Card>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => {
              const Icon = platformIcon[c.platform];
              const preview = Array.isArray(c.latest_message)
                ? c.latest_message[0]
                : undefined;
              const isSelected = c.id === selectedId;
              const hasUnread =
                preview && !preview.sender_type.includes("agent");
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
                          {c.contact?.display_name ?? "Unknown contact"}
                        </span>
                        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatTimeAgo(c.last_message_at)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {preview?.content ?? "No messages yet"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {c.status !== "open" && (
                          <Badge variant="secondary" className="text-[10px]">
                            {c.status}
                          </Badge>
                        )}
                        {hasUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
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
