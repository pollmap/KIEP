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

// All numeric keys to merge from historical data
const HISTORICAL_KEYS = [
  "healthScore", "companyCount", "employeeCount", "growthRate",
  "population", "populationGrowth", "agingRate", "youthRatio",
  "birthRate", "foreignRatio", "netMigration",
  "grdp", "grdpGrowth", "taxRevenue", "financialIndependence", "localConsumption",
  "avgLandPrice", "priceChangeRate", "aptPrice", "aptChangeRate", "buildingPermits",
  "employmentRate", "unemploymentRate", "avgWage", "jobCreation", "youthEmployment",
  "schoolCount", "studentCount", "universityCount", "libraryCount", "educationBudget",
  "storeCount", "storeOpenRate", "storeCloseRate", "franchiseCount", "salesPerStore",
  "hospitalCount", "doctorCount", "bedsPerPopulation", "seniorFacilities", "daycareCenters",
  "crimeRate", "trafficAccidents", "fireIncidents", "disasterDamage",
  "airQuality", "greenAreaRatio", "wasteGeneration", "waterQuality",
  "roadDensity", "waterSupply", "sewerageRate", "parkArea",
  "transitScore", "subwayStations", "busRoutes", "dailyPassengers", "avgCommute",
  "culturalFacilities", "touristVisitors", "accommodations",
] as const;

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
  const [showSubway, setShowSubway] = useState(false);
  const [showRoads, setShowRoads] = useState(false);
  const [showRailway, setShowRailway] = useState(false);
  const [showAirports, setShowAirports] = useState(false);
  const [showPorts, setShowPorts] = useState(false);
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
      const merged = { ...r } as Record<string, unknown> & RegionData;
      for (const key of HISTORICAL_KEYS) {
        if (h[key] !== undefined) (merged as Record<string, unknown>)[key] = h[key];
      }
      return merged;
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
    const header = [
      "지역코드","지역명","광역시도",
      "산업건강도","사업체수","종사자수","기업성장률","신규창업률","폐업률","제조업비중","중소기업비율",
      "인구","인구증감률","고령화율","청년비율","출생률","외국인비율","순이동률",
      "GRDP","GRDP성장률","지방세수입","재정자립도","지역소비",
      "평균지가","지가변동률","아파트매매가","아파트가격변동률","건축허가건수",
      "고용률","실업률","평균임금","일자리증감","청년고용률",
      "학교수","학생수","대학수","도서관수","교육재정",
      "상가수","개업률","폐업률_상권","프랜차이즈수","점포당매출",
      "의료기관수","의사수","병상수_천명당","노인복지시설","어린이집수",
      "범죄율","교통사고","화재건수","재해피해액",
      "미세먼지","녹지비율","폐기물발생량","수질등급",
      "도로율","상수도보급률","하수도보급률","1인당공원면적",
      "교통접근성","지하철역수","버스노선수","일일이용객","평균통근시간",
      "문화시설수","관광객수","숙박시설수",
    ].join(",");
    const rows = displayed.map((r) => [
      r.code, r.name, r.province,
      r.healthScore, r.companyCount, r.employeeCount, r.growthRate, r.newBizRate, r.closureRate, r.manufacturingRatio, r.smeRatio,
      r.population, r.populationGrowth, r.agingRate, r.youthRatio, r.birthRate, r.foreignRatio, r.netMigration,
      r.grdp, r.grdpGrowth, r.taxRevenue, r.financialIndependence, r.localConsumption,
      r.avgLandPrice, r.priceChangeRate, r.aptPrice, r.aptChangeRate, r.buildingPermits,
      r.employmentRate, r.unemploymentRate, r.avgWage, r.jobCreation, r.youthEmployment,
      r.schoolCount, r.studentCount, r.universityCount, r.libraryCount, r.educationBudget,
      r.storeCount, r.storeOpenRate, r.storeCloseRate, r.franchiseCount, r.salesPerStore,
      r.hospitalCount, r.doctorCount, r.bedsPerPopulation, r.seniorFacilities, r.daycareCenters,
      r.crimeRate, r.trafficAccidents, r.fireIncidents, r.disasterDamage,
      r.airQuality, r.greenAreaRatio, r.wasteGeneration, r.waterQuality,
      r.roadDensity, r.waterSupply, r.sewerageRate, r.parkArea,
      r.transitScore, r.subwayStations, r.busRoutes, r.dailyPassengers, r.avgCommute,
      r.culturalFacilities, r.touristVisitors, r.accommodations,
    ].join(","));
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
        <KoreaMap ref={mapRef} regions={displayedRegions} geojson={geojson} selectedRegion={selectedCode} onRegionSelect={handleRegionSelect} activeLayer={activeLayer} showSubway={showSubway} showRoads={showRoads} showRailway={showRailway} showAirports={showAirports} showPorts={showPorts} />

        {/* Top controls */}
        <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <MapControls activeLayer={activeLayer} onLayerChange={setActiveLayer} onHelpOpen={() => setShowHelp(true)} />
          </div>
        </div>

        {/* Overlay toggles - top right */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          {[
            { key: "subway", label: "지하철", active: showSubway, toggle: () => setShowSubway(!showSubway), color: "#0052A4", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3v4H9V8c0-1.66 1.34-3 3-3z" },
            { key: "roads", label: "고속도로", active: showRoads, toggle: () => setShowRoads(!showRoads), color: "#1e40af", icon: "M4 20L8 4M16 20l4-16M3 12h18" },
            { key: "railway", label: "철도/KTX", active: showRailway, toggle: () => setShowRailway(!showRailway), color: "#dc2626", icon: "M4 15h16M6 19h12M8 11V7c0-2.2 1.8-4 4-4s4 1.8 4 4v4" },
            { key: "airports", label: "공항", active: showAirports, toggle: () => setShowAirports(!showAirports), color: "#7c3aed", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
            { key: "ports", label: "항만", active: showPorts, toggle: () => setShowPorts(!showPorts), color: "#0284c7", icon: "M3 17h18M5 12l7-7 7 7M5 17v-5h14v5" },
          ].map((item) => (
            <button key={item.key} onClick={item.toggle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium shadow-sm transition-all ${item.active ? "text-white" : "bg-white/90 text-[var(--text-secondary)] border border-[var(--border)] hover:bg-white"}`}
              style={item.active ? { backgroundColor: item.color } : undefined}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={item.icon}/></svg>
              {item.label}
            </button>
          ))}
        </div>

        {/* Bottom-left: Legend + Timeline stacked */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 max-w-[420px]" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
          <div className="hidden md:block w-fit"><Legend activeLayer={activeLayer} /></div>
          {historicalData && <TimelineControls startYear={historicalData.startYear} endYear={historicalData.endYear} currentYear={currentYear} onYearChange={setCurrentYear} onReset={handleReset} />}
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
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-[var(--border)] rounded-t-2xl shadow-lg max-h-[75vh] overflow-y-auto animate-slide-up" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="sticky top-0 bg-white z-10 pt-2 pb-1 border-b border-[var(--border-light)]">
            <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-2" />
            <div className="flex items-center justify-between px-4 pb-2">
              <div>
                <div className="text-[10px] text-[var(--text-tertiary)]">{selectedRegion.province}</div>
                <div className="text-base font-bold">{selectedRegion.name}</div>
              </div>
              <button onClick={() => { setMobileDetail(false); setSelectedCode(null); }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--bg-secondary)]">
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
            {[
              "전국 250개 시군구의 산업, 경제, 인구, 부동산, 고용 등 13개 분야 65개 지표를 한눈에.",
              "지하철 노선, 고속도로 등 교통 인프라를 지도 위에 시각화.",
              "2000~2025년 타임라인으로 26년간 변화를 재생하고 비교.",
            ].map((text, i) => (
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
