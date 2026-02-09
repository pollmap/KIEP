"use client";

import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RegionData } from "@/lib/types";
import {
  KOREA_CENTER,
  getLayerColor,
  getRegionValue,
  formatLayerValue,
  getLayerDef,
  BASEMAP_TILES,
  DataLayerKey,
} from "@/lib/constants";

interface KoreaMapProps {
  regions: RegionData[];
  geojson: GeoJSON.FeatureCollection | null;
  selectedRegion: string | null;
  onRegionSelect: (code: string | null) => void;
  activeLayer: DataLayerKey;
}

export interface KoreaMapHandle {
  flyToRegion: (code: string) => void;
  flyToProvince: (prefix: string) => void;
  resetView: () => void;
}

const KoreaMap = forwardRef<KoreaMapHandle, KoreaMapProps>(function KoreaMap(
  { regions, geojson, selectedRegion, onRegionSelect, activeLayer },
  ref
) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const geojsonRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    geojsonRef.current = geojson;
  }, [geojson]);

  const regionLookup = useCallback(() => {
    const m = new Map<string, RegionData>();
    regions.forEach((r) => m.set(r.code, r));
    return m;
  }, [regions]);

  const calcBounds = useCallback((features: GeoJSON.Feature[]) => {
    const bounds = new maplibregl.LngLatBounds();
    const addCoords = (coords: unknown) => {
      if (Array.isArray(coords) && typeof coords[0] === "number") {
        bounds.extend(coords as [number, number]);
      } else if (Array.isArray(coords)) {
        coords.forEach((c) => addCoords(c));
      }
    };
    features.forEach((f) => {
      const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      addCoords(geom.coordinates);
    });
    return bounds;
  }, []);

  useImperativeHandle(ref, () => ({
    flyToRegion: (code: string) => {
      if (!map.current || !geojsonRef.current) return;
      const feature = geojsonRef.current.features.find(
        (f) => f.properties?.code === code
      );
      if (!feature) return;
      const bounds = calcBounds([feature]);
      map.current.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 11 });
    },
    flyToProvince: (prefix: string) => {
      if (!map.current || !geojsonRef.current) return;
      const features = geojsonRef.current.features.filter(
        (f) => f.properties?.code?.startsWith(prefix)
      );
      if (!features.length) return;
      const bounds = calcBounds(features);
      map.current.fitBounds(bounds, { padding: 40, duration: 800 });
    },
    resetView: () => {
      if (!map.current) return;
      map.current.flyTo({
        center: [KOREA_CENTER.longitude, KOREA_CENTER.latitude],
        zoom: KOREA_CENTER.zoom,
        duration: 800,
      });
    },
  }), [calcBounds]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [BASEMAP_TILES.url],
            tileSize: 256,
            attribution: BASEMAP_TILES.attribution,
          },
        },
        layers: [
          {
            id: "basemap-layer",
            type: "raster",
            source: "basemap",
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

    // Explicitly enable zoom interactions
    map.current.scrollZoom.enable();
    map.current.doubleClickZoom.enable();
    map.current.touchZoomRotate.enable();
    map.current.dragPan.enable();

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.current.on("load", () => setMapReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build color map for features
  const buildColorMap = useCallback(
    (lookup: Map<string, RegionData>, layer: DataLayerKey) => {
      const allValues = regions.map((r) => getRegionValue(r, layer));

      return (code: string): string => {
        const data = lookup.get(code);
        if (!data) return "#6b7280";
        const value = getRegionValue(data, layer);
        return getLayerColor(layer, value, allValues);
      };
    },
    [regions]
  );

  // Add/update GeoJSON layer
  useEffect(() => {
    if (!mapReady || !map.current || !geojson) return;

    const lookup = regionLookup();
    const colorFn = buildColorMap(lookup, activeLayer);
    const layerDef = getLayerDef(activeLayer);

    const enriched: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geojson.features.map((f) => {
        const code = f.properties?.code;
        const data = code ? lookup.get(code) : null;
        return {
          ...f,
          properties: {
            ...f.properties,
            province: data?.province ?? "",
            fillColor: colorFn(code || ""),
          },
        };
      }),
    };

    ["region-highlight", "region-borders", "region-fills"].forEach((id) => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
    });
    if (map.current.getSource("regions")) map.current.removeSource("regions");

    map.current.addSource("regions", { type: "geojson", data: enriched });

    map.current.addLayer({
      id: "region-fills",
      type: "fill",
      source: "regions",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.88,
          0.7,
        ],
      },
    });

    map.current.addLayer({
      id: "region-borders",
      type: "line",
      source: "regions",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#ffffff",
          "rgba(255,255,255,0.25)",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2,
          0.5,
        ],
      },
    });

    map.current.addLayer({
      id: "region-highlight",
      type: "line",
      source: "regions",
      paint: { "line-color": "#3b82f6", "line-width": 3 },
      filter: ["==", "code", ""],
    });

    let hoveredId: string | number | null = null;

    const onMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!map.current || !e.features?.length) return;
      map.current.getCanvas().style.cursor = "pointer";

      const feature = e.features[0];
      const code = feature.properties?.code;
      const data = code ? lookup.get(code) : null;

      if (hoveredId !== null) {
        map.current.setFeatureState({ source: "regions", id: hoveredId }, { hover: false });
      }
      hoveredId = feature.id ?? null;
      if (hoveredId !== null) {
        map.current.setFeatureState({ source: "regions", id: hoveredId }, { hover: true });
      }

      if (popup.current && data) {
        const value = getRegionValue(data, activeLayer);
        const formatted = formatLayerValue(value, activeLayer);
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.6">
              <strong>${data.name}</strong>
              <span style="color:#999;font-size:11px;margin-left:4px">${data.province}</span><br/>
              ${layerDef?.label ?? ""}: <b style="color:${colorFn(code)}">${formatted}</b><br/>
              기업: ${data.companyCount.toLocaleString()} &middot; 인구: ${data.population?.toLocaleString() ?? "N/A"}
            </div>`
          )
          .addTo(map.current);
      }
    };

    const onMouseLeave = () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = "";
      if (hoveredId !== null) {
        map.current.setFeatureState({ source: "regions", id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      popup.current?.remove();
    };

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const code = e.features?.[0]?.properties?.code;
      if (code) onRegionSelect(code);
    };

    // Double-click to zoom into region
    const onDblClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      const code = e.features?.[0]?.properties?.code;
      if (code && geojsonRef.current) {
        const feature = geojsonRef.current.features.find(
          (f) => f.properties?.code === code
        );
        if (feature && map.current) {
          const bounds = calcBounds([feature]);
          map.current.fitBounds(bounds, { padding: 80, duration: 800, maxZoom: 12 });
        }
      }
    };

    map.current.on("mousemove", "region-fills", onMouseMove);
    map.current.on("mouseleave", "region-fills", onMouseLeave);
    map.current.on("click", "region-fills", onClick);
    map.current.on("dblclick", "region-fills", onDblClick);

    return () => {
      map.current?.off("mousemove", "region-fills", onMouseMove);
      map.current?.off("mouseleave", "region-fills", onMouseLeave);
      map.current?.off("click", "region-fills", onClick);
      map.current?.off("dblclick", "region-fills", onDblClick);
    };
  }, [mapReady, geojson, regions, activeLayer, regionLookup, buildColorMap, onRegionSelect, calcBounds]);

  // Highlight selected
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (map.current.getLayer("region-highlight")) {
      map.current.setFilter("region-highlight", ["==", "code", selectedRegion ?? ""]);
    }
  }, [mapReady, selectedRegion]);

  return <div ref={mapContainer} className="w-full h-full" />;
});

export default KoreaMap;
