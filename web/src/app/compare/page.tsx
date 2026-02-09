"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, DATA_CATEGORIES, DataCategory, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef } from "@/lib/constants";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706"];

const tooltipStyle = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
  fontSize: "12px", color: "#334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export default function ComparePage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<DataCategory>("industry");
  const [compareLayer, setCompareLayer] = useState<DataLayerKey>("healthScore");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/sample-regions.json`)
      .then((r) => r.json())
      .then(setRegions)
      .catch((err) => console.error("Failed to load regions:", err));
  }, []);

  const selectedRegions = useMemo(
    () => selectedCodes.map((c) => regions.find((r) => r.code === c)).filter(Boolean) as RegionData[],
    [regions, selectedCodes]
  );

  const addRegion = (code: string) => {
    if (selectedCodes.length < 4 && !selectedCodes.includes(code)) {
      setSelectedCodes([...selectedCodes, code]);
    }
  };
  const removeRegion = (code: string) => setSelectedCodes(selectedCodes.filter((c) => c !== code));

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return regions.filter((r) => r.name.toLowerCase().includes(q) || r.province.includes(q))
      .filter((r) => !selectedCodes.includes(r.code)).slice(0, 10);
  }, [regions, search, selectedCodes]);

  const catDef = DATA_CATEGORIES.find((c) => c.key === selectedCat) ?? DATA_CATEGORIES[0];
  const compareLayerDef = getLayerDef(compareLayer);

  // Radar data for selected category
  const radarData = useMemo(() => {
    if (selectedRegions.length === 0) return [];
    return catDef.layers.map((layer) => {
      const allVals = regions.map((r) => getRegionValue(r, layer.key));
      const maxV = Math.max(...allVals, 1);
      const point: Record<string, string | number> = { axis: layer.label };
      selectedRegions.forEach((r) => {
        const val = getRegionValue(r, layer.key);
        point[r.name] = +((val / maxV) * 100).toFixed(1);
      });
      return point;
    });
  }, [selectedRegions, regions, catDef]);

  // Bar data for selected layer
  const barData = useMemo(() => {
    return selectedRegions.map((r) => ({
      name: r.name.length > 5 ? r.name.slice(0, 5) + "…" : r.name,
      value: getRegionValue(r, compareLayer),
      code: r.code,
    }));
  }, [selectedRegions, compareLayer]);

  return (
    <div className="min-h-[calc(100vh-var(--nav-height))] bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-1">지역 비교 벤치마크</h1>
        <p className="text-xs md:text-sm text-[var(--text-tertiary)] mb-4 md:mb-6">최대 4개 지역을 선택해서 13개 카테고리 다차원 비교 분석</p>

        {/* Region Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {selectedRegions.map((r, i) => (
            <div key={r.code} className="flex items-center gap-1.5 bg-white border border-[var(--border)] rounded-full px-3 py-1.5 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-sm text-[var(--text-primary)]">{r.name}</span>
              <button onClick={() => removeRegion(r.code)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] ml-1 text-xs">x</button>
            </div>
          ))}
          {selectedCodes.length < 4 && (
            <div className="relative">
              <input type="text" placeholder="+ 지역 추가..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[var(--border)] rounded-full text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] w-40 md:w-48" />
              {filtered.length > 0 && (
                <div className="absolute top-full mt-1 left-0 w-60 bg-white border border-[var(--border)] rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                  {filtered.map((r) => (
                    <button key={r.code} onClick={() => { addRegion(r.code); setSearch(""); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] flex justify-between">
                      <span className="text-[var(--text-primary)]">{r.name}</span>
                      <span className="text-[var(--text-tertiary)] text-[10px]">{r.province}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category + Layer Selector */}
        <div className="mb-4 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {DATA_CATEGORIES.map((cat) => (
              <button key={cat.key} onClick={() => { setSelectedCat(cat.key); setCompareLayer(cat.layers[0].key); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCat === cat.key ? "bg-[var(--accent)] text-white" : "bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"}`}>
                <span>{cat.icon}</span><span>{cat.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {catDef.layers.map((layer) => (
              <button key={layer.key} onClick={() => setCompareLayer(layer.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  compareLayer === layer.key ? "bg-[var(--accent-light)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
                {layer.label}
              </button>
            ))}
          </div>
        </div>

        {selectedRegions.length >= 2 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Radar Chart */}
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{catDef.icon} {catDef.label} 다차원 비교</h3>
              <div className="h-[300px] md:h-[350px]">
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                    {selectedRegions.map((r, i) => (
                      <Radar key={r.code} name={r.name} dataKey={r.name} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11, color: "#475569" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart for selected layer */}
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{compareLayerDef?.label ?? "건강도"} 비교</h3>
              <div className="h-[300px] md:h-[350px]">
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatLayerValue(v, compareLayer), compareLayerDef?.label]} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Full Comparison Table */}
            <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{catDef.icon} {catDef.label} 상세 비교</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 px-3 text-left text-[var(--text-tertiary)] font-medium text-xs">지표</th>
                      {selectedRegions.map((r, i) => (
                        <th key={r.code} className="py-2 px-3 text-right font-medium text-xs" style={{ color: COLORS[i] }}>{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catDef.layers.map((layer) => {
                      const vals = selectedRegions.map((r) => getRegionValue(r, layer.key));
                      const maxV = Math.max(...vals);
                      return (
                        <tr key={layer.key} className={`border-b border-[var(--border-light)] ${layer.key === compareLayer ? "bg-[var(--accent-light)]" : ""}`}>
                          <td className="py-2 px-3 text-[var(--text-secondary)] text-xs">{layer.label}</td>
                          {selectedRegions.map((r, i) => {
                            const v = getRegionValue(r, layer.key);
                            const isBest = v === maxV && vals.filter((x) => x === maxV).length === 1;
                            return (
                              <td key={r.code} className={`py-2 px-3 text-right text-xs ${isBest ? "font-bold text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                                {formatLayerValue(v, layer.key)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* Health Score always shown */}
                    {selectedCat !== "industry" && (
                      <tr className="border-b border-[var(--border-light)] bg-gray-50">
                        <td className="py-2 px-3 text-[var(--text-secondary)] text-xs font-medium">산업건강도</td>
                        {selectedRegions.map((r) => (
                          <td key={r.code} className="py-2 px-3 text-right text-xs font-semibold" style={{ color: getHealthColor(r.healthScore) }}>
                            {r.healthScore.toFixed(1)}점
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 md:py-20 text-[var(--text-tertiary)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 opacity-40"><path d="M8 7h8M8 12h8M8 17h8"/></svg>
            <div className="text-sm">2개 이상의 지역을 선택하면 비교 분석이 시작됩니다</div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["11010", "41110", "48120", "43110"].map((code) => {
                const r = regions.find((r) => r.code === code);
                if (!r) return null;
                return (
                  <button key={code} onClick={() => addRegion(code)} className="px-3 py-1.5 bg-white border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                    + {r.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
