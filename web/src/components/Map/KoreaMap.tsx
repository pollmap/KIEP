"use client";

import { useEffect, useRef, useCallback, useMemo, useState, useImperativeHandle, forwardRef } from "react";
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
  showSubway?: boolean;
  showRoads?: boolean;
}

export interface KoreaMapHandle {
  flyToRegion: (code: string) => void;
  flyToProvince: (prefix: string) => void;
  resetView: () => void;
}

const KoreaMap = forwardRef<KoreaMapHandle, KoreaMapProps>(function KoreaMap(
  { regions, geojson, selectedRegion, onRegionSelect, activeLayer, showSubway = false, showRoads = false },
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

  const regionLookup = useMemo(() => {
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

    const lookup = regionLookup;
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
          0.85,
          0.65,
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
          "#475569",
          "rgba(148,163,184,0.4)",
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
      paint: { "line-color": "#2563eb", "line-width": 3 },
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
              <span style="color:#94a3b8;font-size:11px;margin-left:4px">${data.province}</span><br/>
              ${layerDef?.label ?? ""}: <b style="color:${colorFn(code)}">${formatted}</b><br/>
              사업체: ${data.companyCount.toLocaleString()} · 인구: ${data.population?.toLocaleString() ?? "N/A"}
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

  // Subway overlay
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;

    if (!m.getSource("subway-lines")) {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      fetch(`${base}/data/subway-lines.json`)
        .then((r) => r.json())
        .then((data) => {
          if (!m.getSource("subway-lines")) {
            m.addSource("subway-lines", { type: "geojson", data });
            m.addLayer({
              id: "subway-lines-layer",
              type: "line",
              source: "subway-lines",
              paint: {
                "line-color": ["get", "color"],
                "line-width": 3,
                "line-opacity": 0.8,
              },
              layout: { visibility: showSubway ? "visible" : "none" },
            });
            m.addLayer({
              id: "subway-labels",
              type: "symbol",
              source: "subway-lines",
              layout: {
                "symbol-placement": "line",
                "text-field": ["get", "name"],
                "text-size": 11,
                "text-font": ["Open Sans Regular"],
                visibility: showSubway ? "visible" : "none",
              },
              paint: {
                "text-color": ["get", "color"],
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
              },
              minzoom: 9,
            });
          }
        })
        .catch(() => {});
    } else {
      const vis = showSubway ? "visible" : "none";
      if (m.getLayer("subway-lines-layer")) m.setLayoutProperty("subway-lines-layer", "visibility", vis);
      if (m.getLayer("subway-labels")) m.setLayoutProperty("subway-labels", "visibility", vis);
    }
  }, [mapReady, showSubway]);

  // Roads overlay
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;

    if (!m.getSource("major-roads")) {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      fetch(`${base}/data/major-roads.json`)
        .then((r) => r.json())
        .then((data) => {
          if (!m.getSource("major-roads")) {
            m.addSource("major-roads", { type: "geojson", data });
            m.addLayer({
              id: "roads-layer",
              type: "line",
              source: "major-roads",
              paint: {
                "line-color": ["get", "color"],
                "line-width": ["case", ["==", ["get", "number"], "100"], 3, 2],
                "line-opacity": 0.7,
                "line-dasharray": [2, 1],
              },
              layout: { visibility: showRoads ? "visible" : "none" },
            });
            m.addLayer({
              id: "roads-labels",
              type: "symbol",
              source: "major-roads",
              layout: {
                "symbol-placement": "line",
                "text-field": ["get", "name"],
                "text-size": 10,
                "text-font": ["Open Sans Regular"],
                visibility: showRoads ? "visible" : "none",
              },
              paint: {
                "text-color": "#1e40af",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
              },
              minzoom: 8,
            });
          }
        })
        .catch(() => {});
    } else {
      const vis = showRoads ? "visible" : "none";
      if (m.getLayer("roads-layer")) m.setLayoutProperty("roads-layer", "visibility", vis);
      if (m.getLayer("roads-labels")) m.setLayoutProperty("roads-labels", "visibility", vis);
    }
  }, [mapReady, showRoads]);

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
