-- New enum values must be committed before use, so they live in their own migration
-- (used by 20261011000018_incident_peer_reports.sql).

-- Plagiarism: copied work submitted without credit. Idea theft: someone's idea, project or work
-- presented as their own (e.g. a student taking a teacher's idea to another teacher).
alter type public.incident_category add value if not exists 'plagiarism';
alter type public.incident_category add value if not exists 'idea_theft';

-- A student reporting another student (limited to plagiarism and work theft).
alter type public.incident_direction add value if not exists 'about_peer';
