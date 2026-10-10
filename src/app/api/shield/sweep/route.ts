import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processPendingScans } from "@/lib/shield/service";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled worker: scans queued content (incl. retries after provider outages) and applies the
 * retention policy. Protected by CRON_SECRET (Vercel Cron sends `Authorization: Bearer <secret>`).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scans = await processPendingScans(100);
  const db = getAdminClient();
  const retention = db ? (await db.rpc("shield_purge")).data : null;
  return NextResponse.json({ scans, retention });
}

export const GET = handle;
export const POST = handle;
