import { describe, expect, it } from "vitest";
import { PULSE_STATUSES, TRANSITIONS, canTransition, isTerminal, priorityScore, transitionRequirements } from "@/lib/pulse";

describe("CampusPulse lifecycle", () => {
  it("allows the happy path submitted → verified → assigned → in_progress → resolved → closed", () => {
    const path = ["submitted", "verified", "assigned", "in_progress", "resolved", "closed"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("rejects skipping verification and leaving terminal states", () => {
    expect(canTransition("submitted", "resolved")).toBe(false);
    expect(canTransition("submitted", "assigned")).toBe(false);
    expect(canTransition("under_review", "in_progress")).toBe(false);
    for (const s of PULSE_STATUSES) {
      expect(canTransition("rejected", s)).toBe(false);
      expect(canTransition("closed", s)).toBe(false);
    }
  });

  it("never allows self-transitions", () => {
    for (const s of PULSE_STATUSES) expect(canTransition(s, s)).toBe(false);
  });

  it("only terminal states have no exits", () => {
    for (const s of PULSE_STATUSES) expect(TRANSITIONS[s].length === 0).toBe(isTerminal(s));
  });

  it("requires notes for reject/close/resolve and an assignee for assign", () => {
    expect(transitionRequirements("rejected")).toEqual({ note: true, assignee: false });
    expect(transitionRequirements("closed").note).toBe(true);
    expect(transitionRequirements("resolved").note).toBe(true);
    expect(transitionRequirements("assigned")).toEqual({ note: false, assignee: true });
    expect(transitionRequirements("verified")).toEqual({ note: false, assignee: false });
  });

  it("prioritises safety categories and severity (mirrors pulse_priority())", () => {
    expect(priorityScore("high", "wildlife")).toBe(45);
    expect(priorityScore("critical", "safety_hazard")).toBe(55);
    expect(priorityScore("medium", "water_sanitation")).toBe(25);
    expect(priorityScore("low", "wifi_network")).toBe(10);
    expect(priorityScore("medium", "wildlife")).toBeGreaterThan(priorityScore("high", "wifi_network"));
  });
});
