"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const LEAD_STATUSES = ["New", "Interested", "Hot", "Paid", "Lost"] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface SegmentFilter {
  lead_status?: LeadStatus[];
  tags?: string[];
  created_from?: string;
  created_to?: string;
}

interface Props {
  value: SegmentFilter;
  onChange: (value: SegmentFilter) => void;
}

export function SegmentBuilder({ value, onChange }: Props) {
  const [tagDraft, setTagDraft] = useState("");

  const toggleStatus = (s: LeadStatus) => {
    const curr = value.lead_status ?? [];
    const next = curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s];
    onChange({ ...value, lead_status: next.length ? next : undefined });
  };

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    const curr = value.tags ?? [];
    if (curr.includes(t)) return;
    onChange({ ...value, tags: [...curr, t] });
    setTagDraft("");
  };

  const removeTag = (t: string) => {
    const curr = value.tags ?? [];
    const next = curr.filter((x) => x !== t);
    onChange({ ...value, tags: next.length ? next : undefined });
  };

  const setDate = (key: "created_from" | "created_to", v: string) => {
    onChange({ ...value, [key]: v ? new Date(v).toISOString() : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Lead status</Label>
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => {
            const active = value.lead_status?.includes(s) ?? false;
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => toggleStatus(s)}
              >
                {s}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seg-tag">Conversation tags</Label>
        <div className="flex gap-2">
          <Input
            id="seg-tag"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="vip, returning…"
            maxLength={50}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
        {(value.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(value.tags ?? []).map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="seg-from">Created from</Label>
          <Input
            id="seg-from"
            type="date"
            value={value.created_from ? value.created_from.slice(0, 10) : ""}
            onChange={(e) => setDate("created_from", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seg-to">Created to</Label>
          <Input
            id="seg-to"
            type="date"
            value={value.created_to ? value.created_to.slice(0, 10) : ""}
            onChange={(e) => setDate("created_to", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
