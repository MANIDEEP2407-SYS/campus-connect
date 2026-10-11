-- Post audiences: authors choose who can see a post — everyone, their followers, members of a club
-- they belong to, their department, or people whose profile interests match chosen topics.
-- Enforced by RLS; the viewer's follows/clubs/department/interests are resolved once per query.

create type public.post_audience as enum ('campus', 'followers', 'club', 'department', 'interests');

alter table public.posts
  add column audience public.post_audience not null default 'campus',
  add column audience_club_id uuid references public.clubs (id) on delete cascade,
  add column audience_department text check (char_length(audience_department) <= 80),
  add column audience_tags text[] not null default '{}' check (cardinality(audience_tags) <= 10);
alter table public.posts add constraint posts_audience_target_check check (
  case audience
    when 'club' then audience_club_id is not null
    when 'department' then audience_department is not null
    when 'interests' then cardinality(audience_tags) > 0
    else true
  end);
create index posts_audience_club_idx on public.posts (audience_club_id) where audience = 'club';

create or replace function public.lower_tags(tags text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(lower(trim(t))), '{}') from unnest(tags) t where trim(t) <> '';
$$;

-- Viewer context (security definer: callable from policies without depending on other tables' RLS).
create or replace function public.my_followee_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(followee_id), '{}') from public.follows where follower_id = auth.uid();
$$;
create or replace function public.my_club_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(club_id), '{}') from public.club_members where user_id = auth.uid() and status = 'approved';
$$;
create or replace function public.my_department()
returns text language sql stable security definer set search_path = '' as $$
  select department from public.profiles where id = auth.uid();
$$;
create or replace function public.my_interest_tags()
returns text[] language sql stable security definer set search_path = '' as $$
  select public.lower_tags(interests) from public.profiles where id = auth.uid();
$$;

-- Normalise targets on write: department is the author's own; tags are lower-cased; unused targets cleared.
-- Club audiences require approved membership of that club.
create or replace function public.posts_audience_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.audience_tags := case when new.audience = 'interests' then public.lower_tags(new.audience_tags) else '{}' end;
  if new.audience <> 'club' then new.audience_club_id := null; end if;
  new.audience_department := case when new.audience = 'department'
    then (select department from public.profiles where id = new.author_id) end;
  if new.audience = 'department' and new.audience_department is null then
    raise exception 'Add your department to your profile to post to it';
  end if;
  if new.audience = 'club' and auth.uid() is not null and not exists (
       select 1 from public.club_members where club_id = new.audience_club_id and user_id = new.author_id and status = 'approved') then
    raise exception 'You can only post to clubs you are a member of' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger posts_audience_guard before insert or update of audience, audience_club_id, audience_tags on public.posts
  for each row execute function public.posts_audience_guard();

drop policy posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (
  (shield_state = 'visible' or author_id = (select auth.uid()) or (select public.is_moderator()))
  and (
    audience = 'campus'
    or author_id = (select auth.uid())
    or (select public.is_moderator())
    or (audience = 'followers' and author_id = any ((select public.my_followee_ids())::uuid[]))
    or (audience = 'club' and audience_club_id = any ((select public.my_club_ids())::uuid[]))
    or (audience = 'department' and audience_department = (select public.my_department()))
    or (audience = 'interests' and audience_tags && (select public.my_interest_tags()))
  ));

-- Comments, likes and bookmarks follow the post's visibility (the posts subquery applies posts RLS).
drop policy comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using ((shield_state = 'visible' or author_id = (select auth.uid()) or (select public.is_moderator()))
         and exists (select 1 from public.posts p where p.id = post_id));
drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and not public.is_posting_restricted(auth.uid())
              and exists (select 1 from public.posts p where p.id = post_id)
              and not public.is_blocked_between(auth.uid(), (select p.author_id from public.posts p where p.id = post_id)));
drop policy likes_select on public.post_likes;
create policy likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy likes_insert on public.post_likes;
create policy likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy bookmarks_insert on public.bookmarks;
create policy bookmarks_insert on public.bookmarks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
