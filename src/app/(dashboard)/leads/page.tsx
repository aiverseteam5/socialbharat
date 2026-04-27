"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { LeadColumn } from "@/components/leads/LeadColumn";
import { LeadDetailDrawer } from "@/components/leads/LeadDetailDrawer";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type LeadWithContact,
} from "@/components/leads/types";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<LeadWithContact | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Debounce search 300ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildUrl = useCallback(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    const qs = sp.toString();
    return qs ? `/api/leads/list?${qs}` : "/api/leads/list";
  }, [debouncedQ, from, to]);

  const fetchLeads = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(buildUrl());
        if (!res.ok) throw new Error(`GET failed (${res.status})`);
        const body = (await res.json()) as { leads: LeadWithContact[] };
        setLeads(body.leads);
      } catch (err) {
        logger.error("Lead list fetch failed", err);
        toast.error("Failed to load leads.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildUrl],
  );

  // Initial load + refetch on filter changes.
  const initialDone = useRef(false);
  useEffect(() => {
    if (!initialDone.current) {
      initialDone.current = true;
      void fetchLeads("initial");
    } else {
      void fetchLeads("refresh");
    }
  }, [fetchLeads]);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, LeadWithContact[]> = {
      New: [],
      Interested: [],
      Hot: [],
      Paid: [],
      Lost: [],
    };
    for (const lead of leads) map[lead.status].push(lead);
    return map;
  }, [leads]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("column-")) return;

    const targetStatus = overId.slice("column-".length) as LeadStatus;
    if (!(LEAD_STATUSES as readonly string[]).includes(targetStatus)) return;

    const leadId = String(active.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    const prevStatus = lead.status;
    setLeads((curr) =>
      curr.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l)),
    );

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error(`PATCH failed (${res.status})`);
    } catch (err) {
      logger.error("Lead status PATCH failed", err);
      toast.error("Failed to update status. Reverting.");
      setLeads((curr) =>
        curr.map((l) => (l.id === leadId ? { ...l, status: prevStatus } : l)),
      );
    }
  };

  const handleLeadChanged = (updated: LeadWithContact) => {
    setLeads((curr) => curr.map((l) => (l.id === updated.id ? updated : l)));
    setSelected(updated);
  };

  const handleLeadDeleted = (id: string) => {
    setLeads((curr) => curr.filter((l) => l.id !== id));
    setSelected(null);
  };

  const isEmpty = !loading && leads.length === 0 && !debouncedQ && !from && !to;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards across columns to update status. Click a card to edit.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLeads("refresh")}
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, contact, or phone…"
            maxLength={64}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
      </div>

      {loading ? (
        <Card className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : isEmpty ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No leads yet. Leads are auto-created when customers message you on
            WhatsApp.
          </p>
          <Link
            href="/whatsapp"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to Inbox →
          </Link>
        </Card>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto md:grid-cols-3 lg:grid-cols-5">
            {LEAD_STATUSES.map((status) => (
              <LeadColumn
                key={status}
                status={status}
                leads={grouped[status]}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </DndContext>
      )}

      <LeadDetailDrawer
        lead={selected}
        onClose={() => setSelected(null)}
        onChange={handleLeadChanged}
        onDelete={handleLeadDeleted}
      />
    </div>
  );
}
