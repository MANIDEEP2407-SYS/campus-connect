"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Flag, LoaderCircle, SendHorizontal } from "lucide-react";
import { FlagButton } from "@/components/common/flag-button";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/client";
import { markConversationRead, sendDirectMessage } from "@/lib/actions/communities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Dm = { id: string; sender_id: string; body: string; created_at: string };

export function DirectThread({ conversationId, meId, otherName, initial }: { conversationId: string; meId: string; otherName: string; initial: Dm[] }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [flagId, setFlagId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const chRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(null);
  const lastTyping = useRef(0);

  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setMessages(initial);
  }

  useEffect(() => {
    const supabase = getBrowserClient();
    let typingTimer: ReturnType<typeof setTimeout>;
    const ch = supabase
      .channel(`dm:${conversationId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Dm;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== meId) {
          setOtherTyping(false);
          markConversationRead({ conversationId });
        }
      })
      .on("broadcast", { event: "typing" }, () => {
        setOtherTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setOtherTyping(false), 3500);
      })
      .subscribe();
    chRef.current = ch;
    return () => {
      clearTimeout(typingTimer);
      supabase.removeChannel(ch);
    };
  }, [conversationId, meId]);

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, otherTyping]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const res = await sendDirectMessage({ conversationId, body });
    setSending(false);
    if (!res.ok) return void toast.error(res.error);
    setMessages((prev) => (prev.some((x) => x.id === res.data.id) ? prev : [...prev, { id: res.data.id, sender_id: meId, body, created_at: new Date().toISOString() }]));
    setDraft("");
  };

  return (
    <>
      <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto p-4" role="log" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Say hi to {otherName}. Keep it respectful — conversations can be reported.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={cn("group flex items-center gap-1", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")} suppressHydrationWarning>{format(new Date(m.created_at), "d MMM, p")}</p>
              </div>
              {!mine && (
                <button type="button" onClick={() => setFlagId(m.id)} aria-label="Report this message"
                  className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100">
                  <Flag className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {otherTyping && <p className="text-xs text-muted-foreground">{otherName.split(" ")[0]} is typing…</p>}
        {flagId && <FlagButton targetType="direct_message" targetId={flagId} open onOpenChange={(o) => !o && setFlagId(null)} />}
      </div>
      <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="dm-input" className="sr-only">Message {otherName}</label>
        <textarea
          id="dm-input"
          rows={1}
          value={draft}
          maxLength={4000}
          onChange={(e) => {
            setDraft(e.target.value);
            if (Date.now() - lastTyping.current > 2500) {
              lastTyping.current = Date.now();
              chRef.current?.send({ type: "broadcast", event: "typing", payload: {} });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${otherName}`}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon-lg" disabled={sending || !draft.trim()} aria-label="Send">
          {sending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </>
  );
}
