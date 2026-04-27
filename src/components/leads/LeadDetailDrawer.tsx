"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { LEAD_STATUSES, type LeadStatus, type LeadWithContact } from "./types";

type FieldKey = "name" | "status" | "notes";

interface Props {
  lead: LeadWithContact | null;
  onClose: () => void;
  onChange: (lead: LeadWithContact) => void;
  onDelete: (id: string) => void;
}

export function LeadDetailDrawer({ lead, onClose, onChange, onDelete }: Props) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [notes, setNotes] = useState("");
  const [savingField, setSavingField] = useState<FieldKey | null>(null);
  const [savedField, setSavedField] = useState<FieldKey | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sync local edit state when the selected lead changes.
  useEffect(() => {
    if (!lead) return;
    setName(lead.name ?? "");
    setStatus(lead.status);
    setNotes(lead.notes ?? "");
    setSavingField(null);
    setSavedField(null);
  }, [lead]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const flashSaved = (field: FieldKey) => {
    setSavedField(field);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedField(null), 2000);
  };

  const patchField = async (
    field: FieldKey,
    value: string | null | LeadStatus,
  ) => {
    if (!lead) return;
    setSavingField(field);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error(`PATCH failed (${res.status})`);
      const body = (await res.json()) as { lead: LeadWithContact };
      onChange({
        ...body.lead,
        contact: lead.contact,
        latest_conversation_id: lead.latest_conversation_id,
        last_message_at: lead.last_message_at,
        last_message_preview: lead.last_message_preview,
      });
      flashSaved(field);
    } catch (err) {
      logger.error("Lead PATCH failed", err);
      toast.error("Failed to save. Try again.");
    } finally {
      setSavingField(null);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (
      !confirm(
        `Delete lead for ${lead.contact?.display_name ?? lead.contact?.platform_user_id ?? "this contact"}?`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`DELETE failed (${res.status})`);
      toast.success("Lead deleted");
      onDelete(lead.id);
    } catch (err) {
      logger.error("Lead DELETE failed", err);
      toast.error("Failed to delete. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const fieldStatus = (field: FieldKey) => {
    if (savingField === field)
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    if (savedField === field)
      return <span className="text-[11px] text-emerald-600">Saved ✓</span>;
    return null;
  };

  return (
    <Sheet
      open={lead !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>Lead details</SheetTitle>
              <SheetDescription>
                Edit name, notes, or status. Changes save automatically.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  {fieldStatus("name")}
                </div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if ((lead.name ?? "") !== name)
                      patchField("name", name || null);
                  }}
                  placeholder={lead.contact?.display_name ?? "Name"}
                  maxLength={120}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Phone
                </label>
                <code className="block rounded-md bg-muted px-3 py-2 text-sm">
                  {lead.contact?.platform_user_id ?? "—"}
                </code>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  {fieldStatus("status")}
                </div>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    const next = v as LeadStatus;
                    setStatus(next);
                    if (next !== lead.status) patchField("status", next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Notes
                  </label>
                  {fieldStatus("notes")}
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if ((lead.notes ?? "") !== notes)
                      patchField("notes", notes || null);
                  }}
                  rows={5}
                  maxLength={5000}
                  placeholder="Add a note..."
                />
              </div>

              {lead.latest_conversation_id && (
                <Link
                  href="/whatsapp"
                  className="block text-sm text-primary hover:underline"
                >
                  View conversation →
                </Link>
              )}
            </div>

            <div className="border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full"
              >
                {deleting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Delete lead
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
