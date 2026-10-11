import { describe, expect, it } from "vitest";
import {
  INCIDENT_CATEGORIES, INCIDENT_STATUSES, TRANSITIONS, canTransition, categoriesFor, directionFor, isOpen, requiresNote, subjectKindsFor,
} from "@/lib/incidents";

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
});

describe("who can report whom (mirror of incident_submit)", () => {
  it("teachers and staff report students only", () => {
    expect(subjectKindsFor("faculty")).toEqual(["student"]);
    expect(subjectKindsFor("staff")).toEqual(["student"]);
    expect(directionFor("faculty", "student")).toBe("about_student");
  });

  it("students report teachers/staff or other students", () => {
    expect(subjectKindsFor("ug_student")).toEqual(["staff", "student"]);
    expect(directionFor("ug_student", "staff")).toBe("about_staff");
    expect(directionFor("phd_scholar", "student")).toBe("about_peer");
  });

  it("student-to-student reports are limited to plagiarism and work theft", () => {
    expect(categoriesFor("about_peer")).toEqual(["plagiarism", "idea_theft"]);
    expect(categoriesFor("about_student")).toEqual(INCIDENT_CATEGORIES);
    expect(categoriesFor("about_student")).toContain("idea_theft");
    expect(categoriesFor("about_staff")).toEqual(INCIDENT_CATEGORIES);
  });
});
