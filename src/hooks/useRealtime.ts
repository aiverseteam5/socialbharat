"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export type RealtimeStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface RealtimePayload<T> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  commit_timestamp: string;
  new: T;
  old: Partial<T>;
}

export interface RealtimeOptions<T> {
  table: string;
  event?: RealtimeEvent;
  /** Supabase filter expression, e.g. "conversation_id=eq.abc" */
  filter?: string;
  schema?: string;
  onInsert?: (payload: RealtimePayload<T>) => void;
  onUpdate?: (payload: RealtimePayload<T>) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
  enabled?: boolean;
}

function mapSupabaseStatus(raw: string): RealtimeStatus {
  if (raw === "SUBSCRIBED") return "connected";
  if (raw === "TIMED_OUT" || raw === "CLOSED") return "disconnected";
  if (raw === "CHANNEL_ERROR") return "error";
  return "connecting";
}

/**
 * Subscribe to a Supabase Realtime channel. Returns the current connection
 * status. The hook unsubscribes on unmount and when its inputs change.
 * RLS is enforced server-side: clients only receive events for rows they
 * are allowed to read.
 */
export function useRealtime<T = Record<string, unknown>>(
  options: RealtimeOptions<T>,
): { status: RealtimeStatus } {
  const {
    table,
    event = "*",
    filter,
    schema = "public",
    onInsert,
    onUpdate,
    onStatusChange,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  // Stable refs so the subscribe callback doesn't re-run on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onStatusChangeRef = useRef(onStatusChange);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channelName = `realtime:${schema}:${table}:${filter ?? "all"}`;
    const channel = supabase.channel(channelName);

    if (event === "INSERT" || event === "*") {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema, table, filter },
        (payload) => {
          onInsertRef.current?.(payload as unknown as RealtimePayload<T>);
        },
      );
    }
    if (event === "UPDATE" || event === "*") {
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema, table, filter },
        (payload) => {
          onUpdateRef.current?.(payload as unknown as RealtimePayload<T>);
        },
      );
    }

    channel.subscribe((rawStatus: string) => {
      const mapped = mapSupabaseStatus(rawStatus);
      setStatus(mapped);
      onStatusChangeRef.current?.(mapped);
    });

    return () => {
      supabase.removeChannel(channel);
      setStatus("connecting");
    };
  }, [table, event, filter, schema, enabled]);

  return { status };
}
