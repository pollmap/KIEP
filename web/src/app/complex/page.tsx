"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_TILES, KOREA_CENTER, getHealthColor } from "@/lib/constants";

interface ComplexData {
  id: string;
  name: string;
  type: string;
  province: string;
  sigungu: string;
  regionCode: string;
  area: number;
  industrialArea: number;
  tenantCount: number;
  operatingCount: number;
  occupancyRate: number;
  production: number;
  exportAmount: number;
  employment: number;
  mainIndustry: string;
  established: number;
  coordinates: [number, number];
}

const TYPE_COLORS: Record<string, string> = {
  "국가": "#2563eb",
  "일반": "#16a34a",
  "도시첨단": "#7c3aed",
  "농공": "#d97706",
};

const TYPE_ORDER = ["국가", "일반", "도시첨단", "농공"];

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "만";
  if (n >= 1000) return (n / 1000).toFixed(1) + "천";
  return n.toLocaleString();
}

export default function ComplexPage() {
  const router = useRouter();
  const [complexes, setComplexes] = useState<ComplexData[]>([]);
  const [selected, setSelected] = useState<ComplexData | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const markersSource = useRef<boolean>(false);

  // Load data
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${base}/data/industrial-complexes.json`)
      .then((r) => r.json())
      .then((geojson) => {
        const items: ComplexData[] = geojson.features.map((f: GeoJSON.Feature) => ({
          ...f.properties,
          coordinates: (f.geometry as GeoJSON.Point).coordinates,
        }));
        setComplexes(items);
        setLoading(false);
      })
      .catch((err) => { console.error("Failed to load complexes:", err); setLoading(false); });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: { basemap: { type: "raster", tiles: [BASEMAP_TILES.url], tileSize: 256, attribution: BASEMAP_TILES.attribution } },
        layers: [{ id: "basemap-layer", type: "raster", source: "basemap", minzoom: 0, maxzoom: 19 }],
      },
      center: [KOREA_CENTER.longitude, KOREA_CENTER.latitude],
      zoom: KOREA_CENTER.zoom,
      minZoom: 5,
      maxZoom: 16,
    });
    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    map.current.on("load", () => setMapReady(true));
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Province list
  const provinces = useMemo(() => {
    const set = new Set(complexes.map((c) => c.province));
    return Array.from(set).sort();
  }, [complexes]);

  // Filter
  const filtered = useMemo(() => {
    let list = complexes;
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (provinceFilter) list = list.filter((c) => c.province === provinceFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.sigungu.includes(q) || c.province.includes(q) || c.mainIndustry.includes(q));
    }
    return list.sort((a, b) => b.employment - a.employment);
  }, [complexes, typeFilter, provinceFilter, search]);

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let base = complexes;
    if (provinceFilter) base = base.filter((c) => c.province === provinceFilter);
    if (search) {
      const q = search.toLowerCase();
      base = base.filter((c) => c.name.toLowerCase().includes(q) || c.sigungu.includes(q));
    }
    TYPE_ORDER.forEach((t) => { counts[t] = base.filter((c) => c.type === t).length; });
    counts["전체"] = base.length;
    return counts;
  }, [complexes, provinceFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    count: filtered.length,
    employment: filtered.reduce((s, c) => s + c.employment, 0),
    production: filtered.reduce((s, c) => s + c.production, 0),
    tenants: filtered.reduce((s, c) => s + c.tenantCount, 0),
  }), [filtered]);

  // GeoJSON for map
  const geojsonData = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: filtered.map((c) => ({
      type: "Feature" as const,
      properties: { id: c.id, name: c.name, type: c.type, employment: c.employment, tenantCount: c.tenantCount, regionCode: c.regionCode },
      geometry: { type: "Point" as const, coordinates: c.coordinates },
    })),
  }), [filtered]);

  // Update map markers
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;

    if (!markersSource.current) {
      m.addSource("complexes", { type: "geojson", data: geojsonData });

      // Circle layer
      m.addLayer({
        id: "complex-circles",
        type: "circle",
        source: "complexes",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, ["case",
              ["==", ["get", "type"], "국가"], 5,
              ["==", ["get", "type"], "일반"], 3,
              ["==", ["get", "type"], "도시첨단"], 3.5,
              2.5
            ],
            12, ["case",
              ["==", ["get", "type"], "국가"], 12,
              ["==", ["get", "type"], "일반"], 8,
              ["==", ["get", "type"], "도시첨단"], 8,
              6
            ],
          ],
          "circle-color": [
            "match", ["get", "type"],
            "국가", TYPE_COLORS["국가"],
            "일반", TYPE_COLORS["일반"],
            "도시첨단", TYPE_COLORS["도시첨단"],
            "농공", TYPE_COLORS["농공"],
            "#6b7280",
          ],
          "circle-opacity": 0.8,
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            1.5
          ],
          "circle-stroke-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#ef4444",
            "#ffffff"
          ],
        },
      });

      // Labels
      m.addLayer({
        id: "complex-labels",
        type: "symbol",
        source: "complexes",
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 10, 12, 12],
          "text-font": ["Open Sans Regular"],
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": ["match", ["get", "type"], "국가", "#1d4ed8", "일반", "#15803d", "도시첨단", "#6d28d9", "농공", "#b45309", "#475569"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
        minzoom: 9,
      });

      // Hover/click handlers
      m.on("mouseenter", "complex-circles", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "complex-circles", () => { m.getCanvas().style.cursor = ""; popup.current?.remove(); });

      m.on("mousemove", "complex-circles", (e) => {
        if (!e.features?.length || !popup.current) return;
        const props = e.features[0].properties!;
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-size:12px;line-height:1.5"><strong>${props.name}</strong><br/><span style="color:${TYPE_COLORS[props.type] || '#666'}">${props.type}</span> · 입주 ${Number(props.tenantCount).toLocaleString()} · 고용 ${Number(props.employment).toLocaleString()}</div>`)
          .addTo(m);
      });

      m.on("click", "complex-circles", (e) => {
        if (!e.features?.length) return;
        const id = e.features[0].properties!.id;
        const c = complexes.find((x) => x.id === id);
        if (c) handleSelect(c);
      });

      markersSource.current = true;
    } else {
      const src = m.getSource("complexes") as maplibregl.GeoJSONSource;
      if (src) src.setData(geojsonData);
    }
  }, [mapReady, geojsonData, complexes]);

  const handleSelect = useCallback((c: ComplexData) => {
    setSelected(c);
    if (map.current) {
      map.current.flyTo({ center: c.coordinates as [number, number], zoom: Math.max(map.current.getZoom(), 11), duration: 600 });
    }
  }, []);

  const handleGoToRegion = useCallback((regionCode: string) => {
    router.push(`/?region=${regionCode}`);
  }, [router]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-var(--nav-height))] flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[var(--text-tertiary)]">산업단지 데이터 로딩 중...</div>
          <div className="mt-3 w-32 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mx-auto">
            <div className="h-full w-1/2 bg-[var(--accent)] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--nav-height))] flex overflow-hidden">
      {/* Left Panel */}
      <div className={`${showList ? "w-full md:w-[420px]" : "hidden md:block md:w-[420px]"} border-r border-[var(--border)] flex flex-col bg-white flex-shrink-0 z-10`}>
        {/* Header */}
        <div className="p-3 border-b border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-[var(--text-primary)]">산업단지 현황</h1>
            <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
              {stats.count.toLocaleString()}개 단지
            </span>
          </div>
          <input
            type="text" placeholder="산업단지, 지역, 업종 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]"
          />
          {/* Type filters */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {["전체", ...TYPE_ORDER].map((t) => (
              <button key={t} onClick={() => setTypeFilter(t === "전체" ? null : t)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  (t === "전체" ? typeFilter === null : typeFilter === t)
                    ? "text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
                style={(t === "전체" ? typeFilter === null : typeFilter === t) ? { backgroundColor: t === "전체" ? "var(--accent)" : TYPE_COLORS[t] } : undefined}
              >
                {t} <span className="opacity-70">{typeCounts[t] ?? 0}</span>
              </button>
            ))}
          </div>
          {/* Province filter */}
          <select
            value={provinceFilter ?? ""}
            onChange={(e) => setProvinceFilter(e.target.value || null)}
            className="w-full px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] outline-none"
          >
            <option value="">전체 시도</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-px bg-[var(--border-light)] flex-shrink-0">
          {[
            { label: "단지 수", value: stats.count.toLocaleString() },
            { label: "입주업체", value: formatNum(stats.tenants) },
            { label: "총 고용", value: formatNum(stats.employment) },
            { label: "총 생산", value: (stats.production / 10000).toFixed(0) + "조원" },
          ].map((s) => (
            <div key={s.label} className="bg-white p-2 text-center">
              <div className="text-[9px] text-[var(--text-tertiary)]">{s.label}</div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{s.value}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">검색 결과 없음</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { handleSelect(c); setShowList(false); }}
                className={`w-full px-3 py-2.5 text-left border-b border-[var(--border-light)] transition-colors ${
                  selected?.id === c.id ? "bg-[var(--accent-light)]" : "hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{c.name}</span>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[c.type] + "18", color: TYPE_COLORS[c.type] }}>{c.type}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-tertiary)]">
                  <span>{c.province} {c.sigungu}</span>
                  <span className="text-[var(--border)]">|</span>
                  <span>입주 {c.tenantCount.toLocaleString()}</span>
                  <span>고용 {c.employment.toLocaleString()}</span>
                  <span className="text-[var(--text-secondary)]">{c.mainIndustry}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Map + Detail */}
      <div className={`flex-1 relative ${showList ? "hidden md:block" : ""}`}>
        <div ref={mapContainer} className="w-full h-full" />

        {/* Mobile: back to list */}
        <button
          onClick={() => setShowList(true)}
          className="md:hidden absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-md border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          목록
        </button>

        {/* Map legend */}
        <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur rounded-lg shadow-sm border border-[var(--border)] p-2">
          <div className="text-[9px] text-[var(--text-tertiary)] mb-1 font-medium">산업단지 유형</div>
          {TYPE_ORDER.map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
              {t} ({typeCounts[t] ?? 0})
            </div>
          ))}
        </div>

        {/* Selected complex detail panel */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-[360px] z-20 bg-white border-t md:border-t-0 md:border-l border-[var(--border)] shadow-lg overflow-y-auto animate-fade-in"
            style={{ maxHeight: "60vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Detail header */}
            <div className="sticky top-0 bg-white z-10 p-3 border-b border-[var(--border)]">
              <div className="md:hidden w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-2" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: TYPE_COLORS[selected.type] }}>{selected.type}산업단지</span>
                    <span className="text-[9px] text-[var(--text-tertiary)]">est. {selected.established}</span>
                  </div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">{selected.name}</h2>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{selected.province} {selected.sigungu} · {selected.mainIndustry}</div>
                </div>
                <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="입주업체" value={selected.tenantCount.toLocaleString()} unit="개" />
                <StatCard label="가동업체" value={selected.operatingCount.toLocaleString()} unit="개" />
                <StatCard label="분양률" value={selected.occupancyRate.toFixed(1)} unit="%" />
                <StatCard label="가동률" value={((selected.operatingCount / selected.tenantCount) * 100).toFixed(1)} unit="%" />
                <StatCard label="고용인원" value={selected.employment.toLocaleString()} unit="명" />
                <StatCard label="생산액" value={(selected.production / 100).toFixed(0)} unit="억원" />
                <StatCard label="수출액" value={(selected.exportAmount / 1000).toFixed(1)} unit="백만$" />
                <StatCard label="면적" value={selected.area.toFixed(0)} unit="천㎡" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleGoToRegion(selected.regionCode)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                  해당 지역 지도에서 보기
                </button>
              </div>

              {/* Location info */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-1.5">
                <div className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1">소재지 정보</div>
                {[
                  ["시도", selected.province],
                  ["시군구", selected.sigungu],
                  ["주력업종", selected.mainIndustry],
                  ["지정면적", `${selected.area.toFixed(0)} 천㎡`],
                  ["산업용지", `${selected.industrialArea.toFixed(0)} 천㎡`],
                  ["단지코드", selected.id],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-tertiary)]">{k}</span>
                    <span className="text-[var(--text-primary)] font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-2">
      <div className="text-[9px] text-[var(--text-tertiary)]">{label}</div>
      <div className="flex items-baseline gap-0.5 mt-0.5">
        <span className="text-sm font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</span>
        <span className="text-[9px] text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}
