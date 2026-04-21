import { Resend } from "resend";
import { logger } from "@/lib/logger";

/**
 * Thin Resend wrapper. Instantiated lazily so missing env vars only fail
 * at send-time, letting the app boot in dev/test without the key set.
 */
let client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? "SocialBharat <no-reply@socialbharat.app>";

export interface InvitationEmailInput {
  to: string;
  orgName: string;
  inviterName: string;
  inviteLink: string;
  role: string;
}

export async function sendInvitationEmail(
  input: InvitationEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) {
    logger.warn("Resend API key not configured; skipping invitation email", {
      to: input.to,
    });
    return { sent: false, error: "email_not_configured" };
  }

  const { to, orgName, inviterName, inviteLink, role } = input;
  const subject = `${inviterName} invited you to ${orgName} on SocialBharat`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">You're invited to join ${escapeHtml(orgName)}</h2>
      <p>${escapeHtml(inviterName)} has invited you to collaborate on <strong>${escapeHtml(orgName)}</strong> as a <strong>${escapeHtml(role)}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
          Accept invitation
        </a>
      </p>
      <p style="color:#555;font-size:14px;">Or open this link in your browser:<br/><a href="${inviteLink}">${inviteLink}</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">This invitation expires in 7 days.</p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error("Resend send failed", error, { to });
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (err) {
    logger.error("Resend send threw", err, { to });
    return {
      sent: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

export interface NotificationEmailInput {
  to: string;
  title: string;
  body: string;
  link?: string | null;
}

export async function sendNotificationEmail(
  input: NotificationEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) return { sent: false, error: "email_not_configured" };

  const { to, title, body, link } = input;
  const linkHtml = link
    ? `<p style="margin:20px 0;"><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">View details</a></p>`
    : "";
  const html = `
    <div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h3 style="color:#111;">${escapeHtml(title)}</h3>
      <p style="color:#555;">${escapeHtml(body)}</p>
      ${linkHtml}
      <p style="color:#aaa;font-size:12px;margin-top:32px;">You received this because email notifications are enabled in your SocialBharat account.</p>
    </div>
  `;
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: title,
      html,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
