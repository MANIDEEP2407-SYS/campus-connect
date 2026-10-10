import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let admin: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client. Server-only, used exclusively by the CampusShield worker to read content
 * for scanning and to record scans through shield_ingest_scan(). Never import from client code.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
