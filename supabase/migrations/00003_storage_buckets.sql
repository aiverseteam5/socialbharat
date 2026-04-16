-- Storage buckets for media uploads
-- Referenced by src/app/api/media/upload/route.ts

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10 MB, matches the upload route limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: members of an organization may read/write media under their org_id prefix.
-- Paths are stored as "<org_id>/<timestamp>.<ext>" by the upload route.

CREATE POLICY "media_select_own_org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
    AND (
      -- Public bucket: anonymous reads allowed for rendering cdn_url in posts
      true
    )
  );

CREATE POLICY "media_insert_own_org"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "media_update_own_org"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "media_delete_own_org"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM org_members WHERE user_id = auth.uid()
    )
  );
