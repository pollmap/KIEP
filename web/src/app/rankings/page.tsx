"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, DataLayerKey, getRegionValue, formatLayerValue } from "@/lib/constants";

export default function RankingsPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<DataLayerKey>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
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

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (key: DataLayerKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const columns: { key: DataLayerKey; label: string; width: string }[] = [
    { key: "healthScore", label: "건강도", width: "w-20" },
    { key: "companyCount", label: "기업 수", width: "w-24" },
    { key: "employeeCount", label: "고용 인원", width: "w-24" },
    { key: "population", label: "인구", width: "w-24" },
    { key: "agingRate", label: "고령화율", width: "w-20" },
    { key: "employmentRate", label: "고용률", width: "w-20" },
    { key: "avgLandPrice", label: "평균지가", width: "w-24" },
    { key: "growthRate", label: "성장률", width: "w-20" },
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
            <span className="text-xs text-[var(--text-tertiary)] ml-auto">{filtered.length}개 지역</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] w-10">#</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">지역</th>
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
                  return (
                    <tr key={r.code} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="px-4 py-2.5 text-xs text-[var(--text-tertiary)]">{globalRank}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{r.name}</div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">{r.province}</div>
                      </td>
                      {columns.map((col) => {
                        const val = getRegionValue(r, col.key);
                        const formatted = formatLayerValue(val, col.key);
                        let colorStyle: React.CSSProperties = {};
                        if (col.key === "healthScore") colorStyle = { color: getHealthColor(val) };
                        else if (col.key === "growthRate") colorStyle = { color: val >= 0 ? "#16a34a" : "#dc2626" };
                        return (
                          <td key={col.key} className={`text-right px-3 py-2.5 text-sm font-medium ${col.width}`} style={colorStyle}>
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
      </div>
    </div>
  );
}
