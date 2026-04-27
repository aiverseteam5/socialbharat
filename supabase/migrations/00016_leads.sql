-- V3 Phase 4D — Lead CRM table for WhatsApp inbox lead card
-- Grain: one row per (org_id, contact_id). Survives across multiple conversations
-- with the same contact. Lead card auto-creates on first conversation open.

CREATE TYPE lead_status AS ENUM ('New', 'Interested', 'Hot', 'Paid', 'Lost');

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT,
  status lead_status NOT NULL DEFAULT 'New',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contact_id)
);

CREATE INDEX idx_leads_org ON leads(org_id);
CREATE INDEX idx_leads_contact ON leads(contact_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_select ON leads FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY leads_insert ON leads FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY leads_delete ON leads FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()));
