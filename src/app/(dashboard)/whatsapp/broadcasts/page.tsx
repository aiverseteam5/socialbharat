"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
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

export default function BroadcastsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/whatsapp/broadcasts");
      const body = (await res.json()) as { campaigns: Campaign[] };
      setCampaigns(body.campaigns);
    } catch (err) {
      logger.error("Broadcasts load failed", err);
      toast.error("Failed to load broadcasts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Broadcasts</h1>
          <p className="text-sm text-muted-foreground">
            Send Meta-approved templates to segments of your contacts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load("refresh")}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            Refresh
          </Button>
          <Button asChild>
            <Link href="/whatsapp/broadcasts/new">
              <Plus className="mr-2 h-4 w-4" />
              New broadcast
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : campaigns.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          <Link
            href="/whatsapp/broadcasts/new"
            className="text-sm font-medium text-primary hover:underline"
          >
            Create your first broadcast →
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/whatsapp/broadcasts/${c.id}`}
              className="block"
            >
              <Card className="flex items-start justify-between gap-4 p-4 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {new Date(c.created_at).toLocaleString()}
                    {c.scheduled_at
                      ? ` · scheduled for ${new Date(c.scheduled_at).toLocaleString()}`
                      : null}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>
                    <span className="font-medium">{c.sent_count}</span>
                    <span className="text-muted-foreground">
                      {" / "}
                      {c.total_recipients} sent
                    </span>
                  </p>
                  {c.failed_count > 0 && (
                    <p className="text-xs text-destructive">
                      {c.failed_count} failed
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
