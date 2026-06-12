"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapSchool = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string;
  tier: string;
  lat: number;
  lng: number;
};

// Brand rules carried onto the map: emerald is accreditation-only,
// navy for verified.
const PIN_COLORS: Record<string, string> = {
  accredited: "#059669", // emerald-600
  verified: "#24509e", // brand-600
  listed: "#78716c", // stone-500
};

export function DirectoryMap({
  schools,
  height = "h-[600px]",
  zoomToSingle = false,
}: {
  schools: MapSchool[];
  height?: string;
  zoomToSingle?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current || schools.length === 0) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [schools[0].lng, schools[0].lat],
      zoom: zoomToSingle ? 12 : 2,
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

    const bounds = new mapboxgl.LngLatBounds();
    for (const s of schools) {
      const popup = new mapboxgl.Popup({ offset: 24, closeButton: false }).setHTML(
        `<div style="font-family:inherit;min-width:160px">
           <a href="/directory/${s.slug}" style="font-weight:600;color:#1c1917;text-decoration:none">${s.name}</a>
           <div style="font-size:12px;color:#78716c;margin-top:2px">${s.city ? `${s.city}, ` : ""}${s.country}</div>
           ${
             s.tier === "accredited"
               ? '<div style="font-size:11px;font-weight:600;color:#065f46;margin-top:4px">GSA Accredited</div>'
               : s.tier === "verified"
                 ? '<div style="font-size:11px;font-weight:600;color:#17356c;margin-top:4px">GSA Verified</div>'
                 : ""
           }
         </div>`
      );
      new mapboxgl.Marker({ color: PIN_COLORS[s.tier] ?? PIN_COLORS.listed })
        .setLngLat([s.lng, s.lat])
        .setPopup(popup)
        .addTo(map);
      bounds.extend([s.lng, s.lat]);
    }
    if (schools.length > 1) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 10 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [schools, zoomToSingle]);

  if (schools.length === 0) return null;
  return (
    <div
      ref={container}
      className={`${height} w-full overflow-hidden rounded-2xl border border-stone-200/70 shadow-sm`}
    />
  );
}
