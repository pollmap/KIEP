"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { RegionData, HistoricalData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef } from "@/lib/constants";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  AreaChart, Area, LineChart, Line, BarChart, Bar, Legend,
} from "recharts";

const COMPARE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#ec4899", "#0891b2", "#84cc16"];

export default function AnalysisPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [xAxis, setXAxis] = useState<DataLayerKey>("companyCount");
  const [yAxis, setYAxis] = useState<DataLayerKey>("healthScore");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  // Trend comparison state
  const [trendMetric, setTrendMetric] = useState<DataLayerKey>("healthScore");
  const [compareRegions, setCompareRegions] = useState<string[]>([]);
  const [regionSearch, setRegionSearch] = useState("");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${base}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${base}/data/sample-historical.json`).then((r) => r.json()),
    ])
      .then(([regionData, histData]) => { setRegions(regionData); setHistoricalData(histData); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const allLayers = useMemo(() => DATA_CATEGORIES.flatMap((c) => c.layers), []);

  const scatterData = useMemo(() => {
    let list = regions;
    if (selectedProvince) list = list.filter((r) => r.code.startsWith(selectedProvince));
    return list.map((r) => ({
      name: r.name,
      province: r.province,
      x: getRegionValue(r, xAxis),
      y: getRegionValue(r, yAxis),
      health: r.healthScore,
      code: r.code,
    }));
  }, [regions, xAxis, yAxis, selectedProvince]);

  const nationalTrend = useMemo(() => {
    if (!historicalData) return [];
    const years = historicalData.endYear - historicalData.startYear + 1;
    return Array.from({ length: years }, (_, i) => {
      const year = historicalData.startYear + i;
      let sumHealth = 0, sumPop = 0, sumCompany = 0, count = 0;
      Object.values(historicalData.data).forEach((regionYears) => {
        const d = regionYears[i];
        if (d) {
          sumHealth += d.healthScore ?? 0;
          sumPop += d.population ?? 0;
          sumCompany += d.companyCount ?? 0;
          count++;
        }
      });
      return {
        year,
        avgHealth: count ? sumHealth / count : 0,
        totalPop: sumPop,
        totalCompany: sumCompany,
      };
    });
  }, [historicalData]);

  const provinceComparison = useMemo(() => {
    const map = new Map<string, { health: number; pop: number; company: number; count: number }>();
    regions.forEach((r) => {
      const prefix = r.code.substring(0, 2);
      const prev = map.get(prefix) || { health: 0, pop: 0, company: 0, count: 0 };
      prev.health += r.healthScore;
      prev.pop += r.population;
      prev.company += r.companyCount;
      prev.count++;
      map.set(prefix, prev);
    });
    return Array.from(map.entries())
      .map(([code, d]) => ({
        name: PROVINCE_SHORT[code] || code,
        avgHealth: d.health / d.count,
        population: d.pop,
        companies: d.company,
      }))
      .sort((a, b) => b.avgHealth - a.avgHealth);
  }, [regions]);

  // Regional trend comparison data
  const trendCompareData = useMemo(() => {
    if (!historicalData || compareRegions.length === 0) return [];
    const years = historicalData.endYear - historicalData.startYear + 1;
    return Array.from({ length: years }, (_, i) => {
      const year = historicalData.startYear + i;
      const row: Record<string, number> = { year };
      compareRegions.forEach((code) => {
        const regionHist = historicalData.data[code];
        if (regionHist && regionHist[i]) {
          row[code] = regionHist[i][trendMetric] ?? 0;
        }
      });
      return row;
    });
  }, [historicalData, compareRegions, trendMetric]);

  const regionNameMap = useMemo(() => {
    const m = new Map<string, string>();
    regions.forEach((r) => m.set(r.code, r.name));
    return m;
  }, [regions]);

  const searchResults = useMemo(() => {
    if (!regionSearch.trim()) return [];
    const q = regionSearch.toLowerCase();
    return regions
      .filter((r) => (r.name.toLowerCase().includes(q) || r.province.includes(q)) && !compareRegions.includes(r.code))
      .slice(0, 8);
  }, [regions, regionSearch, compareRegions]);

  const addRegion = useCallback((code: string) => {
    if (compareRegions.length >= 8) return;
    setCompareRegions((prev) => [...prev, code]);
    setRegionSearch("");
  }, [compareRegions.length]);

  const removeRegion = useCallback((code: string) => {
    setCompareRegions((prev) => prev.filter((c) => c !== code));
  }, []);

  const tooltipStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#334155",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div>
      </div>
    );
  }

  const xDef = getLayerDef(xAxis);
  const yDef = getLayerDef(yAxis);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">분석</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">데이터 간 상관관계, 추세 분석 및 지역 비교</p>
        </div>

        {/* ── Regional Trend Comparison ── */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-5 shadow-sm mb-4">
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">지역별 추세 비교</h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">최대 8개 지역의 20년간 변화를 비교합니다</p>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={trendMetric}
                onChange={(e) => setTrendMetric(e.target.value as DataLayerKey)}
                className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label} ({l.unit})</option>)}
              </select>
            </div>
          </div>

          {/* Region selector */}
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {compareRegions.map((code, i) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                >
                  {regionNameMap.get(code) || code}
                  <button onClick={() => removeRegion(code)} className="hover:opacity-70 -mr-0.5">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l6 6M9 3l-6 6"/></svg>
                  </button>
                </span>
              ))}
              {compareRegions.length < 8 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="지역 추가..."
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                    className="px-3 py-1 border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] w-36"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-[var(--border)] rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {searchResults.map((r) => (
                        <button
                          key={r.code}
                          onClick={() => addRegion(r.code)}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                        >
                          <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                          <span className="text-[var(--text-tertiary)]">{r.province}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {compareRegions.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">
                위 검색창에서 비교할 지역을 추가하세요. 예: 강남구, 해운대구, 수원시
              </p>
            )}
          </div>

          {/* Trend Chart */}
          {compareRegions.length > 0 && trendCompareData.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendCompareData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => `${label}년`}
                    formatter={(value: number, name: string) => [
                      formatLayerValue(value, trendMetric),
                      regionNameMap.get(name) || name,
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => regionNameMap.get(value) || value}
                    wrapperStyle={{ fontSize: "12px", color: "#475569" }}
                  />
                  {compareRegions.map((code, i) => (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      name={code}
                      stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center border border-dashed border-[var(--border)] rounded-xl">
              <div className="text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" className="mx-auto mb-2"><path d="M3 3v18h18M7 16l4-4 4 4 6-6"/></svg>
                <p className="text-sm text-[var(--text-tertiary)]">지역을 추가하면 추세 그래프가 표시됩니다</p>
              </div>
            </div>
          )}

          {/* Quick add popular regions */}
          {compareRegions.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-[var(--text-tertiary)] self-center mr-1">빠른 추가:</span>
              {[
                { code: "11230", name: "강남구" },
                { code: "21090", name: "해운대구" },
                { code: "31011", name: "수원시장안구" },
                { code: "11030", name: "용산구" },
                { code: "11010", name: "종로구" },
              ].filter((q) => regions.some((r) => r.code === q.code)).map((q) => (
                <button
                  key={q.code}
                  onClick={() => addRegion(q.code)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  + {q.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Scatter Plot ── */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">상관관계 분석</h3>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <label className="text-[11px] text-[var(--text-tertiary)]">X축</label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value as DataLayerKey)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <label className="text-[11px] text-[var(--text-tertiary)]">Y축</label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value as DataLayerKey)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <select
                value={selectedProvince || ""}
                onChange={(e) => setSelectedProvince(e.target.value || null)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">전국</option>
                {Object.entries(PROVINCE_SHORT).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="x" name={xDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }} label={{ value: xDef?.label, position: "bottom", fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name={yDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }} label={{ value: yDef?.label, angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [
                    name === "x" ? formatLayerValue(value, xAxis) : formatLayerValue(value, yAxis),
                    name === "x" ? xDef?.label : yDef?.label,
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={getHealthColor(d.health)} opacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── National Trends ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">전국 평균 건강도 추이</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nationalTrend} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[40, 80]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1) + "점", "평균 건강도"]} labelFormatter={(l) => `${l}년`} />
                  <Area type="monotone" dataKey="avgHealth" stroke="#2563eb" strokeWidth={2} fill="url(#healthGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">전국 기업 수 추이</h3>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nationalTrend} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="companyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [(v / 10000).toFixed(1) + "만개", "기업 수"]} labelFormatter={(l) => `${l}년`} />
                  <Area type="monotone" dataKey="totalCompany" stroke="#8b5cf6" strokeWidth={2} fill="url(#companyGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Province Comparison ── */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">광역시도별 평균 건강도 비교</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provinceComparison} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1) + "점", "평균 건강도"]} />
                <Bar dataKey="avgHealth" name="평균 건강도" radius={[4, 4, 0, 0]}>
                  {provinceComparison.map((p, i) => (
                    <Cell key={i} fill={getHealthColor(p.avgHealth)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
