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
    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="text-[var(--text-tertiary)] text-sm">지도 로딩 중...</div>
    </div>
  ),
});

const END_YEAR = 2025;

export default function MapPage() {
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
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
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
        setGeojson({ ...geoData, features: geoData.features.map((f: GeoJSON.Feature, i: number) => ({ ...f, id: i })) });
        setLoading(false);
        if (typeof window !== "undefined" && !localStorage.getItem("kiep_visited")) {
          setShowOnboarding(true);
          localStorage.setItem("kiep_visited", "1");
        }
      })
      .catch((err) => { console.error("Failed to load data:", err); setLoading(false); });
  }, []);

  const regions = useMemo(() => {
    if (currentYear === END_YEAR || !historicalData) return baseRegions;
    const yearIdx = currentYear - historicalData.startYear;
    if (yearIdx < 0 || yearIdx >= (historicalData.endYear - historicalData.startYear + 1)) return baseRegions;
    return baseRegions.map((r) => {
      const h = historicalData.data[r.code]?.[yearIdx];
      if (!h) return r;
      return {
        ...r,
        healthScore: h.healthScore ?? r.healthScore,
        companyCount: h.companyCount ?? r.companyCount,
        employeeCount: h.employeeCount ?? r.employeeCount,
        growthRate: h.growthRate ?? r.growthRate,
        population: h.population ?? r.population,
        populationGrowth: h.populationGrowth ?? r.populationGrowth,
        agingRate: h.agingRate ?? r.agingRate,
        youthRatio: h.youthRatio ?? r.youthRatio,
        avgLandPrice: h.avgLandPrice ?? r.avgLandPrice,
        priceChangeRate: h.priceChangeRate ?? r.priceChangeRate,
        employmentRate: h.employmentRate ?? r.employmentRate,
        unemploymentRate: h.unemploymentRate ?? r.unemploymentRate,
        schoolCount: h.schoolCount ?? r.schoolCount,
        studentCount: h.studentCount ?? r.studentCount,
        storeCount: h.storeCount ?? r.storeCount,
        storeOpenRate: h.storeOpenRate ?? r.storeOpenRate,
        storeCloseRate: h.storeCloseRate ?? r.storeCloseRate,
        transitScore: h.transitScore ?? r.transitScore,
      };
    });
  }, [baseRegions, historicalData, currentYear]);

  const handleRegionSelect = useCallback((code: string | null) => {
    setSelectedCode(code);
    if (code) { mapRef.current?.flyToRegion(code); setMobileDetail(true); }
  }, []);
  const handleProvinceFilter = useCallback((province: string | null) => {
    setProvinceFilter(province);
    if (province) mapRef.current?.flyToProvince(province);
    else mapRef.current?.resetView();
  }, []);
  const handleExportCSV = useCallback(() => {
    const displayed = provinceFilter ? regions.filter((r) => r.code.startsWith(provinceFilter)) : regions;
    const header = "지역코드,지역명,광역시도,건강도,기업수,고용인원,인구,고령화율,평균지가,고용률,상가수,교통접근성,성장률";
    const rows = displayed.map((r) => [r.code, r.name, r.province, r.healthScore, r.companyCount, r.employeeCount, r.population, r.agingRate, r.avgLandPrice, r.employmentRate, r.storeCount, r.transitScore, r.growthRate].join(","));
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `KIEP_데이터${provinceFilter ? `_${PROVINCE_SHORT[provinceFilter]}` : ""}${currentYear !== END_YEAR ? `_${currentYear}` : ""}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [regions, provinceFilter, currentYear]);
  const handleReset = useCallback(() => {
    setCurrentYear(END_YEAR); setSelectedCode(null); setProvinceFilter(null); setActiveLayer("healthScore"); mapRef.current?.resetView();
  }, []);

  const selectedRegion = useMemo(() => regions.find((r) => r.code === selectedCode) ?? null, [regions, selectedCode]);
  const displayedRegions = useMemo(() => provinceFilter ? regions.filter((r) => r.code.startsWith(provinceFilter)) : regions, [regions, provinceFilter]);

  if (loading) {
    return (
      <div className="w-screen h-[calc(100vh-var(--nav-height))] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold mb-3"><span className="text-[var(--accent)]">K</span>IEP</div>
          <div className="text-sm text-[var(--text-tertiary)]">데이터 로딩 중...</div>
          <div className="mt-4 w-32 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mx-auto">
            <div className="h-full w-1/2 bg-[var(--accent)] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-[calc(100vh-var(--nav-height))] relative overflow-hidden flex">
      {/* Left Panel - Desktop */}
      <div className={`hidden md:flex flex-col bg-white border-r border-[var(--border)] z-20 transition-all duration-300 flex-shrink-0 ${panelOpen ? "w-[340px]" : "w-0 overflow-hidden"}`}>
        <RegionRanking regions={regions} selectedCode={selectedCode} onSelect={handleRegionSelect} activeLayer={activeLayer} provinceFilter={provinceFilter} onProvinceFilter={handleProvinceFilter} onExportCSV={handleExportCSV} currentYear={currentYear} />
      </div>

      {/* Panel toggle */}
      <button onClick={() => setPanelOpen(!panelOpen)} className="hidden md:flex absolute z-30 w-6 h-12 items-center justify-center bg-white border border-[var(--border)] rounded-r-lg shadow-sm hover:bg-[var(--bg-secondary)] transition-all" style={{ left: panelOpen ? 340 : 0, top: 12 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><path d={panelOpen ? "M7 1L2 5l5 4" : "M3 1l5 4-5 4"} /></svg>
      </button>

      {/* Map */}
      <div className="flex-1 relative">
        <KoreaMap ref={mapRef} regions={displayedRegions} geojson={geojson} selectedRegion={selectedCode} onRegionSelect={handleRegionSelect} activeLayer={activeLayer} />

        {/* Top controls */}
        <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <MapControls activeLayer={activeLayer} onLayerChange={setActiveLayer} onHelpOpen={() => setShowHelp(true)} />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-3 md:bottom-3 left-3 right-3 z-10 flex flex-col gap-2 mb-[env(safe-area-inset-bottom)] md:mb-0" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
          {historicalData && <TimelineControls startYear={historicalData.startYear} endYear={historicalData.endYear} currentYear={currentYear} onYearChange={setCurrentYear} onReset={handleReset} />}
          <div className="hidden md:block w-fit"><Legend activeLayer={activeLayer} /></div>
        </div>
      </div>

      {/* Right Sidebar - Desktop */}
      {selectedRegion && (
        <div className="hidden md:block w-[380px] flex-shrink-0 border-l border-[var(--border)] animate-fade-in">
          <Sidebar region={selectedRegion} allRegions={regions} onClose={() => setSelectedCode(null)} activeLayer={activeLayer} historicalData={historicalData} currentYear={currentYear} />
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {selectedRegion && mobileDetail && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-[var(--border)] rounded-t-2xl shadow-lg max-h-[70vh] overflow-y-auto animate-slide-up">
          <div className="sticky top-0 bg-white z-10 pt-2 pb-1 border-b border-[var(--border-light)]">
            <div className="w-9 h-1 rounded bg-[var(--border)] mx-auto mb-2" />
            <div className="flex items-center justify-between px-4 pb-2">
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">{selectedRegion.province}</div>
                <div className="font-bold">{selectedRegion.name}</div>
              </div>
              <button onClick={() => { setMobileDetail(false); setSelectedCode(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
          </div>
          <Sidebar region={selectedRegion} allRegions={regions} onClose={() => { setMobileDetail(false); setSelectedCode(null); }} activeLayer={activeLayer} historicalData={historicalData} currentYear={currentYear} />
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showOnboarding && <OnboardingOverlay onClose={() => setShowOnboarding(false)} onOpenGuide={() => { setShowOnboarding(false); setShowHelp(true); }} />}
    </div>
  );
}

function OnboardingOverlay({ onClose, onOpenGuide }: { onClose: () => void; onOpenGuide: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-[480px] overflow-hidden shadow-xl animate-fade-in">
        <div className="p-6 md:p-8 text-center">
          <div className="text-3xl font-bold mb-1"><span className="text-[var(--accent)]">K</span>IEP</div>
          <div className="text-sm text-[var(--text-tertiary)] mb-6">Korea Industrial Ecosystem Platform</div>
          <div className="text-left space-y-3 mb-8">
            {["전국 250개 시군구의 산업, 인구, 부동산, 고용, 교육, 상권, 교통 데이터를 한눈에.", "7개 카테고리 / 18개 레이어로 다양한 관점 분석.", "2005~2025년 타임라인으로 20년간 변화 재생."].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={onOpenGuide} className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">사용 설명서</button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors">시작하기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
