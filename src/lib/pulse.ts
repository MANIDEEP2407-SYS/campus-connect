// CampusPulse domain rules. The database (pulse_can_transition) is authoritative; this mirror
// drives the UI and is unit-tested against the same table.

export const PULSE_STATUSES = [
  "submitted", "under_review", "verified", "assigned", "in_progress", "resolved", "rejected", "closed",
] as const;
export type PulseStatus = (typeof PULSE_STATUSES)[number];

export const PULSE_CATEGORIES = [
  "water_sanitation", "electricity_lighting", "wifi_network", "maintenance_infrastructure",
  "waste_management", "wildlife", "safety_hazard", "other",
] as const;
export type PulseCategory = (typeof PULSE_CATEGORIES)[number];

export const PULSE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type PulseSeverity = (typeof PULSE_SEVERITIES)[number];

export const TRANSITIONS: Record<PulseStatus, readonly PulseStatus[]> = {
  submitted: ["under_review", "verified", "rejected", "closed"],
  under_review: ["verified", "rejected", "closed"],
  verified: ["assigned", "in_progress", "resolved", "closed"],
  assigned: ["in_progress", "resolved", "closed"],
  in_progress: ["assigned", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  rejected: [],
  closed: [],
};

export function canTransition(from: PulseStatus, to: PulseStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Which inputs a transition requires — mirrors the checks in pulse_transition(). */
export function transitionRequirements(to: PulseStatus): { note: boolean; assignee: boolean } {
  return { note: to === "rejected" || to === "closed" || to === "resolved", assignee: to === "assigned" };
}

export function isTerminal(s: PulseStatus) {
  return s === "rejected" || s === "closed";
}

export function isSafetyCategory(c: PulseCategory) {
  return c === "wildlife" || c === "safety_hazard";
}

export function priorityScore(sev: PulseSeverity, cat: PulseCategory): number {
  const base = { critical: 40, high: 30, medium: 20, low: 10 }[sev];
  const boost = isSafetyCategory(cat) ? 15 : cat === "electricity_lighting" || cat === "water_sanitation" ? 5 : 0;
  return base + boost;
}

export const CATEGORY_META: Record<PulseCategory, { label: string; emoji: string; subcategories: string[] }> = {
  water_sanitation: { label: "Water & sanitation", emoji: "💧", subcategories: ["No water supply", "Leaking tap/pipe", "Washroom issue", "Drinking water", "Drainage"] },
  electricity_lighting: { label: "Electricity & lighting", emoji: "💡", subcategories: ["Power outage", "Street light out", "Damaged switch/socket", "Exposed wiring"] },
  wifi_network: { label: "Wi-Fi & network", emoji: "📶", subcategories: ["No connectivity", "Slow network", "Login portal issue", "Lab network"] },
  maintenance_infrastructure: { label: "Maintenance & infrastructure", emoji: "🛠️", subcategories: ["Broken furniture", "Damaged pathway", "Lift not working", "AC/fan issue", "Door/window"] },
  waste_management: { label: "Waste management", emoji: "♻️", subcategories: ["Overflowing bin", "Littering", "Blocked drain", "Uncollected waste"] },
  wildlife: { label: "Wildlife sighting", emoji: "🐍", subcategories: ["Snake", "Stray dogs", "Monkeys", "Bees/wasps", "Other animal"] },
  safety_hazard: { label: "Safety hazard", emoji: "⚠️", subcategories: ["Fallen branch/tree", "Exposed electrical wire", "Slippery surface", "Open pit/manhole", "Fire risk"] },
  other: { label: "Other campus issue", emoji: "📌", subcategories: [] },
};

export const STATUS_META: Record<PulseStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" | "primary" }> = {
  submitted: { label: "Submitted", tone: "neutral" },
  under_review: { label: "Under review", tone: "info" },
  verified: { label: "Verified", tone: "warning" },
  assigned: { label: "Assigned", tone: "primary" },
  in_progress: { label: "In progress", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  closed: { label: "Closed", tone: "neutral" },
};

export const SEVERITY_META: Record<PulseSeverity, { label: string; tone: "neutral" | "info" | "warning" | "danger"; color: string }> = {
  low: { label: "Low", tone: "neutral", color: "#94a3b8" },
  medium: { label: "Medium", tone: "info", color: "#60a5fa" },
  high: { label: "High", tone: "warning", color: "#f59e0b" },
  critical: { label: "Critical", tone: "danger", color: "#ef4444" },
};

export const SAFETY_NOTICE =
  "Stay at a safe distance. Do not approach, handle, chase or photograph animals or hazards up close. " +
  "If anyone is in immediate danger, contact campus security or emergency services directly — CampusPulse is not an emergency line.";
