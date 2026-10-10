-- Scan jobs for deleted content would otherwise stay pending forever (the worker skips them).
create or replace function public.shield_dequeue_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.moderation_jobs where content_type = tg_argv[0]::public.shield_content and content_id = old.id;
  return old;
end $$;
revoke execute on function public.shield_dequeue_deleted() from public, anon, authenticated;

create trigger posts_shield_dequeue after delete on public.posts for each row execute function public.shield_dequeue_deleted('post');
create trigger comments_shield_dequeue after delete on public.comments for each row execute function public.shield_dequeue_deleted('comment');
create trigger messages_shield_dequeue after delete on public.messages for each row execute function public.shield_dequeue_deleted('message');
create trigger dms_shield_dequeue after delete on public.direct_messages for each row execute function public.shield_dequeue_deleted('direct_message');

-- One-off cleanup of orphans created before this migration.
delete from public.moderation_jobs j where not (
  case j.content_type
    when 'post' then exists (select 1 from public.posts x where x.id = j.content_id)
    when 'comment' then exists (select 1 from public.comments x where x.id = j.content_id)
    when 'message' then exists (select 1 from public.messages x where x.id = j.content_id)
    else exists (select 1 from public.direct_messages x where x.id = j.content_id)
  end);
