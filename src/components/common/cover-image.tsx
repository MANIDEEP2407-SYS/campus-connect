import { coverSrc } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Cover photo for clubs, events and communities. Without a cover it shows a soft gradient with
 * the item's emoji, so cards keep the same shape.
 */
export function CoverImage({
  src,
  width = 800,
  emoji,
  alt = "",
  className,
  priority = false,
}: {
  src: string | null | undefined;
  width?: number;
  emoji?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div aria-hidden className={cn("grid place-items-center bg-gradient-to-br from-primary/25 via-muted to-info/20 text-4xl", className)}>
        {emoji}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote covers are already sized by URL
    <img
      src={coverSrc(src, width)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("bg-muted object-cover", className)}
    />
  );
}
