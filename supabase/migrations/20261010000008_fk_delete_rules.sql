-- Account deletion must not be blocked by content the user created or reviewed.

alter table public.research_projects drop constraint research_projects_lead_id_fkey,
  add constraint research_projects_lead_id_fkey foreign key (lead_id) references public.profiles (id) on delete cascade;

alter table public.events drop constraint events_organizer_id_fkey,
  add constraint events_organizer_id_fkey foreign key (organizer_id) references public.profiles (id) on delete cascade;

alter table public.clubs alter column created_by drop not null;
alter table public.clubs drop constraint clubs_created_by_fkey,
  add constraint clubs_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.user_roles drop constraint user_roles_granted_by_fkey,
  add constraint user_roles_granted_by_fkey foreign key (granted_by) references public.profiles (id) on delete set null;

alter table public.server_join_requests drop constraint server_join_requests_decided_by_fkey,
  add constraint server_join_requests_decided_by_fkey foreign key (decided_by) references public.profiles (id) on delete set null;

alter table public.reports drop constraint reports_assigned_to_fkey,
  add constraint reports_assigned_to_fkey foreign key (assigned_to) references public.profiles (id) on delete set null;

alter table public.reports drop constraint reports_duplicate_of_fkey,
  add constraint reports_duplicate_of_fkey foreign key (duplicate_of) references public.reports (id) on delete set null;

alter table public.lost_found_claims drop constraint lost_found_claims_reviewer_id_fkey,
  add constraint lost_found_claims_reviewer_id_fkey foreign key (reviewer_id) references public.profiles (id) on delete set null;

alter table public.moderation_reports drop constraint moderation_reports_resolved_by_fkey,
  add constraint moderation_reports_resolved_by_fkey foreign key (resolved_by) references public.profiles (id) on delete set null;

-- Club announcements belong to the club: deleting the club removes them (SET NULL would violate
-- posts_announcement_needs_club).
alter table public.posts drop constraint posts_club_fk,
  add constraint posts_club_fk foreign key (club_id) references public.clubs (id) on delete cascade;
