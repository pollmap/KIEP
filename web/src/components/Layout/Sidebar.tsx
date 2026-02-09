"use client";

import { useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, INDUSTRY_LABELS, INDUSTRY_COLORS, HEALTH_BANDS, PROVINCES } from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface SidebarProps {
  region: RegionData | null;
  allRegions: RegionData[];
  onClose: () => void;
}

export default function Sidebar({ region, allRegions, onClose }: SidebarProps) {
  if (!region) return null;

  const industryData = Object.entries(region.industryDistribution)
    .map(([key, value]) => ({
      name: INDUSTRY_LABELS[key] || key,
      value,
      color: INDUSTRY_COLORS[key] || "#6b7280",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const healthColor = getHealthColor(region.healthScore);
  const growthSign = region.growthRate >= 0 ? "+" : "";

  // Find rank
  const healthRank = useMemo(() => {
    const sorted = [...allRegions].sort((a, b) => b.healthScore - a.healthScore);
    return sorted.findIndex((r) => r.code === region.code) + 1;
  }, [allRegions, region.code]);

  // Same province comparison: 1st, middle, last + adjacent regions
  const provincePrefix = region.code.substring(0, 2);
  const provinceName = PROVINCES[provincePrefix] || region.province;

  const compareRegions = useMemo(() => {
    const sameProvList = allRegions
      .filter((r) => r.code.substring(0, 2) === provincePrefix && r.code !== region.code)
      .sort((a, b) => b.healthScore - a.healthScore);

    if (sameProvList.length === 0) return [];

    const picks: RegionData[] = [];
    // 1st place
    if (sameProvList.length > 0) picks.push(sameProvList[0]);
    // Middle
    if (sameProvList.length > 2) picks.push(sameProvList[Math.floor(sameProvList.length / 2)]);
    // Last place
    if (sameProvList.length > 1) picks.push(sameProvList[sameProvList.length - 1]);

    return picks;
  }, [allRegions, provincePrefix, region.code]);

  // Health score band
  const band = HEALTH_BANDS.find((b) => region.healthScore >= b.min && region.healthScore <= b.max);

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-[var(--panel-bg)] border-l border-[var(--panel-border)] z-20 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)]">
        <div>
          <div className="text-[10px] text-gray-500">{region.province}</div>
          <h2 className="text-lg font-bold">{region.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">
            #{healthRank} / {allRegions.length}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors text-sm"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Health Score */}
      <div className="p-4 border-b border-[var(--panel-border)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-500">산업 건강도</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: healthColor + "20", color: healthColor }}>
            {band?.label}
          </span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold" style={{ color: healthColor }}>
            {region.healthScore.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500 mb-1">/ 100</span>
          <span
            className={`text-sm mb-1 ml-auto font-medium ${
              region.growthRate >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {growthSign}{region.growthRate.toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${region.healthScore}%`, backgroundColor: healthColor }}
          />
        </div>

        {/* Health score breakdown */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {HEALTH_BANDS.map((b) => {
            const isActive = region.healthScore >= b.min && region.healthScore <= b.max;
            return (
              <div
                key={b.label}
                className={`text-center py-1 rounded text-[9px] transition-all ${
                  isActive ? "ring-1" : "opacity-40"
                }`}
                style={{
                  backgroundColor: b.color + "15",
                  color: b.color,
                  boxShadow: isActive ? `inset 0 0 0 1px ${b.color}` : undefined,
                }}
              >
                {b.label.split(" ")[0]}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-px bg-[var(--panel-border)]">
        <MetricCard label="기업 수" value={region.companyCount.toLocaleString()} unit="개" />
        <MetricCard label="고용 인원" value={region.employeeCount.toLocaleString()} unit="명" />
        <MetricCard
          label="신규 사업자 비율"
          value={region.newBizRate.toFixed(1)}
          unit="%"
          positive={region.newBizRate > 5}
        />
        <MetricCard
          label="폐업률"
          value={region.closureRate.toFixed(1)}
          unit="%"
          danger={region.closureRate > 5}
        />
      </div>

      {/* Industry Distribution */}
      <div className="p-4 border-b border-[var(--panel-border)]">
        <div className="text-[10px] text-gray-500 mb-2">업종 분포</div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={industryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={68}
                paddingAngle={2}
                dataKey="value"
              >
                {industryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  fontSize: "11px",
                  color: "#eee",
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {industryData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-gray-400 truncate flex-1">{item.name}</span>
              <span className="text-gray-500">{item.value.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Same Province Comparison */}
      {compareRegions.length > 0 && (
        <div className="p-4">
          <div className="text-[10px] text-gray-500 mb-2">{provinceName} 내 비교 (1위 / 중간 / 최하위)</div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: region.name.slice(0, 4), score: region.healthScore, isCurrent: true },
                  ...compareRegions.map((r) => ({
                    name: r.name.slice(0, 4),
                    score: r.healthScore,
                    isCurrent: false,
                  })),
                ]}
                margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#666", fontSize: 10 }} />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {[region, ...compareRegions].map((r, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "#3b82f6" : getHealthColor(r.healthScore) + "80"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  danger = false,
  positive = false,
}: {
  label: string;
  value: string;
  unit: string;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="bg-[var(--panel-bg)] p-3">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span
          className={`text-xl font-semibold ${
            danger ? "text-red-400" : positive ? "text-emerald-400" : ""
          }`}
        >
          {value}
        </span>
        <span className="text-[10px] text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
