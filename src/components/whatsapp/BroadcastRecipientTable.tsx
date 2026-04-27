"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface BroadcastRecipient {
  id: string;
  contact_id: string;
  status: string;
  platform_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
}

interface Props {
  recipients: BroadcastRecipient[];
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  sent: "secondary",
  delivered: "default",
  read: "default",
  failed: "destructive",
  skipped: "outline",
};

export function BroadcastRecipientTable({ recipients }: Props) {
  if (recipients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recipients on this page.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent at</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recipients.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.contact_id}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
            </TableCell>
            <TableCell className="text-sm text-destructive">
              {r.error_code ? `${r.error_code}: ${r.error_message ?? ""}` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
