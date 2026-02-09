"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, DataLayerKey, getRegionValue, formatLayerValue, getLayerColor } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid,
} from "recharts";

const tooltipStyle = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
  fontSize: "12px", color: "#334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export default function RankingsPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<DataLayerKey>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "distribution">("table");
  const PAGE_SIZE = 25;

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${base}/data/sample-regions.json`)
      .then((r) => r.json())
      .then((data) => { setRegions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const allLayers = useMemo(() => DATA_CATEGORIES.flatMap((c) => c.layers), []);

  const filtered = useMemo(() => {
    let list = [...regions];
    if (provinceFilter) list = list.filter((r) => r.code.startsWith(provinceFilter));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.province.includes(q));
    }
    list.sort((a, b) => {
      const cmp = getRegionValue(a, sortKey) - getRegionValue(b, sortKey);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [regions, provinceFilter, search, sortKey, sortAsc]);

  const allValues = useMemo(() => regions.map((r) => getRegionValue(r, sortKey)), [regions, sortKey]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Percentile calculator
  const getPercentile = useMemo(() => {
    const sorted = [...allValues].sort((a, b) => a - b);
    return (val: number) => {
      const idx = sorted.findIndex((v) => v >= val);
      return idx >= 0 ? Math.round((idx / sorted.length) * 100) : 100;
    };
  }, [allValues]);

  // Distribution histogram data
  const distributionData = useMemo(() => {
    const values = filtered.map((r) => getRegionValue(r, sortKey));
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const bins = 20;
    const binSize = range / bins;
    const histogram = Array.from({ length: bins }, (_, i) => {
      const lo = min + i * binSize;
      const hi = lo + binSize;
      const count = values.filter((v) => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length;
      return {
        range: `${lo.toFixed(1)}`,
        count,
        lo,
        hi,
        color: getLayerColor(sortKey, (lo + hi) / 2, allValues),
      };
    });
    return histogram;
  }, [filtered, sortKey, allValues]);

  // Summary stats for current sort key
  const sortStats = useMemo(() => {
    const values = filtered.map((r) => getRegionValue(r, sortKey));
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return {
      avg,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev: Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length),
    };
  }, [filtered, sortKey]);

  const handleSort = (key: DataLayerKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const columns: { key: DataLayerKey; label: string; width: string }[] = [
    { key: "healthScore", label: "건강도", width: "w-20" },
    { key: "companyCount", label: "사업체", width: "w-24" },
    { key: "employeeCount", label: "종사자", width: "w-24" },
    { key: "population", label: "인구", width: "w-24" },
    { key: "agingRate", label: "고령화율", width: "w-20" },
    { key: "employmentRate", label: "고용률", width: "w-20" },
    { key: "grdp", label: "GRDP", width: "w-24" },
    { key: "avgLandPrice", label: "지가", width: "w-24" },
    { key: "aptPrice", label: "아파트가", width: "w-24" },
    { key: "growthRate", label: "성장률", width: "w-20" },
    { key: "crimeRate", label: "범죄율", width: "w-20" },
    { key: "airQuality", label: "미세먼지", width: "w-20" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">랭킹</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">전국 시군구 지표별 순위 비교</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="지역명 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] w-48"
            />
            <select
              value={provinceFilter || ""}
              onChange={(e) => { setProvinceFilter(e.target.value || null); setPage(0); }}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">전국</option>
              {Object.entries(PROVINCE_SHORT).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => { setSortKey(e.target.value as DataLayerKey); setPage(0); }}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label} 기준</option>)}
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              {sortAsc ? "오름차순 ↑" : "내림차순 ↓"}
            </button>
            {/* View toggle */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "table" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}
              >표</button>
              <button
                onClick={() => setViewMode("distribution")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "distribution" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}
              >분포</button>
              <span className="text-xs text-[var(--text-tertiary)] ml-2">{filtered.length}개 지역</span>
            </div>
          </div>
        </div>

        {/* Summary stats bar */}
        {sortStats && (
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[
              { label: "평균", value: formatLayerValue(sortStats.avg, sortKey) },
              { label: "중앙값", value: formatLayerValue(sortStats.median, sortKey) },
              { label: "최소", value: formatLayerValue(sortStats.min, sortKey) },
              { label: "최대", value: formatLayerValue(sortStats.max, sortKey) },
              { label: "표준편차", value: sortStats.stdDev.toFixed(1) },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-[var(--border)] p-2.5 text-center shadow-sm">
                <div className="text-[10px] text-[var(--text-tertiary)]">{s.label}</div>
                <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "distribution" ? (
          /* Distribution View */
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              {allLayers.find((l) => l.key === sortKey)?.label ?? sortKey} 분포
            </h3>
            <div className="h-[300px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 4, right: 12, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 9 }} angle={-45} textAnchor="end" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v}개 지역`, "빈도"]}
                    labelFormatter={(label, payload) => {
                      const d = payload?.[0]?.payload;
                      return d ? `${Number(d.lo).toFixed(1)} ~ ${Number(d.hi).toFixed(1)}` : String(label);
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {distributionData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 / Bottom 10 side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-[var(--accent)] mb-2">상위 10</h4>
                {filtered.slice(0, 10).map((r, i) => (
                  <div key={r.code} className="flex items-center gap-2 py-1 text-xs">
                    <span className="text-[var(--accent)] font-bold w-5">{i + 1}</span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">{r.name}</span>
                    <PercentileBar value={getRegionValue(r, sortKey)} allValues={allValues} layerKey={sortKey} />
                    <span className="font-medium text-[var(--text-primary)] w-20 text-right">{formatLayerValue(getRegionValue(r, sortKey), sortKey)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[var(--danger)] mb-2">하위 10</h4>
                {[...filtered].reverse().slice(0, 10).map((r, i) => (
                  <div key={r.code} className="flex items-center gap-2 py-1 text-xs">
                    <span className="text-[var(--danger)] font-bold w-5">{filtered.length - i}</span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">{r.name}</span>
                    <PercentileBar value={getRegionValue(r, sortKey)} allValues={allValues} layerKey={sortKey} />
                    <span className="font-medium text-[var(--text-primary)] w-20 text-right">{formatLayerValue(getRegionValue(r, sortKey), sortKey)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Table View with heatmap coloring */
          <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] w-10">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">지역</th>
                    <th className="text-center px-2 py-3 text-[11px] font-medium text-[var(--text-tertiary)] w-14">백분위</th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`text-right px-3 py-3 text-[11px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors ${col.width} ${
                          sortKey === col.key ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"
                        }`}
                      >
                        {col.label} {sortKey === col.key && (sortAsc ? "↑" : "↓")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r, i) => {
                    const globalRank = page * PAGE_SIZE + i + 1;
                    const percentile = getPercentile(getRegionValue(r, sortKey));
                    return (
                      <tr key={r.code} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="px-4 py-2.5 text-xs text-[var(--text-tertiary)]">{globalRank}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-[var(--text-primary)]">{r.name}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">{r.province}</div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            percentile >= 80 ? "bg-emerald-50 text-emerald-600"
                            : percentile >= 60 ? "bg-blue-50 text-blue-600"
                            : percentile >= 40 ? "bg-amber-50 text-amber-600"
                            : percentile >= 20 ? "bg-orange-50 text-orange-600"
                            : "bg-red-50 text-red-600"
                          }`}>
                            P{percentile}
                          </span>
                        </td>
                        {columns.map((col) => {
                          const val = getRegionValue(r, col.key);
                          const formatted = formatLayerValue(val, col.key);
                          const colValues = regions.map((re) => getRegionValue(re, col.key));
                          const bgColor = getLayerColor(col.key, val, colValues);

                          const useHeatmap = col.key === sortKey;
                          let colorStyle: React.CSSProperties = {};
                          if (useHeatmap) {
                            colorStyle = { backgroundColor: bgColor + "25", color: bgColor };
                          } else if (col.key === "healthScore") {
                            colorStyle = { color: getHealthColor(val) };
                          } else if (col.key === "growthRate") {
                            colorStyle = { color: val >= 0 ? "#16a34a" : "#dc2626" };
                          }

                          return (
                            <td key={col.key} className={`text-right px-3 py-2.5 text-sm font-medium ${col.width} ${useHeatmap ? "rounded" : ""}`} style={colorStyle}>
                              {formatted}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) pageNum = i;
                    else if (page < 3) pageNum = i;
                    else if (page > totalPages - 4) pageNum = totalPages - 7 + i;
                    else pageNum = page - 3 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          page === pageNum
                            ? "bg-[var(--accent-light)] text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Percentile bar component */
function PercentileBar({ value, allValues, layerKey }: { value: number; allValues: number[]; layerKey: DataLayerKey }) {
  const sorted = [...allValues].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= value);
  const percentile = idx >= 0 ? (idx / sorted.length) * 100 : 100;
  const color = getLayerColor(layerKey, value, allValues);

  return (
    <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex-shrink-0">
      <div className="h-full rounded-full transition-all" style={{ width: `${percentile}%`, backgroundColor: color }} />
    </div>
  );
}
