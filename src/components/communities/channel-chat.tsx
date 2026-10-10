"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Ellipsis, Flag, LoaderCircle, Pencil, Reply, SendHorizontal, Trash, X } from "lucide-react";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteMessage, editMessage, sendMessage } from "@/lib/actions/communities";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/user-avatar";
import { FlagButton } from "@/components/common/flag-button";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  body: string;
  author_id: string;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}
export interface ChatMember {
  id: string;
  role: "owner" | "moderator" | "member";
  handle: string;
  full_name: string;
  avatar_url: string | null;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function ChannelChat({
  channelId,
  channelName,
  me,
  members,
  initialMessages,
  canPost,
  canModerate,
  joinSlot,
}: {
  channelId: string;
  channelName: string;
  serverId: string;
  me: ChatMember;
  members: ChatMember[];
  initialMessages: ChatMessage[];
  canPost: boolean;
  canModerate: boolean;
  joinSlot: React.ReactNode;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [people, setPeople] = useState(() => new Map(members.map((m) => [m.id, m])));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [hasOlder, setHasOlder] = useState(initialMessages.length >= 50);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [flagId, setFlagId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const typingChannel = useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);

  // Reset local state when the server sends a fresh page (channel switch / refresh).
  const [prevInitial, setPrevInitial] = useState(initialMessages);
  if (initialMessages !== prevInitial) {
    setPrevInitial(initialMessages);
    setMessages(initialMessages);
    setHasOlder(initialMessages.length >= 50);
  }
  useEffect(() => {
    stickToBottom.current = true;
  }, [initialMessages]);

  // Clock for the 15-minute edit window; ticks so "Edit" disappears without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const upsert = useCallback((m: ChatMessage) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const next = prev.slice();
      next[i] = { ...next[i], ...m };
      return next;
    });
  }, []);

  // Realtime: new / edited messages (RLS ensures only readable channels deliver rows) + typing broadcast.
  useEffect(() => {
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`channel:${channelId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, async (payload) => {
        const m = payload.new as ChatMessage;
        upsert(m);
        setTyping((t) => {
          const { [m.author_id]: _, ...rest } = t;
          return rest;
        });
        if (!people.has(m.author_id)) {
          const { data } = await supabase.from("profiles").select("id, handle, full_name, avatar_url").eq("id", m.author_id).maybeSingle();
          if (data) setPeople((p) => new Map(p).set(data.id, { ...data, role: "member" }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, (payload) => upsert(payload.new as ChatMessage))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = (payload as { userId: string }).userId;
        setTyping((t) => ({ ...t, [id]: Date.now() }));
      })
      .subscribe();
    typingChannel.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChannel.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, upsert]);

  // Expire typing indicators.
  useEffect(() => {
    const t = setInterval(() => setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, ts]) => Date.now() - ts < 4000))), 1500);
    return () => clearInterval(t);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (!messages.length) return;
    setLoadingOlder(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const { data, error } = await getBrowserClient()
      .from("messages")
      .select("id, body, author_id, reply_to, created_at, edited_at, deleted_at")
      .eq("channel_id", channelId)
      .lt("created_at", messages[0]!.created_at)
      .order("created_at", { ascending: false })
      .limit(50);
    setLoadingOlder(false);
    if (error) return toast.error("Couldn't load older messages");
    setHasOlder((data?.length ?? 0) === 50);
    stickToBottom.current = false;
    setMessages((prev) => [...(data ?? []).reverse(), ...prev]);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const res = await sendMessage({ channelId, body, replyTo: replyTo?.id ?? null });
    setSending(false);
    if (!res.ok) return void toast.error(res.error);
    stickToBottom.current = true;
    upsert({ id: res.data.id, body, author_id: me.id, reply_to: replyTo?.id ?? null, created_at: new Date().toISOString(), edited_at: null, deleted_at: null });
    setDraft("");
    setReplyTo(null);
  };

  const notifyTyping = () => {
    if (Date.now() - lastTypingSent.current < 2500) return;
    lastTypingSent.current = Date.now();
    typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { userId: me.id } });
  };

  const byId = new Map(messages.map((m) => [m.id, m]));
  const typers = Object.keys(typing).filter((id) => id !== me.id).map((id) => people.get(id)?.full_name.split(" ")[0] ?? "Someone");

  return (
    <>
      <div
        ref={scroller}
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-label={`Messages in #${channelName}`}
      >
        {hasOlder && (
          <div className="mb-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder && <LoaderCircle className="animate-spin" />} Load older messages
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg font-semibold">Welcome to #{channelName}</p>
            <p className="text-sm text-muted-foreground">This is the start of the channel. Say hello!</p>
          </div>
        )}
        <ol className="space-y-0.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const author = people.get(m.author_id);
            const grouped = prev && prev.author_id === m.author_id && !m.reply_to && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
            const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
            const mine = m.author_id === me.id;
            const canEdit = mine && !m.deleted_at && now - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
            const parent = m.reply_to ? byId.get(m.reply_to) : undefined;
            return (
              <li key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground" role="separator">
                    <span className="h-px flex-1 bg-border" />
                    <span suppressHydrationWarning>{format(new Date(m.created_at), "EEEE, d MMMM")}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className={cn("group relative flex gap-3 rounded-md px-2 py-1 hover:bg-muted/40", !grouped && "mt-3")}>
                  <div className="w-9 shrink-0">
                    {!grouped && <UserAvatar name={author?.full_name ?? "Member"} src={author?.avatar_url} size="sm" className="size-9" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {parent && (
                      <p className="mb-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Reply className="size-3 -scale-x-100" /> {people.get(parent.author_id)?.full_name ?? "Member"}: {parent.deleted_at ? "message removed" : parent.body.slice(0, 80)}
                      </p>
                    )}
                    {!grouped && (
                      <p className="text-sm">
                        {author ? <Link href={`/profile/${author.handle}`} className="font-medium hover:underline">{author.full_name}</Link> : <span className="font-medium">Former member</span>}
                        {author && author.role !== "member" && <span className="ml-1.5 text-[11px] text-primary capitalize">{author.role}</span>}
                        <span className="ml-2 text-xs text-muted-foreground" suppressHydrationWarning>{format(new Date(m.created_at), "p")}</span>
                      </p>
                    )}
                    {editing === m.id ? (
                      <form
                        className="mt-1 flex gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const res = await editMessage({ id: m.id, body: editDraft });
                          if (!res.ok) return void toast.error(res.error);
                          upsert({ ...m, body: editDraft.trim(), edited_at: new Date().toISOString() });
                          setEditing(null);
                        }}
                      >
                        <label htmlFor={`edit-${m.id}`} className="sr-only">Edit message</label>
                        <input id={`edit-${m.id}`} autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} maxLength={4000}
                          className="h-8 flex-1 rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring" />
                        <Button size="sm" type="submit">Save</Button>
                        <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <p className={cn("text-sm leading-relaxed break-words whitespace-pre-wrap", m.deleted_at && "text-muted-foreground italic")}>
                        {m.body}
                        {m.edited_at && !m.deleted_at && <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span>}
                      </p>
                    )}
                  </div>
                  {!m.deleted_at && (
                    <div className="absolute -top-3 right-2 hidden gap-0.5 rounded-md border bg-popover p-0.5 shadow-sm group-focus-within:flex group-hover:flex">
                      {canPost && (
                        <Button variant="ghost" size="icon-xs" aria-label="Reply" onClick={() => setReplyTo(m)}><Reply /></Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Message options" />}><Ellipsis /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && <DropdownMenuItem onClick={() => { setEditing(m.id); setEditDraft(m.body); }}><Pencil /> Edit</DropdownMenuItem>}
                          {(mine || canModerate) && (
                            <DropdownMenuItem variant="destructive" onClick={async () => {
                              const res = await deleteMessage({ id: m.id });
                              if (!res.ok) toast.error(res.error);
                              else upsert({ ...m, deleted_at: new Date().toISOString(), body: "[message removed]" });
                            }}>
                              <Trash /> Delete
                            </DropdownMenuItem>
                          )}
                          {!mine && <DropdownMenuItem onClick={() => setFlagId(m.id)}><Flag /> Report</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {flagId && <FlagButton targetType="message" targetId={flagId} open onOpenChange={(o) => !o && setFlagId(null)} />}

      <div className="shrink-0 border-t p-3">
        <p className="mb-1 h-4 px-1 text-xs text-muted-foreground" aria-live="polite">
          {typers.length > 0 && `${typers.slice(0, 3).join(", ")} ${typers.length === 1 ? "is" : "are"} typing…`}
        </p>
        {canPost ? (
          <>
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
                <Reply className="size-3 -scale-x-100" /> Replying to <strong>{people.get(replyTo.author_id)?.full_name ?? "Member"}</strong>
                <span className="truncate text-muted-foreground">{replyTo.body.slice(0, 60)}</span>
                <button className="ml-auto" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="size-3.5" /></button>
              </div>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="chat-input" className="sr-only">Message #{channelName}</label>
              <textarea
                id="chat-input"
                rows={1}
                value={draft}
                maxLength={4000}
                onChange={(e) => {
                  setDraft(e.target.value);
                  notifyTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message #${channelName}`}
                className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" size="icon-lg" disabled={sending || !draft.trim()} aria-label="Send message">
                {sending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">You&apos;re previewing this public community. Join to send messages.</span>
            {joinSlot}
          </div>
        )}
      </div>
    </>
  );
}
