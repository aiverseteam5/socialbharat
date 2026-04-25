"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { logger } from "@/lib/logger";

interface BrandVoiceForm {
  tone: string;
  coreValues: string;
  avoid: string;
  exampleCaptions: string;
  primaryLanguage: string;
  targetAudience: string;
}

const EMPTY_FORM: BrandVoiceForm = {
  tone: "friendly",
  coreValues: "",
  avoid: "",
  exampleCaptions: "",
  primaryLanguage: "",
  targetAudience: "",
};

const DEFAULT_TEST_PROMPT =
  "Write a 40-word Instagram caption introducing our brand.";

export default function BrandVoicePage() {
  const [form, setForm] = useState<BrandVoiceForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Test playground
  const [testPrompt, setTestPrompt] = useState(DEFAULT_TEST_PROMPT);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/brand-voice");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        voice: (BrandVoiceForm & { primaryLanguage: string | null }) | null;
      };
      if (data.voice) {
        setForm({
          tone: data.voice.tone ?? "friendly",
          coreValues: data.voice.coreValues ?? "",
          avoid: data.voice.avoid ?? "",
          exampleCaptions: data.voice.exampleCaptions ?? "",
          primaryLanguage: data.voice.primaryLanguage ?? "",
          targetAudience: data.voice.targetAudience ?? "",
        });
      }
    } catch (err) {
      logger.error("brand-voice: load failed", err);
      setErrorMsg("Unable to load brand voice.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/brand-voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          primaryLanguage: form.primaryLanguage || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test-brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          primaryLanguage: form.primaryLanguage || null,
          prompt: testPrompt,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { content: string };
      setTestResult(data.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTestError(msg);
    } finally {
      setTesting(false);
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
          <Sparkles className="h-7 w-7 text-brand-500" />
          Brand Voice
        </h1>
        <p className="text-muted-foreground mt-1">
          Tell SocialBharat&apos;s AI how to sound like your brand. Every agent
          (research, content, inbox) uses this voice.
        </p>
      </header>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tone</label>
            <Input
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              placeholder="warm, witty, Hinglish-friendly"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Short descriptor — how should the brand feel?
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Target audience</label>
            <Input
              value={form.targetAudience}
              onChange={(e) =>
                setForm({ ...form, targetAudience: e.target.value })
              }
              placeholder="Tier-1 city millennials interested in sustainable fashion"
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Primary language</label>
            <Select
              value={form.primaryLanguage || "auto"}
              onValueChange={(v) =>
                setForm({ ...form, primaryLanguage: v === "auto" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (use org default)</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="hi-en">Hinglish</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Core values</label>
            <Textarea
              value={form.coreValues}
              onChange={(e) => setForm({ ...form, coreValues: e.target.value })}
              placeholder="Made in India, ethical sourcing, supporting artisans"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Avoid</label>
            <Textarea
              value={form.avoid}
              onChange={(e) => setForm({ ...form, avoid: e.target.value })}
              placeholder="No exclamation-heavy copy, no hard-sell language, no political references"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Example captions</label>
            <Textarea
              value={form.exampleCaptions}
              onChange={(e) =>
                setForm({ ...form, exampleCaptions: e.target.value })
              }
              placeholder={
                "Paste 2-3 captions you love that match your voice. AI will mirror this style."
              }
              rows={6}
              maxLength={4000}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {savedAt ? `Saved at ${savedAt}` : "Not saved yet"}
            </p>
            <Button onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save brand voice"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            Test playground
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send a prompt to Claude with this voice applied to preview the
            result. Limited to 10 calls/hour.
          </p>
          <Textarea
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={DEFAULT_TEST_PROMPT}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => void runTest()}
              disabled={testing || !testPrompt.trim()}
              variant="outline"
            >
              {testing ? "Generating..." : "Test with Claude"}
            </Button>
          </div>

          {testError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="rounded-md border bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Claude&apos;s response
              </p>
              <p className="text-sm whitespace-pre-wrap">{testResult}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
