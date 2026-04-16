-- Add 'rejected' to posts.status CHECK constraint.
-- Postgres can't alter CHECKs in place, so drop and recreate.

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'scheduled',
    'publishing',
    'published',
    'failed',
    'partially_failed'
  ));
