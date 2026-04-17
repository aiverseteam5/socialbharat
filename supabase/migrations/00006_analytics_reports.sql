-- Phase 5: Analytics reports
-- Saved custom-report configurations. Users build a report once (profiles,
-- metrics, date range) and then re-run or export it on demand.

CREATE TABLE analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  profile_ids UUID[] NOT NULL DEFAULT '{}',
  metrics TEXT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_reports_org ON analytics_reports(org_id, created_at DESC);

ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_reports_select ON analytics_reports FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY analytics_reports_insert ON analytics_reports FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY analytics_reports_update ON analytics_reports FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY analytics_reports_delete ON analytics_reports FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  );
