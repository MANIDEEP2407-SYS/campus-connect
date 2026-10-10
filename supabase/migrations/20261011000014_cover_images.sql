-- Optional cover images for clubs, events and communities. The app only writes URLs from the
-- public post-images bucket or the curated demo photo host; the database requires https.

alter table public.clubs add column cover_url text check (cover_url ~ '^https://' and char_length(cover_url) <= 500);
alter table public.events add column cover_url text check (cover_url ~ '^https://' and char_length(cover_url) <= 500);
alter table public.servers add column cover_url text check (cover_url ~ '^https://' and char_length(cover_url) <= 500);
