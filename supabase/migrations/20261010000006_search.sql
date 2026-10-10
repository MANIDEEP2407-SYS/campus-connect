-- Server-side search. SECURITY INVOKER: every branch is filtered by the caller's RLS policies,
-- so private records never leave the database for unauthorised users.

create or replace function public.search_people(q text default null, p_department text default null,
                                                p_affiliation public.affiliation default null, p_interest text default null,
                                                p_limit int default 60)
returns setof public.profile_cards language sql stable security invoker set search_path = '' as $$
  select c.* from public.profile_cards c
   where c.id <> auth.uid()
     and c.visibility <> 'hidden'
     and (q is null or q = '' or
          c.full_name ilike '%' || q || '%' or c.handle ilike '%' || q || '%' or c.department ilike '%' || q || '%'
          or exists (select 1 from unnest(c.skills || c.interests) t where t ilike '%' || q || '%'))
     and (p_department is null or p_department = '' or c.department = p_department)
     and (p_affiliation is null or c.affiliation = p_affiliation)
     and (p_interest is null or p_interest = '' or exists (select 1 from unnest(c.interests || c.skills) t where lower(t) = lower(p_interest)))
   order by c.full_name
   limit least(greatest(p_limit, 1), 200);
$$;

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
     from public.resources r, term where r.title ilike term.t or r.course_code ilike term.t or r.description ilike term.t limit 8)
  union all
  (select 'lost_found', i.id, i.title, i.kind::text || ' · ' || i.location_label, '/lost-found/' || i.id
     from public.lost_found_items i, term where i.status in ('open', 'claimed') and (i.title ilike term.t or i.description ilike term.t) limit 8);
$$;

-- Aggregate seat counts (participant identities stay private to organisers).
create or replace function public.event_counts(ids uuid[])
returns table (event_id uuid, registered int)
language sql stable security definer set search_path = '' as $$
  select e.id, (select count(*)::int from public.event_registrations r where r.event_id = e.id and r.status = 'registered')
    from public.events e where e.id = any(ids) and auth.uid() is not null;
$$;
