"use client";

import { RegionData } from "@/lib/types";
import { getHealthColor, INDUSTRY_LABELS, INDUSTRY_COLORS } from "@/lib/constants";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface SidebarProps {
  region: RegionData | null;
  onClose: () => void;
}

export default function Sidebar({ region, onClose }: SidebarProps) {
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

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-[var(--panel-bg)] border-l border-[var(--panel-border)] z-20 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)]">
        <div>
          <div className="text-xs text-gray-500">{region.province}</div>
          <h2 className="text-lg font-bold">{region.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          x
        </button>
      </div>

      {/* Health Score */}
      <div className="p-4 border-b border-[var(--panel-border)]">
        <div className="text-xs text-gray-500 mb-1">산업 건강도</div>
        <div className="flex items-end gap-3">
          <span
            className="text-4xl font-bold"
            style={{ color: healthColor }}
          >
            {region.healthScore.toFixed(1)}
          </span>
          <span className="text-sm text-gray-400 mb-1">/ 100</span>
          <span
            className={`text-sm mb-1 ml-auto ${
              region.growthRate >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {growthSign}{region.growthRate.toFixed(1)}%
          </span>
        </div>
        {/* Score bar */}
        <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${region.healthScore}%`,
              backgroundColor: healthColor,
            }}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-px bg-[var(--panel-border)]">
        <MetricCard
          label="기업수"
          value={region.companyCount.toLocaleString()}
          unit="개"
        />
        <MetricCard
          label="고용인원"
          value={region.employeeCount.toLocaleString()}
          unit="명"
        />
        <MetricCard
          label="신규 사업자 비율"
          value={region.newBizRate.toFixed(1)}
          unit="%"
        />
        <MetricCard
          label="폐업률"
          value={region.closureRate.toFixed(1)}
          unit="%"
          danger={region.closureRate > 5}
        />
      </div>

      {/* Industry Distribution */}
      <div className="p-4">
        <div className="text-xs text-gray-500 mb-3">업종 분포</div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={industryData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {industryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--foreground)",
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {industryData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-400 truncate">{item.name}</span>
              <span className="text-gray-500 ml-auto">{item.value.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  danger = false,
}: {
  label: string;
  value: string;
  unit: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-[var(--panel-bg)] p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-xl font-semibold ${danger ? "text-red-400" : ""}`}>
          {value}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
