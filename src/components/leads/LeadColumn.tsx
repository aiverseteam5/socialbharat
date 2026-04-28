"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { LeadCardKanban } from "./LeadCardKanban";
import type { LeadStatus, LeadWithContact } from "./types";

interface Props {
  status: LeadStatus;
  leads: LeadWithContact[];
  onCardClick: (lead: LeadWithContact) => void;
}

export function LeadColumn({ status, leads, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });

  return (
    <div className="flex min-h-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{status}</span>
        <Badge variant="secondary" className="text-xs">
          {leads.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-2 transition ${
          isOver ? "bg-muted" : ""
        }`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs italic text-muted-foreground">
              No {status} leads
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCardKanban key={lead.id} lead={lead} onClick={onCardClick} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
