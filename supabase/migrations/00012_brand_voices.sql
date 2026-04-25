-- V3 Phase 4A — Brand voice profiles for agentic AI
-- Each org has at most one active brand voice; it's merged into the system
-- prompt of every agent (research, content, inbox) so Claude writes in the
-- voice the org has approved.
--
-- Columns are kept simple, structured text fields (no JSON-in-JSON) so the
-- server can template them deterministically without JSON parsing.

CREATE TABLE brand_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  -- Short descriptor ("Warm, festive, Hinglish"). Used in prompt + UI.
  tone VARCHAR(255) NOT NULL DEFAULT 'friendly',
  -- Bulleted values ("eco-friendliness, affordability, Indian craft"). One
  -- string — the LLM parses it. Keeping free-form avoids a brittle array.
  core_values TEXT DEFAULT '',
  -- Phrases to avoid ("no exclamation-heavy copy, no slang"). Free-form.
  avoid TEXT DEFAULT '',
  -- Example on-brand captions; Claude uses them as style anchors.
  example_captions TEXT DEFAULT '',
  -- Primary language hint ("en", "hi", "hi-en"). Falls back to org.preferred_language.
  primary_language VARCHAR(10),
  -- Target audience description (one sentence).
  target_audience TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active brand voice per org; easy lookup by the agent pipeline.
CREATE UNIQUE INDEX idx_brand_voices_org_active
  ON brand_voices(org_id)
  WHERE is_active = TRUE;

ALTER TABLE brand_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_voices_select ON brand_voices FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY brand_voices_insert ON brand_voices FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY brand_voices_update ON brand_voices FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin', 'editor')
  );
CREATE POLICY brand_voices_delete ON brand_voices FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND get_user_role(org_id) IN ('owner', 'admin')
  );
