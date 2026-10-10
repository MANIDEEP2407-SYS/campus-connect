import "server-only";
import { after } from "next/server";
import { processPendingScans, scanContent } from "@/lib/shield/service";
import type { ShieldContentType } from "@/lib/shield/types";

// Deliberately NOT a "use server" module: these must not be callable from the browser.

/** Scan new content after the response is sent. The DB job already exists, so a failure here is retried by the sweep. */
export function scheduleScan(type: ShieldContentType, id: string) {
  after(async () => {
    await scanContent(type, id);
  });
}

/** Drain a few queued jobs after the response (e.g. after a user report). */
export function scheduleSweep(limit = 5) {
  after(async () => {
    await processPendingScans(limit);
  });
}
