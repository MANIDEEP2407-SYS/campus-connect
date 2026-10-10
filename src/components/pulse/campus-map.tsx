"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapPoint } from "@/components/pulse/leaflet-map";

export type { MapPoint };

const LeafletMap = dynamic(() => import("@/components/pulse/leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-72 w-full rounded-lg" />,
});

export function CampusMap(props: React.ComponentProps<typeof LeafletMap>) {
  return (
    <div className="overflow-hidden rounded-lg border" role="region" aria-label="Campus map (approximate locations)">
      <LeafletMap {...props} />
    </div>
  );
}
