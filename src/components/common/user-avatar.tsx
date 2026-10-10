import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-lg", xl: "size-24 text-2xl" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Deterministic hue per name so fallback avatars are distinguishable. */
function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function UserAvatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: keyof typeof SIZES; className?: string }) {
  return (
    <Avatar className={cn(SIZES[size], "shrink-0", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className="font-semibold text-white"
        style={{ background: `linear-gradient(135deg, oklch(0.55 0.11 ${hue(name)}), oklch(0.42 0.09 ${(hue(name) + 40) % 360}))` }}
      >
        {initials(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
