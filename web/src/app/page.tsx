"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { RegionData } from "@/lib/types";
import Header from "@/components/Layout/Header";
import Legend from "@/components/Layout/Legend";
import Sidebar from "@/components/Layout/Sidebar";

const KoreaMap = dynamic(() => import("@/components/Map/KoreaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--background)]">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

export default function HomePage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/regions.json`).then((r) => r.json()),
    ])
      .then(([regionData, geoData]) => {
        setRegions(regionData);
        // Add sequential IDs for feature-state
        const enriched = {
          ...geoData,
          features: geoData.features.map(
            (f: GeoJSON.Feature, i: number) => ({
              ...f,
              id: i,
            })
          ),
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

  const selectedRegion = regions.find((r) => r.code === selectedCode) ?? null;

  const avgHealth =
    regions.length > 0
      ? regions.reduce((sum, r) => sum + r.healthScore, 0) / regions.length
      : 0;

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">
            <span className="text-blue-400">K</span>IEP
          </div>
          <div className="text-sm text-gray-500">데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <Header totalRegions={regions.length} avgHealthScore={avgHealth} />
      <KoreaMap
        regions={regions}
        geojson={geojson}
        selectedRegion={selectedCode}
        onRegionSelect={handleRegionSelect}
      />
      <Legend />
      <Sidebar region={selectedRegion} onClose={() => setSelectedCode(null)} />
    </div>
  );
}
