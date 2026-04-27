"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import type { ConversationSummary } from "@/stores/inbox-store";

const STATUS_OPTIONS = ["New", "Interested", "Hot", "Paid", "Lost"] as const;
type LeadStatus = (typeof STATUS_OPTIONS)[number];

interface Lead {
  id: string;
  org_id: string;
  contact_id: string;
  name: string | null;
  status: LeadStatus;
  notes: string | null;
}

type FieldKey = "name" | "status" | "notes";

interface Props {
  conversation: ConversationSummary;
}

export function LeadCard({ conversation }: Props) {
  const contact = conversation.contact;
  const [lead, setLead] = useState<Lead | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [notes, setNotes] = useState("");
  const [savingField, setSavingField] = useState<FieldKey | null>(null);
  const [savedField, setSavedField] = useState<FieldKey | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load (or create on first open) the lead row whenever the contact changes.
  useEffect(() => {
    if (!contact?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads?contactId=${contact.id}`);
        let data: { lead: Lead } | null = null;
        if (res.ok) {
          data = await res.json();
        } else if (res.status === 404) {
          const createRes = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contact_id: contact.id,
              name: contact.display_name ?? undefined,
            }),
          });
          if (!createRes.ok) throw new Error("create lead failed");
          data = await createRes.json();
        }
        if (!cancelled && data?.lead) {
          setLead(data.lead);
          setName(data.lead.name ?? "");
          setStatus(data.lead.status);
          setNotes(data.lead.notes ?? "");
        }
      } catch (err) {
        logger.error("LeadCard load failed", err, { contactId: contact.id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact?.id, contact?.display_name]);

  const flashSaved = (field: FieldKey) => {
    setSavedField(field);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedField(null), 2000);
  };

  const patchLead = async (
    field: FieldKey,
    body: Partial<Pick<Lead, "name" | "status" | "notes">>,
  ) => {
    if (!lead) return;
    setSavingField(field);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch failed");
      const data = (await res.json()) as { lead: Lead };
      setLead(data.lead);
      flashSaved(field);
    } catch (err) {
      logger.error("LeadCard patch failed", err, { leadId: lead.id, field });
    } finally {
      setSavingField(null);
    }
  };

  if (!contact) {
    return (
      <Card className="m-3 p-6 text-sm text-muted-foreground">
        No contact details available.
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 border-l p-4">
      <h3 className="text-sm font-semibold text-slate-900">Lead</h3>

      <div className="space-y-1">
        <label
          htmlFor="lead-name"
          className="flex items-center justify-between text-xs font-medium text-slate-600"
        >
          <span>Name</span>
          {savingField === "name" ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : savedField === "name" ? (
            <span className="text-emerald-600">Saved ✓</span>
          ) : null}
        </label>
        <Input
          id="lead-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if ((lead?.name ?? "") !== name) {
              void patchLead("name", { name: name.trim() || null });
            }
          }}
          placeholder="Lead name"
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-600">Phone</p>
        <code className="block rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-800">
          {contact.platform_user_id ?? "—"}
        </code>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="lead-status"
          className="flex items-center justify-between text-xs font-medium text-slate-600"
        >
          <span>Status</span>
          {savingField === "status" ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : savedField === "status" ? (
            <span className="text-emerald-600">Saved ✓</span>
          ) : null}
        </label>
        <Select
          value={status}
          onValueChange={(v) => {
            const next = v as LeadStatus;
            setStatus(next);
            if (lead?.status !== next) {
              void patchLead("status", { status: next });
            }
          }}
        >
          <SelectTrigger id="lead-status" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-1">
        <label
          htmlFor="lead-notes"
          className="flex items-center justify-between text-xs font-medium text-slate-600"
        >
          <span>Notes</span>
          {savingField === "notes" ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : savedField === "notes" ? (
            <span className="text-emerald-600">Saved ✓</span>
          ) : null}
        </label>
        <Textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if ((lead?.notes ?? "") !== notes) {
              void patchLead("notes", { notes: notes.trim() || null });
            }
          }}
          placeholder="Add notes about this lead…"
          rows={6}
          className="resize-none text-sm"
        />
      </div>
    </div>
  );
}
