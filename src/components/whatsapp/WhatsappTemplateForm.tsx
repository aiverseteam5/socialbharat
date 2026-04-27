"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface WhatsappTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  body: string;
  variable_count: number;
  status: string;
}

interface Props {
  open: boolean;
  template: WhatsappTemplate | null;
  onClose: () => void;
  onSaved: (t: WhatsappTemplate) => void;
}

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const STATUSES = ["draft", "approved", "paused", "rejected"] as const;

export function WhatsappTemplateForm({
  open,
  template,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("UTILITY");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("approved");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setLanguage(template.language);
      setCategory(template.category as (typeof CATEGORIES)[number]);
      setBody(template.body);
      setStatus(template.status as (typeof STATUSES)[number]);
    } else {
      setName("");
      setLanguage("en");
      setCategory("UTILITY");
      setBody("");
      setStatus("approved");
    }
  }, [open, template]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = template
        ? `/api/whatsapp/templates/${template.id}`
        : "/api/whatsapp/templates";
      const method = template ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, language, category, body, status }),
      });
      const json = (await res.json()) as {
        template?: WhatsappTemplate;
        error?: string;
      };
      if (!res.ok || !json.template) {
        toast.error(json.error ?? `Save failed (${res.status})`);
        return;
      }
      toast.success(template ? "Template updated" : "Template created");
      onSaved(json.template);
      onClose();
    } catch (err) {
      logger.error("Template save failed", err);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Live preview of {{N}} placeholders detected in the body.
  const placeholders = Array.from(body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map(
    (m) => Number(m[1]),
  );
  const variableCount = placeholders.length ? Math.max(...placeholders) : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{template ? "Edit template" : "New template"}</SheetTitle>
          <SheetDescription>
            Templates must already be approved in Meta Business Manager. Enter
            them here exactly as Meta has them.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="order_confirmation"
              maxLength={512}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, underscores only. Must match the name
              approved in Meta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-lang">Language</Label>
              <Input
                id="tpl-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) =>
                  setCategory(v as (typeof CATEGORIES)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Body</Label>
            <Textarea
              id="tpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={1024}
              placeholder="Hi {{1}}, your order {{2}} is confirmed."
            />
            <p className="text-xs text-muted-foreground">
              {body.length}/1024 chars · {variableCount} variable
              {variableCount === 1 ? "" : "s"} detected
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only `approved` templates can be used in campaigns.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name || !body}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
