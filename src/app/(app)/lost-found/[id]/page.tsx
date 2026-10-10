import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { ToneBadge } from "@/components/common/tone-badge";
import { ActionButton } from "@/components/common/action-button";
import { FlagButton } from "@/components/common/flag-button";
import { TimeAgo, formatDate } from "@/components/common/time-ago";
import { UserAvatar } from "@/components/common/user-avatar";
import { ClaimForm } from "@/components/lostfound/claim-form";
import { ClaimReview } from "@/components/lostfound/claim-review";
import { MyClaim } from "@/components/lostfound/my-claim";
import { MessageButton } from "@/components/profile/message-button";
import { closeLfItem, deleteLfItem, moderateLfItem } from "@/lib/actions/lostfound";
import { LF_CATEGORY_META, LF_STATUS_META, rankMatches, type LfCategory, type MatchableItem } from "@/lib/lostfound";

export const metadata: Metadata = { title: "Lost & Found item" };

export default async function LfItemPage({ params }: PageProps<"/lost-found/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  const { data: item } = await v.supabase
    .from("lost_found_items")
    .select("*, owner:profiles!lost_found_items_owner_id_fkey(id, handle, full_name, avatar_url)")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();
  const isOwner = item.owner_id === v.userId;
  const meta = LF_CATEGORY_META[item.category as LfCategory];
  const st = LF_STATUS_META[item.status];

  // Candidate matches: opposite kind, same category, open, within ±21 days (scored transparently in TS).
  const from = new Date(Date.parse(item.occurred_on) - 21 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(item.occurred_on) + 21 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: candidates }, { data: claims }, { data: secret }, { data: myLost }] = await Promise.all([
    v.supabase
      .from("lost_found_items")
      .select("id, kind, category, title, description, location_label, occurred_on, owner_id")
      .neq("kind", item.kind)
      .eq("category", item.category)
      .eq("status", "open")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .limit(50),
    v.supabase
      .from("lost_found_claims")
      .select("id, claimant_id, details, status, review_note, dispute_reason, created_at, lost_item_id, claimant:profiles!lost_found_claims_claimant_id_fkey(handle, full_name, avatar_url)")
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
    isOwner || v.isModerator ? v.supabase.from("lost_found_secrets").select("details").eq("item_id", id).maybeSingle() : Promise.resolve({ data: null }),
    item.kind === "found" && !isOwner ? v.supabase.from("lost_found_items").select("id, title").eq("owner_id", v.userId).eq("kind", "lost").eq("status", "open") : Promise.resolve({ data: null }),
  ]);
  const matches = rankMatches(item as MatchableItem, (candidates ?? []) as MatchableItem[]).slice(0, 6);
  const myClaim = (claims ?? []).find((c) => c.claimant_id === v.userId && ["pending", "approved", "disputed", "rejected", "completed"].includes(c.status));
  const showImage = item.image_path && (!item.is_sensitive || isOwner || v.isModerator);
  const { data: signed } = showImage ? await v.supabase.storage.from("lostfound").createSignedUrl(item.image_path!, 900) : { data: null };

  return (
    <div>
      <PageHeader
        back={{ href: "/lost-found", label: "Lost & Found" }}
        eyebrow={
          <>
            <ToneBadge tone={item.kind === "lost" ? "warning" : "info"}>{item.kind === "lost" ? "Lost item" : "Found item"}</ToneBadge>
            <ToneBadge tone={st.tone}>{st.label}</ToneBadge>
            {item.is_sensitive && <ToneBadge tone="danger">Sensitive</ToneBadge>}
            {item.is_demo && <ToneBadge>Fictional demo listing</ToneBadge>}
          </>
        }
        title={<span className="flex items-center gap-3"><span aria-hidden>{meta.emoji}</span>{item.title}</span>}
        description={`${meta.label} · ${item.kind === "lost" ? "Lost" : "Found"} near ${item.location_label} on ${formatDate(item.occurred_on)}`}
        actions={
          <>
            {isOwner && item.status === "open" && (
              <ActionButton action={closeLfItem} input={{ itemId: id }} variant="outline" confirm={{ title: "Close this listing?", description: "Use this if the item was recovered another way.", confirmLabel: "Close listing" }}>
                Close listing
              </ActionButton>
            )}
            {isOwner && ["open", "closed", "expired"].includes(item.status) && (
              <ActionButton action={deleteLfItem} input={{ itemId: id }} variant="destructive" confirm={{ title: "Delete this listing?", confirmLabel: "Delete", destructive: true }} redirectTo="/lost-found">
                Delete
              </ActionButton>
            )}
            {!isOwner && <FlagButton targetType="lf_item" targetId={id} label="Report listing" />}
          </>
        }
      />

      {item.is_sensitive && (
        <div role="note" className="mb-6 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p>Identity documents, wallets and phones are returned through the <strong>campus security office</strong>. Bring your student ID to collect. Never share ID or card numbers in messages.</p>
        </div>
      )}
      {item.moderation_note && (isOwner || v.isModerator) && (
        <p className="mb-6 rounded-lg bg-muted p-3 text-sm"><span className="font-medium">Moderator note:</span> {item.moderation_note}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              {signed?.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signed.signedUrl} alt={`Photo of ${item.title}`} className="h-44 w-full rounded-lg object-cover ring-1 ring-border sm:w-56" />
              ) : item.image_path ? (
                <div className="grid h-44 w-full place-items-center rounded-lg bg-muted text-center text-xs text-muted-foreground sm:w-56">
                  <span><EyeOff className="mx-auto mb-1 size-5" /> Photo hidden for privacy</span>
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserAvatar name={item.owner?.full_name ?? "Member"} src={item.owner?.avatar_url} size="xs" />
                  Posted by {item.owner ? item.owner.full_name : "a member"} · <TimeAgo date={item.created_at} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Contact: {item.contact_pref === "security_office" ? "via campus security office" : "private in-app claim / message"}</p>
              </div>
            </div>
          </section>

          {(isOwner || v.isModerator) && secret && (
            <section className="rounded-xl border border-primary/30 bg-card p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lock className="size-3.5" /> Private verification details</h2>
              <p className="text-sm text-muted-foreground">{secret.details}</p>
              <p className="mt-2 text-xs text-muted-foreground">Only you{v.isModerator && !isOwner ? " (moderator)" : " and moderators"} can see this. Compare it with what claimants describe.</p>
            </section>
          )}

          <section id="matches" className="scroll-mt-24">
            <h2 className="mb-1 flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Possible matches</h2>
            <p className="mb-3 text-xs text-muted-foreground">Suggestions based on category, shared description words, location and date proximity. A suggestion is not a confirmed match — ownership is verified through a private claim.</p>
            {matches.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No likely {item.kind === "lost" ? "found" : "lost"} reports yet. You&apos;ll be notified if one is posted.</p>
            ) : (
              <ul className="space-y-2">
                {matches.map(({ item: m, match }) => (
                  <li key={m.id}>
                    <Link href={`/lost-found/${m.id}`} className="block rounded-xl border bg-card p-4 hover:border-primary/40">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{m.title}</p>
                        <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums" aria-label={`Match score ${match.score} out of 100`}>{match.score}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.kind === "lost" ? "Lost" : "Found"} near {m.location_label} · {formatDate(m.occurred_on)}</p>
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {match.reasons.map((r) => <li key={r}>• {r}</li>)}
                      </ul>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {isOwner || v.isModerator ? (
            item.kind === "found" ? (
              <ClaimReview itemId={id} claims={(claims ?? []).map((c) => ({ ...c, claimant: c.claimant }))} isModerator={v.isModerator && !isOwner} />
            ) : (
              <section className="rounded-xl border bg-card p-5 text-sm">
                <p className="mb-1 font-medium">Waiting for a finder</p>
                <p className="text-muted-foreground">When someone posts a matching found item you&apos;ll be notified. Open a match and submit a private claim with your verification details.</p>
              </section>
            )
          ) : item.kind === "found" ? (
            myClaim ? (
              <MyClaim claim={myClaim} sensitive={item.is_sensitive} />
            ) : item.status === "open" ? (
              <ClaimForm itemId={id} myLostItems={myLost ?? []} />
            ) : (
              <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">This item is not accepting new claims.</p>
            )
          ) : (
            <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
              <p className="font-medium">Think you found this?</p>
              <p className="text-muted-foreground">Post it as a found item so the owner can verify ownership privately{item.is_sensitive ? ", or hand it to the campus security office" : ""}.</p>
              <Link href="/lost-found/new?kind=found" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Post a found item</Link>
              {item.owner && !item.is_sensitive && <div><MessageButton userId={item.owner.id} label="Message the owner" /></div>}
            </section>
          )}

          {v.isModerator && (
            <section className="space-y-2 rounded-xl border border-warning/30 bg-card p-5">
              <h2 className="text-sm font-semibold">Moderator actions</h2>
              {item.flagged && <ToneBadge tone="danger">Flagged by users</ToneBadge>}
              <div className="flex flex-wrap gap-2">
                {item.status !== "removed" && <ActionButton action={moderateLfItem} input={{ itemId: id, action: "remove", note: "Removed by moderator" }} size="sm" variant="destructive" confirm={{ title: "Remove listing?", confirmLabel: "Remove", destructive: true }}>Remove</ActionButton>}
                {item.status === "removed" && <ActionButton action={moderateLfItem} input={{ itemId: id, action: "restore" }} size="sm" variant="outline">Restore</ActionButton>}
                {item.flagged && <ActionButton action={moderateLfItem} input={{ itemId: id, action: "clear_flag" }} size="sm" variant="outline">Clear flag</ActionButton>}
                {item.status === "open" && <ActionButton action={moderateLfItem} input={{ itemId: id, action: "expire" }} size="sm" variant="ghost">Mark expired</ActionButton>}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
