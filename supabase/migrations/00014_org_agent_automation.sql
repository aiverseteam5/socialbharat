-- V3 Phase 4A — Org-level opt-in for autonomous agent runs
-- When TRUE, the weekly-content and inbox-reply cron fan-outs will include
-- this org. When FALSE (default), the org is skipped — a user must toggle
-- the switch on /ai-agent before anything runs automatically.
--
-- The cron worker reads this column; UI on /ai-agent writes it.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS opted_in_to_agent_automation BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: cron fan-out iterates only opted-in orgs, so the index is
-- cheap and keeps the scheduler query bounded even at scale.
CREATE INDEX IF NOT EXISTS idx_organizations_agent_automation
  ON organizations(id)
  WHERE opted_in_to_agent_automation = TRUE;
