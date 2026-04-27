-- Feature 4: WhatsApp Broadcast Campaigns
--
-- Adds:
--  - opt-out flag on contacts (DPDP + WhatsApp policy)
--  - whatsapp_templates  : Meta-approved template registry (manual entry v1)
--  - whatsapp_campaigns  : campaign config + lifecycle
--  - whatsapp_broadcast_recipients : per-recipient send tracking
--
-- Outbound goes via WhatsAppConnector.sendTemplate() one-per-recipient through
-- a BullMQ broadcast worker. Per-recipient delivery state flows back via the
-- existing Meta status webhook keyed on platform_message_id.

-- ── Opt-out / consent on contacts ───────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_opted_out
  ON contacts (org_id) WHERE opted_out_at IS NOT NULL;

-- ── Templates ───────────────────────────────────────────────────────────────
CREATE TYPE wa_template_status AS ENUM ('draft', 'approved', 'paused', 'rejected');

CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  variable_count INT NOT NULL DEFAULT 0,
  status wa_template_status NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name, language)
);
CREATE INDEX idx_wa_templates_org ON whatsapp_templates (org_id);

-- ── Campaigns ───────────────────────────────────────────────────────────────
CREATE TYPE wa_campaign_status AS ENUM (
  'draft', 'scheduled', 'running', 'completed', 'cancelled', 'failed'
);

CREATE TABLE whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES whatsapp_templates(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  segment_filter JSONB NOT NULL,
  template_variables JSONB,
  scheduled_at TIMESTAMPTZ,
  status wa_campaign_status NOT NULL DEFAULT 'draft',
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wa_campaigns_org_status
  ON whatsapp_campaigns (org_id, status, created_at DESC);

-- ── Recipients ──────────────────────────────────────────────────────────────
CREATE TYPE wa_recipient_status AS ENUM (
  'pending', 'sent', 'delivered', 'read', 'failed', 'skipped'
);

CREATE TABLE whatsapp_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status wa_recipient_status NOT NULL DEFAULT 'pending',
  platform_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX idx_wa_recipients_campaign_status
  ON whatsapp_broadcast_recipients (campaign_id, status);
CREATE INDEX idx_wa_recipients_platform_message_id
  ON whatsapp_broadcast_recipients (platform_message_id)
  WHERE platform_message_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_templates_all ON whatsapp_templates FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()))
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY wa_campaigns_all ON whatsapp_campaigns FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()))
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));

-- Recipients table is worker-managed (service role only). Users get read-only.
CREATE POLICY wa_recipients_select ON whatsapp_broadcast_recipients FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
