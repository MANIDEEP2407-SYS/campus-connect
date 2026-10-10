-- Raw report_updates carry actor_id (the first row's actor is the reporter), so non-responders
-- read the timeline through a masking view instead of the table.

drop policy report_updates_select on public.report_updates;
create policy report_updates_select on public.report_updates for select to authenticated
  using (public.is_responder());

create view public.pulse_timeline with (security_invoker = false) as
select u.id, u.report_id, u.kind, u.from_status, u.to_status, u.note, u.created_at,
       case
         when public.is_responder() then (select p.full_name from public.profiles p where p.id = u.actor_id)
         when u.actor_id = r.reporter_id then 'Reporter'
         when u.actor_id is null then 'System'
         else 'Campus responder'
       end as actor_label,
       u.is_internal
  from public.report_updates u
  join public.reports r on r.id = u.report_id
 where auth.uid() is not null
   and (public.is_responder()
        or (not u.is_internal and (r.reporter_id = auth.uid() or r.status in ('verified', 'assigned', 'in_progress', 'resolved')))
        or (u.kind = 'status' and r.reporter_id = auth.uid()));
revoke all on public.pulse_timeline from anon;
grant select on public.pulse_timeline to authenticated;

-- Responders list (names only) for assignment pickers.
create or replace function public.list_responders()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select distinct p.id, p.full_name from public.user_roles ur join public.profiles p on p.id = ur.user_id
   where ur.role in ('safety_responder', 'platform_admin') and public.is_responder()
   order by p.full_name;
$$;
