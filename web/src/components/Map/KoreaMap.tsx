"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RegionData } from "@/lib/types";
import {
  KOREA_CENTER,
  getHealthColor,
  getLayerColor,
  getBasemapTiles,
  MapLayerType,
  BasemapStyle,
} from "@/lib/constants";

interface KoreaMapProps {
  regions: RegionData[];
  geojson: GeoJSON.FeatureCollection | null;
  selectedRegion: string | null;
  onRegionSelect: (code: string | null) => void;
  activeLayer: MapLayerType;
  basemapStyle: BasemapStyle;
}

export default function KoreaMap({
  regions,
  geojson,
  selectedRegion,
  onRegionSelect,
  activeLayer,
  basemapStyle,
}: KoreaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const regionLookup = useCallback(() => {
    const m = new Map<string, RegionData>();
    regions.forEach((r) => m.set(r.code, r));
    return m;
  }, [regions]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const tiles = getBasemapTiles(basemapStyle);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [tiles.url],
            tileSize: 256,
            attribution: tiles.attribution,
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

  // Switch basemap tiles
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const tiles = getBasemapTiles(basemapStyle);
    const source = map.current.getSource("basemap") as maplibregl.RasterTileSource;
    if (source) {
      // MapLibre doesn't support setTiles directly, recreate
      map.current.removeLayer("basemap-layer");
      map.current.removeSource("basemap");
      map.current.addSource("basemap", {
        type: "raster",
        tiles: [tiles.url],
        tileSize: 256,
        attribution: tiles.attribution,
      });
      // Add basemap layer before region layers
      const firstLayerId = map.current.getLayer("region-fills") ? "region-fills" : undefined;
      map.current.addLayer(
        { id: "basemap-layer", type: "raster", source: "basemap", minzoom: 0, maxzoom: 19 },
        firstLayerId
      );
    }
  }, [mapReady, basemapStyle]);

  // Build color map for features
  const buildColorMap = useCallback(
    (lookup: Map<string, RegionData>, layer: MapLayerType) => {
      const allValues = regions.map((r) => {
        switch (layer) {
          case "healthScore": return r.healthScore;
          case "companyCount": return r.companyCount;
          case "employeeCount": return r.employeeCount;
          case "growthRate": return r.growthRate;
        }
      });

      return (code: string): string => {
        const data = lookup.get(code);
        if (!data) return "#6b7280";
        const value =
          layer === "healthScore" ? data.healthScore :
          layer === "companyCount" ? data.companyCount :
          layer === "employeeCount" ? data.employeeCount :
          data.growthRate;
        return getLayerColor(layer, value, allValues);
      };
    },
    [regions]
  );

  // Format tooltip value
  const formatValue = useCallback(
    (data: RegionData, layer: MapLayerType): string => {
      switch (layer) {
        case "healthScore": return data.healthScore.toFixed(1);
        case "companyCount": return data.companyCount.toLocaleString() + "개";
        case "employeeCount": return data.employeeCount.toLocaleString() + "명";
        case "growthRate": return (data.growthRate >= 0 ? "+" : "") + data.growthRate.toFixed(1) + "%";
      }
    },
    []
  );

  const layerLabel = useCallback(
    (layer: MapLayerType): string => {
      switch (layer) {
        case "healthScore": return "건강도";
        case "companyCount": return "기업 수";
        case "employeeCount": return "고용 인원";
        case "growthRate": return "성장률";
      }
    },
    []
  );

  // Add/update GeoJSON layer
  useEffect(() => {
    if (!mapReady || !map.current || !geojson) return;

    const lookup = regionLookup();
    const colorFn = buildColorMap(lookup, activeLayer);

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
            province: data?.province ?? "",
            fillColor: colorFn(code || ""),
          },
        };
      }),
    };

    // Remove existing layers
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

    // Interactions
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
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.6">
              <strong>${data.name}</strong>
              <span style="color:#999;font-size:11px;margin-left:4px">${data.province}</span><br/>
              ${layerLabel(activeLayer)}: <b style="color:${colorFn(code)}">${formatValue(data, activeLayer)}</b><br/>
              기업: ${data.companyCount.toLocaleString()} &middot; 고용: ${data.employeeCount.toLocaleString()}
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

    map.current.on("mousemove", "region-fills", onMouseMove);
    map.current.on("mouseleave", "region-fills", onMouseLeave);
    map.current.on("click", "region-fills", onClick);

    return () => {
      map.current?.off("mousemove", "region-fills", onMouseMove);
      map.current?.off("mouseleave", "region-fills", onMouseLeave);
      map.current?.off("click", "region-fills", onClick);
    };
  }, [mapReady, geojson, regions, activeLayer, regionLookup, buildColorMap, onRegionSelect, formatValue, layerLabel]);

  // Highlight selected
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (map.current.getLayer("region-highlight")) {
      map.current.setFilter("region-highlight", ["==", "code", selectedRegion ?? ""]);
    }
  }, [mapReady, selectedRegion]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
