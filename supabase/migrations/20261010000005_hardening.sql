-- Lock down internal SECURITY DEFINER helpers so they can only run inside other database
-- functions/triggers, never be invoked directly through PostgREST /rpc.

revoke execute on all functions in schema public from anon;

revoke execute on function public.notify(uuid, text, text, text, text) from public, authenticated;
revoke execute on function public.audit(text, text, text, jsonb) from public, authenticated;
revoke execute on function public.check_rate_limit(text, int, interval) from public, authenticated;
revoke execute on function public.rate_limit_insert() from public, authenticated;
revoke execute on function public.handle_new_user() from public, authenticated;
revoke execute on function public.on_follow_notify() from public, authenticated;
revoke execute on function public.on_like_notify() from public, authenticated;
revoke execute on function public.on_comment_notify() from public, authenticated;
revoke execute on function public.on_server_created() from public, authenticated;
revoke execute on function public.on_club_created() from public, authenticated;
revoke execute on function public.on_dm_insert() from public, authenticated;
revoke execute on function public.on_moderation_report() from public, authenticated;
revoke execute on function public.lf_notify_matches() from public, authenticated;
revoke execute on function public.events_notify_change() from public, authenticated;

-- Future functions should not be executable by anon by default.
alter default privileges in schema public revoke execute on functions from anon;

-- Audit official-status changes from inside the trigger (admins only reach this branch).
create or replace function public.clubs_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.is_official and not public.is_admin() and auth.uid() is not null then new.is_official := false; end if;
  elsif new.is_official is distinct from old.is_official then
    if not public.is_admin() and auth.uid() is not null then
      raise exception 'Only platform administrators can change official status' using errcode = '42501';
    end if;
    perform public.audit(case when new.is_official then 'club.verify' else 'club.unverify' end, 'club', new.id::text);
  end if;
  return new;
end $$;

create or replace function public.resources_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.submitted_by := auth.uid();
    if not public.is_admin() then new.is_official := false; end if;
  elsif new.is_official is distinct from old.is_official then
    if not public.is_admin() then
      raise exception 'Only administrators can mark resources official' using errcode = '42501';
    end if;
    perform public.audit(case when new.is_official then 'resource.official' else 'resource.unofficial' end, 'resource', new.id::text);
  end if;
  return new;
end $$;
