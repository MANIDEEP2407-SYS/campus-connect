import {
  BookOpen, CalendarDays, ClipboardList, Compass, FlaskConical, House, MessageCircle,
  MessagesSquare, ShieldAlert, ShieldCheck, Siren, User,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/communities", label: "Communities", icon: MessagesSquare },
  { href: "/clubs", label: "Clubs & Events", icon: CalendarDays, also: ["/events"] },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/pulse", label: "CampusPulse", icon: Siren },
  { href: "/resources", label: "Academic Resources", icon: BookOpen },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export const STAFF_ITEMS = {
  responder: { href: "/pulse/responder", label: "Responder desk", icon: ClipboardList },
  shield: { href: "/shield", label: "CampusShield", icon: ShieldAlert },
  admin: { href: "/admin", label: "Admin & moderation", icon: ShieldCheck },
} as const;

/** Bottom bar on mobile: the five most-used destinations. */
export const MOBILE_PRIMARY = ["/home", "/communities", "/clubs", "/pulse", "/messages"] as const;

export function isActive(pathname: string, href: string, also: readonly string[] = []) {
  if (href === "/pulse" && pathname.startsWith("/pulse/responder")) return false;
  return [href, ...also].some((h) => pathname === h || pathname.startsWith(h + "/"));
}
