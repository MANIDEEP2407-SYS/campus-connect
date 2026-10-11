"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/** Re-render the current server page when rows in `table` change (Realtime respects RLS). */
export function LiveRefresh({ table }: { table: "incidents" | "moderation_cases" }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = getBrowserClient();
    const ch = supabase
      .channel(`live:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 600);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [router, table]);
  return null;
}
