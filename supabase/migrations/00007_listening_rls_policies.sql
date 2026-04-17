-- C-1: listening_queries was missing an UPDATE policy.
-- Without it, all UPDATE operations from non-superuser roles are denied by RLS,
-- silently breaking PUT /api/listening/queries/[id] and soft-DELETE (is_active=false).
ALTER TABLE listening_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors+ can update listening queries" ON listening_queries
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- W-2: listening_mentions INSERT intent documented via explicit RLS policy.
-- The cron crawler uses createServiceClient() which bypasses RLS, so inserts work.
-- This WITH CHECK (false) policy blocks any accidental user-context insert,
-- making the service-role-only contract enforceable at the DB level.
CREATE POLICY "Service role only — no user-context inserts" ON listening_mentions
  FOR INSERT WITH CHECK (false);
