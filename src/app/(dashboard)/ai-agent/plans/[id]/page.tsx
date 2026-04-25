"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, CheckCircle, Calendar, Hash } from "lucide-react";
import { logger } from "@/lib/logger";

interface PlanPost {
  platforms: string[];
  caption: string;
  hashtags: string[];
  suggestedAt: string;
  festivalId?: string | null;
  rationale?: string;
}

interface PlanRow {
  id: string;
  org_id: string;
  kind: string;
  status: "draft" | "pending_review" | "approved" | "published" | "discarded";
  week_start: string | null;
  week_end: string | null;
  plan: {
    theme?: string;
    summary?: string;
    posts?: PlanPost[];
  } | null;
  created_at: string;
  approved_at: string | null;
  published_post_ids: string[] | null;
}

const STATUS_BADGE: Record<
  PlanRow["status"],
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  pending_review: {
    label: "Pending review",
    className: "bg-amber-100 text-amber-800",
  },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800" },
  published: { label: "Published", className: "bg-green-100 text-green-800" },
  discarded: { label: "Discarded", className: "bg-red-50 text-red-700" },
};

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, PlanPost>>({});
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    void fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchPlan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/plans/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { plan: PlanRow };
      setPlan(data.plan);
      const seeded: Record<number, PlanPost> = {};
      (data.plan.plan?.posts ?? []).forEach((p, i) => {
        seeded[i] = { ...p };
      });
      setDrafts(seeded);
    } catch (err) {
      logger.error("plan-detail: fetch failed", err);
      setErrorMsg("Unable to load plan.");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<PlanPost>) {
    setDrafts((prev) => ({
      ...prev,
      [index]: { ...prev[index]!, ...patch },
    }));
  }

  async function savePost(index: number) {
    const draft = drafts[index];
    if (!draft) return;
    setSavingIndex(index);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/agent/plans/${id}/posts/${index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: draft.caption,
          hashtags: draft.hashtags,
          suggestedAt: draft.suggestedAt,
          platforms: draft.platforms,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrorMsg(msg);
    } finally {
      setSavingIndex(null);
    }
  }

  async function approveAndSchedule() {
    if (!plan) return;
    if (
      !confirm(
        "Approve this plan? Posts will be scheduled and published automatically.",
      )
    )
      return;

    setApproving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/agent/plans/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push("/ai-agent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approve failed";
      setErrorMsg(msg);
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">
            {errorMsg ?? "Plan not found."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/ai-agent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AI Studio
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const badge = STATUS_BADGE[plan.status];
  const editable =
    plan.status === "pending_review" || plan.status === "approved";
  const posts = plan.plan?.posts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/ai-agent">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        {plan.status === "pending_review" && (
          <Button
            onClick={() => void approveAndSchedule()}
            disabled={approving}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {approving ? "Approving..." : "Approve & schedule"}
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={badge.className + " border-0"}>
              {badge.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Created {new Date(plan.created_at).toLocaleString()}
            </span>
          </div>
          <CardTitle className="text-2xl mt-2">
            {plan.plan?.theme ?? "Untitled plan"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{plan.plan?.summary ?? ""}</p>
          {plan.week_start && plan.week_end && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {plan.week_start} → {plan.week_end}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Drafts ({posts.length})</h2>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No draft posts in this plan.
            </CardContent>
          </Card>
        ) : (
          posts.map((_, index) => {
            const draft = drafts[index] ?? posts[index]!;
            const original = posts[index]!;
            const dirty =
              draft.caption !== original.caption ||
              draft.hashtags.join(" ") !== original.hashtags.join(" ") ||
              draft.suggestedAt !== original.suggestedAt;
            return (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {draft.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        {p}
                      </Badge>
                    ))}
                    {draft.festivalId && (
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-800 border-0"
                      >
                        Festival
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Caption</label>
                    <Textarea
                      value={draft.caption}
                      onChange={(e) =>
                        updateDraft(index, { caption: e.target.value })
                      }
                      disabled={!editable}
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        Hashtags (space-separated)
                      </label>
                      <Input
                        value={draft.hashtags.join(" ")}
                        onChange={(e) =>
                          updateDraft(index, {
                            hashtags: e.target.value
                              .split(/\s+/)
                              .filter(Boolean),
                          })
                        }
                        disabled={!editable}
                        placeholder="#craft #india"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Scheduled for (ISO)
                      </label>
                      <Input
                        value={draft.suggestedAt}
                        onChange={(e) =>
                          updateDraft(index, { suggestedAt: e.target.value })
                        }
                        disabled={!editable}
                      />
                    </div>
                  </div>

                  {draft.rationale && (
                    <p className="text-xs text-muted-foreground italic">
                      Why this post: {draft.rationale}
                    </p>
                  )}

                  {editable && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void savePost(index)}
                        disabled={!dirty || savingIndex === index}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {savingIndex === index ? "Saving..." : "Save edits"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
