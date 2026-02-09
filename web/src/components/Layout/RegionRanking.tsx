"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCES, PROVINCE_SHORT, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef, getLayerColor } from "@/lib/constants";

interface RegionRankingProps {
  regions: RegionData[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  activeLayer: DataLayerKey;
  provinceFilter: string | null;
  onProvinceFilter: (province: string | null) => void;
  onExportCSV: () => void;
  currentYear: number;
}

type SortKey = DataLayerKey | "name";

export default function RegionRanking({
  regions,
  selectedCode,
  onSelect,
  activeLayer,
  provinceFilter,
  onProvinceFilter,
  onExportCSV,
  currentYear,
}: RegionRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const layerDef = getLayerDef(activeLayer);

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
        cmp = getRegionValue(a, sortKey) - getRegionValue(b, sortKey);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [regions, provinceFilter, search, sortKey, sortAsc]);

  const allLayerValues = useMemo(
    () => regions.map((r) => getRegionValue(r, activeLayer)),
    [regions, activeLayer]
  );

  useEffect(() => {
    if (selectedCode && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedCode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const uniqueProvinces = useMemo(() => {
    const codes = new Set(regions.map((r) => r.code.substring(0, 2)));
    return Array.from(codes)
      .map((c) => ({ code: c, short: PROVINCE_SHORT[c] || c, full: PROVINCES[c] || c }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [regions]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm font-semibold text-[var(--text-primary)]">지역 목록</div>
          <div className="ml-auto flex items-center gap-1.5">
            {currentYear !== 2025 && (
              <span className="text-[10px] text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded font-medium tabular-nums">
                {currentYear}
              </span>
            )}
            <button
              onClick={onExportCSV}
              className="px-2 py-1 rounded text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
              title="CSV 다운로드"
            >
              CSV
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder="지역 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Province Filter */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex flex-wrap gap-1">
        <button
          onClick={() => onProvinceFilter(null)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            !provinceFilter
              ? "bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent"
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
                ? "bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/20"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent"
            }`}
            title={p.full}
          >
            {p.short}
          </button>
        ))}
      </div>

      {/* Sort Headers */}
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center text-[10px] text-[var(--text-tertiary)]">
        <button onClick={() => handleSort("name")} className="flex-1 text-left hover:text-[var(--text-secondary)]">
          지역 {sortKey === "name" && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("healthScore")} className="w-14 text-right hover:text-[var(--text-secondary)]">
          건강도 {sortKey === "healthScore" && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort(activeLayer)} className="w-20 text-right hover:text-[var(--text-secondary)]">
          {layerDef?.label ?? "값"} {sortKey === activeLayer && (sortAsc ? "↑" : "↓")}
        </button>
        <button onClick={() => handleSort("growthRate")} className="w-14 text-right hover:text-[var(--text-secondary)]">
          성장 {sortKey === "growthRate" && (sortAsc ? "↑" : "↓")}
        </button>
      </div>

      {/* Region List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filtered.map((r, i) => {
          const isSelected = r.code === selectedCode;
          const layerVal = getRegionValue(r, activeLayer);
          const layerColor = getLayerColor(activeLayer, layerVal, allLayerValues);
          return (
            <button
              key={r.code}
              ref={isSelected ? selectedItemRef : undefined}
              onClick={() => onSelect(r.code)}
              className={`w-full px-3 py-2 flex items-center text-left transition-colors border-b border-[var(--border-light)] ${
                isSelected
                  ? "bg-[var(--accent-light)] border-l-2 border-l-[var(--accent)]"
                  : "hover:bg-[var(--bg-secondary)] border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                  <span className="text-[var(--text-tertiary)] mr-1">{i + 1}</span>
                  {r.name}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] truncate">{r.province}</div>
              </div>
              <div className="w-14 text-right">
                <span className="text-xs font-semibold" style={{ color: getHealthColor(r.healthScore) }}>
                  {r.healthScore.toFixed(1)}
                </span>
              </div>
              <div className="w-20 text-right">
                <span className="text-[11px] font-medium" style={{ color: layerColor }}>
                  {formatLayerValue(layerVal, activeLayer)}
                </span>
              </div>
              <div className="w-14 text-right">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: r.growthRate >= 0 ? "#16a34a" : "#dc2626" }}
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
      <div className="px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-tertiary)]">
        {filtered.length}개 지역 {provinceFilter ? `(${PROVINCES[provinceFilter]})` : ""}
      </div>
    </div>
  );
}
