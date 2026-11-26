-- SCRUM-47 follow-up: allow video entries in the battle-artwork bucket.
--
-- 20261117180000_security_hardening.sql limited the bucket to images up to 5 MB.
-- 20261117190000_battle_media_and_votes.sql added video entries, which that limit blocks.
-- This keeps the protection (no HTML/SVG/other files) and allows common video formats.
--
-- Run in the Supabase SQL Editor after 20261117190000_battle_media_and_votes.sql.
-- Safe to run more than once.

update storage.buckets
set
  -- 50 MB: the largest single upload allowed on the Supabase free plan
  file_size_limit = 50 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/3gpp',
    -- some Android phones send files without a type; such files are served as a download,
    -- never rendered as a page, so they cannot be used for phishing
    'application/octet-stream'
  ]
where id = 'battle-artwork';
