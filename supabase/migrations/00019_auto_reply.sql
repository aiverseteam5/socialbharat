-- Feature 4F: WhatsApp Inbound Auto-Reply
--
-- Adds:
--  - org_agent_knowledge      : per-org grounding text for the AI auto-reply
--                               prompt. 1:1 with organization (PK = org_id).
--  - conversations.auto_reply_paused_at : per-conversation pause toggle.
--                               NULL = active. Set timestamp = paused.
--
-- Auto-reply per-message audit (model + confidence + sent_at) is stored on
-- messages.metadata JSONB under the auto_reply key — no new column needed.

-- ── Org-level knowledge / grounding ─────────────────────────────────────────
CREATE TABLE org_agent_knowledge (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  -- Reserved for future outside-24h proactive re-engagement. Unused in v1.
  outside_24h_template_id UUID REFERENCES whatsapp_templates(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ── Per-conversation auto-reply pause ───────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS auto_reply_paused_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conv_auto_reply_paused
  ON conversations (org_id) WHERE auto_reply_paused_at IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE org_agent_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY ka_all ON org_agent_knowledge FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()))
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
