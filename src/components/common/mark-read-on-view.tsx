"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/lib/actions/social";

export function MarkReadOnView({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    const t = setTimeout(() => markNotificationsRead({ ids: key.split(",") }), 1500);
    return () => clearTimeout(t);
  }, [key]);
  return null;
}
