-- Students may report other students, but only for plagiarism or stealing work. Teachers and
-- staff report students for any category (including idea theft); students report teachers/staff
-- for any category.

alter table public.incidents add constraint incidents_peer_category_check
  check (direction <> 'about_peer' or category in ('plagiarism', 'idea_theft'));

drop function public.incident_submit(public.incident_category, text, text, text, text, date, text, text, text, boolean);

-- p_subject_kind: 'staff' (a teacher/staff member) or 'student'. Faculty and staff can only report students.
create or replace function public.incident_submit(
  p_category public.incident_category, p_subject_kind text, p_subject_name text, p_department text, p_title text, p_description text,
  p_occurred_on date, p_location text, p_context text, p_witnesses text, p_declaration boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me record; dir public.incident_direction; iid uuid; r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not coalesce(p_declaration, false) then
    raise exception 'You must confirm the declaration before submitting';
  end if;
  if p_subject_kind not in ('staff', 'student') then raise exception 'Choose who the report is about'; end if;
  select affiliation into me from public.profiles where id = auth.uid();
  if me.affiliation in ('faculty', 'staff') then
    if p_subject_kind <> 'student' then raise exception 'Teachers and staff can report students only'; end if;
    dir := 'about_student';
  elsif p_subject_kind = 'staff' then
    dir := 'about_staff';
  else
    dir := 'about_peer';
    if p_category not in ('plagiarism', 'idea_theft') then
      raise exception 'Students can report other students only for plagiarism or stealing work';
    end if;
  end if;
  perform public.check_rate_limit('incident.submit', 5, interval '1 day');
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
