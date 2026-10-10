-- Clubs, events, research & consultancy, academic resources.

create type public.club_member_role as enum ('member', 'coordinator');
create type public.membership_policy as enum ('open', 'approval');

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null check (char_length(name) between 3 and 80),
  tagline text check (char_length(tagline) <= 140),
  description text check (char_length(description) <= 3000),
  category text not null check (char_length(category) <= 40),
  logo text not null default '✨' check (char_length(logo) <= 8),
  is_official boolean not null default false,
  membership_policy public.membership_policy not null default 'approval',
  requirements text check (char_length(requirements) <= 500),
  server_id uuid references public.servers (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index clubs_name_trgm_idx on public.clubs using gin (name extensions.gin_trgm_ops);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_member_role not null default 'member',
  status public.request_status not null default 'pending',
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user_idx on public.club_members (user_id);

alter table public.posts add constraint posts_club_fk foreign key (club_id) references public.clubs (id) on delete set null;
alter table public.posts add constraint posts_announcement_needs_club check (not is_announcement or club_id is not null);

create or replace function public.is_club_coordinator(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members where club_id = cid and user_id = auth.uid()
                  and role = 'coordinator' and status = 'approved') or public.is_admin();
$$;

-- Official status is only settable by platform admins; creators become coordinators.
create or replace function public.clubs_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.is_official and not public.is_admin() and auth.uid() is not null then new.is_official := false; end if;
  elsif new.is_official is distinct from old.is_official and not public.is_admin() and auth.uid() is not null then
    raise exception 'Only platform administrators can change official status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger clubs_guard before insert or update on public.clubs for each row execute function public.clubs_guard();

create or replace function public.on_club_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.club_members (club_id, user_id, role, status) values (new.id, new.created_by, 'coordinator', 'approved')
  on conflict do nothing;
  return new;
end $$;
create trigger clubs_after_insert after insert on public.clubs for each row execute function public.on_club_created();

create or replace function public.join_club(cid uuid, p_note text default null)
returns public.request_status language plpgsql security definer set search_path = '' as $$
declare c record; st public.request_status;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from public.clubs where id = cid;
  if not found then raise exception 'Club not found'; end if;
  st := case when c.membership_policy = 'open' then 'approved'::public.request_status else 'pending' end;
  insert into public.club_members (club_id, user_id, status, note) values (cid, auth.uid(), st, left(p_note, 300))
  on conflict (club_id, user_id) do update set status = excluded.status, note = excluded.note, created_at = now()
    where public.club_members.status = 'rejected';
  for c in select user_id from public.club_members where club_id = cid and role = 'coordinator' and status = 'approved' loop
    perform public.notify(c.user_id, 'club.request',
      (select full_name from public.profiles where id = auth.uid()) ||
      case when st = 'approved' then ' joined ' else ' requested to join ' end || (select name from public.clubs where id = cid),
      left(p_note, 120), '/clubs/' || (select slug from public.clubs where id = cid));
  end loop;
  return st;
end $$;

create or replace function public.decide_club_member(cid uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_club_coordinator(cid) then raise exception 'Only club coordinators can review requests' using errcode = '42501'; end if;
  update public.club_members set status = case when p_approve then 'approved'::public.request_status else 'rejected' end
   where club_id = cid and user_id = p_user and status = 'pending';
  if not found then raise exception 'No pending request'; end if;
  perform public.notify(p_user, 'club.decided',
    'Your membership request for ' || (select name from public.clubs where id = cid) || ' was ' || case when p_approve then 'approved' else 'declined' end,
    null, '/clubs/' || (select slug from public.clubs where id = cid));
end $$;

create or replace function public.set_club_coordinator(cid uuid, p_user uuid, p_coordinator boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_club_coordinator(cid) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.club_members set role = case when p_coordinator then 'coordinator'::public.club_member_role else 'member' end
   where club_id = cid and user_id = p_user and status = 'approved';
  if not found then raise exception 'Not an approved member'; end if;
  perform public.audit('club.coordinator', 'club', cid::text, jsonb_build_object('user', p_user, 'coordinator', p_coordinator));
end $$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 4000),
  category text not null default 'General',
  venue text not null check (char_length(venue) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity is null or capacity between 1 and 10000),
  registration_deadline timestamptz,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_deadline is null or registration_deadline <= ends_at)
);
create index events_starts_idx on public.events (starts_at);
create index events_title_trgm_idx on public.events using gin (title extensions.gin_trgm_ops);
alter table public.posts add constraint posts_event_fk foreign key (event_id) references public.events (id) on delete set null;

create type public.registration_status as enum ('registered', 'cancelled');

create table public.event_registrations (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.registration_status not null default 'registered',
  reminded boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_registrations_user_idx on public.event_registrations (user_id);

create or replace function public.can_manage_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = eid and
    (e.organizer_id = auth.uid() or (e.club_id is not null and public.is_club_coordinator(e.club_id)) or public.is_admin()));
$$;

-- Registration: row-locks the event to make capacity checks race-free.
create or replace function public.register_for_event(eid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e record; taken int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into e from public.events where id = eid for update;
  if not found then raise exception 'Event not found'; end if;
  if e.is_cancelled then raise exception 'This event has been cancelled'; end if;
  if coalesce(e.registration_deadline, e.starts_at) < now() then raise exception 'Registration has closed'; end if;
  if exists (select 1 from public.event_registrations where event_id = eid and user_id = auth.uid() and status = 'registered') then
    raise exception 'You are already registered';
  end if;
  if e.capacity is not null then
    select count(*) into taken from public.event_registrations where event_id = eid and status = 'registered';
    if taken >= e.capacity then raise exception 'This event is full'; end if;
  end if;
  insert into public.event_registrations (event_id, user_id, status) values (eid, auth.uid(), 'registered')
  on conflict (event_id, user_id) do update set status = 'registered', created_at = now();
  insert into public.notifications (user_id, type, title, body, link)
  values (auth.uid(), 'event.registered', 'You are registered for ' || e.title,
          to_char(e.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM') || ' · ' || e.venue, '/events/' || eid);
end $$;

create or replace function public.cancel_event_registration(eid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.event_registrations set status = 'cancelled' where event_id = eid and user_id = auth.uid() and status = 'registered';
  if not found then raise exception 'You are not registered for this event'; end if;
end $$;

-- In-app reminders for events starting within 24h (idempotent; invoked on page load / cron).
create or replace function public.send_event_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select er.event_id, er.user_id, e.title, e.starts_at, e.venue
             from public.event_registrations er join public.events e on e.id = er.event_id
            where er.status = 'registered' and not er.reminded and not e.is_cancelled
              and e.starts_at between now() and now() + interval '24 hours'
              and (auth.uid() is null or er.user_id = auth.uid() or public.is_admin()) loop
    insert into public.notifications (user_id, type, title, body, link)
    values (r.user_id, 'event.reminder', 'Reminder: ' || r.title || ' starts soon',
            to_char(r.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM') || ' · ' || r.venue, '/events/' || r.event_id);
    update public.event_registrations set reminded = true where event_id = r.event_id and user_id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.events_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.organizer_id := auth.uid();
    if new.club_id is not null and not public.is_club_coordinator(new.club_id) then
      raise exception 'Only club coordinators can create events for this club' using errcode = '42501';
    end if;
  elsif new.organizer_id <> old.organizer_id or new.club_id is distinct from old.club_id then
    raise exception 'Organizer and club cannot be changed';
  end if;
  return new;
end $$;
create trigger events_guard before insert or update on public.events for each row execute function public.events_guard();

create or replace function public.events_notify_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.is_cancelled and not old.is_cancelled or new.starts_at <> old.starts_at or new.venue <> old.venue then
    for r in select user_id from public.event_registrations where event_id = new.id and status = 'registered' loop
      perform public.notify(r.user_id, 'event.updated',
        case when new.is_cancelled then 'Cancelled: ' else 'Updated: ' end || new.title,
        to_char(new.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM') || ' · ' || new.venue, '/events/' || new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger events_after_update after update on public.events for each row execute function public.events_notify_change();

-- ---------------------------------------------------------------------------
-- Research & consultancy
-- ---------------------------------------------------------------------------
create type public.project_kind as enum ('research', 'consultancy');
create type public.project_status as enum ('open', 'closed', 'completed');
create type public.application_status as enum ('pending', 'shortlisted', 'accepted', 'rejected', 'withdrawn');

create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  kind public.project_kind not null default 'research',
  lead_id uuid not null references public.profiles (id),
  title text not null check (char_length(title) between 5 and 160),
  abstract text not null check (char_length(abstract) between 20 and 600),
  description text check (char_length(description) <= 6000),
  area text not null check (char_length(area) <= 60),
  department text,
  required_skills text[] not null default '{}',
  commitment text not null check (char_length(commitment) <= 120),
  positions int not null default 1 check (positions between 1 and 50),
  status public.project_status not null default 'open',
  open_to text[] not null default '{ug_student,pg_student,phd_scholar}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_projects_title_trgm_idx on public.research_projects using gin (title extensions.gin_trgm_ops);
create index research_projects_skills_idx on public.research_projects using gin (required_skills);
create trigger research_projects_touch before update on public.research_projects for each row execute function public.touch_updated_at();

-- Restricted details (budgets, agreements) visible only to the lead and admins.
create table public.project_private_details (
  project_id uuid primary key references public.research_projects (id) on delete cascade,
  budget_note text check (char_length(budget_note) <= 1000),
  agreement_note text check (char_length(agreement_note) <= 2000),
  updated_at timestamptz not null default now()
);

create table public.research_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  statement text not null check (char_length(statement) between 30 and 2000),
  relevant_skills text[] not null default '{}',
  availability text check (char_length(availability) <= 120),
  status public.application_status not null default 'pending',
  reviewer_note text check (char_length(reviewer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, applicant_id)
);
create trigger research_applications_touch before update on public.research_applications for each row execute function public.touch_updated_at();

create or replace function public.research_projects_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.lead_id := auth.uid();
    if not (public.has_role('faculty') or public.is_admin()
            or exists (select 1 from public.profiles where id = auth.uid() and affiliation = 'phd_scholar')) then
      raise exception 'Only verified faculty and doctoral scholars can publish projects' using errcode = '42501';
    end if;
    if new.kind = 'consultancy' and not (public.has_role('faculty') or public.is_admin()) then
      raise exception 'Only verified faculty can publish consultancy listings' using errcode = '42501';
    end if;
  elsif new.lead_id <> old.lead_id then
    raise exception 'Project lead cannot be changed';
  end if;
  return new;
end $$;
create trigger research_projects_guard before insert or update on public.research_projects
  for each row execute function public.research_projects_guard();

create or replace function public.apply_to_project(pid uuid, p_statement text, p_skills text[], p_availability text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p record; aid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into p from public.research_projects where id = pid;
  if not found then raise exception 'Project not found'; end if;
  if p.status <> 'open' then raise exception 'This project is not accepting applications'; end if;
  if p.lead_id = auth.uid() then raise exception 'You lead this project'; end if;
  perform public.check_rate_limit('research.apply', 10, interval '1 day');
  insert into public.research_applications (project_id, applicant_id, statement, relevant_skills, availability)
  values (pid, auth.uid(), p_statement, coalesce(p_skills, '{}'), p_availability)
  on conflict (project_id, applicant_id) do update
     set statement = excluded.statement, relevant_skills = excluded.relevant_skills,
         availability = excluded.availability, status = 'pending'
   where public.research_applications.status = 'withdrawn'
  returning id into aid;
  if aid is null then raise exception 'You have already applied to this project'; end if;
  perform public.notify(p.lead_id, 'research.application',
    (select full_name from public.profiles where id = auth.uid()) || ' applied to ' || p.title, left(p_statement, 120), '/research/' || pid);
  return aid;
end $$;

create or replace function public.review_application(aid uuid, p_status public.application_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record; p record;
begin
  select * into a from public.research_applications where id = aid;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.research_projects where id = a.project_id;
  if p.lead_id <> auth.uid() and not public.is_admin() then raise exception 'Only the project lead can review applications' using errcode = '42501'; end if;
  if p_status not in ('shortlisted', 'accepted', 'rejected') then raise exception 'Invalid decision'; end if;
  if a.status in ('withdrawn') then raise exception 'This application was withdrawn'; end if;
  update public.research_applications set status = p_status, reviewer_note = left(p_note, 1000) where id = aid;
  perform public.notify(a.applicant_id, 'research.status', 'Application ' || p_status::text || ': ' || p.title, left(p_note, 120), '/research/' || p.id);
end $$;

create or replace function public.withdraw_application(aid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.research_applications set status = 'withdrawn' where id = aid and applicant_id = auth.uid() and status in ('pending', 'shortlisted');
  if not found then raise exception 'Application cannot be withdrawn'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Academic resources
-- ---------------------------------------------------------------------------
create type public.resource_kind as enum ('course', 'elective', 'material', 'link', 'form');

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  kind public.resource_kind not null,
  title text not null check (char_length(title) between 3 and 160),
  description text check (char_length(description) <= 2000),
  course_code text check (char_length(course_code) <= 20),
  department text,
  semester smallint check (semester between 1 and 10),
  url text check (url ~ '^https?://'),
  source_label text check (char_length(source_label) <= 120),
  is_official boolean not null default false,
  server_id uuid references public.servers (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index resources_title_trgm_idx on public.resources using gin (title extensions.gin_trgm_ops);

create or replace function public.resources_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.submitted_by := auth.uid();
    if not public.is_admin() then new.is_official := false; end if;
  elsif new.is_official is distinct from old.is_official and not public.is_admin() then
    raise exception 'Only administrators can mark resources official' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger resources_guard before insert or update on public.resources for each row execute function public.resources_guard();
create trigger resources_rate_limit before insert on public.resources
  for each row execute function public.rate_limit_insert('resource', '10', '1 day');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.research_projects enable row level security;
alter table public.project_private_details enable row level security;
alter table public.research_applications enable row level security;
alter table public.resources enable row level security;

-- Posting on behalf of a club (announcements) requires coordinator rights.
drop policy posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (club_id is null or public.is_club_coordinator(club_id)));
drop policy posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and (club_id is null or public.is_club_coordinator(club_id)));

create policy clubs_select on public.clubs for select to authenticated using (true);
create policy clubs_insert on public.clubs for insert to authenticated with check (created_by = auth.uid());
create policy clubs_update on public.clubs for update to authenticated
  using (public.is_club_coordinator(id)) with check (public.is_club_coordinator(id));
create policy clubs_delete on public.clubs for delete to authenticated using (public.is_admin());

create policy club_members_select on public.club_members for select to authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_club_coordinator(club_id));
create policy club_members_delete on public.club_members for delete to authenticated
  using ((user_id = auth.uid() and role = 'member') or public.is_club_coordinator(club_id));

create policy events_select on public.events for select to authenticated using (true);
create policy events_insert on public.events for insert to authenticated with check (true); -- guarded by trigger
create policy events_update on public.events for update to authenticated
  using (public.can_manage_event(id)) with check (public.can_manage_event(id));
create policy events_delete on public.events for delete to authenticated using (public.can_manage_event(id));

-- Participant lists are visible to the registrant themselves and the organizers.
create policy registrations_select on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or public.can_manage_event(event_id));

create policy projects_select on public.research_projects for select to authenticated using (true);
create policy projects_insert on public.research_projects for insert to authenticated with check (true); -- guarded by trigger
create policy projects_update on public.research_projects for update to authenticated
  using (lead_id = auth.uid() or public.is_admin()) with check (lead_id = auth.uid() or public.is_admin());
create policy projects_delete on public.research_projects for delete to authenticated using (lead_id = auth.uid() or public.is_admin());

create policy private_details_all on public.project_private_details for all to authenticated
  using (exists (select 1 from public.research_projects p where p.id = project_id and (p.lead_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.research_projects p where p.id = project_id and (p.lead_id = auth.uid() or public.is_admin())));

create policy applications_select on public.research_applications for select to authenticated
  using (applicant_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.research_projects p where p.id = project_id and p.lead_id = auth.uid()));

create policy resources_select on public.resources for select to authenticated using (true);
create policy resources_insert on public.resources for insert to authenticated with check (true); -- guarded by trigger
create policy resources_update on public.resources for update to authenticated
  using (submitted_by = auth.uid() or public.is_admin()) with check (submitted_by = auth.uid() or public.is_admin());
create policy resources_delete on public.resources for delete to authenticated
  using (submitted_by = auth.uid() or public.is_moderator());
