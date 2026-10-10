-- Microsoft Entra ID (Amrita Microsoft 365) identity linking.
--
-- Trust model: Supabase Auth's `azure` provider verifies the ID token signature and, when configured
-- with a tenant-specific URL, rejects tokens from any other tenant. The verified token's `iss` claim
-- (https://login.microsoftonline.com/<tenant-id>/v2.0) is stored on auth.identities. We copy the
-- tenant id from that claim onto the profile so the app can show "verified Amrita account" by
-- comparing with the configured MICROSOFT_TENANT_ID. Users can never write these columns, and a
-- Microsoft sign-in never grants any role.

alter table public.profiles
  add column ms_tenant_id text,
  add column ms_linked_at timestamptz;

create or replace function public.sync_microsoft_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  iss text := new.identity_data ->> 'iss';
  tid text;
begin
  if new.provider <> 'azure' then return new; end if;
  tid := substring(iss from '^https://login\.microsoftonline\.com/([0-9a-fA-F-]{36})/v2\.0/?$');
  perform set_config('app.identity_sync', 'on', true);
  update public.profiles
     set ms_tenant_id = lower(tid),
         ms_linked_at = coalesce(ms_linked_at, now())
   where id = new.user_id;
  return new;
end $$;

create trigger on_auth_identity_linked
  after insert or update of identity_data on auth.identities
  for each row execute function public.sync_microsoft_identity();

revoke execute on function public.sync_microsoft_identity() from public, anon, authenticated;

-- Profiles: users may edit their own profile, but never identity-verification columns.
create or replace function public.profiles_guard_identity()
returns trigger language plpgsql as $$
begin
  if (new.ms_tenant_id is distinct from old.ms_tenant_id or new.ms_linked_at is distinct from old.ms_linked_at)
     and current_setting('app.identity_sync', true) is distinct from 'on'
     and current_user not in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    raise exception 'Identity verification fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard_identity before update on public.profiles
  for each row execute function public.profiles_guard_identity();

-- Expose the verification fact (not the raw claims) on profile cards.
create or replace view public.profile_cards with (security_invoker = true) as
select p.id, p.handle, p.full_name, p.affiliation, p.avatar_url, p.visibility,
       case when public.can_view_profile(p.id) then p.department end as department,
       case when public.can_view_profile(p.id) then p.program end as program,
       case when public.can_view_profile(p.id) then p.year_of_study end as year_of_study,
       case when public.can_view_profile(p.id) then p.bio end as bio,
       case when public.can_view_profile(p.id) then p.skills else '{}' end as skills,
       case when public.can_view_profile(p.id) then p.interests else '{}' end as interests,
       case when public.can_view_profile(p.id) then p.goals else '{}' end as goals,
       p.allow_dms, p.created_at,
       p.ms_tenant_id
  from public.profiles p;
