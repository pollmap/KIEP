"use client";

import { useEffect, useState, useMemo } from "react";
import Navigation from "@/components/Layout/Navigation";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCES } from "@/lib/constants";
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

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"];

export default function ComparePage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/sample-regions.json`)
      .then((r) => r.json())
      .then(setRegions);
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

  // Normalize for radar chart (0~100 scale)
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
      selectedRegions.forEach((r, i) => {
        point[r.name] = +axis.getter(r).toFixed(1);
      });
      return point;
    });
  }, [selectedRegions, regions]);

  // Bar comparison data
  const barData = useMemo(() => {
    return selectedRegions.map((r, i) => ({
      name: r.name,
      건강도: r.healthScore,
      기업수: r.companyCount,
      고용: r.employeeCount,
      color: COLORS[i],
    }));
  }, [selectedRegions]);

  return (
    <div className="w-screen h-screen bg-[var(--background)] flex flex-col">
      <Navigation />

      <div className="flex-1 pt-14 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-2">지역 비교 벤치마크</h1>
          <p className="text-sm text-gray-500 mb-6">최대 4개 지역을 선택해서 다차원 비교 분석</p>

          {/* Region Selector */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {selectedRegions.map((r, i) => (
              <div key={r.code} className="flex items-center gap-1.5 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-full px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-sm">{r.name}</span>
                <button onClick={() => removeRegion(r.code)} className="text-gray-500 hover:text-white ml-1 text-xs">x</button>
              </div>
            ))}
            {selectedCodes.length < 4 && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="+ 지역 추가..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-1.5 bg-black/30 border border-[var(--panel-border)] rounded-full text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 w-48"
                />
                {filtered.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 w-64 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                    {filtered.map((r) => (
                      <button
                        key={r.code}
                        onClick={() => { addRegion(r.code); setSearch(""); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex justify-between"
                      >
                        <span>{r.name}</span>
                        <span className="text-gray-600 text-[10px]">{r.province}</span>
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
              <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">다차원 비교</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#333" />
                      <PolarAngleAxis dataKey="axis" tick={{ fill: "#999", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 9 }} />
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
                      <Legend wrapperStyle={{ fontSize: 11, color: "#ccc" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Health Score Bar */}
              <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">건강도 비교</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer>
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="name" tick={{ fill: "#999", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 12, color: "#eee" }} />
                      <Bar dataKey="건강도" radius={[4, 4, 0, 0]}>
                        {barData.map((d, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="lg:col-span-2 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">상세 비교</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--panel-border)]">
                        <th className="py-2 px-3 text-left text-gray-500 font-medium">지표</th>
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
                        <tr key={row.label} className="border-b border-[var(--panel-border)]/30">
                          <td className="py-2 px-3 text-gray-400">{row.label}</td>
                          {selectedRegions.map((r) => (
                            <td key={r.code} className="py-2 px-3 text-right">{row.fn(r)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-600">
              <div className="text-5xl mb-4">V</div>
              <div className="text-sm">2개 이상의 지역을 선택하면 비교 분석이 시작됩니다</div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["11010", "41110", "48120", "43110"].map((code) => {
                  const r = regions.find((r) => r.code === code);
                  if (!r) return null;
                  return (
                    <button key={code} onClick={() => addRegion(code)} className="px-3 py-1.5 bg-white/5 border border-[var(--panel-border)] rounded text-xs hover:bg-white/10">
                      + {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
