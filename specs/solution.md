# Solution Design Document (SDD)
# SocialBharat — Technical Architecture

## 1. Data Model

### 1.1 Core Entities (Supabase/PostgreSQL)

```sql
-- ============================================
-- MULTI-TENANT CORE
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  industry VARCHAR(100),
  team_size VARCHAR(20),
  logo_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business', 'enterprise')),
  plan_expires_at TIMESTAMPTZ,
  gst_number VARCHAR(15),
  billing_state VARCHAR(50),
  billing_email VARCHAR(255),
  razorpay_customer_id VARCHAR(255),
  razorpay_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(15) UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{"in_app": true, "email": true, "whatsapp": false, "sms": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (org_id, user_id)
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(15),
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL PROFILES
-- ============================================

CREATE TABLE social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN (
    'facebook', 'instagram', 'twitter', 'linkedin', 'youtube',
    'whatsapp', 'sharechat', 'moj', 'google_business'
  )),
  platform_user_id VARCHAR(255),
  platform_username VARCHAR(255),
  profile_name VARCHAR(255),
  profile_image_url TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',  -- platform-specific data (followers, etc.)
  is_active BOOLEAN DEFAULT true,
  connected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PUBLISHING
-- ============================================

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  content TEXT NOT NULL,
  content_json JSONB,  -- rich content: {text, media_urls, platform_overrides}
  media_urls TEXT[] DEFAULT '{}',
  platforms UUID[] NOT NULL,  -- array of social_profile IDs
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'partially_failed'
  )),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  campaign_id UUID,
  tags TEXT[] DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  festival_context VARCHAR(100),
  ai_generated BOOLEAN DEFAULT false,
  publish_results JSONB DEFAULT '{}',  -- {profile_id: {status, platform_post_id, error}}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENGAGEMENT (UNIFIED INBOX)
-- ============================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_user_id VARCHAR(255),
  display_name VARCHAR(255),
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',  -- email, phone, notes, tags
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, platform, platform_user_id)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  social_profile_id UUID REFERENCES social_profiles(id),
  contact_id UUID REFERENCES contacts(id),
  platform TEXT NOT NULL,
  platform_conversation_id VARCHAR(255),
  type TEXT DEFAULT 'message' CHECK (type IN ('message', 'comment', 'mention', 'review')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'closed', 'snoozed')),
  assigned_to UUID REFERENCES users(id),
  sentiment_score FLOAT,
  language_detected VARCHAR(10),
  tags TEXT[] DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('contact', 'agent', 'system')),
  sender_id VARCHAR(255),  -- contact_id or user_id
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  platform_message_id VARCHAR(255),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS
-- ============================================

CREATE TABLE profile_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_profile_id UUID REFERENCES social_profiles(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_profile_id, metric_date)
);

CREATE TABLE post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  social_profile_id UUID REFERENCES social_profiles(id),
  platform_post_id VARCHAR(255),
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  video_views BIGINT DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================
-- MEDIA LIBRARY
-- ============================================

CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  cdn_url TEXT,
  thumbnail_url TEXT,
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds FLOAT,
  folder VARCHAR(255) DEFAULT 'root',
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BILLING
-- ============================================

CREATE TABLE plan_limits (
  plan TEXT PRIMARY KEY,
  max_social_profiles INTEGER NOT NULL,
  max_users INTEGER NOT NULL,
  max_posts_per_month INTEGER,
  max_scheduled_posts INTEGER,
  ai_content_generation BOOLEAN DEFAULT false,
  social_listening BOOLEAN DEFAULT false,
  custom_reports BOOLEAN DEFAULT false,
  approval_workflows BOOLEAN DEFAULT false,
  whatsapp_inbox BOOLEAN DEFAULT false,
  api_access BOOLEAN DEFAULT false,
  price_monthly_inr INTEGER NOT NULL,
  price_yearly_inr INTEGER NOT NULL
);

INSERT INTO plan_limits VALUES
  ('free',       3,  1,    30,   10,  false, false, false, false, false, false, 0,     0),
  ('starter',    5,  2,   150,   50,  false, false, false, false, true,  false, 499,   4790),
  ('pro',       15,  5,  1000,  500,  true,  true,  false, true,  true,  false, 1499,  14390),
  ('business',  30, 10, 10000, 5000,  true,  true,  true,  true,  true,  false, 4999,  47990),
  ('enterprise', -1, -1,   -1,   -1,  true,  true,  true,  true,  true,  true,  0,     0);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(255),
  stripe_payment_id VARCHAR(255),
  base_amount INTEGER NOT NULL,  -- in paise (INR) or cents (USD)
  currency VARCHAR(3) DEFAULT 'INR',
  cgst INTEGER DEFAULT 0,
  sgst INTEGER DEFAULT 0,
  igst INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL,
  gst_number VARCHAR(15),
  billing_state VARCHAR(50),
  status TEXT DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOCIAL LISTENING
-- ============================================

CREATE TABLE listening_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  keywords TEXT[] NOT NULL,
  excluded_keywords TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{"twitter", "instagram", "facebook"}',
  languages TEXT[] DEFAULT '{"en", "hi"}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listening_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES listening_queries(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id VARCHAR(255),
  author_name VARCHAR(255),
  author_handle VARCHAR(255),
  content TEXT,
  sentiment_score FLOAT,
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'negative', 'neutral', 'mixed')),
  language_detected VARCHAR(10),
  engagement_count INTEGER DEFAULT 0,
  url TEXT,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,  -- 'new_message', 'approval_needed', 'post_published', 'payment_received', etc.
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDIAN FESTIVALS
-- ============================================

CREATE TABLE indian_festivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name_hi VARCHAR(255),
  name_regional VARCHAR(255),
  regional_language VARCHAR(10),
  festival_date DATE NOT NULL,
  type TEXT CHECK (type IN ('national', 'regional', 'religious', 'commercial', 'sporting')),
  regions TEXT[] DEFAULT '{"ALL"}',
  suggested_hashtags TEXT[] DEFAULT '{}',
  content_ideas TEXT[] DEFAULT '{}',
  best_posting_start TIME,
  best_posting_end TIME,
  template_image_urls TEXT[] DEFAULT '{}',
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_social_profiles_org ON social_profiles(org_id);
CREATE INDEX idx_posts_org ON posts(org_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_conversations_org ON conversations(org_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_profile_metrics_date ON profile_metrics(social_profile_id, metric_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_listening_mentions_query ON listening_mentions(query_id, posted_at);
CREATE INDEX idx_invoices_org ON invoices(org_id);
```

### 1.2 Row Level Security (RLS) Policies

Every table must have RLS enabled. Key policies:

```sql
-- Organizations: users can only see orgs they belong to
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_member_select ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Posts: users can only see posts in their org
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_org_select ON posts FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY post_org_insert ON posts FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')));

-- Conversations: org-scoped
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_org_select ON conversations FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Apply similar patterns for ALL tables
```

## 2. API Design

### 2.1 Authentication Routes
```
POST   /api/auth/otp/send          — Send OTP to phone number
POST   /api/auth/otp/verify        — Verify OTP and login/register
POST   /api/auth/register          — Email/password registration
POST   /api/auth/login             — Email/password login
POST   /api/auth/callback          — OAuth callback handler
GET    /api/auth/me                — Get current user profile
POST   /api/auth/logout            — Logout
```

### 2.2 Organization Routes
```
POST   /api/orgs                   — Create organization
GET    /api/orgs/:id               — Get organization details
PUT    /api/orgs/:id               — Update organization
POST   /api/orgs/:id/invite        — Invite team member
GET    /api/orgs/:id/members       — List team members
PUT    /api/orgs/:id/members/:uid  — Update member role
DELETE /api/orgs/:id/members/:uid  — Remove team member
```

### 2.3 Social Profile Routes
```
POST   /api/connectors/:platform/auth     — Initiate OAuth for platform
GET    /api/connectors/:platform/callback  — OAuth callback
GET    /api/connectors/profiles            — List connected profiles
DELETE /api/connectors/profiles/:id        — Disconnect profile
GET    /api/connectors/profiles/:id/status — Check connection health
```

### 2.4 Publishing Routes
```
POST   /api/posts                  — Create post (draft or publish)
GET    /api/posts                  — List posts (with filters)
GET    /api/posts/:id              — Get post details
PUT    /api/posts/:id              — Update post
DELETE /api/posts/:id              — Delete post
POST   /api/posts/:id/schedule     — Schedule post
POST   /api/posts/:id/publish      — Publish immediately
POST   /api/posts/:id/approve      — Approve post
POST   /api/posts/:id/reject       — Reject post with feedback
GET    /api/posts/calendar         — Get calendar view (date range)
POST   /api/posts/bulk             — Bulk create/schedule
```

### 2.5 Engagement Routes
```
GET    /api/inbox/conversations            — List conversations (paginated)
GET    /api/inbox/conversations/:id        — Get conversation with messages
POST   /api/inbox/conversations/:id/reply  — Reply to conversation
PUT    /api/inbox/conversations/:id/assign — Assign to team member
PUT    /api/inbox/conversations/:id/status — Update status (close/snooze)
POST   /api/inbox/conversations/:id/tags   — Add tags
GET    /api/inbox/contacts/:id             — Get contact profile
```

### 2.6 Analytics Routes
```
GET    /api/analytics/overview                     — Dashboard overview
GET    /api/analytics/profiles/:id/metrics         — Profile metrics (date range)
GET    /api/analytics/posts                        — Post analytics (date range)
GET    /api/analytics/audience/:profileId          — Audience demographics
POST   /api/analytics/reports                      — Generate report
GET    /api/analytics/reports/:id                  — Get report
GET    /api/analytics/reports/:id/export           — Export report (PDF/CSV/XLSX)
```

### 2.7 AI Routes
```
POST   /api/ai/generate-content    — Generate social media content
POST   /api/ai/translate           — Translate content (Indian languages)
POST   /api/ai/hashtags            — Generate hashtags
POST   /api/ai/smart-schedule      — Suggest optimal posting times
POST   /api/ai/suggest-replies     — Generate smart replies for inbox
POST   /api/ai/sentiment           — Analyze sentiment of text
```

### 2.8 Billing Routes
```
GET    /api/billing/plans                 — List available plans
POST   /api/billing/checkout              — Create Razorpay/Stripe checkout session
POST   /api/billing/webhook/razorpay      — Razorpay webhook handler
POST   /api/billing/webhook/stripe        — Stripe webhook handler
GET    /api/billing/subscription          — Get current subscription details
PUT    /api/billing/subscription          — Update subscription (upgrade/downgrade)
DELETE /api/billing/subscription          — Cancel subscription
GET    /api/billing/invoices              — List invoices
GET    /api/billing/invoices/:id/pdf      — Download invoice PDF
```

### 2.9 Media Routes
```
POST   /api/media/upload           — Upload media file
GET    /api/media                  — List media assets (paginated)
GET    /api/media/:id              — Get media details
PUT    /api/media/:id              — Update media metadata
DELETE /api/media/:id              — Delete media
POST   /api/media/:id/transform   — Transform media (resize, crop)
GET    /api/media/folders          — List folders
```

### 2.10 Notification Routes
```
GET    /api/notifications          — List notifications (paginated)
PUT    /api/notifications/:id/read — Mark as read
PUT    /api/notifications/read-all — Mark all as read
PUT    /api/notifications/preferences — Update notification preferences
```

### 2.11 Listening Routes
```
POST   /api/listening/queries              — Create listening query
GET    /api/listening/queries              — List queries
GET    /api/listening/queries/:id/results  — Get mentions/results
GET    /api/listening/sentiment            — Get sentiment analysis
GET    /api/listening/trends               — Get trending topics
POST   /api/listening/alerts               — Configure alerts
```

### 2.12 Webhook Endpoints (Incoming)
```
POST   /api/webhooks/meta          — Facebook/Instagram/WhatsApp webhooks
POST   /api/webhooks/twitter       — Twitter webhook
POST   /api/webhooks/linkedin      — LinkedIn webhook
POST   /api/webhooks/youtube       — YouTube push notifications
```

## 3. Auth Flows

### 3.1 Phone OTP Flow (Primary — India)
1. User enters phone number → POST /api/auth/otp/send
2. Server generates 6-digit OTP, stores in Redis-like cache (Supabase Edge Function or Upstash) with 5-min TTL
3. OTP sent via MSG91 SMS gateway
4. User enters OTP → POST /api/auth/otp/verify
5. Server verifies OTP, creates/finds user in Supabase Auth
6. Returns JWT access token + refresh token
7. If new user → redirect to onboarding wizard

### 3.2 Email/Password Flow
1. Standard Supabase Auth email/password flow
2. Email verification required before dashboard access

### 3.3 OAuth Flow (Google)
1. User clicks "Continue with Google"
2. Redirect to Supabase Auth OAuth endpoint
3. Callback to /api/auth/callback
4. Supabase creates user + session
5. Redirect to dashboard

### 3.4 Social Platform OAuth (Connecting accounts)
1. User clicks "Connect [Platform]"
2. Redirect to platform OAuth with required scopes
3. Callback to /api/connectors/:platform/callback
4. Store encrypted access/refresh tokens in social_profiles table
5. Fetch and store profile metadata

## 4. Third-Party Integrations

| Service      | Purpose                        | Integration Type    |
|-------------|-------------------------------|---------------------|
| Supabase    | DB, Auth, Storage, Realtime   | SDK (primary)       |
| Razorpay    | Indian payments (UPI, cards)  | SDK + Webhooks      |
| Stripe      | International payments        | SDK + Webhooks      |
| MSG91       | SMS OTP delivery (India)      | REST API            |
| Resend      | Transactional emails          | REST API            |
| Meta API    | FB, IG, WhatsApp              | REST API + Webhooks |
| Twitter API | Twitter/X                     | REST API + Webhooks |
| LinkedIn API| LinkedIn                      | REST API            |
| YouTube API | YouTube                       | REST API + PubSub   |
| OpenAI      | AI content generation         | REST API            |
| PostHog     | Product analytics             | SDK (client)        |
| Sentry      | Error tracking                | SDK (client+server) |
| Upstash     | Rate limiting, OTP cache      | SDK                 |

## 5. Security Architecture

- All tokens encrypted at rest (AES-256) before storing in DB
- RLS on every table — no exceptions
- API routes validate auth server-side before any data access
- Razorpay webhook signature verification on every webhook
- Rate limiting on auth endpoints (5 OTP requests per phone per hour)
- DPDP Act: Data deletion API, consent management, privacy dashboard
- All data in ap-south-1 (Mumbai) for Indian data residency
- HTTPS only, HSTS headers, CSP headers
