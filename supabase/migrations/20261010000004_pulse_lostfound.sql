-- CampusPulse issue reporting, Lost & Found, moderation, storage and realtime.

-- ---------------------------------------------------------------------------
-- CampusPulse
-- ---------------------------------------------------------------------------
create type public.pulse_category as enum (
  'water_sanitation', 'electricity_lighting', 'wifi_network', 'maintenance_infrastructure',
  'waste_management', 'wildlife', 'safety_hazard', 'other');
create type public.pulse_severity as enum ('low', 'medium', 'high', 'critical');
create type public.pulse_status as enum (
  'submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed');

create sequence public.pulse_ref_seq start 1001;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique default 'CP-' || nextval('public.pulse_ref_seq')::text,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  category public.pulse_category not null,
  subcategory text check (char_length(subcategory) <= 60),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  severity public.pulse_severity not null default 'medium',
  priority smallint not null default 0,
  is_safety boolean not null default false,
  location_label text not null check (char_length(location_label) between 2 and 120),
  approx_lat numeric(7, 4),
  approx_lng numeric(7, 4),
  status public.pulse_status not null default 'submitted',
  assigned_to uuid references public.profiles (id),
  duplicate_of uuid references public.reports (id),
  resolution_note text,
  closed_reason text,
  alert_message text,
  expires_at timestamptz,
  confirmations_count int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, priority desc, created_at desc);
create index reports_category_idx on public.reports (category, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);
create trigger reports_touch before update on public.reports for each row execute function public.touch_updated_at();

-- Precise coordinates: reporter and responders only.
create table public.report_locations (
  report_id uuid primary key references public.reports (id) on delete cascade,
  lat double precision not null,
  lng double precision not null
);

create table public.report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('status', 'note', 'assignment', 'alert', 'confirmation')),
  from_status public.pulse_status,
  to_status public.pulse_status,
  note text check (char_length(note) <= 2000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index report_updates_report_idx on public.report_updates (report_id, created_at);

create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  purpose text not null default 'evidence' check (purpose in ('evidence', 'resolution')),
  created_at timestamptz not null default now()
);

create table public.report_confirmations (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- Approximate distance in metres (equirectangular; fine at campus scale).
create or replace function public.approx_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select sqrt(power((lat2 - lat1) * 111320, 2) + power((lng2 - lng1) * 111320 * cos(radians((lat1 + lat2) / 2)), 2));
$$;

create or replace function public.pulse_priority(sev public.pulse_severity, cat public.pulse_category)
returns smallint language sql immutable as $$
  select (case sev when 'critical' then 40 when 'high' then 30 when 'medium' then 20 else 10 end
        + case when cat in ('wildlife', 'safety_hazard') then 15 when cat in ('electricity_lighting', 'water_sanitation') then 5 else 0 end)::smallint;
$$;

-- Legal lifecycle transitions (mirrored in src/lib/pulse.ts for UI hints and unit tests).
create or replace function public.pulse_can_transition(from_s public.pulse_status, to_s public.pulse_status)
returns boolean language sql immutable as $$
  select case from_s
    when 'submitted'    then to_s in ('under_review', 'verified', 'rejected', 'closed')
    when 'under_review' then to_s in ('verified', 'rejected', 'closed')
    when 'verified'     then to_s in ('assigned', 'in_progress', 'resolved', 'closed')
    when 'assigned'     then to_s in ('in_progress', 'resolved', 'closed')
    when 'in_progress'  then to_s in ('assigned', 'resolved', 'closed')
    when 'resolved'     then to_s in ('in_progress', 'closed')
    else false
  end;
$$;

-- Campus bounding box (generous) for the Coimbatore campus.
create or replace function public.within_campus(lat double precision, lng double precision)
returns boolean language sql immutable as $$
  select lat between 10.88 and 10.93 and lng between 76.88 and 76.93;
$$;

create or replace function public.pulse_find_similar(p_category public.pulse_category, p_lat double precision, p_lng double precision)
returns table (id uuid, ref_code text, title text, status public.pulse_status, location_label text, distance_m int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.ref_code, r.title, r.status, r.location_label,
         round(public.approx_distance_m(p_lat, p_lng, l.lat, l.lng))::int, r.created_at
    from public.reports r join public.report_locations l on l.report_id = r.id
   where r.category = p_category
     and r.status not in ('resolved', 'rejected', 'closed')
     and r.created_at > now() - interval '48 hours'
     and p_lat is not null and p_lng is not null
     and public.approx_distance_m(p_lat, p_lng, l.lat, l.lng) < 250
   order by 6 asc
   limit 5;
$$;

create or replace function public.pulse_submit(
  p_category public.pulse_category, p_subcategory text, p_title text, p_description text,
  p_severity public.pulse_severity, p_lat double precision, p_lng double precision, p_location_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid; safety boolean; r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.check_rate_limit('pulse.submit', 5, interval '1 hour');
  if (p_lat is null) <> (p_lng is null) then raise exception 'Provide both latitude and longitude'; end if;
  if p_lat is not null and not public.within_campus(p_lat, p_lng) then
    raise exception 'The selected location is outside the campus area';
  end if;
  if exists (select 1 from public.reports where reporter_id = auth.uid() and category = p_category
              and lower(title) = lower(trim(p_title)) and created_at > now() - interval '6 hours') then
    raise exception 'You already submitted this report recently';
  end if;
  safety := p_category in ('wildlife', 'safety_hazard') or p_severity = 'critical';
  insert into public.reports (reporter_id, category, subcategory, title, description, severity, priority, is_safety,
                              location_label, approx_lat, approx_lng, expires_at)
  values (auth.uid(), p_category, nullif(trim(p_subcategory), ''), trim(p_title), trim(p_description), p_severity,
          public.pulse_priority(p_severity, p_category), safety, trim(p_location_label),
          round(p_lat::numeric, 3), round(p_lng::numeric, 3),
          case when safety then now() + interval '12 hours' end)
  returning id into rid;
  if p_lat is not null then
    insert into public.report_locations (report_id, lat, lng) values (rid, p_lat, p_lng);
  end if;
  insert into public.report_updates (report_id, actor_id, kind, to_status, note)
  values (rid, auth.uid(), 'status', 'submitted', 'Report submitted');
  -- Alert responders: everything safety-related or high/critical immediately.
  if safety or p_severity in ('high', 'critical') then
    for r in select distinct user_id from public.user_roles where role in ('safety_responder', 'platform_admin') loop
      perform public.notify(r.user_id, 'pulse.new', 'New ' || p_severity::text || ' report: ' || trim(p_title),
        trim(p_location_label), '/pulse/' || rid);
    end loop;
  end if;
  return rid;
end $$;

create or replace function public.pulse_confirm(rid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare rep record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into rep from public.reports where id = rid;
  if not found then raise exception 'Report not found'; end if;
  if rep.reporter_id = auth.uid() then raise exception 'You submitted this report'; end if;
  if rep.status in ('resolved', 'rejected', 'closed') then raise exception 'This report is no longer active'; end if;
  insert into public.report_confirmations (report_id, user_id) values (rid, auth.uid());
  update public.reports set confirmations_count = confirmations_count + 1,
         priority = least(priority + 2, 80) where id = rid;
  insert into public.report_updates (report_id, actor_id, kind, note, is_internal)
  values (rid, auth.uid(), 'confirmation', 'Another person confirmed this issue', true);
exception when unique_violation then
  raise exception 'You already confirmed this report';
end $$;

create or replace function public.pulse_transition(rid uuid, p_to public.pulse_status, p_note text default null, p_assignee uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare rep record; r record; msg text;
begin
  if not public.is_responder() then raise exception 'Only authorised responders can update report status' using errcode = '42501'; end if;
  select * into rep from public.reports where id = rid for update;
  if not found then raise exception 'Report not found'; end if;
  if not public.pulse_can_transition(rep.status, p_to) then
    raise exception 'Cannot move a report from % to %', rep.status, p_to;
  end if;
  if p_to in ('rejected', 'closed') and coalesce(trim(p_note), '') = '' then
    raise exception 'A reason is required to reject or close a report';
  end if;
  if p_to = 'resolved' and coalesce(trim(p_note), '') = '' then
    raise exception 'Describe how the issue was resolved';
  end if;
  if p_to = 'assigned' then
    if p_assignee is null then raise exception 'Choose a responder to assign'; end if;
    if not exists (select 1 from public.user_roles where user_id = p_assignee and role in ('safety_responder', 'platform_admin')) then
      raise exception 'Assignee must be an authorised responder';
    end if;
  end if;
  update public.reports set
    status = p_to,
    assigned_to = case when p_to = 'assigned' then p_assignee else assigned_to end,
    resolution_note = case when p_to = 'resolved' then trim(p_note) else resolution_note end,
    closed_reason = case when p_to in ('rejected', 'closed') then trim(p_note) else closed_reason end,
    expires_at = case when p_to in ('resolved', 'rejected', 'closed') then null else expires_at end
  where id = rid;
  insert into public.report_updates (report_id, actor_id, kind, from_status, to_status, note)
  values (rid, auth.uid(), case when p_to = 'assigned' then 'assignment' else 'status' end, rep.status, p_to, nullif(trim(p_note), ''));
  perform public.audit('pulse.transition', 'report', rid::text, jsonb_build_object('from', rep.status, 'to', p_to, 'assignee', p_assignee));

  msg := rep.ref_code || ' is now ' || replace(p_to::text, '_', ' ');
  perform public.notify(rep.reporter_id, 'pulse.status', msg, left(p_note, 140), '/pulse/' || rid);
  if p_to = 'assigned' then
    perform public.notify(p_assignee, 'pulse.assigned', 'Assigned to you: ' || rep.ref_code || ' · ' || rep.title, rep.location_label, '/pulse/' || rid);
  end if;
  if p_to in ('verified', 'resolved') then
    for r in select user_id from public.report_confirmations where report_id = rid loop
      perform public.notify(r.user_id, 'pulse.status', msg, null, '/pulse/' || rid);
    end loop;
  end if;
end $$;

create or replace function public.pulse_add_note(rid uuid, p_note text, p_internal boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_responder() then raise exception 'Only responders can add notes' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Note cannot be empty'; end if;
  insert into public.report_updates (report_id, actor_id, kind, note, is_internal) values (rid, auth.uid(), 'note', trim(p_note), p_internal);
end $$;

-- Responder-issued campus alert for a verified hazard: notifies every user once.
create or replace function public.pulse_issue_alert(rid uuid, p_message text, p_hours int default 6)
returns int language plpgsql security definer set search_path = '' as $$
declare rep record; n int;
begin
  if not public.is_responder() then raise exception 'Only responders can issue alerts' using errcode = '42501'; end if;
  select * into rep from public.reports where id = rid for update;
  if rep.status not in ('verified', 'assigned', 'in_progress') then raise exception 'Only verified, active reports can trigger alerts'; end if;
  if rep.alert_message is not null and rep.expires_at > now() then raise exception 'An alert is already active for this report'; end if;
  if char_length(coalesce(trim(p_message), '')) < 10 then raise exception 'Alert message is too short'; end if;
  update public.reports set alert_message = trim(p_message), expires_at = now() + make_interval(hours => greatest(1, least(p_hours, 48)))
   where id = rid;
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'pulse.alert', 'Campus safety alert: ' || rep.location_label, trim(p_message), '/pulse/' || rid
    from public.profiles p where p.id <> auth.uid();
  get diagnostics n = row_count;
  insert into public.report_updates (report_id, actor_id, kind, note) values (rid, auth.uid(), 'alert', trim(p_message));
  perform public.audit('pulse.alert', 'report', rid::text, jsonb_build_object('recipients', n));
  return n;
end $$;

create or replace function public.pulse_mark_duplicate(rid uuid, p_of uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare rep record; target record;
begin
  if not public.is_responder() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if rid = p_of then raise exception 'A report cannot duplicate itself'; end if;
  select * into rep from public.reports where id = rid for update;
  select * into target from public.reports where id = p_of;
  if target.id is null then raise exception 'Original report not found'; end if;
  if rep.status in ('resolved', 'rejected', 'closed') then raise exception 'Report is already closed'; end if;
  update public.reports set status = 'closed', duplicate_of = p_of, closed_reason = 'Duplicate of ' || target.ref_code, expires_at = null where id = rid;
  update public.reports set confirmations_count = confirmations_count + 1 + rep.confirmations_count where id = p_of;
  insert into public.report_confirmations (report_id, user_id)
  select p_of, user_id from public.report_confirmations where report_id = rid
  union select p_of, rep.reporter_id
  on conflict do nothing;
  insert into public.report_updates (report_id, actor_id, kind, from_status, to_status, note)
  values (rid, auth.uid(), 'status', rep.status, 'closed', 'Merged into ' || target.ref_code);
  perform public.notify(rep.reporter_id, 'pulse.status', rep.ref_code || ' was merged into ' || target.ref_code,
    'You will receive updates on the original report.', '/pulse/' || p_of);
  perform public.audit('pulse.duplicate', 'report', rid::text, jsonb_build_object('of', p_of));
end $$;

-- Close safety warnings past their expiry (called from the responder dashboard / cron).
create or replace function public.pulse_expire_stale()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with expired as (
    update public.reports set status = 'closed', closed_reason = 'Warning expired without further reports', expires_at = null
     where is_safety and expires_at < now() and status in ('submitted', 'under_review', 'verified')
       and alert_message is null
    returning id, status)
  insert into public.report_updates (report_id, kind, to_status, note)
  select id, 'status', 'closed', 'Automatically closed: warning expired' from expired;
  get diagnostics n = row_count;
  update public.reports set alert_message = null where alert_message is not null and expires_at < now();
  return n;
end $$;

create or replace function public.can_see_report(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = rid and (
    r.reporter_id = auth.uid() or public.is_responder()
    or r.status in ('verified', 'assigned', 'in_progress', 'resolved')));
$$;

-- Public feed: safe columns only; no reporter identity, approximate coordinates.
create view public.pulse_feed with (security_invoker = false) as
select r.id, r.ref_code, r.category, r.subcategory, r.title, r.description, r.severity, r.priority, r.is_safety,
       r.location_label, r.approx_lat, r.approx_lng, r.status, r.duplicate_of, r.resolution_note, r.closed_reason,
       case when r.expires_at > now() then r.alert_message end as alert_message,
       r.expires_at, r.confirmations_count, r.is_demo, r.created_at, r.updated_at,
       (r.reporter_id = auth.uid()) as is_mine,
       exists (select 1 from public.report_confirmations c where c.report_id = r.id and c.user_id = auth.uid()) as confirmed_by_me,
       (r.is_safety and r.status in ('submitted', 'under_review', 'verified', 'assigned', 'in_progress')
         and (r.expires_at is null or r.expires_at > now())) as is_active_warning
  from public.reports r
 where auth.uid() is not null
   and (r.reporter_id = auth.uid() or public.is_responder() or r.status in ('verified', 'assigned', 'in_progress', 'resolved'));
revoke all on public.pulse_feed from anon;
grant select on public.pulse_feed to authenticated;

-- ---------------------------------------------------------------------------
-- Lost & Found
-- ---------------------------------------------------------------------------
create type public.lf_kind as enum ('lost', 'found');
create type public.lf_category as enum ('id_card', 'wallet', 'keys', 'books', 'bag', 'electronics', 'clothing', 'other');
create type public.lf_status as enum ('open', 'claimed', 'returned', 'closed', 'expired', 'removed');
create type public.lf_claim_status as enum ('pending', 'approved', 'rejected', 'withdrawn', 'disputed', 'completed');

create table public.lost_found_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind public.lf_kind not null,
  category public.lf_category not null,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1500),
  location_label text not null check (char_length(location_label) between 2 and 120),
  occurred_on date not null check (occurred_on <= current_date + 1),
  image_path text,
  contact_pref text not null default 'in_app' check (contact_pref in ('in_app', 'security_office')),
  status public.lf_status not null default 'open',
  is_sensitive boolean not null default false,
  flagged boolean not null default false,
  moderation_note text,
  is_demo boolean not null default false,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lf_items_status_idx on public.lost_found_items (status, kind, category, occurred_on desc);
create index lf_items_title_trgm_idx on public.lost_found_items using gin ((title || ' ' || description) extensions.gin_trgm_ops);
create trigger lf_items_touch before update on public.lost_found_items for each row execute function public.touch_updated_at();
create trigger lf_items_rate_limit before insert on public.lost_found_items
  for each row execute function public.rate_limit_insert('lf.create', '10', '1 day');

-- Hidden verification details recorded by the poster (e.g. a sticker, contents) — never public.
create table public.lost_found_secrets (
  item_id uuid primary key references public.lost_found_items (id) on delete cascade,
  details text not null check (char_length(details) <= 1000)
);

create table public.lost_found_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.lost_found_items (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  lost_item_id uuid references public.lost_found_items (id) on delete set null,
  details text not null check (char_length(details) between 10 and 1500),
  status public.lf_claim_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  review_note text check (char_length(review_note) <= 1000),
  dispute_reason text check (char_length(dispute_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index lf_claims_one_active on public.lost_found_claims (item_id, claimant_id) where status in ('pending', 'approved', 'disputed');
create trigger lf_claims_touch before update on public.lost_found_claims for each row execute function public.touch_updated_at();

-- Redact long digit runs (ID / phone / serial numbers) from public text.
create or replace function public.redact_sensitive(t text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(t, '[0-9][0-9 -]{5,}[0-9]', '[number hidden]', 'g'),
           '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email hidden]', 'g');
$$;

create or replace function public.lf_items_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.title := public.redact_sensitive(new.title);
  new.description := public.redact_sensitive(new.description);
  new.location_label := public.redact_sensitive(new.location_label);
  if new.category in ('id_card', 'wallet', 'electronics') then new.is_sensitive := true; end if;
  if new.is_sensitive then new.contact_pref := 'security_office'; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.owner_id := auth.uid();
      new.status := 'open';
      new.flagged := false;
    end if;
  elsif auth.uid() is not null and current_setting('app.lf_rpc', true) is distinct from 'on' then
    if new.owner_id <> old.owner_id or new.kind <> old.kind or new.flagged <> old.flagged
       or new.moderation_note is distinct from old.moderation_note then
      raise exception 'These fields cannot be changed';
    end if;
    if new.status <> old.status and not (old.status = 'open' and new.status = 'closed') then
      raise exception 'Use the claim workflow to change item status';
    end if;
  end if;
  return new;
end $$;
create trigger lf_items_guard before insert or update on public.lost_found_items for each row execute function public.lf_items_guard();

-- Notify owners of plausible opposite-kind matches (category + trigram similarity + 14-day window).
create or replace function public.lf_notify_matches()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select i.id, i.owner_id, i.title
             from public.lost_found_items i
            where i.kind <> new.kind and i.category = new.category and i.status = 'open'
              and i.owner_id <> new.owner_id
              and abs(i.occurred_on - new.occurred_on) <= 14
              and extensions.similarity(i.title || ' ' || i.description, new.title || ' ' || new.description) > 0.12
            limit 10 loop
    perform public.notify(r.owner_id, 'lf.match', 'Possible match for "' || r.title || '"',
      'A new ' || new.kind::text || ' report may correspond to your item.', '/lost-found/' || r.id || '#matches');
  end loop;
  return new;
end $$;
create trigger lf_items_matches after insert on public.lost_found_items for each row execute function public.lf_notify_matches();

create or replace function public.lf_submit_claim(p_item uuid, p_details text, p_lost_item uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare it record; cid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into it from public.lost_found_items where id = p_item for update;
  if not found or it.status = 'removed' then raise exception 'Item not found'; end if;
  if it.kind <> 'found' then raise exception 'Claims can only be made on found items'; end if;
  if it.status <> 'open' then raise exception 'This item is no longer accepting claims'; end if;
  if it.owner_id = auth.uid() then raise exception 'You posted this item'; end if;
  if p_lost_item is not null and not exists (select 1 from public.lost_found_items where id = p_lost_item and owner_id = auth.uid() and kind = 'lost') then
    raise exception 'Linked lost report must be your own';
  end if;
  perform public.check_rate_limit('lf.claim', 5, interval '1 day');
  insert into public.lost_found_claims (item_id, claimant_id, lost_item_id, details)
  values (p_item, auth.uid(), p_lost_item, trim(p_details)) returning id into cid;
  perform public.notify(it.owner_id, 'lf.claim', 'New ownership claim for "' || it.title || '"',
    'Review the private details to verify ownership.', '/lost-found/' || p_item);
  return cid;
exception when unique_violation then
  raise exception 'You already have an active claim on this item';
end $$;

create or replace function public.lf_review_claim(p_claim uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; it record; instructions text;
begin
  select * into c from public.lost_found_claims where id = p_claim for update;
  if not found then raise exception 'Claim not found'; end if;
  select * into it from public.lost_found_items where id = c.item_id for update;
  if it.owner_id <> auth.uid() and not public.is_moderator() then raise exception 'Only the finder or a moderator can review claims' using errcode = '42501'; end if;
  if c.status not in ('pending', 'disputed') then raise exception 'This claim has already been reviewed'; end if;
  if p_approve and it.status <> 'open' then raise exception 'Another claim was already approved for this item'; end if;
  perform set_config('app.lf_rpc', 'on', true);
  update public.lost_found_claims set status = case when p_approve then 'approved'::public.lf_claim_status else 'rejected' end,
         reviewer_id = auth.uid(), review_note = left(p_note, 1000) where id = p_claim;
  if p_approve then
    update public.lost_found_items set status = 'claimed' where id = it.id;
    instructions := case when it.is_sensitive
      then 'Collect it from the campus security office with your student ID. Do not share ID numbers in chat.'
      else 'Arrange a handover in a public campus location (e.g. the library entrance) via in-app messages.' end;
  end if;
  perform public.notify(c.claimant_id, 'lf.claim.decided',
    'Your claim for "' || it.title || '" was ' || case when p_approve then 'approved' else 'not approved' end,
    coalesce(instructions, left(p_note, 140)), '/lost-found/' || it.id);
  if c.status = 'disputed' or it.owner_id <> auth.uid() then
    perform public.audit('lf.claim.review', 'lf_claim', p_claim::text, jsonb_build_object('approve', p_approve));
  end if;
end $$;

create or replace function public.lf_complete_handover(p_claim uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; it record;
begin
  select * into c from public.lost_found_claims where id = p_claim for update;
  if not found or c.status <> 'approved' then raise exception 'Only approved claims can be completed'; end if;
  select * into it from public.lost_found_items where id = c.item_id;
  if it.owner_id <> auth.uid() and not public.is_moderator() then raise exception 'Only the finder or a moderator can confirm the handover' using errcode = '42501'; end if;
  perform set_config('app.lf_rpc', 'on', true);
  update public.lost_found_claims set status = 'completed' where id = p_claim;
  update public.lost_found_claims set status = 'rejected', review_note = 'Item returned to another claimant'
   where item_id = c.item_id and id <> p_claim and status in ('pending', 'disputed');
  update public.lost_found_items set status = 'returned' where id in (c.item_id, c.lost_item_id);
  perform public.notify(c.claimant_id, 'lf.returned', '"' || it.title || '" marked as returned', 'Glad it found its way back!', '/lost-found/' || it.id);
end $$;

create or replace function public.lf_withdraw_claim(p_claim uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.lost_found_claims where id = p_claim and claimant_id = auth.uid() for update;
  if not found or c.status not in ('pending', 'approved', 'disputed') then raise exception 'Claim cannot be withdrawn'; end if;
  perform set_config('app.lf_rpc', 'on', true);
  update public.lost_found_claims set status = 'withdrawn' where id = p_claim;
  if c.status = 'approved' then update public.lost_found_items set status = 'open' where id = c.item_id; end if;
end $$;

create or replace function public.lf_dispute_claim(p_claim uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; r record;
begin
  select * into c from public.lost_found_claims where id = p_claim and claimant_id = auth.uid() for update;
  if not found or c.status <> 'rejected' then raise exception 'Only rejected claims can be disputed'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 10 then raise exception 'Explain why you are disputing this decision'; end if;
  update public.lost_found_claims set status = 'disputed', dispute_reason = trim(p_reason) where id = p_claim;
  for r in select distinct user_id from public.user_roles where role in ('moderator', 'platform_admin') loop
    perform public.notify(r.user_id, 'lf.dispute', 'Lost & Found claim disputed', left(p_reason, 140), '/admin?tab=lostfound');
  end loop;
end $$;

create or replace function public.lf_moderate_item(p_item uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  select * into it from public.lost_found_items where id = p_item for update;
  if not found then raise exception 'Item not found'; end if;
  perform set_config('app.lf_rpc', 'on', true);
  update public.lost_found_items set
    status = case p_action when 'remove' then 'removed'::public.lf_status when 'expire' then 'expired'
                           when 'resolve' then 'closed' when 'restore' then 'open' else status end,
    flagged = case when p_action in ('restore', 'clear_flag') then false else flagged end,
    moderation_note = coalesce(nullif(trim(p_note), ''), moderation_note)
  where id = p_item;
  perform public.audit('lf.moderate', 'lf_item', p_item::text, jsonb_build_object('action', p_action, 'note', p_note));
  perform public.notify(it.owner_id, 'lf.moderated', 'A moderator updated "' || it.title || '"', p_note, '/lost-found/' || p_item);
end $$;

create or replace function public.lf_expire_stale()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform set_config('app.lf_rpc', 'on', true);
  update public.lost_found_items set status = 'expired' where status = 'open' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Moderation reports (flags) across the platform
-- ---------------------------------------------------------------------------
create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'message', 'server', 'lf_item', 'profile', 'pulse_report', 'resource')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index moderation_reports_status_idx on public.moderation_reports (status, created_at desc);
create trigger moderation_reports_rate_limit before insert on public.moderation_reports
  for each row execute function public.rate_limit_insert('flag', '20', '1 day');

create or replace function public.on_moderation_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.target_type = 'lf_item' then
    perform set_config('app.lf_rpc', 'on', true);
    update public.lost_found_items set flagged = true where id = new.target_id;
  end if;
  for r in select distinct user_id from public.user_roles where role in ('moderator', 'platform_admin') loop
    perform public.notify(r.user_id, 'moderation', 'New ' || replace(new.target_type, '_', ' ') || ' flagged', left(new.reason, 140), '/admin');
  end loop;
  return new;
end $$;
create trigger moderation_reports_after_insert after insert on public.moderation_reports for each row execute function public.on_moderation_report();

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
      when 'lf_item' then
        perform set_config('app.lf_rpc', 'on', true);
        update public.lost_found_items set status = 'removed', moderation_note = p_note where id = m.target_id;
      when 'resource' then delete from public.resources where id = m.target_id;
      when 'server' then delete from public.servers where id = m.target_id;
      else null;
    end case;
  end if;
  update public.moderation_reports set status = p_status, resolution_note = p_note, resolved_by = auth.uid()
   where target_type = m.target_type and target_id = m.target_id and status = 'open';
  perform public.audit('moderation.' || p_status, m.target_type, m.target_id::text,
    jsonb_build_object('report', p_id, 'removed', p_remove_content, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.report_locations enable row level security;
alter table public.report_updates enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.lost_found_items enable row level security;
alter table public.lost_found_secrets enable row level security;
alter table public.lost_found_claims enable row level security;
alter table public.moderation_reports enable row level security;

-- Raw reports (with reporter identity) only for the reporter and responders; others use pulse_feed.
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_responder());
create policy report_locations_select on public.report_locations for select to authenticated
  using (public.is_responder() or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()));
create policy report_updates_select on public.report_updates for select to authenticated
  using (public.is_responder() or (not is_internal and public.can_see_report(report_id)));
create policy report_attachments_select on public.report_attachments for select to authenticated
  using (uploaded_by = auth.uid() or public.is_responder()
         or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()));
create policy report_attachments_insert on public.report_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and (
    (purpose = 'evidence' and exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid()))
    or (purpose = 'resolution' and public.is_responder()))
    and storage_path like auth.uid()::text || '/%');
create policy report_confirmations_select on public.report_confirmations for select to authenticated
  using (user_id = auth.uid() or public.is_responder());

create policy lf_items_select on public.lost_found_items for select to authenticated
  using (status <> 'removed' or owner_id = auth.uid() or public.is_moderator());
create policy lf_items_insert on public.lost_found_items for insert to authenticated with check (owner_id = auth.uid());
create policy lf_items_update on public.lost_found_items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lf_items_delete on public.lost_found_items for delete to authenticated
  using ((owner_id = auth.uid() and status in ('open', 'closed', 'expired')) or public.is_moderator());

create policy lf_secrets_all on public.lost_found_secrets for all to authenticated
  using (public.is_moderator() or exists (select 1 from public.lost_found_items i where i.id = item_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.lost_found_items i where i.id = item_id and i.owner_id = auth.uid()));

create policy lf_claims_select on public.lost_found_claims for select to authenticated
  using (claimant_id = auth.uid() or public.is_moderator()
         or exists (select 1 from public.lost_found_items i where i.id = item_id and i.owner_id = auth.uid()));

create policy moderation_reports_select on public.moderation_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy moderation_reports_insert on public.moderation_reports for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public buckets for avatars/post images, private for evidence and L&F photos.
-- Uploads must live under a folder named after the uploader's user id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('pulse-evidence', 'pulse-evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('lostfound', 'lostfound', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy storage_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-images', 'pulse-evidence', 'lostfound')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_update_own on storage.objects for update to authenticated
  using (owner_id = auth.uid()::text) with check ((storage.foldername(name))[1] = auth.uid()::text);
create policy storage_delete_own on storage.objects for delete to authenticated using (owner_id = auth.uid()::text);
create policy storage_select_public on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'post-images'));
create policy storage_select_pulse on storage.objects for select to authenticated
  using (bucket_id = 'pulse-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_responder()));
-- L&F photos: owner/moderators always; others only for non-sensitive, visible items.
create policy storage_select_lostfound on storage.objects for select to authenticated
  using (bucket_id = 'lostfound' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_moderator()
    or exists (select 1 from public.lost_found_items i where i.image_path = name and not i.is_sensitive and i.status <> 'removed')));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.direct_messages, public.notifications, public.reports;
