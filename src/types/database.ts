// src/types/database.ts
// Auto-generated types matching Supabase schema — keep in sync with migrations

export type UserRole = "owner" | "admin" | "editor" | "viewer";

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "whatsapp"
  | "sharechat"
  | "moj"
  | "google_business";

export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partially_failed";

export type ConversationStatus = "open" | "assigned" | "closed" | "snoozed";
export type ConversationType = "message" | "comment" | "mention" | "review";
export type MessageSenderType = "contact" | "agent" | "system";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SentimentLabel = "positive" | "negative" | "neutral" | "mixed";
export type InvoiceStatus = "pending" | "paid" | "failed" | "refunded";
export type PlanType = "free" | "starter" | "pro" | "business" | "enterprise";
export type FestivalType =
  | "national"
  | "regional"
  | "religious"
  | "commercial"
  | "sporting";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  team_size: string | null;
  logo_url: string | null;
  plan: PlanType;
  plan_expires_at: string | null;
  gst_number: string | null;
  billing_state: string | null;
  billing_email: string | null;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  preferred_language: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: string;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string | null;
  phone: string | null;
  role: Exclude<UserRole, "owner">;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface SocialProfile {
  id: string;
  org_id: string;
  platform: SocialPlatform;
  platform_user_id: string | null;
  platform_username: string | null;
  profile_name: string | null;
  profile_image_url: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  org_id: string;
  created_by: string;
  content: string;
  content_json: PostContentJson | null;
  media_urls: string[];
  platforms: string[]; // UUIDs of social_profiles
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  campaign_id: string | null;
  tags: string[];
  language: string;
  festival_context: string | null;
  ai_generated: boolean;
  publish_results: Record<string, PublishResult>;
  created_at: string;
  updated_at: string;
}

export interface PostContentJson {
  text: string;
  media_urls?: string[];
  platform_overrides?: Record<
    SocialPlatform,
    { text?: string; media_urls?: string[] }
  >;
}

export interface PublishResult {
  status: "success" | "failed";
  platform_post_id?: string;
  error?: string;
}

export interface PostApproval {
  id: string;
  post_id: string;
  reviewer_id: string | null;
  status: ApprovalStatus;
  feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  platform: string;
  platform_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  org_id: string;
  social_profile_id: string;
  contact_id: string;
  platform: string;
  platform_conversation_id: string | null;
  type: ConversationType;
  status: ConversationStatus;
  assigned_to: string | null;
  sentiment_score: number | null;
  language_detected: string | null;
  tags: string[];
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  sender_id: string;
  content: string | null;
  media_urls: string[];
  platform_message_id: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProfileMetrics {
  id: string;
  social_profile_id: string;
  metric_date: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  impressions: number;
  reach: number;
  engagements: number;
  engagement_rate: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PostMetrics {
  id: string;
  post_id: string;
  social_profile_id: string;
  platform_post_id: string | null;
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
  saves: number;
  video_views: number;
  fetched_at: string;
  metadata: Record<string, unknown>;
}

export interface AnalyticsReport {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  profile_ids: string[];
  metrics: string[];
  start_date: string;
  end_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  org_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  cdn_url: string | null;
  thumbnail_url: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  folder: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlanLimits {
  plan: PlanType;
  max_social_profiles: number;
  max_users: number;
  max_posts_per_month: number;
  max_scheduled_posts: number;
  ai_content_generation: boolean;
  social_listening: boolean;
  custom_reports: boolean;
  approval_workflows: boolean;
  whatsapp_inbox: boolean;
  api_access: boolean;
  price_monthly_inr: number;
  price_yearly_inr: number;
}

export interface Invoice {
  id: string;
  org_id: string;
  invoice_number: string;
  razorpay_payment_id: string | null;
  stripe_payment_id: string | null;
  base_amount: number;
  currency: string;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  gst_number: string | null;
  billing_state: string | null;
  status: InvoiceStatus;
  pdf_url: string | null;
  created_at: string;
}

export interface ListeningQuery {
  id: string;
  org_id: string;
  name: string;
  keywords: string[];
  excluded_keywords: string[];
  platforms: string[];
  languages: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface ListeningMention {
  id: string;
  query_id: string;
  platform: string;
  platform_post_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  content: string | null;
  sentiment_score: number | null;
  sentiment_label: SentimentLabel | null;
  language_detected: string | null;
  engagement_count: number;
  url: string | null;
  posted_at: string | null;
  fetched_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  org_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IndianFestival {
  id: string;
  name: string;
  name_hi: string | null;
  name_regional: string | null;
  regional_language: string | null;
  festival_date: string;
  type: FestivalType;
  regions: string[];
  suggested_hashtags: string[];
  content_ideas: string[];
  best_posting_start: string | null;
  best_posting_end: string | null;
  template_image_urls: string[];
  year: number;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  processed_at: string;
}

// ============================================
// Supabase Database type (for typed client)
// ============================================

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & Pick<Organization, "name" | "slug">;
        Update: Partial<Organization>;
      };
      users: {
        Row: User;
        Insert: Partial<User> & Pick<User, "id">;
        Update: Partial<User>;
      };
      org_members: {
        Row: OrgMember;
        Insert: Partial<OrgMember> &
          Pick<OrgMember, "org_id" | "user_id" | "role">;
        Update: Partial<OrgMember>;
      };
      invitations: {
        Row: Invitation;
        Insert: Partial<Invitation> &
          Pick<
            Invitation,
            "org_id" | "role" | "token" | "invited_by" | "expires_at"
          >;
        Update: Partial<Invitation>;
      };
      social_profiles: {
        Row: SocialProfile;
        Insert: Partial<SocialProfile> &
          Pick<SocialProfile, "org_id" | "platform">;
        Update: Partial<SocialProfile>;
      };
      posts: {
        Row: Post;
        Insert: Partial<Post> &
          Pick<Post, "org_id" | "created_by" | "content" | "platforms">;
        Update: Partial<Post>;
      };
      post_approvals: {
        Row: PostApproval;
        Insert: Partial<PostApproval> & Pick<PostApproval, "post_id">;
        Update: Partial<PostApproval>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Partial<Campaign> &
          Pick<Campaign, "org_id" | "name" | "created_by">;
        Update: Partial<Campaign>;
      };
      contacts: {
        Row: Contact;
        Insert: Partial<Contact> &
          Pick<Contact, "org_id" | "platform" | "platform_user_id">;
        Update: Partial<Contact>;
      };
      conversations: {
        Row: Conversation;
        Insert: Partial<Conversation> &
          Pick<
            Conversation,
            "org_id" | "social_profile_id" | "contact_id" | "platform"
          >;
        Update: Partial<Conversation>;
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> &
          Pick<Message, "conversation_id" | "sender_type" | "sender_id">;
        Update: Partial<Message>;
      };
      profile_metrics: {
        Row: ProfileMetrics;
        Insert: Partial<ProfileMetrics> &
          Pick<ProfileMetrics, "social_profile_id" | "metric_date">;
        Update: Partial<ProfileMetrics>;
      };
      post_metrics: {
        Row: PostMetrics;
        Insert: Partial<PostMetrics> &
          Pick<PostMetrics, "post_id" | "social_profile_id">;
        Update: Partial<PostMetrics>;
      };
      analytics_reports: {
        Row: AnalyticsReport;
        Insert: Partial<AnalyticsReport> &
          Pick<AnalyticsReport, "org_id" | "name" | "start_date" | "end_date">;
        Update: Partial<AnalyticsReport>;
      };
      media_assets: {
        Row: MediaAsset;
        Insert: Partial<MediaAsset> &
          Pick<
            MediaAsset,
            | "org_id"
            | "uploaded_by"
            | "file_name"
            | "file_type"
            | "file_size"
            | "storage_path"
          >;
        Update: Partial<MediaAsset>;
      };
      plan_limits: {
        Row: PlanLimits;
        Insert: PlanLimits;
        Update: Partial<PlanLimits>;
      };
      invoices: {
        Row: Invoice;
        Insert: Partial<Invoice> &
          Pick<
            Invoice,
            "org_id" | "invoice_number" | "base_amount" | "total_amount"
          >;
        Update: Partial<Invoice>;
      };
      listening_queries: {
        Row: ListeningQuery;
        Insert: Partial<ListeningQuery> &
          Pick<ListeningQuery, "org_id" | "name" | "keywords" | "created_by">;
        Update: Partial<ListeningQuery>;
      };
      listening_mentions: {
        Row: ListeningMention;
        Insert: Partial<ListeningMention> &
          Pick<ListeningMention, "query_id" | "platform">;
        Update: Partial<ListeningMention>;
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification> &
          Pick<Notification, "user_id" | "type" | "title">;
        Update: Partial<Notification>;
      };
      indian_festivals: {
        Row: IndianFestival;
        Insert: Partial<IndianFestival> &
          Pick<IndianFestival, "name" | "festival_date" | "year">;
        Update: Partial<IndianFestival>;
      };
      webhook_events: {
        Row: WebhookEvent;
        Insert: Partial<WebhookEvent> &
          Pick<WebhookEvent, "provider" | "event_id" | "event_type">;
        Update: Partial<WebhookEvent>;
      };
    };
  };
}
