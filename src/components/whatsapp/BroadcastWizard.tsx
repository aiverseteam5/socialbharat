"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  SegmentBuilder,
  type SegmentFilter,
} from "@/components/whatsapp/SegmentBuilder";
import type { WhatsappTemplate } from "@/components/whatsapp/WhatsappTemplateForm";

type Step = 1 | 2 | 3 | 4;

export function BroadcastWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [segment, setSegment] = useState<SegmentFilter>({});
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/whatsapp/templates");
        const body = (await res.json()) as { templates: WhatsappTemplate[] };
        setTemplates(body.templates.filter((t) => t.status === "approved"));
      } catch (err) {
        logger.error("Templates load failed", err);
        toast.error("Failed to load templates");
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templateId, templates],
  );

  // Substitute placeholders for the live preview.
  const preview = useMemo(() => {
    if (!template) return "";
    return template.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
      const v = variables[String(n)];
      return v && v.length > 0 ? v : `{{${n}}}`;
    });
  }, [template, variables]);

  const segmentValid = Boolean(
    segment.lead_status?.length ||
    segment.tags?.length ||
    segment.created_from ||
    segment.created_to,
  );

  const variablesValid =
    !template ||
    template.variable_count === 0 ||
    Array.from(
      { length: template.variable_count },
      (_, i) => variables[String(i + 1)],
    ).every((v) => typeof v === "string" && v.trim().length > 0);

  const canNext = (() => {
    if (step === 1)
      return (
        Boolean(template) && campaignName.trim().length > 0 && variablesValid
      );
    if (step === 2) return segmentValid;
    if (step === 3)
      return (
        scheduleMode === "now" ||
        (scheduleMode === "later" &&
          scheduledAt &&
          new Date(scheduledAt).getTime() > Date.now())
      );
    return true;
  })();

  const submit = async () => {
    if (!template) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        template_id: template.id,
        name: campaignName.trim(),
        segment_filter: segment,
      };
      if (template.variable_count > 0) payload.template_variables = variables;
      if (scheduleMode === "later" && scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      }
      const res = await fetch("/api/whatsapp/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        campaign?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.campaign) {
        toast.error(json.error ?? `Create failed (${res.status})`);
        return;
      }
      toast.success("Broadcast created");
      router.push(`/whatsapp/broadcasts/${json.campaign.id}`);
    } catch (err) {
      logger.error("Broadcast create failed", err);
      toast.error("Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <Badge variant={step === n ? "default" : "outline"}>{n}</Badge>
            <span
              className={step === n ? "font-medium" : "text-muted-foreground"}
            >
              {n === 1 && "Template"}
              {n === 2 && "Segment"}
              {n === 3 && "Schedule"}
              {n === 4 && "Confirm"}
            </span>
            {n < 4 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="bc-name">Campaign name</Label>
            <Input
              id="bc-name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Diwali sale Oct 26"
              maxLength={255}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Template</Label>
            {templatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved templates. Create one in Settings → WhatsApp →
                Templates first.
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {template && template.variable_count > 0 && (
            <div className="space-y-2">
              <Label>Template variables</Label>
              <div className="space-y-2">
                {Array.from({ length: template.variable_count }, (_, i) => {
                  const k = String(i + 1);
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-12 text-sm text-muted-foreground">
                        {`{{${k}}}`}
                      </span>
                      <Input
                        value={variables[k] ?? ""}
                        onChange={(e) =>
                          setVariables((v) => ({ ...v, [k]: e.target.value }))
                        }
                        placeholder={`Value for {{${k}}}`}
                        maxLength={1024}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {template && (
            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">
                {preview}
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Pick at least one filter. Opted-out contacts are always excluded.
          </p>
          <SegmentBuilder value={segment} onChange={setSegment} />
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-6">
          <div className="space-y-2">
            <Label>When to send</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scheduleMode === "now" ? "default" : "outline"}
                onClick={() => setScheduleMode("now")}
              >
                Send now
              </Button>
              <Button
                type="button"
                variant={scheduleMode === "later" ? "default" : "outline"}
                onClick={() => setScheduleMode("later")}
              >
                Schedule
              </Button>
            </div>
          </div>
          {scheduleMode === "later" && (
            <div className="space-y-1.5">
              <Label htmlFor="bc-when">Date & time</Label>
              <Input
                id="bc-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Local time. The send fires at this moment via the worker queue.
              </p>
            </div>
          )}
        </Card>
      )}

      {step === 4 && template && (
        <Card className="space-y-3 p-6">
          <div>
            <p className="text-xs text-muted-foreground">Campaign</p>
            <p className="font-medium">{campaignName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Template</p>
            <p className="font-medium">
              {template.name} ({template.language})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Preview</p>
            <div className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">
              {preview}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Segment</p>
            <p className="text-sm">
              {segment.lead_status?.length
                ? `Lead status: ${segment.lead_status.join(", ")}`
                : null}
              {segment.tags?.length ? (
                <>
                  {segment.lead_status?.length ? " · " : null}
                  Tags: {segment.tags.join(", ")}
                </>
              ) : null}
              {segment.created_from
                ? ` · From ${segment.created_from.slice(0, 10)}`
                : null}
              {segment.created_to
                ? ` · To ${segment.created_to.slice(0, 10)}`
                : null}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="text-sm">
              {scheduleMode === "now"
                ? "Immediate"
                : scheduledAt
                  ? new Date(scheduledAt).toLocaleString()
                  : ""}
            </p>
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || submitting}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => setStep((s) => (s < 4 ? ((s + 1) as Step) : s))}
            disabled={!canNext}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {scheduleMode === "now" ? "Send broadcast" : "Schedule broadcast"}
          </Button>
        )}
      </div>
    </div>
  );
}
