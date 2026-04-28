// src/types/schemas.ts
// Zod validation schemas for all API inputs
// Every API route MUST validate with these before touching data

import { z } from "zod";

// ============================================
// AUTH SCHEMAS
// ============================================

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+91[6-9]\d{9}$/,
      "Invalid Indian phone number. Must be +91 followed by 10 digits starting with 6-9",
    ),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must be numeric"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number"),
  full_name: z.string().min(2, "Name must be at least 2 characters").max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// ============================================
// ORGANIZATION SCHEMAS
// ============================================

export const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(255),
  industry: z.string().max(100).optional(),
  team_size: z
    .enum(["1", "2-5", "6-10", "11-25", "26-50", "51-100", "100+"])
    .optional(),
  preferred_language: z.string().length(2).default("en"),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  industry: z.string().max(100).optional(),
  logo_url: z.string().url().optional(),
  gst_number: z
    .string()
    .regex(
      /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/,
      "Invalid GSTIN format",
    )
    .optional()
    .nullable(),
  billing_state: z.string().max(50).optional(),
  billing_email: z.string().email().optional(),
  preferred_language: z.string().length(2).optional(),
  timezone: z.string().max(50).optional(),
});

export const inviteMemberSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+91[6-9]\d{9}$/)
      .optional(),
    role: z.enum(["admin", "editor", "viewer"]),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
  });

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

// ============================================
// SOCIAL PROFILE SCHEMAS
// ============================================

export const connectWhatsAppSchema = z.object({
  phone_number_id: z.string().min(1, "Phone Number ID is required"),
  access_token: z.string().min(1, "Access token is required"),
  business_account_id: z.string().min(1, "Business Account ID is required"),
});

// ============================================
// POST SCHEMAS
// ============================================

export const createPostSchema = z.object({
  content: z.string().min(1, "Post content is required").max(63206),
  content_json: z
    .object({
      text: z.string(),
      media_urls: z.array(z.string().url()).optional(),
      platform_overrides: z
        .record(
          z.object({
            text: z.string().optional(),
            media_urls: z.array(z.string().url()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  media_urls: z.array(z.string().url()).default([]),
  platforms: z.array(z.string().uuid()).min(1, "Select at least one platform"),
  status: z.enum(["draft", "pending_approval"]).default("draft"),
  scheduled_at: z.string().datetime().optional(),
  campaign_id: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  language: z.string().length(2).default("en"),
  festival_context: z.string().max(100).optional(),
});

export const updatePostSchema = createPostSchema.partial();

export const schedulePostSchema = z.object({
  scheduled_at: z.string().datetime({ message: "Valid ISO datetime required" }),
});

export const bulkCreatePostsSchema = z.object({
  posts: z.array(createPostSchema).min(1).max(100),
});

export const postApprovalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  feedback: z.string().max(1000).optional(),
});

// ============================================
// INBOX / ENGAGEMENT SCHEMAS
// ============================================

export const replyMessageSchema = z.object({
  content: z.string().min(1, "Reply content is required").max(4096),
  media_urls: z.array(z.string().url()).default([]),
});

export const assignConversationSchema = z.object({
  assigned_to: z.string().uuid(),
});

export const updateConversationStatusSchema = z.object({
  status: z.enum(["open", "closed", "snoozed"]),
});

export const addConversationTagsSchema = z.object({
  tags: z.array(z.string().max(50)).min(1),
});

export const listConversationsSchema = z.object({
  platform: z
    .enum(["facebook", "instagram", "twitter", "linkedin", "whatsapp"])
    .optional(),
  status: z.enum(["open", "assigned", "closed", "snoozed"]).optional(),
  assigned_to: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateConversationSchema = z.object({
  status: z.enum(["open", "assigned", "closed", "snoozed"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  sentiment_score: z.number().min(-1).max(1).optional(),
  language_detected: z.string().length(2).optional(),
});

// ============================================
// ANALYTICS SCHEMAS
// ============================================

export const dateRangeSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD"),
});

export const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  profiles: z.array(z.string().uuid()).min(1),
  metrics: z.array(z.string()).min(1),
  date_range: dateRangeSchema,
  format: z.enum(["pdf", "csv", "xlsx"]).default("pdf"),
  schedule: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      recipients: z.array(z.string().email()),
    })
    .optional(),
});

export const ANALYTICS_METRIC_KEYS = [
  "followers_count",
  "impressions",
  "reach",
  "engagements",
  "engagement_rate",
  "clicks",
  "shares",
  "comments",
  "likes",
] as const;

export type AnalyticsMetricKey = (typeof ANALYTICS_METRIC_KEYS)[number];

export const saveReportSchema = z.object({
  name: z.string().min(1).max(255),
  profile_ids: z.array(z.string().uuid()).min(1),
  metrics: z.array(z.enum(ANALYTICS_METRIC_KEYS)).min(1),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD"),
});

export const analyticsQuerySchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  profile_id: z.string().uuid().optional(),
});

export const analyticsPostsQuerySchema = analyticsQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// AI SCHEMAS
// ============================================

export const generateContentSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters").max(2000),
  platform: z.enum([
    "instagram",
    "facebook",
    "twitter",
    "linkedin",
    "whatsapp",
    "sharechat",
    "youtube",
  ]),
  tone: z
    .enum([
      "professional",
      "casual",
      "humorous",
      "festive",
      "hinglish",
      "formal_hindi",
      "regional_casual",
    ])
    .default("professional"),
  language: z
    .enum(["en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"])
    .default("en"),
  include_hashtags: z.boolean().default(true),
  include_emoji: z.boolean().default(true),
  max_length: z.number().int().min(50).max(10000).optional(),
  festival_context: z.string().max(100).optional(),
});

export const translateContentSchema = z.object({
  text: z.string().min(1).max(10000),
  source_language: z.enum([
    "en",
    "hi",
    "ta",
    "te",
    "bn",
    "mr",
    "gu",
    "kn",
    "ml",
    "pa",
  ]),
  target_language: z.enum([
    "en",
    "hi",
    "ta",
    "te",
    "bn",
    "mr",
    "gu",
    "kn",
    "ml",
    "pa",
  ]),
});

export const generateHashtagsSchema = z.object({
  content: z.string().min(5).max(5000),
  platform: z.enum(["instagram", "facebook", "twitter", "linkedin"]),
  language: z.enum(["en", "hi", "ta", "te", "bn", "mr"]).default("en"),
  count: z.number().int().min(3).max(30).default(10),
});

export const suggestRepliesSchema = z.object({
  conversation_id: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["contact", "agent", "system"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(20),
  language: z.enum(["en", "hi", "ta", "te", "bn", "mr"]).default("en"),
  tone: z
    .enum(["professional", "casual", "friendly", "hinglish"])
    .default("professional"),
  context: z.string().max(500).optional(),
});

export const sentimentAnalysisSchema = z.object({
  text: z.string().min(1).max(5000),
  language: z.enum(["en", "hi", "ta", "te", "bn", "mr"]).optional(),
});

// ============================================
// BILLING SCHEMAS
// ============================================

export const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "business", "enterprise"]),
  billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  billing_state: z
    .string()
    .min(1, "Billing state is required for GST calculation"),
  gst_number: z
    .string()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/)
    .optional(),
});

export const updateSubscriptionSchema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
  billing_cycle: z.enum(["monthly", "yearly"]).optional(),
});

// ============================================
// MEDIA SCHEMAS
// ============================================

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const MEDIA_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
] as const;

export const uploadMediaSchema = z.object({
  file: z
    .instanceof(File, { message: "File is required" })
    .refine((f) => f.size > 0, { message: "File is empty" })
    .refine((f) => f.size <= MEDIA_MAX_BYTES, {
      message: `File size exceeds ${MEDIA_MAX_BYTES / 1024 / 1024}MB limit`,
    })
    .refine((f) => (MEDIA_ALLOWED_MIME as readonly string[]).includes(f.type), {
      message: `Unsupported file type. Allowed: ${MEDIA_ALLOWED_MIME.join(", ")}`,
    }),
});

export const updateMediaSchema = z.object({
  alt_text: z.string().max(500).optional(),
  folder: z.string().max(255).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export const transformMediaSchema = z.object({
  width: z.number().int().min(1).max(4096).optional(),
  height: z.number().int().min(1).max(4096).optional(),
  format: z.enum(["jpeg", "png", "webp"]).optional(),
  quality: z.number().int().min(1).max(100).default(85),
});

// ============================================
// LISTENING SCHEMAS
// ============================================

export const createListeningQuerySchema = z.object({
  name: z.string().min(1).max(255),
  keywords: z
    .array(z.string().max(100))
    .min(1, "At least one keyword required"),
  excluded_keywords: z.array(z.string().max(100)).default([]),
  platforms: z
    .array(z.enum(["twitter", "instagram", "facebook", "youtube"]))
    .default(["twitter", "instagram"]),
  languages: z
    .array(z.enum(["en", "hi", "ta", "te", "bn", "mr"]))
    .default(["en", "hi"]),
});

export const createAlertSchema = z.object({
  query_id: z.string().uuid(),
  type: z.enum(["sentiment_spike", "mention_volume", "keyword_trigger"]),
  threshold: z.number(),
  channels: z.array(z.enum(["in_app", "email", "whatsapp", "sms"])).min(1),
});

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

export const updateNotificationPreferencesSchema = z.object({
  in_app: z.boolean().optional(),
  email: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  sms: z.boolean().optional(),
});

// ============================================
// LEAD SCHEMAS
// ============================================

export const leadStatusEnum = z.enum([
  "New",
  "Interested",
  "Hot",
  "Paid",
  "Lost",
]);

export const createLeadSchema = z.object({
  contact_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  status: leadStatusEnum.optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  status: leadStatusEnum.optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// ============================================
// WHATSAPP BROADCAST SCHEMAS
// ============================================

export const waTemplateStatusEnum = z.enum([
  "draft",
  "approved",
  "paused",
  "rejected",
]);

export const waTemplateCategoryEnum = z.enum([
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
]);

// Returns the highest {{N}} index in the body — also the canonical
// variable_count. {{0}} is invalid; we floor at 0 (meaning "no variables").
export function countTemplateVariables(body: string): number {
  let max = 0;
  for (const match of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const captured = match[1];
    if (!captured) continue;
    const n = Number(captured);
    if (n > max) max = n;
  }
  return max;
}

export const createWhatsappTemplateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(
      /^[a-z0-9_]+$/,
      "Template name must use lowercase letters, numbers, and underscores",
    ),
  language: z
    .string()
    .regex(
      /^[a-z]{2}(_[A-Z]{2})?$/,
      "Language must be a code like 'en', 'hi', or 'en_US'",
    ),
  category: waTemplateCategoryEnum,
  body: z.string().min(1).max(1024),
  status: waTemplateStatusEnum.default("approved"),
});

export const updateWhatsappTemplateSchema = z.object({
  name: createWhatsappTemplateSchema.shape.name.optional(),
  language: createWhatsappTemplateSchema.shape.language.optional(),
  category: waTemplateCategoryEnum.optional(),
  body: z.string().min(1).max(1024).optional(),
  status: waTemplateStatusEnum.optional(),
});

// Segment filter for a broadcast. Must have at least one populated key — an
// empty filter would target every contact in the org, which is unsafe v1.
export const segmentFilterSchema = z
  .object({
    lead_status: z.array(leadStatusEnum).min(1).optional(),
    tags: z.array(z.string().max(50)).min(1).optional(),
    created_from: z.string().datetime().optional(),
    created_to: z.string().datetime().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.lead_status?.length ||
        data.tags?.length ||
        data.created_from ||
        data.created_to,
      ),
    { message: "At least one segment filter is required" },
  );

export const createWhatsappCampaignSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  segment_filter: segmentFilterSchema,
  // Same variable values for every recipient in v1. Keys are "1", "2", ...
  // matching the template's {{N}} placeholders.
  template_variables: z.record(z.string().min(1).max(1024)).optional(),
  scheduled_at: z.string().datetime().optional(),
});

export const waCampaignStatusEnum = z.enum([
  "draft",
  "scheduled",
  "running",
  "completed",
  "cancelled",
  "failed",
]);

export const listWhatsappCampaignsSchema = z.object({
  status: waCampaignStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// COMMON SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

// Per-org grounding text for the WhatsApp inbound auto-reply agent.
// Free-text, hard-capped to keep the system prompt under Anthropic's
// limits; v1 uses a single body — multi-document retrieval is deferred.
export const updateOrgKnowledgeSchema = z.object({
  body: z.string().max(8000),
});

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number(),
      changes: z.array(z.unknown()).optional(),
      messaging: z.array(z.unknown()).optional(),
    }),
  ),
});

// Export all schemas as a namespace for easy importing
export const schemas = {
  auth: {
    sendOtp: sendOtpSchema,
    verifyOtp: verifyOtpSchema,
    register: registerSchema,
    login: loginSchema,
  },
  org: {
    create: createOrgSchema,
    update: updateOrgSchema,
    invite: inviteMemberSchema,
    updateRole: updateMemberRoleSchema,
  },
  post: {
    create: createPostSchema,
    update: updatePostSchema,
    schedule: schedulePostSchema,
    bulk: bulkCreatePostsSchema,
    approval: postApprovalSchema,
  },
  inbox: {
    reply: replyMessageSchema,
    assign: assignConversationSchema,
    status: updateConversationStatusSchema,
    tags: addConversationTagsSchema,
    list: listConversationsSchema,
    update: updateConversationSchema,
  },
  analytics: { dateRange: dateRangeSchema, report: createReportSchema },
  ai: {
    generate: generateContentSchema,
    translate: translateContentSchema,
    hashtags: generateHashtagsSchema,
    replies: suggestRepliesSchema,
    sentiment: sentimentAnalysisSchema,
  },
  billing: {
    checkout: checkoutSchema,
    updateSubscription: updateSubscriptionSchema,
  },
  media: {
    upload: uploadMediaSchema,
    update: updateMediaSchema,
    transform: transformMediaSchema,
  },
  listening: {
    createQuery: createListeningQuerySchema,
    createAlert: createAlertSchema,
  },
  leads: { create: createLeadSchema, update: updateLeadSchema },
  whatsapp: {
    createTemplate: createWhatsappTemplateSchema,
    updateTemplate: updateWhatsappTemplateSchema,
    createCampaign: createWhatsappCampaignSchema,
    listCampaigns: listWhatsappCampaignsSchema,
    segment: segmentFilterSchema,
  },
  agent: { updateKnowledge: updateOrgKnowledgeSchema },
  common: { pagination: paginationSchema, id: idParamSchema },
} as const;
