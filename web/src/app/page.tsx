"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { RegionData } from "@/lib/types";
import { MapLayerType, BasemapStyle } from "@/lib/constants";
import RegionRanking from "@/components/Layout/RegionRanking";
import MapControls from "@/components/Layout/MapControls";
import Legend from "@/components/Layout/Legend";
import Sidebar from "@/components/Layout/Sidebar";

const KoreaMap = dynamic(() => import("@/components/Map/KoreaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--background)]">
      <div className="text-gray-500 text-sm">지도 로딩 중...</div>
    </div>
  ),
});

export default function HomePage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>("healthScore");
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>("vworld-base");
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${base}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${base}/data/regions.json`).then((r) => r.json()),
    ])
      .then(([regionData, geoData]) => {
        setRegions(regionData);
        const enriched = {
          ...geoData,
          features: geoData.features.map((f: GeoJSON.Feature, i: number) => ({
            ...f,
            id: i,
          })),
        };
        setGeojson(enriched);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setLoading(false);
      });
  }, []);

  const handleRegionSelect = useCallback((code: string | null) => {
    setSelectedCode(code);
  }, []);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.code === selectedCode) ?? null,
    [regions, selectedCode]
  );

  // Filter regions shown on map based on province filter
  const displayedRegions = useMemo(() => {
    if (!provinceFilter) return regions;
    return regions.filter((r) => r.code.startsWith(provinceFilter));
  }, [regions, provinceFilter]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="text-3xl font-bold mb-3">
            <span className="text-blue-400">K</span>IEP
          </div>
          <div className="text-sm text-gray-500">데이터 로딩 중...</div>
          <div className="mt-4 w-32 h-1 bg-gray-800 rounded-full overflow-hidden mx-auto">
            <div className="h-full w-1/2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {/* Left: Region Ranking Panel */}
      <RegionRanking
        regions={regions}
        selectedCode={selectedCode}
        onSelect={handleRegionSelect}
        activeLayer={activeLayer}
        provinceFilter={provinceFilter}
        onProvinceFilter={setProvinceFilter}
      />

      {/* Center: Map */}
      <div className="absolute inset-0 left-[320px]" style={{ right: selectedRegion ? 380 : 0 }}>
        <KoreaMap
          regions={displayedRegions}
          geojson={geojson}
          selectedRegion={selectedCode}
          onRegionSelect={handleRegionSelect}
          activeLayer={activeLayer}
          basemapStyle={basemapStyle}
        />
      </div>

      {/* Map Controls (above map) */}
      <MapControls
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        basemapStyle={basemapStyle}
        onBasemapChange={setBasemapStyle}
      />

      {/* Legend */}
      {activeLayer === "healthScore" && (
        <div className="absolute bottom-6 left-[340px] z-10">
          <Legend />
        </div>
      )}

      {/* Right: Detail Sidebar */}
      <Sidebar
        region={selectedRegion}
        allRegions={regions}
        onClose={() => setSelectedCode(null)}
      />
    </div>
  );
}
