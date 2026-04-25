"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Inbox,
  ArrowRight,
  Settings as SettingsIcon,
} from "lucide-react";
import { logger } from "@/lib/logger";

type PlanStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "published"
  | "discarded";

interface PlanRow {
  id: string;
  kind: "weekly_content" | "inbox_replies";
  status: PlanStatus;
  week_start: string | null;
  week_end: string | null;
  plan: { theme?: string; summary?: string; posts?: unknown[] } | null;
  created_at: string;
  approved_at: string | null;
}

const STATUS_BADGE: Record<PlanStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  pending_review: {
    label: "Pending review",
    className: "bg-amber-100 text-amber-800",
  },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800" },
  published: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-800",
  },
  discarded: { label: "Discarded", className: "bg-red-50 text-red-700" },
};

export default function AiAgentPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | PlanStatus>("all");
  const [running, setRunning] = useState<
    null | "weekly_content" | "inbox_replies"
  >(null);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [togglingOptIn, setTogglingOptIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchPlans();
    void fetchOptIn();
  }, []);

  async function fetchPlans() {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/agent/plans?limit=50");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { plans: PlanRow[] };
      setPlans(data.plans ?? []);
    } catch (err) {
      logger.error("ai-agent: fetch plans failed", err);
      setErrorMsg("Unable to load plans.");
    } finally {
      setLoadingPlans(false);
    }
  }

  async function fetchOptIn() {
    try {
      const res = await fetch("/api/organizations/automation");
      if (!res.ok) return;
      const data = (await res.json()) as { optedIn: boolean };
      setOptedIn(data.optedIn);
    } catch (err) {
      logger.error("ai-agent: fetch opt-in failed", err);
    }
  }

  async function toggleOptIn() {
    if (optedIn == null || togglingOptIn) return;
    setTogglingOptIn(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/organizations/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedIn: !optedIn }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { optedIn: boolean };
      setOptedIn(data.optedIn);
    } catch (err) {
      logger.error("ai-agent: toggle opt-in failed", err);
      setErrorMsg("Could not save automation setting.");
    } finally {
      setTogglingOptIn(false);
    }
  }

  async function runAgent(kind: "weekly_content" | "inbox_replies") {
    setRunning(kind);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setInfoMsg(
        kind === "weekly_content"
          ? "Weekly content run queued. Check back in a minute."
          : "Inbox triage queued. Drafts will appear shortly.",
      );
      // Soft refresh after a beat — backend writes asynchronously.
      setTimeout(() => void fetchPlans(), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
    } finally {
      setRunning(null);
    }
  }

  const filteredPlans =
    statusFilter === "all"
      ? plans
      : plans.filter((p) => p.status === statusFilter);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-brand-500" />
            AI Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Your always-on social media co-pilot. Plans need approval before
            anything publishes.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/brand-voice">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Brand voice
          </Link>
        </Button>
      </header>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {infoMsg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-brand-500" />
              Run weekly content plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Researches upcoming festivals + trends and drafts a week of posts
              for your connected platforms.
            </p>
            <Button
              onClick={() => void runAgent("weekly_content")}
              disabled={running !== null}
              className="w-full"
            >
              {running === "weekly_content" ? "Queueing..." : "Run weekly plan"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-brand-500" />
              Run inbox triage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Classifies recent unread messages and drafts replies for human
              review.
            </p>
            <Button
              onClick={() => void runAgent("inbox_replies")}
              disabled={running !== null}
              className="w-full"
              variant="outline"
            >
              {running === "inbox_replies" ? "Queueing..." : "Triage inbox"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Auto-run weekly + daily</p>
            <p className="text-sm text-muted-foreground">
              When on, SocialBharat runs the weekly plan every Monday and
              triages inbox messages every morning.
            </p>
          </div>
          <Button
            onClick={() => void toggleOptIn()}
            disabled={optedIn == null || togglingOptIn}
            variant={optedIn ? "default" : "outline"}
            size="sm"
          >
            {optedIn == null
              ? "..."
              : togglingOptIn
                ? "Saving..."
                : optedIn
                  ? "Enabled"
                  : "Enable"}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent plans</h2>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="discarded">Discarded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingPlans ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="font-medium">No plans yet</p>
              <p className="text-sm mt-1">
                Run the weekly plan above to generate your first set of drafts.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredPlans.map((plan) => {
              const badge = STATUS_BADGE[plan.status];
              const postCount = Array.isArray(plan.plan?.posts)
                ? plan.plan.posts.length
                : 0;
              return (
                <Link
                  key={plan.id}
                  href={`/ai-agent/plans/${plan.id}`}
                  className="block group"
                >
                  <Card className="hover:shadow-card-hover transition-shadow">
                    <CardContent className="py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={badge.className + " border-0"}
                          >
                            {badge.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(plan.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="font-medium truncate">
                          {plan.plan?.theme ?? "Untitled plan"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {plan.plan?.summary ?? `${postCount} drafts`}
                          {plan.week_start && plan.week_end
                            ? ` · ${plan.week_start} → ${plan.week_end}`
                            : ""}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
