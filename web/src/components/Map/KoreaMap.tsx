"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RegionData } from "@/lib/types";
import { KOREA_CENTER, getHealthColor, CARTO_DARK_TILE_URL } from "@/lib/constants";

interface KoreaMapProps {
  regions: RegionData[];
  geojson: GeoJSON.FeatureCollection | null;
  selectedRegion: string | null;
  onRegionSelect: (code: string | null) => void;
}

export default function KoreaMap({
  regions,
  geojson,
  selectedRegion,
  onRegionSelect,
}: KoreaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Build lookup map
  const regionMap = useCallback(() => {
    const m = new Map<string, RegionData>();
    regions.forEach((r) => m.set(r.code, r));
    return m;
  }, [regions]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [CARTO_DARK_TILE_URL],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap &copy; CARTO",
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [KOREA_CENTER.longitude, KOREA_CENTER.latitude],
      zoom: KOREA_CENTER.zoom,
      minZoom: 5,
      maxZoom: 14,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on("load", () => {
      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add/update GeoJSON layer
  useEffect(() => {
    if (!mapReady || !map.current || !geojson) return;

    const lookup = regionMap();

    // Inject health_score into feature properties
    const enriched: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geojson.features.map((f) => {
        const code = f.properties?.code;
        const data = code ? lookup.get(code) : null;
        return {
          ...f,
          properties: {
            ...f.properties,
            healthScore: data?.healthScore ?? 50,
            companyCount: data?.companyCount ?? 0,
            employeeCount: data?.employeeCount ?? 0,
            growthRate: data?.growthRate ?? 0,
            fillColor: getHealthColor(data?.healthScore ?? 50),
          },
        };
      }),
    };

    // Remove existing source/layers if present
    if (map.current.getSource("regions")) {
      map.current.removeLayer("region-borders");
      map.current.removeLayer("region-fills");
      map.current.removeLayer("region-highlight");
      map.current.removeSource("regions");
    }

    map.current.addSource("regions", {
      type: "geojson",
      data: enriched,
    });

    // Fill layer
    map.current.addLayer({
      id: "region-fills",
      type: "fill",
      source: "regions",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.85,
          0.65,
        ],
      },
    });

    // Border layer
    map.current.addLayer({
      id: "region-borders",
      type: "line",
      source: "regions",
      paint: {
        "line-color": "#ffffff",
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2,
          0.5,
        ],
        "line-opacity": 0.6,
      },
    });

    // Highlight layer for selected region
    map.current.addLayer({
      id: "region-highlight",
      type: "line",
      source: "regions",
      paint: {
        "line-color": "#3b82f6",
        "line-width": 3,
        "line-opacity": 1,
      },
      filter: ["==", "code", ""],
    });

    // Hover interaction
    let hoveredId: string | null = null;

    map.current.on("mousemove", "region-fills", (e) => {
      if (!map.current || !e.features?.length) return;
      map.current.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      const props = feature.properties;

      if (hoveredId !== null) {
        map.current.setFeatureState(
          { source: "regions", id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = feature.id as string;
      map.current.setFeatureState(
        { source: "regions", id: hoveredId },
        { hover: true }
      );

      // Tooltip
      if (popup.current) {
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px">
              <strong>${props?.name || ""}</strong><br/>
              건강도: <span style="color:${props?.fillColor}">${(props?.healthScore ?? 0).toFixed(1)}</span><br/>
              기업수: ${(props?.companyCount ?? 0).toLocaleString()}<br/>
              고용: ${(props?.employeeCount ?? 0).toLocaleString()}
            </div>`
          )
          .addTo(map.current);
      }
    });

    map.current.on("mouseleave", "region-fills", () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = "";
      if (hoveredId !== null) {
        map.current.setFeatureState(
          { source: "regions", id: hoveredId },
          { hover: false }
        );
      }
      hoveredId = null;
      popup.current?.remove();
    });

    // Click interaction
    map.current.on("click", "region-fills", (e) => {
      if (!e.features?.length) return;
      const code = e.features[0].properties?.code;
      if (code) onRegionSelect(code);
    });
  }, [mapReady, geojson, regions, regionMap, onRegionSelect]);

  // Update highlight when selection changes
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (map.current.getLayer("region-highlight")) {
      map.current.setFilter("region-highlight", [
        "==",
        "code",
        selectedRegion ?? "",
      ]);
    }
  }, [mapReady, selectedRegion]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
