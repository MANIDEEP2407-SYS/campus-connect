-- Communities (Discord-style servers/channels/messages) and direct messages.

create type public.server_visibility as enum ('public', 'private');
create type public.server_role as enum ('owner', 'moderator', 'member');
create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 500),
  icon text not null default '💬' check (char_length(icon) <= 8),
  category text not null default 'General' check (char_length(category) <= 40),
  visibility public.server_visibility not null default 'public',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index servers_name_trgm_idx on public.servers using gin (name extensions.gin_trgm_ops);
create trigger servers_rate_limit before insert on public.servers
  for each row execute function public.rate_limit_insert('server.create', '5', '1 day');

create table public.server_members (
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.server_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);
create index server_members_user_idx on public.server_members (user_id);

create table public.server_join_requests (
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 300),
  status public.request_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table public.server_invites (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  max_uses int not null default 25 check (max_uses between 1 and 500),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9-]{1,32}$'),
  topic text check (char_length(topic) <= 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (server_id, name)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  server_id uuid not null references public.servers (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.messages (id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_channel_idx on public.messages (channel_id, created_at desc);
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.rate_limit_insert('message', '120', '5 minutes');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.server_role_of(sid uuid)
returns public.server_role language sql stable security definer set search_path = '' as $$
  select role from public.server_members where server_id = sid and user_id = auth.uid();
$$;

create or replace function public.is_server_member(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.server_members where server_id = sid and user_id = auth.uid());
$$;

create or replace function public.is_server_staff(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.server_role_of(sid) in ('owner', 'moderator'), false);
$$;

create or replace function public.can_read_server(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.servers s where s.id = sid and s.visibility = 'public')
      or public.is_server_member(sid)
      or public.is_moderator();
$$;

-- On server creation: owner membership + #general channel.
create or replace function public.on_server_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.server_members (server_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.channels (server_id, name, topic, position) values (new.id, 'general', 'Say hello!', 0);
  return new;
end $$;
create trigger servers_after_insert after insert on public.servers for each row execute function public.on_server_created();

-- Ownership can only be transferred via transfer_server_ownership().
create or replace function public.guard_server_update()
returns trigger language plpgsql as $$
begin
  if new.owner_id <> old.owner_id and current_setting('app.allow_owner_change', true) is distinct from 'on' then
    raise exception 'Server ownership cannot be changed directly';
  end if;
  return new;
end $$;
create trigger servers_guard before update on public.servers for each row execute function public.guard_server_update();

-- Messages: derive server_id from channel, restrict what authors can edit.
create or replace function public.messages_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select server_id into new.server_id from public.channels where id = new.channel_id;
    new.edited_at := null;
    new.deleted_at := null;
    return new;
  end if;
  if new.channel_id <> old.channel_id or new.author_id <> old.author_id or new.server_id <> old.server_id
     or new.created_at <> old.created_at then
    raise exception 'Only message content can be edited';
  end if;
  if old.deleted_at is not null then raise exception 'Deleted messages cannot be edited'; end if;
  if new.body is distinct from old.body then
    if old.created_at < now() - interval '15 minutes' and current_setting('app.moderating', true) is distinct from 'on' then
      raise exception 'Messages can only be edited within 15 minutes of sending';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.messages_before_write();
create trigger messages_before_update before update on public.messages for each row execute function public.messages_before_write();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.join_public_server(sid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.servers where id = sid and visibility = 'public') then
    raise exception 'This community is private; request access instead';
  end if;
  insert into public.server_members (server_id, user_id) values (sid, auth.uid()) on conflict do nothing;
  perform public.notify((select owner_id from public.servers where id = sid), 'server.join',
    (select full_name from public.profiles where id = auth.uid()) || ' joined ' || (select name from public.servers where id = sid),
    null, '/communities/' || sid);
end $$;

create or replace function public.request_server_access(sid uuid, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.servers where id = sid;
  if not found then raise exception 'Community not found'; end if;
  if public.is_server_member(sid) then raise exception 'You are already a member'; end if;
  perform public.check_rate_limit('server.request', 10, interval '1 day');
  insert into public.server_join_requests (server_id, user_id, message) values (sid, auth.uid(), left(p_message, 300))
  on conflict (server_id, user_id) do update set status = 'pending', message = excluded.message, created_at = now()
    where public.server_join_requests.status <> 'pending';
  perform public.notify(s.owner_id, 'server.request',
    (select full_name from public.profiles where id = auth.uid()) || ' requested to join ' || s.name, left(p_message, 120),
    '/communities/' || sid || '/settings');
end $$;

create or replace function public.decide_server_request(sid uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_server_staff(sid) then raise exception 'Only community owners and moderators can review requests' using errcode = '42501'; end if;
  update public.server_join_requests set status = case when p_approve then 'approved'::public.request_status else 'rejected' end,
         decided_by = auth.uid()
   where server_id = sid and user_id = p_user and status = 'pending';
  if not found then raise exception 'No pending request'; end if;
  if p_approve then
    insert into public.server_members (server_id, user_id) values (sid, p_user) on conflict do nothing;
  end if;
  perform public.notify(p_user, 'server.request.decided',
    'Your request to join ' || (select name from public.servers where id = sid) || ' was ' || case when p_approve then 'approved' else 'declined' end,
    null, '/communities/' || sid);
end $$;

create or replace function public.redeem_server_invite(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into inv from public.server_invites where code = p_code for update;
  if not found or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'This invite is invalid or has expired';
  end if;
  if not public.is_server_member(inv.server_id) then
    insert into public.server_members (server_id, user_id) values (inv.server_id, auth.uid());
    update public.server_invites set uses = uses + 1 where id = inv.id;
    update public.server_join_requests set status = 'approved' where server_id = inv.server_id and user_id = auth.uid();
  end if;
  return inv.server_id;
end $$;

create or replace function public.set_server_member_role(sid uuid, p_user uuid, p_role public.server_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.server_role_of(sid) is distinct from 'owner' then raise exception 'Only the owner can change roles' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'Use ownership transfer to change the owner'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.server_members set role = p_role where server_id = sid and user_id = p_user;
  if not found then raise exception 'Not a member'; end if;
  perform public.audit('server.role', 'server', sid::text, jsonb_build_object('user', p_user, 'role', p_role));
end $$;

create or replace function public.transfer_server_ownership(sid uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.server_role_of(sid) is distinct from 'owner' then raise exception 'Only the owner can transfer ownership' using errcode = '42501'; end if;
  if not exists (select 1 from public.server_members where server_id = sid and user_id = p_user) then raise exception 'New owner must be a member'; end if;
  perform set_config('app.allow_owner_change', 'on', true);
  update public.servers set owner_id = p_user where id = sid;
  update public.server_members set role = 'moderator' where server_id = sid and user_id = auth.uid();
  update public.server_members set role = 'owner' where server_id = sid and user_id = p_user;
  perform public.audit('server.transfer', 'server', sid::text, jsonb_build_object('new_owner', p_user));
end $$;

create or replace function public.remove_server_member(sid uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_role public.server_role;
begin
  select role into target_role from public.server_members where server_id = sid and user_id = p_user;
  if target_role is null then raise exception 'Not a member'; end if;
  if target_role = 'owner' then raise exception 'The owner cannot be removed; transfer ownership first'; end if;
  if p_user <> auth.uid() then
    if not public.is_server_staff(sid) then raise exception 'Not allowed' using errcode = '42501'; end if;
    if target_role = 'moderator' and public.server_role_of(sid) <> 'owner' then raise exception 'Only the owner can remove moderators'; end if;
    perform public.audit('server.kick', 'server', sid::text, jsonb_build_object('user', p_user));
  end if;
  delete from public.server_members where server_id = sid and user_id = p_user;
end $$;

create or replace function public.moderate_delete_message(mid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  select * into m from public.messages where id = mid;
  if not found then raise exception 'Message not found'; end if;
  if m.author_id <> auth.uid() and not public.is_server_staff(m.server_id) and not public.is_moderator() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform set_config('app.moderating', 'on', true);
  update public.messages set deleted_at = now(), body = '[message removed]' where id = mid;
  if m.author_id <> auth.uid() then
    perform public.audit('message.remove', 'message', mid::text, jsonb_build_object('server', m.server_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index direct_messages_conv_idx on public.direct_messages (conversation_id, created_at desc);
create trigger dm_rate_limit before insert on public.direct_messages
  for each row execute function public.rate_limit_insert('dm', '120', '5 minutes');

create or replace function public.is_conversation_member(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid());
$$;

create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_other = auth.uid() then raise exception 'You cannot message yourself'; end if;
  select cm1.conversation_id into cid
    from public.conversation_members cm1
    join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id and cm2.user_id = p_other
   where cm1.user_id = auth.uid()
     and (select count(*) from public.conversation_members c where c.conversation_id = cm1.conversation_id) = 2
   limit 1;
  if cid is not null then return cid; end if;
  if not exists (select 1 from public.profiles where id = p_other and allow_dms) and not public.is_moderator() then
    raise exception 'This person is not accepting direct messages';
  end if;
  insert into public.conversations default values returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, auth.uid()), (cid, p_other);
  return cid;
end $$;

create or replace function public.on_dm_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  for r in select user_id from public.conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id loop
    perform public.notify(r.user_id, 'dm', 'New message from ' || (select full_name from public.profiles where id = new.sender_id),
      left(new.body, 120), '/messages/' || new.conversation_id);
  end loop;
  return new;
end $$;
create trigger direct_messages_after_insert after insert on public.direct_messages for each row execute function public.on_dm_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.server_join_requests enable row level security;
alter table public.server_invites enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.direct_messages enable row level security;

-- Private servers are discoverable (name/description) so people can request access; their
-- channels, members and messages are not.
create policy servers_select on public.servers for select to authenticated using (true);
create policy servers_insert on public.servers for insert to authenticated with check (owner_id = auth.uid());
create policy servers_update on public.servers for update to authenticated
  using (public.is_server_staff(id)) with check (public.is_server_staff(id));
create policy servers_delete on public.servers for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

create policy server_members_select on public.server_members for select to authenticated using (public.can_read_server(server_id));
-- Joining goes through join_public_server / redeem_server_invite / decide_server_request.

create policy join_requests_select on public.server_join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_server_staff(server_id));

create policy invites_select on public.server_invites for select to authenticated using (public.is_server_staff(server_id));
create policy invites_insert on public.server_invites for insert to authenticated
  with check (created_by = auth.uid() and public.is_server_staff(server_id));
create policy invites_delete on public.server_invites for delete to authenticated using (public.is_server_staff(server_id));

create policy channels_select on public.channels for select to authenticated using (public.can_read_server(server_id));
create policy channels_insert on public.channels for insert to authenticated with check (public.is_server_staff(server_id));
create policy channels_update on public.channels for update to authenticated
  using (public.is_server_staff(server_id)) with check (public.is_server_staff(server_id));
create policy channels_delete on public.channels for delete to authenticated using (public.is_server_staff(server_id));

create policy messages_select on public.messages for select to authenticated using (public.can_read_server(server_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = auth.uid()
              and public.is_server_member((select c.server_id from public.channels c where c.id = channel_id)));
create policy messages_update on public.messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy conversations_select on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy conversation_members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy conversation_members_update on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dms_select on public.direct_messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy dms_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
