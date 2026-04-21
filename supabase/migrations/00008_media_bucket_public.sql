-- Ensure the "media" storage bucket is public so that platform APIs
-- (Instagram /media container, Facebook /photos) can fetch image_url / url
-- over HTTPS without needing a signed URL.
--
-- 00003_storage_buckets.sql creates the bucket with ON CONFLICT DO NOTHING,
-- which leaves pre-existing buckets untouched. This migration force-sets
-- public = true even when a row already exists.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;
