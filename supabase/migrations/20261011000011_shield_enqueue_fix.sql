-- Fix: shield_enqueue referenced new.deleted_at, which only exists on messages. PL/pgSQL resolves
-- record fields even inside a false AND branch, so inserts into posts/comments failed.
create or replace function public.shield_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ctype public.shield_content := tg_argv[0]::public.shield_content;
  row_json jsonb := to_jsonb(new);
begin
  if tg_op = 'UPDATE' and (row_json ->> 'body') is not distinct from (to_jsonb(old) ->> 'body') then return new; end if;
  if (row_json ->> 'deleted_at') is not null then return new; end if;
  insert into public.moderation_jobs (content_type, content_id) values (ctype, new.id)
  on conflict (content_type, content_id) do update set status = 'pending', attempts = 0, last_error = null, processed_at = null;
  return new;
end $$;
revoke execute on function public.shield_enqueue() from public, anon, authenticated;
