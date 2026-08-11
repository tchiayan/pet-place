"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Place } from "@/types/place";

const DEFAULT_CENTER: [number, number] = [4.2105, 108.9758]; // Malaysia centre
const DEFAULT_ZOOM = 6;

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Props {
  places: Place[];
  userLocation: [number, number] | null;
  onMarkerClick: (place: Place) => void;
  onBoundsChange: (bounds: Bounds) => void;
}

// Stable ref to avoid re-running the init effect when callbacks change
type Callbacks = {
  onMarkerClick: (p: Place) => void;
  onBoundsChange: (b: Bounds) => void;
};

export default function Map({ places, userLocation, onMarkerClick, onBoundsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const clusterRef = useRef<import("leaflet.markercluster").MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const cbRef = useRef<Callbacks>({ onMarkerClick, onBoundsChange });
  cbRef.current = { onMarkerClick, onBoundsChange };

  // Initialise map exactly once per mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Guard: if Leaflet already owns this DOM node (React StrictMode double-invoke),
    // remove the stale instance so we can re-initialise cleanly.
    const node = container as unknown as Record<string, unknown>;
    if (node._leaflet_id) {
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      delete node._leaflet_id;
    }

    let destroyed = false;

    (async () => {
      const L = await import("leaflet");

      // markercluster is a legacy UMD plugin — it looks for `L` on window.
      // Set window.L first, import the plugin, then read the augmented object back.
      (window as unknown as Record<string, unknown>).L = L;
      await import("leaflet.markercluster");
      // After the plugin runs it attaches .markerClusterGroup to window.L (which is L).

      if (destroyed) return; // component unmounted while we were awaiting

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(container, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: false });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Read markerClusterGroup from window.L (where the plugin attached it)
      type LWithCluster = typeof L & {
        markerClusterGroup: (opts?: object) => import("leaflet.markercluster").MarkerClusterGroup;
      };
      const cluster = (window as unknown as { L: LWithCluster }).L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 60,
      });
      map.addLayer(cluster);

      clusterRef.current = cluster;
      mapRef.current = map;

      const emitBounds = () => {
        const b = map.getBounds();
        cbRef.current.onBoundsChange({
          north: b.getNorth(), south: b.getSouth(),
          east: b.getEast(),  west: b.getWest(),
        });
      };
      map.on("moveend", emitBounds);
      emitBounds();
    })();

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      // Clear Leaflet's internal ID so the container can be reused
      delete (container as unknown as Record<string, unknown>)._leaflet_id;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers whenever the places list changes
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    import("leaflet").then((L) => {
      cluster.clearLayers();
      const markers = places
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((place) => {
          const m = L.marker([place.latitude!, place.longitude!]);
          m.bindPopup(
            `<strong>${place.name}</strong><br/>${place.category ?? ""}${
              place.seating ? " · " + place.seating : ""
            }`
          );
          m.on("click", () => cbRef.current.onMarkerClick(place));
          return m;
        });
      cluster.addLayers(markers);
    });
  }, [places]);

  // Pan to user location
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    import("leaflet").then((L) => {
      userMarkerRef.current?.remove();
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      userMarkerRef.current = L.marker(userLocation, { icon })
        .addTo(mapRef.current!)
        .bindPopup("You are here");
      mapRef.current!.setView(userLocation, 14);
    });
  }, [userLocation]);

  return <div ref={containerRef} className="h-full w-full" />;
}
