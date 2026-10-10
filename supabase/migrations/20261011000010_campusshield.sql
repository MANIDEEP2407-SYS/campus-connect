-- CampusShield: AI-assisted (human-decided) harmful-content moderation.
--
-- Pipeline: content insert → moderation_jobs (DB trigger, cannot be bypassed) → server worker
-- (service role) calls the AI provider → shield_ingest_scan() records the scan and, when the policy
-- says so, opens/updates a moderation case → moderators decide via shield_decide() → authors are
-- notified and may appeal. AI output is stored separately from the policy decision, the human review
-- status and the final decision. Private DMs are never scanned unless a participant reports one.

create type public.shield_category as enum (
  'targeted_harassment', 'repeated_bullying', 'threats_intimidation', 'hate_discrimination',
  'sexual_harassment', 'doxxing', 'other_harmful', 'none');
create type public.shield_risk as enum ('low', 'review', 'high', 'critical');
create type public.shield_content as enum ('post', 'comment', 'message', 'direct_message');
create type public.shield_case_status as enum ('open', 'in_review', 'escalated', 'resolved', 'dismissed');
create type public.shield_decision as enum (
  'no_action', 'dismissed_false_positive', 'warning', 'edit_requested', 'removed', 'restricted', 'escalated');

-- ---------------------------------------------------------------------------
-- Content visibility state (held = withheld pending review; removed = removed by moderators)
-- ---------------------------------------------------------------------------
alter table public.posts add column shield_state text not null default 'visible' check (shield_state in ('visible', 'held', 'removed'));
alter table public.comments add column shield_state text not null default 'visible' check (shield_state in ('visible', 'held', 'removed'));
alter table public.messages add column shield_state text not null default 'visible' check (shield_state in ('visible', 'held', 'removed'));

create or replace function public.shield_state_guard()
returns trigger language plpgsql as $$
begin
  if new.shield_state is distinct from old.shield_state
     and current_setting('app.shield', true) is distinct from 'on'
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Moderation state can only be changed by CampusShield' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger posts_shield_guard before update on public.posts for each row execute function public.shield_state_guard();
create trigger comments_shield_guard before update on public.comments for each row execute function public.shield_state_guard();
create trigger messages_shield_guard before update on public.messages for each row execute function public.shield_state_guard();

-- ---------------------------------------------------------------------------
-- Blocks / mutes
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'block' check (kind in ('block', 'mute')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy user_blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where kind = 'block'
                  and ((blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)));
$$;

-- ---------------------------------------------------------------------------
-- Posting restrictions (temporary, moderator-imposed)
-- ---------------------------------------------------------------------------
create table public.user_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'posting' check (kind in ('posting')),
  reason text not null check (char_length(reason) between 5 and 1000),
  case_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index user_restrictions_user_idx on public.user_restrictions (user_id, ends_at desc);
alter table public.user_restrictions enable row level security;
create policy user_restrictions_select on public.user_restrictions for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create or replace function public.is_posting_restricted(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_restrictions
                  where user_id = uid and kind = 'posting' and lifted_at is null and now() between starts_at and ends_at);
$$;

-- Re-create content policies: hide held/removed content from others; enforce restrictions and blocks.
drop policy posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (shield_state = 'visible' or author_id = auth.uid() or public.is_moderator());
drop policy posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and (club_id is null or public.is_club_coordinator(club_id))
              and not public.is_posting_restricted(auth.uid()));

drop policy comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (shield_state = 'visible' or author_id = auth.uid() or public.is_moderator());
drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and not public.is_posting_restricted(auth.uid())
              and not public.is_blocked_between(auth.uid(), (select p.author_id from public.posts p where p.id = post_id)));

drop policy messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.can_read_server(server_id) and (shield_state = 'visible' or author_id = auth.uid() or public.is_moderator()));
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid() and not public.is_posting_restricted(auth.uid())
              and public.is_server_member((select c.server_id from public.channels c where c.id = channel_id)));

-- DMs: blocked pairs cannot message each other.
drop policy dms_insert on public.direct_messages;
create policy dms_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id)
              and not exists (select 1 from public.conversation_members m
                               where m.conversation_id = direct_messages.conversation_id and m.user_id <> auth.uid()
                                 and public.is_blocked_between(auth.uid(), m.user_id)));

create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_other = auth.uid() then raise exception 'You cannot message yourself'; end if;
  if public.is_blocked_between(auth.uid(), p_other) then raise exception 'You cannot message this person'; end if;
  select cm1.conversation_id into cid
    from public.conversation_members cm1
    join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id and cm2.user_id = p_other
   where cm1.user_id = auth.uid()
     and (select count(*) from public.conversation_members c where c.conversation_id = cm1.conversation_id) = 2
   limit 1;
  if cid is not null then return cid; end if;
  if not exists (select 1 from public.profiles where id = p_other and allow_dms) and not public.is_moderator() then
    raise exception 'This person is not accepting direct messages';
  end if;
  insert into public.conversations default values returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, p_other);
  return cid;
end $$;

-- ---------------------------------------------------------------------------
-- Scan jobs (created by triggers — scanning cannot be skipped by calling the API directly)
-- ---------------------------------------------------------------------------
create table public.moderation_jobs (
  id bigint generated always as identity primary key,
  content_type public.shield_content not null,
  content_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (content_type, content_id)
);
create index moderation_jobs_pending_idx on public.moderation_jobs (status, created_at) where status <> 'done';
alter table public.moderation_jobs enable row level security; -- no policies: service role only

create or replace function public.shield_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ctype public.shield_content := tg_argv[0]::public.shield_content;
begin
  if tg_op = 'UPDATE' and new.body is not distinct from old.body then return new; end if;
  if ctype = 'message' and new.deleted_at is not null then return new; end if;
  insert into public.moderation_jobs (content_type, content_id) values (ctype, new.id)
  on conflict (content_type, content_id) do update set status = 'pending', attempts = 0, last_error = null, processed_at = null;
  return new;
end $$;
create trigger posts_shield_enqueue after insert or update of body on public.posts for each row execute function public.shield_enqueue('post');
create trigger comments_shield_enqueue after insert on public.comments for each row execute function public.shield_enqueue('comment');
create trigger messages_shield_enqueue after insert or update of body on public.messages for each row execute function public.shield_enqueue('message');

-- ---------------------------------------------------------------------------
-- Scans (model output only; never a finding)
-- ---------------------------------------------------------------------------
create table public.moderation_scans (
  id uuid primary key default gen_random_uuid(),
  content_type public.shield_content not null,
  content_id uuid not null,
  provider text not null,              -- 'openai' | 'mock' (development mock — not AI)
  model text,
  status text not null check (status in ('ok', 'error')),
  provider_flagged boolean,
  provider_scores jsonb,               -- raw category scores returned by the provider
  mapped_scores jsonb,                 -- CampusShield category → score
  model_category public.shield_category,
  policy_risk public.shield_risk,      -- result of applying configured thresholds
  explanation text,
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index moderation_scans_content_idx on public.moderation_scans (content_type, content_id, created_at desc);
alter table public.moderation_scans enable row level security;
create policy moderation_scans_select on public.moderation_scans for select to authenticated using (public.is_moderator());

-- ---------------------------------------------------------------------------
-- Cases (one open case per content item; repeated reports are linked, not duplicated)
-- ---------------------------------------------------------------------------
create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  content_type public.shield_content not null,
  content_id uuid not null,
  content_author_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  context jsonb not null default '{}',
  content_excerpt text,                -- for moderator review/audit; purged by retention policy
  source text not null check (source in ('ai', 'report', 'ai+report')),
  category public.shield_category not null default 'none',
  risk_level public.shield_risk not null default 'review',
  priority int not null default 0,
  model_provider text,
  model_scores jsonb,
  model_explanation text,
  scan_id uuid references public.moderation_scans (id) on delete set null,
  report_count int not null default 0,
  pattern_evidence jsonb not null default '{}',
  review_status public.shield_case_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  decision public.shield_decision,
  decision_reason text,                -- shown to the content author
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index moderation_cases_one_active on public.moderation_cases (content_type, content_id)
  where review_status in ('open', 'in_review', 'escalated');
create index moderation_cases_queue_idx on public.moderation_cases (review_status, priority desc, created_at desc);
create index moderation_cases_author_idx on public.moderation_cases (content_author_id, target_user_id, created_at desc);
create trigger moderation_cases_touch before update on public.moderation_cases for each row execute function public.touch_updated_at();
alter table public.moderation_cases enable row level security;
create policy moderation_cases_select on public.moderation_cases for select to authenticated using (public.is_moderator());

alter table public.user_restrictions add constraint user_restrictions_case_fk foreign key (case_id) references public.moderation_cases (id) on delete set null;

create table public.moderation_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.moderation_cases (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,   -- null = system
  event_type text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index moderation_events_case_idx on public.moderation_events (case_id, created_at);
alter table public.moderation_events enable row level security;
create policy moderation_events_select on public.moderation_events for select to authenticated using (public.is_moderator());

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.moderation_cases (id) on delete cascade,
  appellant_id uuid not null references public.profiles (id) on delete cascade,
  statement text not null check (char_length(statement) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.moderation_appeals enable row level security;
create policy moderation_appeals_select on public.moderation_appeals for select to authenticated
  using (appellant_id = auth.uid() or public.is_moderator());

-- User reports: reuse moderation_reports, adding a category, DM support and the case link.
alter table public.moderation_reports
  add column category text check (category in ('harassment', 'threat', 'hate', 'sexual_harassment', 'personal_info', 'spam', 'self_harm', 'other')),
  add column case_id uuid references public.moderation_cases (id) on delete set null;
alter table public.moderation_reports drop constraint moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'direct_message', 'server', 'lf_item', 'profile', 'pulse_report', 'resource'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.shield_set_content_state(p_type public.shield_content, p_id uuid, p_state text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.shield', 'on', true);
  case p_type
    when 'post' then update public.posts set shield_state = p_state where id = p_id;
    when 'comment' then update public.comments set shield_state = p_state where id = p_id;
    when 'message' then update public.messages set shield_state = p_state where id = p_id;
    else null; -- DMs are never hidden by CampusShield; participants can block instead
  end case;
end $$;

-- Resolve author / target / context / excerpt for a content item.
create or replace function public.shield_content_facts(p_type public.shield_content, p_id uuid)
returns table (author_id uuid, target_id uuid, context jsonb, excerpt text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_type = 'post' then
    return query select p.author_id, null::uuid, jsonb_build_object('club_id', p.club_id), left(p.body, 600) from public.posts p where p.id = p_id;
  elsif p_type = 'comment' then
    return query select c.author_id, p.author_id, jsonb_build_object('post_id', c.post_id, 'post_excerpt', left(p.body, 200)), left(c.body, 600)
      from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  elsif p_type = 'message' then
    return query select m.author_id, r.author_id, jsonb_build_object('server_id', m.server_id, 'channel_id', m.channel_id), left(m.body, 600)
      from public.messages m left join public.messages r on r.id = m.reply_to where m.id = p_id;
  else
    return query select d.sender_id,
      (select cm.user_id from public.conversation_members cm where cm.conversation_id = d.conversation_id and cm.user_id <> d.sender_id limit 1),
      jsonb_build_object('conversation', 'private (reported by a participant)'), left(d.body, 600)
      from public.direct_messages d where d.id = p_id;
  end if;
end $$;

create or replace function public.shield_risk_weight(r public.shield_risk)
returns int language sql immutable as $$
  select case r when 'critical' then 30 when 'high' then 20 when 'review' then 10 else 0 end;
$$;

-- Notify moderators (and admins for critical) about a case.
create or replace function public.shield_notify_moderators(p_case uuid, p_title text, p_body text, p_admins_only boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select distinct user_id from public.user_roles
            where role = 'platform_admin' or (not p_admins_only and role = 'moderator') loop
    insert into public.notifications (user_id, type, title, body, link)
    values (r.user_id, 'shield.case', p_title, p_body, '/shield/' || p_case);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Ingest a scan (service role only). Applies dedupe, repeated-targeting evidence and holds.
-- ---------------------------------------------------------------------------
create or replace function public.shield_ingest_scan(
  p_type public.shield_content, p_id uuid, p_provider text, p_model text, p_status text,
  p_flagged boolean, p_provider_scores jsonb, p_mapped jsonb, p_category public.shield_category,
  p_risk public.shield_risk, p_explanation text, p_error text, p_latency int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sid uuid; f record; cid uuid; existing record; prior_confirmed int := 0; open_other int := 0; prior_warnings int := 0;
  cat public.shield_category := p_category; evidence jsonb := '{}'; prio int; created boolean := false;
begin
  insert into public.moderation_scans (content_type, content_id, provider, model, status, provider_flagged, provider_scores,
                                       mapped_scores, model_category, policy_risk, explanation, error, latency_ms)
  values (p_type, p_id, p_provider, p_model, p_status, p_flagged, p_provider_scores, p_mapped, p_category, p_risk, p_explanation, p_error, p_latency)
  returning id into sid;

  update public.moderation_jobs set status = case when p_status = 'ok' then 'done' else 'error' end,
         attempts = attempts + 1, last_error = p_error, processed_at = now()
   where content_type = p_type and content_id = p_id;

  -- Errors never produce classifications; low risk never opens a case.
  if p_status <> 'ok' then return jsonb_build_object('scan_id', sid, 'case_id', null); end if;

  select * into f from public.shield_content_facts(p_type, p_id);
  select * into existing from public.moderation_cases
   where content_type = p_type and content_id = p_id and review_status in ('open', 'in_review', 'escalated');

  if p_risk = 'low' and existing.id is null then return jsonb_build_object('scan_id', sid, 'case_id', null); end if;

  -- Repeated-targeting evidence: only from prior *reviewed* outcomes and other open cases
  -- involving the same author → target pair. A single message is never "repeated" on its own.
  if f.author_id is not null and cat in ('targeted_harassment', 'threats_intimidation', 'sexual_harassment', 'hate_discrimination') then
    select count(*) into prior_warnings from public.moderation_cases
     where content_author_id = f.author_id and decision in ('warning', 'removed', 'restricted') and reviewed_at > now() - interval '180 days';
    if f.target_id is not null then
      select count(*) into prior_confirmed from public.moderation_cases
       where content_author_id = f.author_id and target_user_id = f.target_id
         and decision in ('warning', 'removed', 'restricted') and reviewed_at > now() - interval '90 days';
      select count(*) into open_other from public.moderation_cases
       where content_author_id = f.author_id and target_user_id = f.target_id
         and review_status in ('open', 'in_review', 'escalated') and not (content_type = p_type and content_id = p_id);
    end if;
    if prior_confirmed > 0 or open_other >= 1 then
      cat := 'repeated_bullying';
    end if;
    evidence := jsonb_build_object('prior_actioned_cases_same_target', prior_confirmed,
                                   'other_open_cases_same_target', open_other,
                                   'prior_actioned_cases_author', prior_warnings,
                                   'model_category', p_category);
  end if;

  prio := public.shield_risk_weight(p_risk) + case when cat = 'repeated_bullying' then 5 else 0 end + least(prior_warnings, 3) * 2;

  if existing.id is null then
    insert into public.moderation_cases (content_type, content_id, content_author_id, target_user_id, context, content_excerpt,
                                         source, category, risk_level, priority, model_provider, model_scores, model_explanation,
                                         scan_id, pattern_evidence)
    values (p_type, p_id, f.author_id, f.target_id, coalesce(f.context, '{}'), f.excerpt, 'ai', cat, p_risk, prio,
            p_provider, p_mapped, p_explanation, sid, evidence)
    returning id into cid;
    created := true;
    insert into public.moderation_events (case_id, event_type, details)
    values (cid, 'ai_flagged', jsonb_build_object('provider', p_provider, 'risk', p_risk, 'category', cat));
  else
    cid := existing.id;
    update public.moderation_cases set
      source = case when existing.source = 'report' then 'ai+report' else existing.source end,
      category = case when existing.category = 'none' or public.shield_risk_weight(p_risk) >= public.shield_risk_weight(existing.risk_level) then cat else existing.category end,
      risk_level = case when public.shield_risk_weight(p_risk) > public.shield_risk_weight(existing.risk_level) then p_risk else existing.risk_level end,
      priority = greatest(existing.priority, prio + existing.report_count * 2),
      model_provider = p_provider, model_scores = p_mapped, model_explanation = p_explanation, scan_id = sid,
      pattern_evidence = existing.pattern_evidence || evidence,
      content_excerpt = coalesce(existing.content_excerpt, f.excerpt)
    where id = cid;
    insert into public.moderation_events (case_id, event_type, details)
    values (cid, 'ai_rescanned', jsonb_build_object('provider', p_provider, 'risk', p_risk, 'category', cat));
  end if;

  -- Critical: withhold from others pending human review (never deleted automatically).
  if p_risk = 'critical' then
    perform public.shield_set_content_state(p_type, p_id, 'held');
    insert into public.moderation_events (case_id, event_type, details) values (cid, 'content_held', '{}');
    if f.author_id is not null and p_type <> 'direct_message' then
      insert into public.notifications (user_id, type, title, body, link)
      values (f.author_id, 'shield.held', 'Your ' || replace(p_type::text, '_', ' ') || ' is pending review',
              'It has been temporarily hidden from others while a moderator reviews it.', '/safety');
    end if;
  end if;

  if created and p_risk in ('high', 'critical') then
    perform public.shield_notify_moderators(cid,
      case when p_risk = 'critical' then 'Urgent CampusShield review' else 'High-priority CampusShield case' end,
      replace(cat::text, '_', ' ') || ' · ' || replace(p_type::text, '_', ' '));
  end if;

  return jsonb_build_object('scan_id', sid, 'case_id', cid, 'category', cat);
end $$;

-- ---------------------------------------------------------------------------
-- Link user reports to cases (dedupe) and queue a scan of the reported content.
-- The reporter's own description is never classified as a violation by the reporter.
-- ---------------------------------------------------------------------------
create or replace function public.on_moderation_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record; ctype public.shield_content; f record; cid uuid; cnt int; created boolean := false;
  cat public.shield_category; risk public.shield_risk;
begin
  if new.target_type = 'lf_item' then
    perform set_config('app.lf_rpc', 'on', true);
    update public.lost_found_items set flagged = true where id = new.target_id;
  end if;

  if new.target_type not in ('post', 'comment', 'message', 'direct_message') then
    for r in select distinct user_id from public.user_roles where role in ('moderator', 'platform_admin') loop
      perform public.notify(r.user_id, 'moderation', 'New ' || replace(new.target_type, '_', ' ') || ' flagged', left(new.reason, 140), '/admin');
    end loop;
    return new;
  end if;

  ctype := new.target_type::public.shield_content;
  if ctype = 'direct_message' and not exists (
       select 1 from public.direct_messages d join public.conversation_members m on m.conversation_id = d.conversation_id
        where d.id = new.target_id and m.user_id = new.reporter_id) then
    raise exception 'You can only report messages from your own conversations' using errcode = '42501';
  end if;

  select * into f from public.shield_content_facts(ctype, new.target_id);
  if f.author_id is null and f.excerpt is null then raise exception 'Content not found'; end if;
  if f.author_id = new.reporter_id then raise exception 'You cannot report your own content'; end if;

  cat := case new.category when 'harassment' then 'targeted_harassment' when 'threat' then 'threats_intimidation'
           when 'hate' then 'hate_discrimination' when 'sexual_harassment' then 'sexual_harassment'
           when 'personal_info' then 'doxxing' when 'self_harm' then 'other_harmful' else 'other_harmful' end;
  risk := case when new.category in ('threat', 'self_harm') then 'high' else 'review' end;

  select id into cid from public.moderation_cases
   where content_type = ctype and content_id = new.target_id and review_status in ('open', 'in_review', 'escalated');
  if cid is null then
    insert into public.moderation_cases (content_type, content_id, content_author_id, target_user_id, context, content_excerpt,
                                         source, category, risk_level, priority, report_count)
    values (ctype, new.target_id, f.author_id, coalesce(f.target_id, case when ctype = 'direct_message' then new.reporter_id end),
            coalesce(f.context, '{}'), f.excerpt, 'report', cat, risk, public.shield_risk_weight(risk) + 2, 1)
    returning id into cid;
    created := true;
  else
    update public.moderation_cases set report_count = report_count + 1, priority = priority + 2,
           source = case when source = 'ai' then 'ai+report' else source end,
           risk_level = case when public.shield_risk_weight(risk) > public.shield_risk_weight(risk_level) then risk else risk_level end
     where id = cid returning report_count into cnt;
  end if;

  update public.moderation_reports set case_id = cid where id = new.id;
  insert into public.moderation_events (case_id, event_type, details)
  values (cid, 'report_linked', jsonb_build_object('category', new.category));

  -- Ask the worker to scan the reported content (DMs only ever reach here via a participant report).
  insert into public.moderation_jobs (content_type, content_id) values (ctype, new.target_id)
  on conflict (content_type, content_id) do nothing;

  if created or cnt = 3 then
    perform public.shield_notify_moderators(cid, case when created then 'New user report' else 'Content reported 3 times' end,
      replace(cat::text, '_', ' ') || ' · ' || replace(ctype::text, '_', ' '));
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Moderator actions
-- ---------------------------------------------------------------------------
create or replace function public.shield_mark_in_review(p_case uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  update public.moderation_cases set review_status = 'in_review' where id = p_case and review_status = 'open';
  if found then
    insert into public.moderation_events (case_id, actor_id, event_type) values (p_case, auth.uid(), 'review_started');
  end if;
end $$;

create or replace function public.shield_add_note(p_case uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_note), '')) < 2 then raise exception 'Note is empty'; end if;
  insert into public.moderation_events (case_id, actor_id, event_type, details)
  values (p_case, auth.uid(), 'internal_note', jsonb_build_object('note', left(trim(p_note), 2000)));
end $$;

create or replace function public.shield_decide(p_case uuid, p_decision public.shield_decision, p_reason text default null,
                                               p_internal_note text default null, p_restrict_days int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; msg text;
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  select * into c from public.moderation_cases where id = p_case for update;
  if not found then raise exception 'Case not found'; end if;
  if c.review_status in ('resolved', 'dismissed') then raise exception 'This case is already closed'; end if;
  if p_decision in ('warning', 'edit_requested', 'removed', 'restricted', 'escalated') and char_length(coalesce(trim(p_reason), '')) < 10 then
    raise exception 'Give the author a clear explanation (at least 10 characters)';
  end if;
  if p_decision = 'restricted' and (p_restrict_days is null or p_restrict_days not between 1 and 30) then
    raise exception 'Restrictions must last between 1 and 30 days';
  end if;
  if p_decision = 'restricted' and c.content_author_id is null then raise exception 'No author to restrict'; end if;

  update public.moderation_cases set
    decision = p_decision,
    decision_reason = nullif(trim(p_reason), ''),
    review_status = case when p_decision = 'escalated' then 'escalated'::public.shield_case_status
                         when p_decision = 'dismissed_false_positive' then 'dismissed' else 'resolved' end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_case;

  if p_decision in ('dismissed_false_positive', 'no_action', 'warning', 'edit_requested') then
    perform public.shield_set_content_state(c.content_type, c.content_id, 'visible');
  elsif p_decision in ('removed', 'restricted') then
    perform public.shield_set_content_state(c.content_type, c.content_id, 'removed');
  end if;

  if p_decision = 'restricted' then
    insert into public.user_restrictions (user_id, reason, case_id, created_by, ends_at)
    values (c.content_author_id, trim(p_reason), p_case, auth.uid(), now() + make_interval(days => p_restrict_days));
  end if;

  insert into public.moderation_events (case_id, actor_id, event_type, details)
  values (p_case, auth.uid(), 'decision', jsonb_build_object('decision', p_decision, 'restrict_days', p_restrict_days, 'note', nullif(trim(p_internal_note), '')));
  perform public.audit('shield.' || p_decision::text, 'moderation_case', p_case::text,
                       jsonb_build_object('content_type', c.content_type, 'restrict_days', p_restrict_days));

  msg := case p_decision
    when 'warning' then 'Warning about your ' || replace(c.content_type::text, '_', ' ')
    when 'edit_requested' then 'Please edit your ' || replace(c.content_type::text, '_', ' ')
    when 'removed' then 'Your ' || replace(c.content_type::text, '_', ' ') || ' was removed'
    when 'restricted' then 'Posting temporarily restricted for ' || p_restrict_days || ' day(s)'
    else null end;
  if msg is not null and c.content_author_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (c.content_author_id, 'shield.decision', msg, left(trim(p_reason), 200) || ' You can request a review.', '/safety');
  end if;
  if p_decision = 'escalated' then
    perform public.shield_notify_moderators(p_case, 'CampusShield case escalated', left(trim(p_reason), 140), true);
  end if;
end $$;

create or replace function public.shield_appeal(p_case uuid, p_statement text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c record; aid uuid;
begin
  select * into c from public.moderation_cases where id = p_case;
  if not found or c.content_author_id is distinct from auth.uid() then raise exception 'Case not found' using errcode = '42501'; end if;
  if c.decision not in ('warning', 'edit_requested', 'removed', 'restricted') then raise exception 'This decision cannot be appealed'; end if;
  if char_length(coalesce(trim(p_statement), '')) < 10 then raise exception 'Explain why the decision should be reviewed'; end if;
  perform public.check_rate_limit('shield.appeal', 5, interval '1 day');
  insert into public.moderation_appeals (case_id, appellant_id, statement) values (p_case, auth.uid(), trim(p_statement)) returning id into aid;
  insert into public.moderation_events (case_id, actor_id, event_type) values (p_case, auth.uid(), 'appeal_submitted');
  perform public.shield_notify_moderators(p_case, 'Moderation decision appealed', 'An author has requested a review.');
  return aid;
exception when unique_violation then
  raise exception 'You have already appealed this decision';
end $$;

create or replace function public.shield_resolve_appeal(p_appeal uuid, p_overturn boolean, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
declare a record; c record;
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_resolution), '')) < 10 then raise exception 'Explain the outcome to the author'; end if;
  select * into a from public.moderation_appeals where id = p_appeal for update;
  if not found or a.status <> 'open' then raise exception 'Appeal not found or already resolved'; end if;
  select * into c from public.moderation_cases where id = a.case_id;
  update public.moderation_appeals set status = case when p_overturn then 'overturned' else 'upheld' end,
         resolution = trim(p_resolution), resolved_by = auth.uid(), resolved_at = now() where id = p_appeal;
  if p_overturn then
    perform public.shield_set_content_state(c.content_type, c.content_id, 'visible');
    update public.user_restrictions set lifted_at = now(), lifted_by = auth.uid() where case_id = c.id and lifted_at is null;
  end if;
  insert into public.moderation_events (case_id, actor_id, event_type, details)
  values (c.id, auth.uid(), 'appeal_resolved', jsonb_build_object('overturned', p_overturn));
  perform public.audit(case when p_overturn then 'shield.appeal.overturned' else 'shield.appeal.upheld' end, 'moderation_case', c.id::text);
  insert into public.notifications (user_id, type, title, body, link)
  values (a.appellant_id, 'shield.appeal', 'Your appeal was ' || case when p_overturn then 'accepted — the action was reversed' else 'reviewed — the decision stands' end,
          left(trim(p_resolution), 200), '/safety');
end $$;

create or replace function public.shield_lift_restriction(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only' using errcode = '42501'; end if;
  update public.user_restrictions set lifted_at = now(), lifted_by = auth.uid() where id = p_id and lifted_at is null;
  perform public.audit('shield.restriction.lifted', 'user_restriction', p_id::text);
end $$;

-- Draft-check quota (pre-publish suggestions call the provider; keep them bounded).
create or replace function public.shield_draft_quota()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.check_rate_limit('shield.draft', 40, interval '10 minutes');
end $$;

-- Authors see a plain-language notice for decisions on their own content — no scores, reporter
-- identities or internal notes.
create view public.my_moderation_notices with (security_invoker = false) as
select c.id, c.content_type, c.content_id, c.content_excerpt, c.category, c.review_status, c.decision, c.decision_reason,
       c.reviewed_at, c.created_at,
       (select s.shield_state from public.posts s where c.content_type = 'post' and s.id = c.content_id
        union all select s.shield_state from public.comments s where c.content_type = 'comment' and s.id = c.content_id
        union all select s.shield_state from public.messages s where c.content_type = 'message' and s.id = c.content_id limit 1) as content_state,
       a.status as appeal_status, a.resolution as appeal_resolution
  from public.moderation_cases c
  left join public.moderation_appeals a on a.case_id = c.id
 where auth.uid() is not null and c.content_author_id = auth.uid()
   and (c.decision in ('warning', 'edit_requested', 'removed', 'restricted')
        or exists (select 1 from public.posts p where c.content_type = 'post' and p.id = c.content_id and p.shield_state = 'held')
        or exists (select 1 from public.comments p where c.content_type = 'comment' and p.id = c.content_id and p.shield_state = 'held')
        or exists (select 1 from public.messages p where c.content_type = 'message' and p.id = c.content_id and p.shield_state = 'held'));
revoke all on public.my_moderation_notices from anon;
grant select on public.my_moderation_notices to authenticated;

-- Retention: drop routine scans after 90 days; anonymise excerpts of closed cases after 1 year.
create or replace function public.shield_purge()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s int; c int;
begin
  delete from public.moderation_scans sc where sc.created_at < now() - interval '90 days'
     and not exists (select 1 from public.moderation_cases mc where mc.scan_id = sc.id);
  get diagnostics s = row_count;
  update public.moderation_cases set content_excerpt = null
   where review_status in ('resolved', 'dismissed') and updated_at < now() - interval '365 days' and content_excerpt is not null;
  get diagnostics c = row_count;
  delete from public.moderation_jobs where status = 'done' and processed_at < now() - interval '30 days';
  return jsonb_build_object('scans_deleted', s, 'excerpts_cleared', c);
end $$;

-- Lock down internal functions.
revoke execute on function public.shield_ingest_scan(public.shield_content, uuid, text, text, text, boolean, jsonb, jsonb, public.shield_category, public.shield_risk, text, text, int) from public, anon, authenticated;
revoke execute on function public.shield_set_content_state(public.shield_content, uuid, text) from public, anon, authenticated;
revoke execute on function public.shield_content_facts(public.shield_content, uuid) from public, anon, authenticated;
revoke execute on function public.shield_notify_moderators(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.shield_purge() from public, anon, authenticated;
revoke execute on function public.shield_enqueue() from public, anon, authenticated;
grant execute on function public.shield_ingest_scan(public.shield_content, uuid, text, text, text, boolean, jsonb, jsonb, public.shield_category, public.shield_risk, text, text, int) to service_role;
grant execute on function public.shield_purge() to service_role;

alter publication supabase_realtime add table public.moderation_cases;
