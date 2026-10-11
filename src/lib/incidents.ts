// Incident report domain rules. The database (incident_can_transition) is authoritative; this
// mirror drives the UI and is unit-tested against the same table.

export const INCIDENT_STATUSES = ["submitted", "under_review", "action_taken", "unsubstantiated", "false_report", "withdrawn"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_CATEGORIES = [
  "harassment", "sexual_harassment", "verbal_abuse", "discrimination", "threat_or_violence",
  "unprofessional_conduct", "academic_misconduct", "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export type IncidentDirection = "about_staff" | "about_student";

export const TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  submitted: ["under_review", "action_taken", "unsubstantiated", "false_report"],
  under_review: ["action_taken", "unsubstantiated", "false_report"],
  action_taken: [],
  unsubstantiated: [],
  false_report: [],
  withdrawn: [],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Closing outcomes need a written note — mirrors incident_transition(). */
export function requiresNote(to: IncidentStatus) {
  return to === "action_taken" || to === "unsubstantiated" || to === "false_report";
}

export function isOpen(s: IncidentStatus) {
  return s === "submitted" || s === "under_review";
}

/** Faculty and staff report students; everyone else reports teachers/staff. */
export function directionFor(affiliation: string): IncidentDirection {
  return affiliation === "faculty" || affiliation === "staff" ? "about_student" : "about_staff";
}

export const DIRECTION_META: Record<IncidentDirection, { label: string; subject: string; department: string }> = {
  about_staff: { label: "Student → teacher/staff", subject: "Teacher or staff member involved", department: "Their department" },
  about_student: { label: "Teacher → student", subject: "Student involved", department: "Student's department" },
};

export const CATEGORY_META: Record<IncidentCategory, { label: string; hint: string }> = {
  harassment: { label: "Harassment or bullying", hint: "Repeated targeting, intimidation or humiliation" },
  sexual_harassment: { label: "Sexual harassment", hint: "Unwelcome sexual remarks, contact or advances" },
  verbal_abuse: { label: "Verbal abuse", hint: "Insults, shouting or abusive language" },
  discrimination: { label: "Discrimination", hint: "Unfair treatment based on identity or background" },
  threat_or_violence: { label: "Threat or violence", hint: "Threats, physical aggression or damage" },
  unprofessional_conduct: { label: "Unprofessional conduct", hint: "Misconduct during class, labs or official work" },
  academic_misconduct: { label: "Academic misconduct", hint: "Unfair assessment, cheating or plagiarism" },
  other: { label: "Other incident", hint: "Anything else the department should review" },
};

type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "primary";
export const STATUS_META: Record<IncidentStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "neutral" },
  under_review: { label: "Under review", tone: "info" },
  action_taken: { label: "Action taken", tone: "success" },
  unsubstantiated: { label: "Not substantiated", tone: "warning" },
  false_report: { label: "Found false", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const DISCLAIMER_TITLE = "Before you submit — please read";

export const DISCLAIMER_POINTS = [
  "Your report is sent confidentially to the reviewers of the department concerned and the central administration. It is never shown publicly and the person you name is not shown your identity by this app.",
  "Every report is reviewed and may be investigated. You may be contacted for a statement or evidence.",
  "Reports must be truthful and made in good faith. If an investigation finds that allegations were knowingly false, fabricated or malicious, the person who made them may face disciplinary action under university rules.",
  "A report that cannot be proven is not automatically false — honest reports made in good faith will not be penalised.",
  "This is not an emergency service. If anyone is in immediate danger, contact campus security or emergency services directly.",
] as const;

export const DECLARATION =
  "I confirm that this report is true to the best of my knowledge and made in good faith. I understand that knowingly false or malicious allegations may lead to disciplinary action against me.";
