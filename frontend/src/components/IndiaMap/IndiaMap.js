"use client";

import { useEffect, useRef } from "react";

import "leaflet/dist/leaflet.css";
import styles from "./IndiaMap.module.css";

// Mainland India plus the island territories
const INDIA_BOUNDS = [
  [6.4, 68.0],
  [35.8, 97.5],
];

// OpenStreetMap standard tiles: free, no API key; attribution is required
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const PRIORITY_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#16a34a",
};

// Interactive map of monitoring sites. Leaflet touches `window`, so it is
// loaded on the client only.
export default function IndiaMap({ sites, selectedId, onSelect, picking, onPick, focus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const layerRef = useRef(null);
  const pickMarkerRef = useRef(null);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = { onSelect, onPick, picking };
  });

  // --------------------------------------------------
  // Create the map once
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((module) => {
      if (cancelled || mapRef.current) return;

      const L = module.default || module;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        minZoom: 4,
        maxBounds: [
          [-5, 55],
          [45, 110],
        ],
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19, className: styles.tiles }).addTo(map);

      map.fitBounds(INDIA_BOUNDS);

      map.on("click", (event) => {
        const { picking: isPicking, onPick: pick } = handlersRef.current;
        if (isPicking && pick) pick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Trigger the marker effect now that the map exists
      containerRef.current.dispatchEvent(new Event("mapready"));
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // Markers
  // --------------------------------------------------

  useEffect(() => {
    const draw = () => {
      const L = leafletRef.current;
      const layer = layerRef.current;
      if (!L || !layer) return;

      layer.clearLayers();

      for (const site of sites) {
        const level = site.stats.priority_level;
        const selected = site.id === selectedId;
        const radius = 7 + Math.min(14, Math.sqrt(site.stats.unresolved_items) * 1.6);

        const marker = L.circleMarker([site.latitude, site.longitude], {
          radius: selected ? radius + 4 : radius,
          color: selected ? "#0f3d2a" : "#ffffff",
          weight: selected ? 3 : 2,
          fillColor: PRIORITY_COLORS[level] || PRIORITY_COLORS.low,
          fillOpacity: 0.88,
        });

        marker.bindTooltip(
          `<strong>${escapeHtml(site.name)}</strong><br>${escapeHtml(site.district)}, ${escapeHtml(site.state)}<br>${site.stats.unresolved_items} uncleared items · ${level} priority`,
          { direction: "top", offset: [0, -radius], className: styles.tooltip }
        );

        marker.on("click", () => handlersRef.current.onSelect?.(site.id));
        marker.addTo(layer);

        if (selected) marker.bringToFront();
      }
    };

    draw();

    const container = containerRef.current;
    container.addEventListener("mapready", draw);
    return () => container.removeEventListener("mapready", draw);
  }, [sites, selectedId]);

  // --------------------------------------------------
  // Focus a site, or return to the national view
  // --------------------------------------------------

  useEffect(() => {
    const move = () => {
      const map = mapRef.current;
      if (!map || !focus) return;

      if (focus.type === "site") {
        map.flyTo([focus.latitude, focus.longitude], Math.max(map.getZoom(), 12), { duration: 0.8 });
      } else {
        map.flyToBounds(INDIA_BOUNDS, { duration: 0.8 });
      }
    };

    move();

    const container = containerRef.current;
    container.addEventListener("mapready", move);
    return () => container.removeEventListener("mapready", move);
  }, [focus]);

  // --------------------------------------------------
  // Placement cursor while adding a site
  // --------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    container.classList.toggle(styles.picking, Boolean(picking));

    const L = leafletRef.current;
    const map = mapRef.current;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;

    if (L && map && picking?.latitude) {
      pickMarkerRef.current = L.circleMarker([picking.latitude, picking.longitude], {
        radius: 10,
        color: "#0f3d2a",
        weight: 3,
        fillColor: "#ffffff",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [picking]);

  return <div ref={containerRef} className={styles.map} />;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
