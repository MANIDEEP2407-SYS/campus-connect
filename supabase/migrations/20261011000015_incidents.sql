-- Replace CampusPulse and Academic Resources with confidential Incident Reports: students report
-- incidents involving teachers/staff, and teachers report incidents involving students. Reports are
-- routed to reviewers of the department concerned (plus the central Administration cell) and are
-- never public.

-- ---------------------------------------------------------------------------
-- Roles: the safety responder role becomes the department incident reviewer.
-- ---------------------------------------------------------------------------
alter type public.app_role rename value 'safety_responder' to 'incident_reviewer';

-- ---------------------------------------------------------------------------
-- Leftover references to removed records
-- ---------------------------------------------------------------------------
delete from public.notifications where type like 'pulse.%' or link like '/pulse%' or link like '/resources%';
delete from public.moderation_reports where target_type in ('pulse_report', 'resource');
alter table public.moderation_reports drop constraint moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'direct_message', 'server', 'profile'));

-- Same as 20261011000013 without the resource removal branch.
create or replace function public.mod_resolve_report(p_id uuid, p_status text, p_note text default null, p_remove_content boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  if p_status not in ('actioned', 'dismissed') then raise exception 'Invalid status'; end if;
  select * into m from public.moderation_reports where id = p_id for update;
  if not found then raise exception 'Report not found'; end if;
  if p_remove_content then
    case m.target_type
      when 'post' then delete from public.posts where id = m.target_id;
      when 'comment' then delete from public.comments where id = m.target_id;
      when 'message' then
        perform set_config('app.moderating', 'on', true);
        update public.messages set deleted_at = now(), body = '[message removed by moderator]' where id = m.target_id;
      when 'server' then delete from public.servers where id = m.target_id;
      else null;
    end case;
  end if;
  update public.moderation_reports set status = p_status, resolution_note = p_note, resolved_by = auth.uid()
   where target_type = m.target_type and target_id = m.target_id and status = 'open';
  perform public.audit('moderation.' || p_status, m.target_type, m.target_id::text,
    jsonb_build_object('report', p_id, 'removed', p_remove_content, 'note', p_note));
end $$;

-- Same as 20261011000013 without the academic resources branch.
create or replace function public.global_search(q text)
returns table (kind text, id uuid, title text, subtitle text, href text)
language sql stable security invoker set search_path = '' as $$
  with term as (select '%' || trim(q) || '%' as t where char_length(trim(q)) >= 2)
  (select 'person', c.id, c.full_name, coalesce(c.department, '@' || c.handle), '/profile/' || c.handle
     from public.profile_cards c, term where c.visibility <> 'hidden' and (c.full_name ilike term.t or c.handle ilike term.t
       or exists (select 1 from unnest(c.skills || c.interests) s where s ilike term.t)) limit 8)
  union all
  (select 'community', s.id, s.name, s.category || ' · ' || s.visibility::text, '/communities/' || s.id
     from public.servers s, term where s.name ilike term.t or s.description ilike term.t limit 8)
  union all
  (select 'club', c.id, c.name, c.category || case when c.is_official then ' · Official' else '' end, '/clubs/' || c.slug
     from public.clubs c, term where c.name ilike term.t or c.tagline ilike term.t or c.description ilike term.t limit 8)
  union all
  (select 'event', e.id, e.title, e.venue, '/events/' || e.id
     from public.events e, term where not e.is_cancelled and e.ends_at > now() and (e.title ilike term.t or e.description ilike term.t) limit 8)
  union all
  (select 'project', p.id, p.title, p.kind::text || ' · ' || p.area, '/research/' || p.id
     from public.research_projects p, term where p.title ilike term.t or p.abstract ilike term.t
       or exists (select 1 from unnest(p.required_skills) s where s ilike term.t) limit 8);
$$;

-- ---------------------------------------------------------------------------
-- Remove CampusPulse
-- ---------------------------------------------------------------------------
drop policy storage_select_pulse on storage.objects;
drop view public.pulse_timeline, public.pulse_feed;
drop function public.list_responders();
drop function public.pulse_find_similar(public.pulse_category, double precision, double precision);
drop function public.pulse_submit(public.pulse_category, text, text, text, public.pulse_severity, double precision, double precision, text);
drop function public.pulse_confirm(uuid);
drop function public.pulse_transition(uuid, public.pulse_status, text, uuid);
drop function public.pulse_add_note(uuid, text, boolean);
drop function public.pulse_issue_alert(uuid, text, int);
drop function public.pulse_mark_duplicate(uuid, uuid);
drop function public.pulse_expire_stale();
drop function public.can_see_report(uuid);
drop table public.report_confirmations, public.report_attachments, public.report_updates, public.report_locations, public.reports;
drop sequence public.pulse_ref_seq;
drop function public.pulse_priority(public.pulse_severity, public.pulse_category);
drop function public.pulse_can_transition(public.pulse_status, public.pulse_status);
drop function public.within_campus(double precision, double precision);
drop function public.approx_distance_m(double precision, double precision, double precision, double precision);
drop type public.pulse_status, public.pulse_severity, public.pulse_category;
do $$
begin
  delete from storage.buckets where id = 'pulse-evidence' and not exists (select 1 from storage.objects where bucket_id = 'pulse-evidence');
exception when others then
  raise notice 'pulse-evidence bucket left in place: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Remove Academic Resources
-- ---------------------------------------------------------------------------
drop table public.resources;
drop function public.resources_guard();
drop type public.resource_kind;

-- ---------------------------------------------------------------------------
-- Incident reports
-- ---------------------------------------------------------------------------
drop function public.is_responder();

-- Reviewers handle their own department; reviewers in Administration and platform admins see everything.
create or replace function public.can_review_incident(p_department text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('platform_admin') or (
    public.has_role('incident_reviewer') and exists (
      select 1 from public.profiles p where p.id = auth.uid() and (p.department = p_department or p.department = 'Administration')));
$$;

-- about_staff: a student reports a teacher/staff member; about_student: a teacher reports a student.
create type public.incident_direction as enum ('about_staff', 'about_student');
create type public.incident_category as enum (
  'harassment', 'sexual_harassment', 'verbal_abuse', 'discrimination', 'threat_or_violence',
  'unprofessional_conduct', 'academic_misconduct', 'other');
create type public.incident_status as enum ('submitted', 'under_review', 'action_taken', 'unsubstantiated', 'false_report', 'withdrawn');

create sequence public.incident_ref_seq start 1001;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique default 'IR-' || nextval('public.incident_ref_seq')::text,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  direction public.incident_direction not null,
  category public.incident_category not null,
  subject_name text not null check (char_length(subject_name) between 2 and 120),
  department text not null check (char_length(department) between 2 and 80),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 30 and 4000),
  occurred_on date not null check (occurred_on <= current_date + 1),
  location text check (char_length(location) <= 120),
  context text check (char_length(context) <= 120),
  witnesses text check (char_length(witnesses) <= 500),
  status public.incident_status not null default 'submitted',
  outcome_note text check (char_length(outcome_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  declared_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index incidents_department_idx on public.incidents (department, status, created_at desc);
create index incidents_reporter_idx on public.incidents (reporter_id, created_at desc);
create trigger incidents_touch before update on public.incidents for each row execute function public.touch_updated_at();

create table public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('status', 'note')),
  to_status public.incident_status,
  note text check (char_length(note) <= 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index incident_updates_incident_idx on public.incident_updates (incident_id, created_at);

create table public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

-- Legal lifecycle transitions (mirrored in src/lib/incidents.ts).
create or replace function public.incident_can_transition(from_s public.incident_status, to_s public.incident_status)
returns boolean language sql immutable as $$
  select case from_s
    when 'submitted'    then to_s in ('under_review', 'action_taken', 'unsubstantiated', 'false_report')
    when 'under_review' then to_s in ('action_taken', 'unsubstantiated', 'false_report')
    else false
  end;
$$;

create or replace function public.incident_submit(
  p_category public.incident_category, p_subject_name text, p_department text, p_title text, p_description text,
  p_occurred_on date, p_location text, p_context text, p_witnesses text, p_declaration boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me record; dir public.incident_direction; iid uuid; r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not coalesce(p_declaration, false) then
    raise exception 'You must confirm the declaration before submitting';
  end if;
  perform public.check_rate_limit('incident.submit', 5, interval '1 day');
  select affiliation into me from public.profiles where id = auth.uid();
  dir := case when me.affiliation in ('faculty', 'staff') then 'about_student' else 'about_staff' end;
  insert into public.incidents (reporter_id, direction, category, subject_name, department, title, description,
                                occurred_on, location, context, witnesses)
  values (auth.uid(), dir, p_category, trim(p_subject_name), trim(p_department), trim(p_title), trim(p_description),
          p_occurred_on, nullif(trim(p_location), ''), nullif(trim(p_context), ''), nullif(trim(p_witnesses), ''))
  returning id into iid;
  insert into public.incident_updates (incident_id, actor_id, kind, to_status, note)
  values (iid, auth.uid(), 'status', 'submitted', 'Report submitted with a truthfulness declaration');
  perform public.audit('incident.submit', 'incident', iid::text, jsonb_build_object('department', trim(p_department), 'direction', dir));
  for r in select distinct ur.user_id from public.user_roles ur join public.profiles p on p.id = ur.user_id
            where ur.user_id <> auth.uid()
              and (ur.role = 'platform_admin' or (ur.role = 'incident_reviewer' and p.department in (trim(p_department), 'Administration'))) loop
    perform public.notify(r.user_id, 'incident.new', 'New incident report for ' || trim(p_department), null, '/incidents/' || iid);
  end loop;
  return iid;
end $$;

create or replace function public.incident_transition(p_id uuid, p_to public.incident_status, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare inc record; msg text;
begin
  select * into inc from public.incidents where id = p_id for update;
  if not found then raise exception 'Report not found'; end if;
  if not public.can_review_incident(inc.department) then
    raise exception 'Only reviewers for this department can update the report' using errcode = '42501';
  end if;
  if inc.reporter_id = auth.uid() then raise exception 'You cannot review your own report' using errcode = '42501'; end if;
  if not public.incident_can_transition(inc.status, p_to) then
    raise exception 'Cannot move a report from % to %', inc.status, p_to;
  end if;
  if p_to in ('action_taken', 'unsubstantiated', 'false_report') and coalesce(trim(p_note), '') = '' then
    raise exception 'Record the outcome before closing the report';
  end if;
  update public.incidents set status = p_to, reviewed_by = auth.uid(),
         outcome_note = case when p_to = 'under_review' then outcome_note else trim(p_note) end
   where id = p_id;
  insert into public.incident_updates (incident_id, actor_id, kind, to_status, note)
  values (p_id, auth.uid(), 'status', p_to, nullif(trim(p_note), ''));
  perform public.audit('incident.transition', 'incident', p_id::text, jsonb_build_object('from', inc.status, 'to', p_to));
  msg := inc.ref_code || ': ' || case p_to
    when 'under_review' then 'now under review by the department'
    when 'action_taken' then 'reviewed — action taken'
    when 'unsubstantiated' then 'reviewed — could not be substantiated'
    when 'false_report' then 'reviewed — found to be false'
    else replace(p_to::text, '_', ' ') end;
  perform public.notify(inc.reporter_id, 'incident.status', msg, left(p_note, 140), '/incidents/' || p_id);
end $$;

create or replace function public.incident_add_note(p_id uuid, p_note text, p_internal boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare inc record;
begin
  select * into inc from public.incidents where id = p_id;
  if not found then raise exception 'Report not found'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Note cannot be empty'; end if;
  if public.can_review_incident(inc.department) and inc.reporter_id <> auth.uid() then
    insert into public.incident_updates (incident_id, actor_id, kind, note, is_internal) values (p_id, auth.uid(), 'note', trim(p_note), p_internal);
    if not p_internal then
      perform public.notify(inc.reporter_id, 'incident.status', inc.ref_code || ': new message from the department', left(p_note, 140), '/incidents/' || p_id);
    end if;
  elsif inc.reporter_id = auth.uid() then
    -- Reporters can add further information while the report is open; it is never internal.
    if inc.status not in ('submitted', 'under_review') then raise exception 'This report is closed'; end if;
    perform public.check_rate_limit('incident.note', 10, interval '1 day');
    insert into public.incident_updates (incident_id, actor_id, kind, note) values (p_id, auth.uid(), 'note', trim(p_note));
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end $$;

create or replace function public.incident_withdraw(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare inc record;
begin
  select * into inc from public.incidents where id = p_id for update;
  if not found or inc.reporter_id <> auth.uid() then raise exception 'Report not found'; end if;
  if inc.status <> 'submitted' then raise exception 'Only reports that are not yet under review can be withdrawn'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason for withdrawing'; end if;
  update public.incidents set status = 'withdrawn', outcome_note = trim(p_reason) where id = p_id;
  insert into public.incident_updates (incident_id, actor_id, kind, to_status, note) values (p_id, auth.uid(), 'status', 'withdrawn', trim(p_reason));
  perform public.audit('incident.withdraw', 'incident', p_id::text);
end $$;

-- Timeline: reviewers see names and internal notes; reporters see only "You" / "Department reviewer".
create view public.incident_timeline with (security_invoker = false) as
select u.id, u.incident_id, u.kind, u.to_status, u.note, u.created_at, u.is_internal,
       case
         when u.actor_id = auth.uid() then 'You'
         when u.actor_id = i.reporter_id then 'Reporter'
         when public.can_review_incident(i.department) then (select p.full_name from public.profiles p where p.id = u.actor_id)
         when u.actor_id is null then 'System'
         else 'Department reviewer'
       end as actor_label
  from public.incident_updates u
  join public.incidents i on i.id = u.incident_id
 where auth.uid() is not null
   and ((public.can_review_incident(i.department) and i.reporter_id <> auth.uid())
        or (i.reporter_id = auth.uid() and not u.is_internal));
revoke all on public.incident_timeline from anon;
grant select on public.incident_timeline to authenticated;

alter table public.incidents enable row level security;
alter table public.incident_updates enable row level security;
alter table public.incident_attachments enable row level security;

-- Writes go through the functions above; there are no insert/update/delete policies on these tables.
create policy incidents_select on public.incidents for select to authenticated
  using (reporter_id = auth.uid() or public.can_review_incident(department));
create policy incident_updates_select on public.incident_updates for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id and i.reporter_id <> auth.uid() and public.can_review_incident(i.department)));
create policy incident_attachments_select on public.incident_attachments for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id and (i.reporter_id = auth.uid() or public.can_review_incident(i.department))));
create policy incident_attachments_insert on public.incident_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and (storage.foldername(storage_path))[1] = auth.uid()::text
              and exists (select 1 from public.incidents i where i.id = incident_id and i.reporter_id = auth.uid() and i.status = 'submitted'));

-- Private evidence bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('incident-evidence', 'incident-evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
drop policy storage_insert_own_folder on storage.objects;
create policy storage_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-images', 'incident-evidence')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_select_incident on storage.objects for select to authenticated
  using (bucket_id = 'incident-evidence' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.incident_attachments a join public.incidents i on i.id = a.incident_id
                where a.storage_path = name and public.can_review_incident(i.department))));

alter publication supabase_realtime add table public.incidents;
