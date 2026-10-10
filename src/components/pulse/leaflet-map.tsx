"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useLayoutEffect, useRef } from "react";
import { CAMPUS_BOUNDS, CAMPUS_CENTER } from "@/lib/constants";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  sublabel?: string;
  href?: string;
  pulse?: boolean;
}

interface Props {
  points: MapPoint[];
  onPick?: (lat: number, lng: number) => void;
  picked?: [number, number] | null;
  height?: number;
  zoom?: number;
}

/** Popup content built with DOM APIs (labels are user content — never injected as HTML). */
function popupContent(p: MapPoint): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("p");
  title.style.cssText = "font-weight:600;margin:0";
  title.textContent = p.label;
  root.append(title);
  if (p.sublabel) {
    const sub = document.createElement("p");
    sub.style.cssText = "margin:2px 0 0;opacity:.75";
    sub.textContent = p.sublabel;
    root.append(sub);
  }
  if (p.href) {
    const a = document.createElement("a");
    a.href = p.href;
    a.style.cssText = "display:inline-block;margin-top:6px";
    a.textContent = "View details →";
    root.append(a);
  }
  return root;
}

/**
 * Leaflet + OpenStreetMap campus map, managed imperatively. One effect owns the whole map
 * lifecycle: it is created on mount and removed on cleanup. Next.js hides and re-shows visited
 * pages (re-running effects), so this guarantees a fresh, working map every time the page is shown.
 * Client-only (imported via next/dynamic).
 */
export default function LeafletMap({ points, onPick, picked, height = 420, zoom = 16 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const pickedRef = useRef<L.CircleMarker | null>(null);
  // Latest props for use inside the long-lived map effect (layout effects run before the effects below).
  const latest = useRef({ points, onPick, picked });
  useLayoutEffect(() => {
    latest.current = { points, onPick, picked };
  });

  const drawPoints = () => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();
    for (const p of latest.current.points) {
      L.circleMarker([p.lat, p.lng], {
        radius: p.pulse ? 11 : 8,
        color: p.color,
        fillColor: p.color,
        fillOpacity: 0.55,
        weight: p.pulse ? 3 : 2,
      })
        .bindPopup(() => popupContent(p))
        .addTo(group);
    }
  };

  const drawPicked = (fly: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    pickedRef.current?.remove();
    pickedRef.current = null;
    const pt = latest.current.picked;
    if (!pt) return;
    pickedRef.current = L.circleMarker(pt, { radius: 10, color: "#5eead4", fillColor: "#5eead4", fillOpacity: 0.4, weight: 3, dashArray: "4 3" }).addTo(map);
    if (fly) map.flyTo(pt, Math.max(map.getZoom(), 17), { duration: 0.5 });
  };

  // Map lifecycle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, {
      center: CAMPUS_CENTER,
      zoom,
      minZoom: 14,
      maxBounds: CAMPUS_BOUNDS,
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      latest.current.onPick?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });
    drawPoints();
    drawPicked(false);
    if (latest.current.picked) map.setView(latest.current.picked, Math.max(zoom, 17));
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      pickedRef.current = null;
    };
     
  }, [zoom]);

  // Data updates on the live map.
  useEffect(() => {
    drawPoints();
     
  }, [points]);
  useEffect(() => {
    drawPicked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.[0], picked?.[1]]);

  return <div ref={containerRef} style={{ height, width: "100%" }} className="isolate z-0" />;
}
