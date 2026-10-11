import { describe, expect, it } from "vitest";
import { INCIDENT_STATUSES, TRANSITIONS, canTransition, directionFor, isOpen, requiresNote } from "@/lib/incidents";

describe("incident lifecycle (mirror of incident_can_transition)", () => {
  it("only open reports can move, and closed outcomes are final", () => {
    for (const s of INCIDENT_STATUSES) expect(TRANSITIONS[s].length > 0).toBe(isOpen(s));
    expect(canTransition("submitted", "under_review")).toBe(true);
    expect(canTransition("under_review", "false_report")).toBe(true);
    expect(canTransition("under_review", "submitted")).toBe(false);
    expect(canTransition("action_taken", "under_review")).toBe(false);
    expect(TRANSITIONS.submitted).not.toContain("withdrawn");
  });

  it("every closing outcome requires a note", () => {
    expect(requiresNote("under_review")).toBe(false);
    for (const s of ["action_taken", "unsubstantiated", "false_report"] as const) expect(requiresNote(s)).toBe(true);
  });

  it("students report staff and teachers report students", () => {
    expect(directionFor("ug_student")).toBe("about_staff");
    expect(directionFor("phd_scholar")).toBe("about_staff");
    expect(directionFor("faculty")).toBe("about_student");
    expect(directionFor("staff")).toBe("about_student");
  });
});
