import { format, formatDistanceToNowStrict } from "date-fns";

/** Relative time with an absolute tooltip. Rendered on the server; suppressHydrationWarning guards drift. */
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={format(d, "PPpp")} className={className} suppressHydrationWarning>
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}

const IST = "Asia/Kolkata";

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}
