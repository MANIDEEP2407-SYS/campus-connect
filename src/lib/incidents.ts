// Incident report domain rules. The database (incident_can_transition) is authoritative; this
// mirror drives the UI and is unit-tested against the same table.

export const INCIDENT_STATUSES = ["submitted", "under_review", "action_taken", "unsubstantiated", "false_report", "withdrawn"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_CATEGORIES = [
  "harassment", "sexual_harassment", "verbal_abuse", "discrimination", "threat_or_violence",
  "unprofessional_conduct", "plagiarism", "idea_theft", "academic_misconduct", "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export type IncidentDirection = "about_staff" | "about_student" | "about_peer";
export type SubjectKind = "staff" | "student";

/** Students reporting other students may only use these — mirrors incidents_peer_category_check. */
export const PEER_CATEGORIES = ["plagiarism", "idea_theft"] as const satisfies readonly IncidentCategory[];

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

export function isStaffAffiliation(affiliation: string) {
  return affiliation === "faculty" || affiliation === "staff";
}

/** Teachers/staff report students; students report teachers/staff or (for work theft) other students. */
export function subjectKindsFor(affiliation: string): readonly SubjectKind[] {
  return isStaffAffiliation(affiliation) ? ["student"] : ["staff", "student"];
}

/** Mirrors incident_submit(): the direction follows from the reporter and who is reported. */
export function directionFor(affiliation: string, subject: SubjectKind): IncidentDirection {
  if (isStaffAffiliation(affiliation)) return "about_student";
  return subject === "staff" ? "about_staff" : "about_peer";
}

export function categoriesFor(direction: IncidentDirection): readonly IncidentCategory[] {
  return direction === "about_peer" ? PEER_CATEGORIES : INCIDENT_CATEGORIES;
}

export const DIRECTION_META: Record<IncidentDirection, { label: string; subject: string; department: string }> = {
  about_staff: { label: "Student → teacher/staff", subject: "Teacher or staff member involved", department: "Their department" },
  about_student: { label: "Teacher → student", subject: "Student involved", department: "Student's department" },
  about_peer: { label: "Student → student", subject: "Student involved", department: "Student's department" },
};

export const CATEGORY_META: Record<IncidentCategory, { label: string; hint: string }> = {
  harassment: { label: "Harassment or bullying", hint: "Repeated targeting, intimidation or humiliation" },
  sexual_harassment: { label: "Sexual harassment", hint: "Unwelcome sexual remarks, contact or advances" },
  verbal_abuse: { label: "Verbal abuse", hint: "Insults, shouting or abusive language" },
  discrimination: { label: "Discrimination", hint: "Unfair treatment based on identity or background" },
  threat_or_violence: { label: "Threat or violence", hint: "Threats, physical aggression or damage" },
  unprofessional_conduct: { label: "Unprofessional conduct", hint: "Misconduct during class, labs or official work" },
  plagiarism: { label: "Plagiarism", hint: "Copied work, code or writing submitted without credit" },
  idea_theft: { label: "Idea or work theft", hint: "Took an idea, project or work and presented it as their own, e.g. to another teacher" },
  academic_misconduct: { label: "Academic misconduct", hint: "Unfair assessment, cheating in exams or other dishonesty" },
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
