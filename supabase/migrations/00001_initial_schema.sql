-- ============================================
-- SocialBharat — Initial Schema Migration
-- Multi-tenant SaaS social media management
-- ============================================

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
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  connected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PUBLISHING
-- ============================================

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

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  content TEXT NOT NULL,
  content_json JSONB,
  media_urls TEXT[] DEFAULT '{}',
  platforms UUID[] NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'partially_failed'
  )),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  campaign_id UUID REFERENCES campaigns(id),
  tags TEXT[] DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'en',
  festival_context VARCHAR(100),
  ai_generated BOOLEAN DEFAULT false,
  publish_results JSONB DEFAULT '{}',
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
  metadata JSONB DEFAULT '{}',
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
  sender_id VARCHAR(255),
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
  base_amount INTEGER NOT NULL,
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
  type TEXT NOT NULL,
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
-- WEBHOOK EVENT LOG (for idempotency)
-- ============================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,  -- 'razorpay', 'stripe', 'meta', 'twitter'
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, event_id)
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
CREATE INDEX idx_webhook_events_lookup ON webhook_events(provider, event_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Helper function: get user's org IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get user's role in an org
CREATE OR REPLACE FUNCTION get_user_role(target_org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM org_members WHERE user_id = auth.uid() AND org_id = target_org_id
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_update ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));
CREATE POLICY org_update ON organizations FOR UPDATE
  USING (id IN (SELECT get_user_org_ids()) AND get_user_role(id) IN ('owner', 'admin'));
CREATE POLICY org_insert ON organizations FOR INSERT WITH CHECK (true);  -- anyone can create

-- Org Members
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_members_select ON org_members FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY org_members_insert ON org_members FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY org_members_update ON org_members FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));
CREATE POLICY org_members_delete ON org_members FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_select ON invitations FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY invitations_insert ON invitations FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Social Profiles
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_profiles_select ON social_profiles FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY social_profiles_insert ON social_profiles FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));
CREATE POLICY social_profiles_update ON social_profiles FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));
CREATE POLICY social_profiles_delete ON social_profiles FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_select ON posts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY posts_insert ON posts FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin', 'editor'));
CREATE POLICY posts_update ON posts FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin', 'editor'));
CREATE POLICY posts_delete ON posts FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_select ON conversations FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY conversations_insert ON conversations FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY conversations_update ON conversations FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM conversations WHERE org_id IN (SELECT get_user_org_ids())
  ));

-- Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_select ON contacts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY contacts_insert ON contacts FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY contacts_update ON contacts FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

-- Media Assets
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_select ON media_assets FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY media_insert ON media_assets FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY media_delete ON media_assets FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Profile Metrics
ALTER TABLE profile_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY metrics_select ON profile_metrics FOR SELECT
  USING (social_profile_id IN (
    SELECT id FROM social_profiles WHERE org_id IN (SELECT get_user_org_ids())
  ));

-- Post Metrics
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_metrics_select ON post_metrics FOR SELECT
  USING (post_id IN (
    SELECT id FROM posts WHERE org_id IN (SELECT get_user_org_ids())
  ));

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Listening Queries
ALTER TABLE listening_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY listening_queries_select ON listening_queries FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY listening_queries_insert ON listening_queries FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin'));

-- Listening Mentions
ALTER TABLE listening_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY listening_mentions_select ON listening_mentions FOR SELECT
  USING (query_id IN (
    SELECT id FROM listening_queries WHERE org_id IN (SELECT get_user_org_ids())
  ));

-- Post Approvals
ALTER TABLE post_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_approvals_select ON post_approvals FOR SELECT
  USING (post_id IN (
    SELECT id FROM posts WHERE org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY post_approvals_insert ON post_approvals FOR INSERT
  WITH CHECK (post_id IN (
    SELECT id FROM posts WHERE org_id IN (SELECT get_user_org_ids())
  ) AND get_user_role((SELECT org_id FROM posts WHERE id = post_id)) IN ('owner', 'admin'));

-- Campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_select ON campaigns FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY campaigns_insert ON campaigns FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND get_user_role(org_id) IN ('owner', 'admin', 'editor'));

-- Indian Festivals (public read)
ALTER TABLE indian_festivals ENABLE ROW LEVEL SECURITY;
CREATE POLICY festivals_select ON indian_festivals FOR SELECT USING (true);

-- Plan Limits (public read)
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_limits_select ON plan_limits FOR SELECT USING (true);

-- Webhook Events (service role only — no RLS for regular users)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
