-- Feature 3: Leads CRM Lite — Kanban list query speedup.
-- Most queries: filter by (org_id, status), order by recency.

create index if not exists idx_leads_org_status_updated
  on leads (org_id, status, updated_at desc);
