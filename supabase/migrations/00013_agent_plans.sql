-- V3 Phase 4A — Agent-generated content plans and inbox action log
-- A plan is a weekly bundle of draft posts produced by the orchestrator.
-- Humans approve/edit/publish from /ai-agent. When AGENT_HUMAN_APPROVAL=true,
-- plans cannot publish until a user transitions status to 'approved'.
--
-- agent_inbox_actions logs Claude-drafted replies so we have an audit trail
-- of what the agent suggested vs. what the human sent.

CREATE TABLE agent_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  -- 'weekly_content' is the only kind for Phase 4A; leaving kind open for
  -- future plans (monthly, campaign, inbox-digest).
  kind VARCHAR(50) NOT NULL DEFAULT 'weekly_content',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'discarded')),
  -- Week window the plan covers (inclusive). Used for de-duping.
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  -- Structured plan body produced by content-agent. Shape:
  --   { theme, summary, posts: [{ platforms, caption, hashtags, suggested_at, festival_id?, ... }] }
  plan JSONB NOT NULL DEFAULT '{}',
  -- Raw research context (festivals + trend report) captured at plan time —
  -- used so a user can audit *why* the agent chose these topics.
  research JSONB NOT NULL DEFAULT '{}',
  -- When the user approves, we record who and when; post IDs are written here
  -- once publish() is called so the audit trail links plan → posts.
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  published_post_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_plans_org_status
  ON agent_plans(org_id, status, created_at DESC);
CREATE INDEX idx_agent_plans_week
  ON agent_plans(org_id, week_start);

ALTER TABLE agent_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_plans_select ON agent_plans FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY agent_plans_insert ON agent_plans FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY agent_plans_update ON agent_plans FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY agent_plans_delete ON agent_plans FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  );


-- Inbox agent drafts — one row per Claude classification of a conversation.
-- draft_reply is the text to send; status tracks whether a human dispatched it.
CREATE TABLE agent_inbox_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  -- Claude's classification ('question', 'complaint', 'lead', 'spam', 'thanks')
  intent VARCHAR(50) NOT NULL,
  sentiment VARCHAR(20), -- 'positive' | 'neutral' | 'negative'
  urgency VARCHAR(20),   -- 'low' | 'normal' | 'high'
  draft_reply TEXT,
  -- Flags the human should see in UI (e.g., 'escalate', 'needs_policy_review').
  flags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'edited', 'skipped', 'escalated')),
  sent_by UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_inbox_actions_org_status
  ON agent_inbox_actions(org_id, status, created_at DESC);
CREATE INDEX idx_agent_inbox_actions_conversation
  ON agent_inbox_actions(conversation_id);

ALTER TABLE agent_inbox_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_inbox_actions_select ON agent_inbox_actions FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY agent_inbox_actions_insert ON agent_inbox_actions FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY agent_inbox_actions_update ON agent_inbox_actions FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY agent_inbox_actions_delete ON agent_inbox_actions FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  );
