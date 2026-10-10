import Link from "next/link";
import { Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/common/user-avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { AFFILIATION_LABELS } from "@/lib/constants";

export interface PersonCardData {
  id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  affiliation: keyof typeof AFFILIATION_LABELS;
  department: string | null;
  skills: string[];
  interests: string[];
}

export function PersonCard({ person, following, reasons }: { person: PersonCardData; following: boolean; reasons?: string[] }) {
  const tags = [...person.interests.slice(0, 3), ...person.skills.slice(0, 2)];
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <UserAvatar name={person.full_name} src={person.avatar_url} />
        <div className="min-w-0 flex-1">
          <Link href={`/profile/${person.handle}`} className="block truncate font-medium hover:underline">{person.full_name}</Link>
          <p className="truncate text-xs text-muted-foreground">
            {AFFILIATION_LABELS[person.affiliation]}
            {person.department && ` · ${person.department}`}
          </p>
        </div>
      </div>
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1" aria-label="Interests and skills">
          {tags.map((t) => (
            <li key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t}</li>
          ))}
        </ul>
      )}
      {reasons && reasons.length > 0 && (
        <p className="mt-3 flex gap-1.5 text-xs text-primary">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          <span>{reasons.slice(0, 2).join(" · ")}</span>
        </p>
      )}
      <div className="mt-auto pt-4">
        <FollowButton userId={person.id} following={following} className="w-full" />
      </div>
    </div>
  );
}
