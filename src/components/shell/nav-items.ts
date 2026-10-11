import {
  CalendarDays, ClipboardList, Compass, FileWarning, FlaskConical, House, MessageCircle,
  MessagesSquare, ShieldAlert, ShieldCheck, User,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/communities", label: "Communities", icon: MessagesSquare },
  { href: "/clubs", label: "Clubs & Events", icon: CalendarDays, also: ["/events"] },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/incidents", label: "Incident reports", icon: FileWarning },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export const STAFF_ITEMS = {
  reviewer: { href: "/incidents/review", label: "Incident review desk", icon: ClipboardList },
  shield: { href: "/shield", label: "CampusShield", icon: ShieldAlert },
  admin: { href: "/admin", label: "Admin & moderation", icon: ShieldCheck },
} as const;

/** Bottom bar on mobile: the five most-used destinations. */
export const MOBILE_PRIMARY = ["/home", "/communities", "/clubs", "/discover", "/messages"] as const;

export function isActive(pathname: string, href: string, also: readonly string[] = []) {
  if (href === "/incidents" && pathname.startsWith("/incidents/review")) return false;
  return [href, ...also].some((h) => pathname === h || pathname.startsWith(h + "/"));
}
