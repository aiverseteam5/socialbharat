"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  WhatsappTemplateForm,
  type WhatsappTemplate,
} from "@/components/whatsapp/WhatsappTemplateForm";

export default function WhatsappTemplatesPage() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WhatsappTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      const body = (await res.json()) as { templates: WhatsappTemplate[] };
      setTemplates(body.templates);
    } catch (err) {
      logger.error("Templates load failed", err);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = (t: WhatsappTemplate) => {
    setTemplates((curr) => {
      const idx = curr.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const next = [...curr];
        next[idx] = t;
        return next;
      }
      return [t, ...curr];
    });
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this template? Campaigns referencing it will block deletion.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/whatsapp/templates/${id}`, {
        method: "DELETE",
      });
      if (res.status === 409) {
        toast.error("In use by one or more campaigns");
        return;
      }
      if (!res.ok && res.status !== 204) {
        toast.error(`Delete failed (${res.status})`);
        return;
      }
      setTemplates((curr) => curr.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (err) {
      logger.error("Template delete failed", err);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage Meta-approved message templates used by broadcasts.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New template
        </Button>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : templates.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No templates yet. Create one approved in Meta Business Manager.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="flex cursor-pointer items-start justify-between gap-4 p-4 hover:bg-muted/30"
              onClick={() => {
                setEditing(t);
                setFormOpen(true);
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="outline">{t.language}</Badge>
                  <Badge variant="secondary">{t.category}</Badge>
                  <Badge
                    variant={t.status === "approved" ? "default" : "outline"}
                  >
                    {t.status}
                  </Badge>
                  {t.variable_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t.variable_count} var{t.variable_count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {t.body}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(t.id);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <WhatsappTemplateForm
        open={formOpen}
        template={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
