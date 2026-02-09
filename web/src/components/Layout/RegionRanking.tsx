"use client";

import { useMemo, useState } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCES, MapLayerType } from "@/lib/constants";

interface RegionRankingProps {
  regions: RegionData[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  activeLayer: MapLayerType;
  provinceFilter: string | null;
  onProvinceFilter: (province: string | null) => void;
}

type SortKey = "healthScore" | "companyCount" | "employeeCount" | "growthRate" | "name";

export default function RegionRanking({
  regions,
  selectedCode,
  onSelect,
  activeLayer,
  provinceFilter,
  onProvinceFilter,
}: RegionRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...regions];

    if (provinceFilter) {
      list = list.filter((r) => r.code.startsWith(provinceFilter));
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.province.includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "ko");
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [regions, provinceFilter, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const getValue = (r: RegionData): { text: string; color?: string } => {
    switch (activeLayer) {
      case "healthScore":
        return { text: r.healthScore.toFixed(1), color: getHealthColor(r.healthScore) };
      case "companyCount":
        return { text: r.companyCount.toLocaleString() };
      case "employeeCount":
        return { text: r.employeeCount.toLocaleString() };
      case "growthRate":
        return {
          text: (r.growthRate >= 0 ? "+" : "") + r.growthRate.toFixed(1) + "%",
          color: r.growthRate >= 0 ? "#10b981" : "#ef4444",
        };
    }
  };

  const uniqueProvinces = useMemo(() => {
    const codes = new Set(regions.map((r) => r.code.substring(0, 2)));
    return Array.from(codes)
      .map((c) => ({ code: c, name: PROVINCES[c] || c }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [regions]);

  return (
    <div className="absolute top-0 left-0 h-full w-[320px] bg-[var(--panel-bg)] border-r border-[var(--panel-border)] z-20 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[var(--panel-border)]">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-blue-400">K</span>IEP
          </div>
          <div className="text-[10px] text-gray-600 leading-tight">
            Korea Industrial<br />Ecosystem Platform
          </div>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="지역 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-black/30 border border-[var(--panel-border)] rounded text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Province Filter */}
      <div className="px-3 py-2 border-b border-[var(--panel-border)] flex flex-wrap gap-1">
        <button
          onClick={() => onProvinceFilter(null)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            !provinceFilter
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "text-gray-500 hover:text-gray-300 border border-transparent"
          }`}
        >
          전체
        </button>
        {uniqueProvinces.map((p) => (
          <button
            key={p.code}
            onClick={() => onProvinceFilter(provinceFilter === p.code ? null : p.code)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              provinceFilter === p.code
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            }`}
          >
            {p.name.replace(/특별시|광역시|특별자치시|특별자치도|도/g, "")}
          </button>
        ))}
      </div>

      {/* Sort Headers */}
      <div className="px-3 py-1.5 border-b border-[var(--panel-border)] flex items-center text-[10px] text-gray-600">
        <button onClick={() => handleSort("name")} className="flex-1 text-left hover:text-gray-400">
          지역 {sortKey === "name" && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("healthScore")} className="w-14 text-right hover:text-gray-400">
          건강도 {sortKey === "healthScore" && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("companyCount")} className="w-16 text-right hover:text-gray-400">
          기업 {sortKey === "companyCount" && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("growthRate")} className="w-14 text-right hover:text-gray-400">
          성장 {sortKey === "growthRate" && (sortAsc ? "↑" : "↓")}
        </button>
      </div>

      {/* Region List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((r, i) => {
          const val = getValue(r);
          const isSelected = r.code === selectedCode;
          return (
            <button
              key={r.code}
              onClick={() => onSelect(r.code)}
              className={`w-full px-3 py-2 flex items-center text-left transition-colors border-b border-[var(--panel-border)]/50 ${
                isSelected
                  ? "bg-blue-500/10 border-l-2 border-l-blue-400"
                  : "hover:bg-white/5 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  <span className="text-gray-500 mr-1">{i + 1}</span>
                  {r.name}
                </div>
                <div className="text-[10px] text-gray-600 truncate">{r.province}</div>
              </div>
              <div className="w-14 text-right">
                <span className="text-xs font-semibold" style={{ color: getHealthColor(r.healthScore) }}>
                  {r.healthScore.toFixed(1)}
                </span>
              </div>
              <div className="w-16 text-right text-[11px] text-gray-400">
                {r.companyCount.toLocaleString()}
              </div>
              <div className="w-14 text-right">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: r.growthRate >= 0 ? "#10b981" : "#ef4444" }}
                >
                  {r.growthRate >= 0 ? "+" : ""}
                  {r.growthRate.toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--panel-border)] text-[10px] text-gray-600">
        {filtered.length}개 지역 {provinceFilter ? `(${PROVINCES[provinceFilter]})` : ""}
      </div>
    </div>
  );
}
