/**
 * Zod-validated environment schema. Import `env` instead of reading
 * `process.env` directly in any server-side business logic.
 *
 * This module is SERVER-ONLY. Never import it in client components.
 * NEXT_PUBLIC_* vars are inlined at build time and don't need validation here.
 */
import { z } from "zod";

const schema = z.object({
  // ── Core ──────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),

  // ── Queue / Job System ────────────────────────────────────────────────────
  // Required for rate-limiting (already used in ratelimit.ts)
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
  // Self-hosted Redis for BullMQ (VPS). Required when workers run;
  // optional in local dev where queue features may be disabled.
  REDIS_URL: z
    .string()
    .url("REDIS_URL must be a valid redis:// URL")
    .optional(),

  // ── Payments ──────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, "RAZORPAY_WEBHOOK_SECRET is required"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── AI ────────────────────────────────────────────────────────────────────
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  // V3 Phase 4A — agent orchestrator safety rails.
  // AGENT_MAX_STEPS caps the orchestrator loop; AGENT_HUMAN_APPROVAL gates
  // queued publishing behind plan approval.
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(20),
  AGENT_HUMAN_APPROVAL: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // ── Email ─────────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().optional(),

  // ── SMS ───────────────────────────────────────────────────────────────────
  MSG91_AUTH_KEY: z.string().min(1, "MSG91_AUTH_KEY is required"),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // ── Social Connectors (optional — connector activates only when present) ──
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),

  // ── Observability ─────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),

  // ── App config ────────────────────────────────────────────────────────────
  CRON_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  COMPANY_GST_STATE: z.string().optional(),
  COMPANY_GSTIN: z.string().optional(),
});

function formatEnvError(error: z.ZodError): string {
  const groups: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "unknown");
    // Derive group from key prefix
    let group = "other";
    if (
      key.includes("SUPABASE") ||
      key === "ENCRYPTION_KEY" ||
      key.includes("APP_URL")
    )
      group = "core";
    else if (key.includes("UPSTASH") || key === "REDIS_URL") group = "queue";
    else if (key.includes("RAZORPAY") || key.includes("STRIPE"))
      group = "payments";
    else if (
      key.includes("OPENAI") ||
      key.includes("ANTHROPIC") ||
      key.startsWith("AGENT_")
    )
      group = "ai";
    else if (key.includes("RESEND")) group = "email";
    else if (key.includes("MSG91")) group = "sms";
    else if (
      key.includes("META") ||
      key.includes("TWITTER") ||
      key.includes("LINKEDIN") ||
      key.includes("YOUTUBE") ||
      key.includes("WHATSAPP")
    )
      group = "connectors";
    else if (key.includes("SENTRY")) group = "observability";

    (groups[group] ??= []).push(key);
  }

  const lines = Object.entries(groups).map(
    ([g, keys]) => `  [${g}]: ${keys.join(", ")}`,
  );
  return `Missing or invalid environment variables:\n${lines.join("\n")}`;
}

// Skip validation during:
//   - CI builds (SKIP_ENV_VALIDATION=true) where real secrets aren't available
//   - Next.js production build phase — route modules are imported to collect
//     page data, but secrets aren't always hydrated at build time on Vercel
//     (e.g. vars scoped only to runtime). Runtime validation still fires on
//     first import at cold start, preserving fail-fast behavior in production.
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "true" ||
  process.env.NEXT_PHASE === "phase-production-build";

if (!skipValidation) {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
}

const result = schema.safeParse(process.env);
export const env = (result.success ? result.data : {}) as z.infer<
  typeof schema
>;
