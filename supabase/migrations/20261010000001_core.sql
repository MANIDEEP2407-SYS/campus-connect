-- CampusConnect Amrita — core schema: profiles, roles, helpers, social graph, notifications, audit.
-- All business-critical rules live in the database (RLS, triggers, SECURITY DEFINER RPCs) because
-- the anon key is public and clients can call PostgREST directly.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('platform_admin', 'safety_responder', 'moderator', 'faculty');
create type public.affiliation as enum ('ug_student', 'pg_student', 'phd_scholar', 'faculty', 'staff');
create type public.profile_visibility as enum ('campus', 'connections', 'hidden');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  affiliation public.affiliation not null default 'ug_student',
  department text check (char_length(department) <= 80),
  program text check (char_length(program) <= 80),
  year_of_study smallint check (year_of_study between 1 and 6),
  bio text check (char_length(bio) <= 500),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  interests text[] not null default '{}' check (cardinality(interests) <= 20),
  goals text[] not null default '{}' check (cardinality(goals) <= 10),
  avatar_url text,
  visibility public.profile_visibility not null default 'campus',
  allow_dms boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_skills_idx on public.profiles using gin (skills);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index profiles_department_idx on public.profiles (department);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('platform_admin');
$$;

create or replace function public.is_responder()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('safety_responder') or public.has_role('platform_admin');
$$;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('moderator') or public.has_role('platform_admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, handle, full_name)
  values (new.id, candidate, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), initcap(base)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit log, notifications, rate limiting
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'));
$$;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
end $$;

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_idx on public.rate_limit_events (user_id, action, created_at desc);

-- Raises if the caller exceeded p_max events of p_action within p_window; otherwise records one.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cnt int;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select count(*) into cnt from public.rate_limit_events
   where user_id = auth.uid() and action = p_action and created_at > now() - p_window;
  if cnt >= p_max then
    raise exception 'Rate limit exceeded for %: try again later', p_action using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (auth.uid(), p_action);
end $$;

-- Generic trigger: rate-limit inserts by the authenticated caller. TG_ARGV: action, max, window.
create or replace function public.rate_limit_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    perform public.check_rate_limit(tg_argv[0], tg_argv[1]::int, tg_argv[2]::interval);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Social graph and feed
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create or replace function public.is_following(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = target);
$$;

-- Whether the caller may see the full profile of `target` (visibility rules).
create or replace function public.can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = auth.uid()
      or public.is_moderator()
      or exists (
        select 1 from public.profiles p where p.id = target and (
          p.visibility = 'campus'
          or (p.visibility = 'connections' and exists (
                select 1 from public.follows f where f.follower_id = target and f.followee_id = auth.uid()))
        ));
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_path text,
  club_id uuid, -- FK added in clubs migration
  event_id uuid,
  is_announcement boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.rate_limit_insert('post', '20', '1 hour');

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.rate_limit_insert('comment', '60', '1 hour');

create table public.bookmarks (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Notifications for social interactions
create or replace function public.on_follow_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  select full_name into n from public.profiles where id = new.follower_id;
  perform public.notify(new.followee_id, 'follow', n || ' started following you', null,
    '/profile/' || (select handle from public.profiles where id = new.follower_id));
  return new;
end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.on_follow_notify();

create or replace function public.on_like_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify((select author_id from public.posts where id = new.post_id), 'like',
    (select full_name from public.profiles where id = new.user_id) || ' liked your post', null, '/home#post-' || new.post_id);
  return new;
end $$;
create trigger likes_notify after insert on public.post_likes for each row execute function public.on_like_notify();

create or replace function public.on_comment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify((select author_id from public.posts where id = new.post_id), 'comment',
    (select full_name from public.profiles where id = new.author_id) || ' commented on your post',
    left(new.body, 120), '/home#post-' || new.post_id);
  return new;
end $$;
create trigger comments_notify after insert on public.comments for each row execute function public.on_comment_notify();

-- ---------------------------------------------------------------------------
-- Admin role management (the only way privileged roles are granted)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only platform administrators can change roles' using errcode = '42501'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    if p_user = auth.uid() and p_role = 'platform_admin' then
      raise exception 'You cannot remove your own administrator role';
    end if;
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'role.grant' else 'role.revoke' end, 'profile', p_user::text, jsonb_build_object('role', p_role));
  perform public.notify(p_user, 'role', case when p_grant then 'You were granted the ' else 'Your role was removed: ' end || p_role::text, null, '/profile');
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;

-- Profiles: every signed-in user can see the directory row (name/handle/avatar) of non-hidden
-- profiles; full-detail gating for 'connections' visibility (people the owner follows) is applied in the profile_cards view.
create policy profiles_select on public.profiles for select to authenticated
  using (visibility <> 'hidden' or id = auth.uid() or public.is_moderator()
         or exists (select 1 from public.follows f where f.follower_id = profiles.id and f.followee_id = auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Roles are readable (to show badges) but never writable through the API.
create policy user_roles_select on public.user_roles for select to authenticated using (true);

create policy audit_logs_admin_select on public.audit_logs for select to authenticated using (public.is_admin());

create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy posts_select on public.posts for select to authenticated using (true);
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_moderator());

create policy likes_select on public.post_likes for select to authenticated using (true);
create policy likes_insert on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.comments for select to authenticated using (true);
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy bookmarks_select on public.bookmarks for select to authenticated using (user_id = auth.uid());
create policy bookmarks_insert on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy bookmarks_delete on public.bookmarks for delete to authenticated using (user_id = auth.uid());

-- Profile cards: masks details of 'connections'-only profiles for non-followers.
create view public.profile_cards with (security_invoker = true) as
select p.id, p.handle, p.full_name, p.affiliation, p.avatar_url, p.visibility,
       case when public.can_view_profile(p.id) then p.department end as department,
       case when public.can_view_profile(p.id) then p.program end as program,
       case when public.can_view_profile(p.id) then p.year_of_study end as year_of_study,
       case when public.can_view_profile(p.id) then p.bio end as bio,
       case when public.can_view_profile(p.id) then p.skills else '{}' end as skills,
       case when public.can_view_profile(p.id) then p.interests else '{}' end as interests,
       case when public.can_view_profile(p.id) then p.goals else '{}' end as goals,
       p.allow_dms, p.created_at
  from public.profiles p;
grant select on public.profile_cards to authenticated;
