-- Fixes found by synthetic load testing (scripts/loadtest.mts):
-- 1. incidents RLS called can_review_incident(department) once per row (seconds at 20k rows).
--    The reviewer's scope is now resolved once per query via (select …) init-plans.
-- 2. check_rate_limit counted then inserted without a lock, so concurrent calls could all pass.

-- Reviewer scope, evaluated once per statement.
create or replace function public.incident_review_all()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('platform_admin') or (
    public.has_role('incident_reviewer') and exists (select 1 from public.profiles p where p.id = auth.uid() and p.department = 'Administration'));
$$;

create or replace function public.incident_review_department()
returns text language sql stable security definer set search_path = '' as $$
  select p.department from public.profiles p where p.id = auth.uid() and public.has_role('incident_reviewer');
$$;

drop policy incidents_select on public.incidents;
create policy incidents_select on public.incidents for select to authenticated
  using (reporter_id = (select auth.uid())
         or (select public.incident_review_all())
         or department = (select public.incident_review_department()));

create index incidents_status_created_idx on public.incidents (status, created_at);

-- Serialise checks per user and action so concurrent requests can't all slip under the limit.
create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cnt int;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_action, 0));
  select count(*) into cnt from public.rate_limit_events
   where user_id = auth.uid() and action = p_action and created_at > now() - p_window;
  if cnt >= p_max then
    raise exception 'Rate limit exceeded for %: try again later', p_action using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (auth.uid(), p_action);
end $$;
