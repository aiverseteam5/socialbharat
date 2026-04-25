"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import type { ConversationSummary } from "@/stores/inbox-store";

/**
 * WhatsApp-specific inbox controls. Surfaces a "send template" button that
 * lets operators initiate conversations outside the 24-hour service window.
 * The actual template catalogue comes from the Meta Business API once wired
 * up; for Phase 3 we render a stubbed list and mark real fetch as tech debt.
 */
interface Props {
  conversations: ConversationSummary[];
  onSendTemplate: (params: {
    conversationId: string;
    templateName: string;
    language: string;
  }) => Promise<void>;
}

const STUB_TEMPLATES = [
  { name: "welcome_message", language: "en" },
  { name: "order_update_hi", language: "hi" },
  { name: "festival_greeting", language: "en" },
];

export function WhatsAppInbox({ conversations, onSendTemplate }: Props) {
  const whatsappConvos = conversations.filter((c) => c.platform === "whatsapp");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(
    STUB_TEMPLATES[0]!.name,
  );

  if (whatsappConvos.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No WhatsApp conversations yet. Connect a WhatsApp Business account to
        start receiving messages.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {whatsappConvos.map((c) => (
        <Card key={c.id} className="flex items-center gap-3 p-3">
          <MessageSquare className="h-5 w-5 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {c.contact?.display_name ?? c.contact?.platform_user_id}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.last_message_at
                ? new Date(c.last_message_at).toLocaleString()
                : "No messages"}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {c.status}
          </Badge>
          <Dialog
            open={openFor === c.id}
            onOpenChange={(open) => setOpenFor(open ? c.id : null)}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Send template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send WhatsApp template</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUB_TEMPLATES.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} ({t.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Template messages are required for conversations outside the
                  24-hour service window. Live template catalogue integration is
                  pending (Phase 4).
                </p>
                <Button
                  onClick={async () => {
                    const t = STUB_TEMPLATES.find(
                      (x) => x.name === selectedTemplate,
                    );
                    if (!t) return;
                    await onSendTemplate({
                      conversationId: c.id,
                      templateName: t.name,
                      language: t.language,
                    });
                    setOpenFor(null);
                  }}
                >
                  Send
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      ))}
    </div>
  );
}
