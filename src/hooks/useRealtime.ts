"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

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
  enabled?: boolean;
}

/**
 * Subscribe to a Supabase Realtime channel. The hook unsubscribes on unmount
 * and when its inputs change. RLS is enforced server-side: clients only
 * receive events for rows they are allowed to read.
 */
export function useRealtime<T = Record<string, unknown>>(
  options: RealtimeOptions<T>,
): void {
  const {
    table,
    event = "*",
    filter,
    schema = "public",
    onInsert,
    onUpdate,
    enabled = true,
  } = options;

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
          onInsert?.(payload as unknown as RealtimePayload<T>);
        },
      );
    }
    if (event === "UPDATE" || event === "*") {
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema, table, filter },
        (payload) => {
          onUpdate?.(payload as unknown as RealtimePayload<T>);
        },
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, schema, enabled, onInsert, onUpdate]);
}
