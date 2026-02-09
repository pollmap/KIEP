"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor } from "@/lib/constants";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706"];

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#334155",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export default function ComparePage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");

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

  const removeRegion = (code: string) => {
    setSelectedCodes(selectedCodes.filter((c) => c !== code));
  };

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return regions
      .filter((r) => r.name.toLowerCase().includes(q) || r.province.includes(q))
      .filter((r) => !selectedCodes.includes(r.code))
      .slice(0, 10);
  }, [regions, search, selectedCodes]);

  const radarData = useMemo(() => {
    if (selectedRegions.length === 0) return [];
    const maxCompany = Math.max(...regions.map((r) => r.companyCount));
    const maxEmployee = Math.max(...regions.map((r) => r.employeeCount));

    const axes = [
      { key: "건강도", getter: (r: RegionData) => r.healthScore },
      { key: "기업활력", getter: (r: RegionData) => Math.min(r.newBizRate * 10, 100) },
      { key: "고용규모", getter: (r: RegionData) => (r.employeeCount / maxEmployee) * 100 },
      { key: "기업밀도", getter: (r: RegionData) => (r.companyCount / maxCompany) * 100 },
      { key: "성장률", getter: (r: RegionData) => Math.max(0, (r.growthRate + 10) * 5) },
      { key: "안정성", getter: (r: RegionData) => Math.max(0, (1 - r.closureRate / 10) * 100) },
    ];

    return axes.map((axis) => {
      const point: Record<string, string | number> = { axis: axis.key };
      selectedRegions.forEach((r) => {
        point[r.name] = +axis.getter(r).toFixed(1);
      });
      return point;
    });
  }, [selectedRegions, regions]);

  const barData = useMemo(() => {
    return selectedRegions.map((r) => ({
      name: r.name,
      건강도: r.healthScore,
      기업수: r.companyCount,
      고용: r.employeeCount,
    }));
  }, [selectedRegions]);

  return (
    <div className="min-h-[calc(100vh-var(--nav-height))] bg-[var(--bg-secondary)]">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">지역 비교 벤치마크</h1>
        <p className="text-sm text-[var(--text-tertiary)] mb-6">최대 4개 지역을 선택해서 다차원 비교 분석</p>

        {/* Region Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {selectedRegions.map((r, i) => (
            <div key={r.code} className="flex items-center gap-1.5 bg-white border border-[var(--border)] rounded-full px-3 py-1.5 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-sm text-[var(--text-primary)]">{r.name}</span>
              <button onClick={() => removeRegion(r.code)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] ml-1 text-xs">x</button>
            </div>
          ))}
          {selectedCodes.length < 4 && (
            <div className="relative">
              <input
                type="text"
                placeholder="+ 지역 추가..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[var(--border)] rounded-full text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] w-48"
              />
              {filtered.length > 0 && (
                <div className="absolute top-full mt-1 left-0 w-64 bg-white border border-[var(--border)] rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                  {filtered.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => { addRegion(r.code); setSearch(""); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-secondary)] flex justify-between"
                    >
                      <span className="text-[var(--text-primary)]">{r.name}</span>
                      <span className="text-[var(--text-tertiary)] text-[10px]">{r.province}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedRegions.length >= 2 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">다차원 비교</h3>
              <div className="h-[350px]">
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                    {selectedRegions.map((r, i) => (
                      <Radar
                        key={r.code}
                        name={r.name}
                        dataKey={r.name}
                        stroke={COLORS[i]}
                        fill={COLORS[i]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11, color: "#475569" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Health Score Bar */}
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">건강도 비교</h3>
              <div className="h-[350px]">
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="건강도" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">상세 비교</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 px-3 text-left text-[var(--text-tertiary)] font-medium">지표</th>
                      {selectedRegions.map((r, i) => (
                        <th key={r.code} className="py-2 px-3 text-right font-medium" style={{ color: COLORS[i] }}>{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "건강도", fn: (r: RegionData) => r.healthScore.toFixed(1) },
                      { label: "기업수", fn: (r: RegionData) => r.companyCount.toLocaleString() },
                      { label: "고용인원", fn: (r: RegionData) => r.employeeCount.toLocaleString() },
                      { label: "성장률", fn: (r: RegionData) => (r.growthRate >= 0 ? "+" : "") + r.growthRate.toFixed(1) + "%" },
                      { label: "신규사업자율", fn: (r: RegionData) => r.newBizRate.toFixed(1) + "%" },
                      { label: "폐업률", fn: (r: RegionData) => r.closureRate.toFixed(1) + "%" },
                      { label: "제조업 비율", fn: (r: RegionData) => (r.industryDistribution.manufacturing ?? 0).toFixed(1) + "%" },
                      { label: "IT 비율", fn: (r: RegionData) => (r.industryDistribution.it ?? 0).toFixed(1) + "%" },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-[var(--border-light)]">
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{row.label}</td>
                        {selectedRegions.map((r) => (
                          <td key={r.code} className="py-2 px-3 text-right text-[var(--text-primary)]">{row.fn(r)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-[var(--text-tertiary)]">
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
