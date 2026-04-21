import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export type NotificationType =
  | "post_published"
  | "post_failed"
  | "post_approval_requested"
  | "post_approved"
  | "post_rejected"
  | "inbox_message"
  | "team_member_invited"
  | "team_member_joined"
  | "payment_received";

export interface SendNotificationParams {
  userId: string;
  orgId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function sendNotification(
  params: SendNotificationParams,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    org_id: params.orgId ?? null,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    metadata: params.metadata ?? {},
    is_read: false,
  });

  if (error) {
    logger.error("Failed to insert notification", error, {
      type: params.type,
      userId: params.userId,
    });
    return;
  }

  // Check user's email preference
  const { data: userRow } = await supabase
    .from("users")
    .select("email, notification_preferences")
    .eq("id", params.userId)
    .single();

  const prefs = userRow?.notification_preferences as { email?: boolean } | null;
  if (!prefs?.email || !userRow?.email) return;

  // Lazy import to avoid loading Resend in non-email contexts
  const { sendNotificationEmail } = await import("@/lib/email");
  await sendNotificationEmail({
    to: userRow.email,
    title: params.title,
    body: params.body ?? "",
    link: params.link,
  });
}

/**
 * Fire-and-forget helper for use in API routes where notification failures
 * must not affect the main response.
 */
export function sendNotificationVoid(params: SendNotificationParams): void {
  void sendNotification(params);
}
