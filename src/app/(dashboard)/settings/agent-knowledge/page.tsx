"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Save } from "lucide-react";
import { logger } from "@/lib/logger";

const MAX_LEN = 8000;

export default function AgentKnowledgePage() {
  const [body, setBody] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/knowledge");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        body: string;
        updated_at: string | null;
      };
      setBody(data.body ?? "");
      setUpdatedAt(data.updated_at);
    } catch (err) {
      logger.error("agent-knowledge: load failed", err);
      setErrorMsg("Unable to load knowledge.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/agent/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { updated_at: string };
      setUpdatedAt(data.updated_at);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const charsRemaining = MAX_LEN - body.length;
  const overLimit = charsRemaining < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-brand-500" />
          Auto-reply Knowledge
        </h1>
        <p className="text-muted-foreground mt-1">
          Facts the WhatsApp auto-reply AI can rely on. Hours, pricing, return
          policy, addresses — anything you want it to be confident answering.
          The agent will <strong>refuse to answer</strong> anything not stated
          here and hand off to a human instead.
        </p>
      </header>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grounding text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={[
                "Examples:",
                "- Hours: Mon-Fri 10am-7pm IST. Closed on national holidays.",
                "- Returns: 7-day no-questions-asked. Customer pays return shipping.",
                "- Shipping: Pan-India free over ₹999. 3-5 day delivery.",
                "- Address: 12 MG Road, Bangalore 560001.",
              ].join("\n")}
              rows={20}
              className="font-mono text-sm"
            />
            <div
              className={`text-xs ${overLimit ? "text-red-600" : "text-muted-foreground"}`}
            >
              {charsRemaining} characters remaining
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {savedAt
                ? `Saved at ${savedAt}`
                : updatedAt
                  ? `Last saved ${new Date(updatedAt).toLocaleString()}`
                  : "Not saved yet"}
            </p>
            <Button onClick={() => void save()} disabled={saving || overLimit}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save knowledge"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How this is used</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            When a customer messages your WhatsApp, the AI reads this text plus
            the recent conversation, then either replies (if it&apos;s confident
            and the answer is grounded here) or escalates to your inbox queue
            with a draft.
          </p>
          <p>
            Auto-reply also requires your organisation to be opted in to AI
            automation. You can pause auto-reply per-conversation from the
            inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
