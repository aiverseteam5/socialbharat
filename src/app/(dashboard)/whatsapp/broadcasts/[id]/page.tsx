"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Ban, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  BroadcastRecipientTable,
  type BroadcastRecipient,
} from "@/components/whatsapp/BroadcastRecipientTable";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Detail {
  campaign: Campaign;
  recipients: BroadcastRecipient[];
  counts: Record<string, number>;
  page: number;
  page_size: number;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  scheduled: "secondary",
  running: "default",
  completed: "secondary",
  cancelled: "outline",
  failed: "destructive",
};

export default function BroadcastDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/broadcasts/${id}?page=${page}`);
      if (!res.ok) throw new Error(`GET failed (${res.status})`);
      const body = (await res.json()) as Detail;
      setData(body);
    } catch (err) {
      logger.error("Broadcast detail load failed", err);
      toast.error("Failed to load broadcast");
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll every 5s while running so live counts and recipient statuses tick.
  useEffect(() => {
    if (data?.campaign.status !== "running") return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [data?.campaign.status, load]);

  const handleCancel = async () => {
    if (!confirm("Cancel this broadcast? Pending recipients will be skipped."))
      return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/whatsapp/broadcasts/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast.error(body.error ?? `Cancel failed (${res.status})`);
        return;
      }
      toast.success("Broadcast cancelled");
      await load();
    } catch (err) {
      logger.error("Broadcast cancel failed", err);
      toast.error("Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !data) {
    return (
      <Card className="flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const { campaign, recipients, counts } = data;
  const cancellable = ["draft", "scheduled", "running"].includes(
    campaign.status,
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/whatsapp/broadcasts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to broadcasts
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge variant={STATUS_VARIANT[campaign.status] ?? "outline"}>
              {campaign.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {new Date(campaign.created_at).toLocaleString()}
            {campaign.scheduled_at
              ? ` · scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}`
              : null}
            {campaign.started_at
              ? ` · started ${new Date(campaign.started_at).toLocaleString()}`
              : null}
            {campaign.completed_at
              ? ` · completed ${new Date(campaign.completed_at).toLocaleString()}`
              : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh
          </Button>
          {cancellable && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Ban className="mr-2 h-3 w-3" />
              )}
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {(
          ["pending", "sent", "delivered", "read", "failed", "skipped"] as const
        ).map((s) => (
          <Card key={s} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {s}
            </p>
            <p className="mt-1 text-2xl font-semibold">{counts[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">
          Recipients (page {data.page + 1})
        </p>
        <BroadcastRecipientTable recipients={recipients} />
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Showing {recipients.length} of {campaign.total_recipients}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={recipients.length < data.page_size}
          >
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
