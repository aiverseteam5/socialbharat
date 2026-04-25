-- V3 Phase 3B — BullMQ queue integration on posts table
-- Adds columns referenced by publish-worker and the schedule API:
--   queue_job_id   — BullMQ delayed job id so schedules can be cancelled/rescheduled
--   error_message  — last failure reason, surfaced in UI
--   retry_count    — incremented by the worker on each retry
--   published_url  — platform URL of the first successful publish (convenience)
-- platform_post_id is already covered per-profile inside publish_results JSONB.
-- 'queued' + 'cancelled' are added to the status CHECK to reflect queue state.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS queue_job_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_url TEXT;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts ADD CONSTRAINT posts_status_check CHECK (
  status IN (
    'draft',
    'pending_approval',
    'approved',
    'scheduled',
    'queued',
    'publishing',
    'published',
    'failed',
    'partially_failed',
    'cancelled'
  )
);

CREATE INDEX IF NOT EXISTS idx_posts_queue_job_id ON posts(queue_job_id)
  WHERE queue_job_id IS NOT NULL;
