"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { RegionData, HistoricalData } from "@/lib/types";
import { DataLayerKey, PROVINCE_SHORT } from "@/lib/constants";
import type { KoreaMapHandle } from "@/components/Map/KoreaMap";
import RegionRanking from "@/components/Layout/RegionRanking";
import MapControls from "@/components/Layout/MapControls";
import Legend from "@/components/Layout/Legend";
import Sidebar from "@/components/Layout/Sidebar";
import HelpModal from "@/components/Layout/HelpModal";
import TimelineControls from "@/components/Layout/TimelineControls";

const KoreaMap = dynamic(() => import("@/components/Map/KoreaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--background)]">
      <div className="text-gray-500 text-sm">지도 로딩 중...</div>
    </div>
  ),
});

const END_YEAR = 2025;

export default function HomePage() {
  const [baseRegions, setBaseRegions] = useState<RegionData[]>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<DataLayerKey>("healthScore");
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentYear, setCurrentYear] = useState(END_YEAR);
  const mapRef = useRef<KoreaMapHandle>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${base}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${base}/data/regions.json`).then((r) => r.json()),
      fetch(`${base}/data/sample-historical.json`).then((r) => r.json()),
    ])
      .then(([regionData, geoData, histData]) => {
        setBaseRegions(regionData);
        setHistoricalData(histData);
        const enriched = {
          ...geoData,
          features: geoData.features.map((f: GeoJSON.Feature, i: number) => ({
            ...f,
            id: i,
          })),
        };
        setGeojson(enriched);
        setLoading(false);

        if (typeof window !== "undefined" && !localStorage.getItem("kiep_visited")) {
          setShowOnboarding(true);
          localStorage.setItem("kiep_visited", "1");
        }
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setLoading(false);
      });
  }, []);

  // Compute effective regions based on selected year
  const regions = useMemo(() => {
    if (currentYear === END_YEAR || !historicalData) return baseRegions;

    const yearIdx = currentYear - historicalData.startYear;
    if (yearIdx < 0 || yearIdx >= (historicalData.endYear - historicalData.startYear + 1)) return baseRegions;

    return baseRegions.map((r) => {
      const hist = historicalData.data[r.code]?.[yearIdx];
      if (!hist) return r;
      return {
        ...r,
        healthScore: hist.healthScore ?? r.healthScore,
        companyCount: hist.companyCount ?? r.companyCount,
        employeeCount: hist.employeeCount ?? r.employeeCount,
        population: hist.population ?? r.population,
        agingRate: hist.agingRate ?? r.agingRate,
        avgLandPrice: hist.avgLandPrice ?? r.avgLandPrice,
        employmentRate: hist.employmentRate ?? r.employmentRate,
        storeCount: hist.storeCount ?? r.storeCount,
        transitScore: hist.transitScore ?? r.transitScore,
        schoolCount: hist.schoolCount ?? r.schoolCount,
      };
    });
  }, [baseRegions, historicalData, currentYear]);

  const handleRegionSelect = useCallback((code: string | null) => {
    setSelectedCode(code);
    if (code) {
      mapRef.current?.flyToRegion(code);
    }
  }, []);

  const handleProvinceFilter = useCallback((province: string | null) => {
    setProvinceFilter(province);
    if (province) {
      mapRef.current?.flyToProvince(province);
    } else {
      mapRef.current?.resetView();
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    const displayed = provinceFilter
      ? regions.filter((r) => r.code.startsWith(provinceFilter))
      : regions;

    const header = "지역코드,지역명,광역시도,건강도,기업수,고용인원,인구,고령화율,평균지가,고용률,상가수,교통접근성,성장률,신규사업자율,폐업률";
    const rows = displayed.map((r) =>
      [r.code, r.name, r.province, r.healthScore, r.companyCount, r.employeeCount,
       r.population, r.agingRate, r.avgLandPrice, r.employmentRate, r.storeCount,
       r.transitScore, r.growthRate, r.newBizRate, r.closureRate].join(",")
    );
    const csv = "\uFEFF" + [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = provinceFilter ? `_${PROVINCE_SHORT[provinceFilter]}` : "";
    const yearSuffix = currentYear !== END_YEAR ? `_${currentYear}` : "";
    a.download = `KIEP_데이터${suffix}${yearSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [regions, provinceFilter, currentYear]);

  const handleReset = useCallback(() => {
    setCurrentYear(END_YEAR);
    setSelectedCode(null);
    setProvinceFilter(null);
    setActiveLayer("healthScore");
    mapRef.current?.resetView();
  }, []);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.code === selectedCode) ?? null,
    [regions, selectedCode]
  );

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
      <RegionRanking
        regions={regions}
        selectedCode={selectedCode}
        onSelect={handleRegionSelect}
        activeLayer={activeLayer}
        provinceFilter={provinceFilter}
        onProvinceFilter={handleProvinceFilter}
        onExportCSV={handleExportCSV}
        currentYear={currentYear}
      />

      <div className="absolute inset-0 left-[320px]" style={{ right: selectedRegion ? 380 : 0 }}>
        <KoreaMap
          ref={mapRef}
          regions={displayedRegions}
          geojson={geojson}
          selectedRegion={selectedCode}
          onRegionSelect={handleRegionSelect}
          activeLayer={activeLayer}
        />
      </div>

      <MapControls
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        onHelpOpen={() => setShowHelp(true)}
      />

      <div className="absolute bottom-6 left-[340px] z-10 flex flex-col gap-2" style={{ right: selectedRegion ? 400 : 20 }}>
        {/* Timeline */}
        {historicalData && (
          <TimelineControls
            startYear={historicalData.startYear}
            endYear={historicalData.endYear}
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            onReset={handleReset}
          />
        )}
        {/* Legend */}
        <Legend activeLayer={activeLayer} />
      </div>

      <Sidebar
        region={selectedRegion}
        allRegions={regions}
        onClose={() => setSelectedCode(null)}
        activeLayer={activeLayer}
        historicalData={historicalData}
        currentYear={currentYear}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showOnboarding && (
        <OnboardingOverlay onClose={() => setShowOnboarding(false)} onOpenGuide={() => { setShowOnboarding(false); setShowHelp(true); }} />
      )}
    </div>
  );
}

function OnboardingOverlay({ onClose, onOpenGuide }: { onClose: () => void; onOpenGuide: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[var(--panel-border)] rounded-2xl w-[520px] overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-8 text-center">
          <div className="text-4xl font-bold mb-2">
            <span className="text-blue-400">K</span>IEP
          </div>
          <div className="text-sm text-gray-400 mb-6">Korea Industrial Ecosystem Platform</div>

          <div className="text-left space-y-3 mb-8 px-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</div>
              <p className="text-sm text-gray-300">전국 <b className="text-white">250개 시군구</b>의 산업, 인구, 부동산, 고용, 교육, 상권, 교통 데이터를 한눈에 파악하세요.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</div>
              <p className="text-sm text-gray-300"><b className="text-white">7개 카테고리 / 18개 레이어</b>를 전환하며 다양한 관점으로 분석하세요.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</div>
              <p className="text-sm text-gray-300">하단 <b className="text-white">타임라인</b>으로 2005~2025년 변화를 시각적으로 재생하세요.</p>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onOpenGuide}
              className="px-5 py-2 rounded-lg text-sm font-medium border border-[var(--panel-border)] text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              사용 설명서 보기
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
