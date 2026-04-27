"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { LeadWithContact } from "./types";

interface Props {
  lead: LeadWithContact;
  onClick: (lead: LeadWithContact) => void;
}

function truncate(s: string | null, max = 40): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function LeadCardKanban({ lead, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const title =
    lead.name?.trim() ||
    lead.contact?.display_name?.trim() ||
    lead.contact?.platform_user_id ||
    "Unknown";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only fire click if not currently dragging
        if (!isDragging) onClick(lead);
        e.stopPropagation();
      }}
      className="cursor-grab touch-none p-3 transition hover:bg-muted/50 active:cursor-grabbing"
    >
      <div className="text-sm font-medium leading-tight">{title}</div>
      {lead.last_message_preview && (
        <div className="mt-1 text-xs text-muted-foreground">
          {truncate(lead.last_message_preview, 40)}
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted-foreground">
        {formatRelativeTime(lead.last_message_at) || "—"}
      </div>
    </Card>
  );
}
