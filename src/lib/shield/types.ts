// CampusShield shared types and labels (safe for client and server).

export const SHIELD_CATEGORIES = [
  "targeted_harassment", "repeated_bullying", "threats_intimidation", "hate_discrimination",
  "sexual_harassment", "doxxing", "other_harmful", "none",
] as const;
export type ShieldCategory = (typeof SHIELD_CATEGORIES)[number];

export const SHIELD_RISKS = ["low", "review", "high", "critical"] as const;
export type ShieldRisk = (typeof SHIELD_RISKS)[number];

export type ShieldContentType = "post" | "comment" | "message" | "direct_message";

export const CATEGORY_LABELS: Record<ShieldCategory, string> = {
  targeted_harassment: "Targeted harassment",
  repeated_bullying: "Possible repeated targeting",
  threats_intimidation: "Threat or intimidation",
  hate_discrimination: "Hate or discriminatory abuse",
  sexual_harassment: "Sexual harassment",
  doxxing: "Personal information exposure",
  other_harmful: "Other potentially harmful content",
  none: "No apparent policy violation",
};

export const RISK_META: Record<ShieldRisk, { label: string; tone: "neutral" | "info" | "warning" | "danger" }> = {
  low: { label: "Low risk", tone: "neutral" },
  review: { label: "Review recommended", tone: "info" },
  high: { label: "High priority", tone: "warning" },
  critical: { label: "Critical safety concern", tone: "danger" },
};

export const DECISION_LABELS = {
  no_action: "Reviewed — no action",
  dismissed_false_positive: "Dismissed (false positive)",
  warning: "Warning issued",
  edit_requested: "Edit requested",
  removed: "Content removed",
  restricted: "Posting restricted",
  escalated: "Escalated",
} as const;
export type ShieldDecision = keyof typeof DECISION_LABELS;

export const REPORT_CATEGORIES = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "threat", label: "Threat or intimidation" },
  { value: "hate", label: "Hate or discrimination" },
  { value: "sexual_harassment", label: "Sexual harassment" },
  { value: "personal_info", label: "Shares someone's personal information" },
  { value: "self_harm", label: "Someone may be at risk of self-harm" },
  { value: "spam", label: "Spam or scam" },
  { value: "other", label: "Something else" },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];
