-- Remove the Lost & Found module: its tables, workflow functions, search branch, report hooks
-- and storage policies. Other modules keep working unchanged.

-- Leftover references to removed records.
delete from public.notifications where type like 'lf.%' or link like '/lost-found%';
delete from public.moderation_reports where target_type = 'lf_item';
alter table public.moderation_reports drop constraint moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
  check (target_type in ('post', 'comment', 'message', 'direct_message', 'server', 'profile', 'pulse_report', 'resource'));

-- Same as 20261011000010 without the Lost & Found flagging branch.
create or replace function public.on_moderation_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record; ctype public.shield_content; f record; cid uuid; cnt int; created boolean := false;
  cat public.shield_category; risk public.shield_risk;
begin
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

-- Same as 20261010000004 without the Lost & Found removal branch.
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

-- Same as 20261010000006 without the Lost & Found branch.
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
       or exists (select 1 from unnest(p.required_skills) s where s ilike term.t) limit 8)
  union all
  (select 'resource', r.id, r.title, coalesce(r.course_code || ' · ', '') || r.kind::text, '/resources?q=' || r.title
     from public.resources r, term where r.title ilike term.t or r.course_code ilike term.t or r.description ilike term.t limit 8);
$$;

-- Storage: no more uploads to or reads from the Lost & Found bucket.
drop policy storage_select_lostfound on storage.objects;
drop policy storage_insert_own_folder on storage.objects;
create policy storage_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-images', 'pulse-evidence')
              and (storage.foldername(name))[1] = auth.uid()::text);
-- Remove the empty bucket where the platform allows it (objects can only be deleted via the Storage API).
do $$
begin
  delete from storage.buckets where id = 'lostfound' and not exists (select 1 from storage.objects where bucket_id = 'lostfound');
exception when others then
  raise notice 'lostfound bucket left in place: %', sqlerrm;
end $$;

drop function public.lf_submit_claim(uuid, text, uuid);
drop function public.lf_review_claim(uuid, boolean, text);
drop function public.lf_complete_handover(uuid);
drop function public.lf_withdraw_claim(uuid);
drop function public.lf_dispute_claim(uuid, text);
drop function public.lf_moderate_item(uuid, text, text);
drop function public.lf_expire_stale();
drop table public.lost_found_claims, public.lost_found_secrets, public.lost_found_items;
drop function public.lf_items_guard();
drop function public.lf_notify_matches();
drop type public.lf_claim_status, public.lf_status, public.lf_category, public.lf_kind;
