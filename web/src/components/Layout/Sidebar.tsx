"use client";

import { useMemo } from "react";
import { RegionData, HistoricalData } from "@/lib/types";
import {
  getHealthColor,
  INDUSTRY_LABELS,
  INDUSTRY_COLORS,
  HEALTH_BANDS,
  PROVINCES,
  DataLayerKey,
  getRegionValue,
  formatLayerValue,
  getLayerDef,
  getCategoryForLayer,
  DATA_CATEGORIES,
  getLayerColor,
} from "@/lib/constants";
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
  activeLayer: DataLayerKey;
  historicalData: HistoricalData | null;
  currentYear: number;
}

export default function Sidebar({ region, allRegions, onClose, activeLayer, historicalData, currentYear }: SidebarProps) {
  // All hooks MUST be called before any early return
  const currentLayerDef = getLayerDef(activeLayer);
  const currentCat = getCategoryForLayer(activeLayer);
  const activeCatDef = currentCat ?? DATA_CATEGORIES[0];

  const activeLayerRank = useMemo(() => {
    if (!region) return 0;
    const sorted = [...allRegions].sort((a, b) => getRegionValue(b, activeLayer) - getRegionValue(a, activeLayer));
    return sorted.findIndex((r) => r.code === region.code) + 1;
  }, [allRegions, region, activeLayer]);

  const healthRank = useMemo(() => {
    if (!region) return 0;
    const sorted = [...allRegions].sort((a, b) => b.healthScore - a.healthScore);
    return sorted.findIndex((r) => r.code === region.code) + 1;
  }, [allRegions, region]);

  const provincePrefix = region?.code.substring(0, 2) ?? "";
  const provinceName = region ? (PROVINCES[provincePrefix] || region.province) : "";

  const compareRegions = useMemo(() => {
    if (!region) return [];
    const sameProvList = allRegions
      .filter((r) => r.code.substring(0, 2) === provincePrefix && r.code !== region.code)
      .sort((a, b) => getRegionValue(b, activeLayer) - getRegionValue(a, activeLayer));
    if (sameProvList.length === 0) return [];
    const picks: RegionData[] = [];
    if (sameProvList.length > 0) picks.push(sameProvList[0]);
    if (sameProvList.length > 2) picks.push(sameProvList[Math.floor(sameProvList.length / 2)]);
    if (sameProvList.length > 1) picks.push(sameProvList[sameProvList.length - 1]);
    return picks;
  }, [allRegions, provincePrefix, region, activeLayer]);

  const trendData = useMemo(() => {
    if (!region || !historicalData || !historicalData.data[region.code]) return [];
    const regionHist = historicalData.data[region.code];
    if (!currentLayerDef) return [];
    return regionHist.map((d, i) => ({
      year: historicalData.startYear + i,
      value: d[activeLayer] ?? 0,
    }));
  }, [historicalData, region, activeLayer, currentLayerDef]);

  const trendDomain = useMemo(() => {
    if (trendData.length === 0) return [0, 100];
    const values = trendData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pad = range * 0.15;
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [trendData]);

  if (!region) return null;

  const activeValue = getRegionValue(region, activeLayer);
  const activeFormatted = formatLayerValue(activeValue, activeLayer);
  const allValues = allRegions.map((r) => getRegionValue(r, activeLayer));
  const activeColor = getLayerColor(activeLayer, activeValue, allValues);

  const industryData = Object.entries(region.industryDistribution)
    .map(([key, value]) => ({
      name: INDUSTRY_LABELS[key] || key,
      value,
      color: INDUSTRY_COLORS[key] || "#6b7280",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const healthColor = getHealthColor(region.healthScore);
  const band = HEALTH_BANDS.find((b) => region.healthScore >= b.min && region.healthScore <= b.max);

  const tooltipStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "11px",
    color: "#334155",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  };

  const isHealthLayer = activeLayer === "healthScore";

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div>
          <div className="text-[10px] text-[var(--text-tertiary)]">{region.province}</div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{region.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {currentYear !== 2025 && (
            <span className="text-[10px] text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded font-medium">
              {currentYear}년
            </span>
          )}
          <button
            onClick={onClose}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </div>
      </div>

      {/* Active Layer Value - Hero Section */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {activeCatDef.icon} {currentLayerDef?.label ?? "산업 건강도"}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
            #{activeLayerRank} / {allRegions.length}
          </span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold" style={{ color: activeColor }}>
            {activeFormatted}
          </span>
        </div>

        {/* If not health layer, show health score as compact info */}
        {!isHealthLayer && (
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-secondary)] rounded-lg">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: healthColor }} />
            <span className="text-[11px] text-[var(--text-secondary)]">산업건강도</span>
            <span className="text-[11px] font-semibold ml-auto" style={{ color: healthColor }}>
              {region.healthScore.toFixed(1)}점
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">({band?.label.split(" ")[0]})</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">#{healthRank}</span>
          </div>
        )}

        {/* Health band indicator - only for health layer */}
        {isHealthLayer && (
          <>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: healthColor + "15", color: healthColor }}>
                {band?.label}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: region.growthRate >= 0 ? "#16a34a" : "#dc2626" }}
              >
                {region.growthRate >= 0 ? "+" : ""}{region.growthRate.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${region.healthScore}%`, backgroundColor: healthColor }} />
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {HEALTH_BANDS.map((b) => {
                const isActive = region.healthScore >= b.min && region.healthScore <= b.max;
                return (
                  <div key={b.label} className={`text-center py-1 rounded text-[9px] transition-all ${isActive ? "" : "opacity-40"}`}
                    style={{ backgroundColor: b.color + "12", color: b.color, boxShadow: isActive ? `inset 0 0 0 1px ${b.color}` : undefined }}>
                    {b.label.split(" ")[0]}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Current Category Metrics */}
      <div className="border-b border-[var(--border)]">
        <div className="px-4 pt-3 pb-1 text-[10px] text-[var(--text-tertiary)] font-medium">
          {activeCatDef.icon} {activeCatDef.label} 지표
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--border-light)]">
          {activeCatDef.layers.map((layer) => {
            const val = getRegionValue(region, layer.key);
            const formatted = formatLayerValue(val, layer.key);
            const isActive = layer.key === activeLayer;
            return (
              <div key={layer.key} className={`bg-white p-3 ${isActive ? "ring-2 ring-[var(--accent)]/40 bg-[var(--accent-light)]" : ""}`}>
                <div className="text-[10px] text-[var(--text-tertiary)]">{layer.label}</div>
                <div className={`text-lg font-semibold mt-0.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{formatted}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend Chart - BarChart with dynamic Y-axis */}
      {trendData.length > 0 && (
        <div className="p-4 border-b border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] mb-2">
            {currentLayerDef?.label} 추이 ({historicalData?.startYear}~{historicalData?.endYear})
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 9 }} tickCount={6} interval="preserveStartEnd" />
                <YAxis domain={trendDomain as [number, number]} tick={{ fill: "#94a3b8", fontSize: 9 }} tickCount={5} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatLayerValue(value, activeLayer), currentLayerDef?.label]}
                  labelFormatter={(label) => `${label}년`}
                />
                <Bar dataKey="value" fill="url(#trendBarGrad)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Key Metrics - condensed */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border-light)] border-b border-[var(--border)]">
        <MetricCard label="사업체" value={region.companyCount.toLocaleString()} unit="개" />
        <MetricCard label="종사자" value={region.employeeCount.toLocaleString()} unit="명" />
        <MetricCard label="인구" value={region.population?.toLocaleString() ?? "N/A"} unit="명" />
        <MetricCard label="고령화율" value={region.agingRate?.toFixed(1) ?? "N/A"} unit="%" danger={(region.agingRate ?? 0) > 25} />
        <MetricCard label="고용률" value={(region.employmentRate || 0).toFixed(1)} unit="%" positive={(region.employmentRate || 0) > 65} />
        <MetricCard label="GRDP" value={(region.grdp || 0).toLocaleString()} unit="십억" />
        <MetricCard label="평균지가" value={(region.avgLandPrice || 0).toLocaleString()} unit="만원" />
        <MetricCard label="범죄율" value={(region.crimeRate || 0).toFixed(1)} unit="" danger={(region.crimeRate || 0) > 60} />
        <MetricCard label="미세먼지" value={(region.airQuality || 0).toFixed(1)} unit="㎍" danger={(region.airQuality || 0) > 30} />
      </div>

      {/* Industry Distribution */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="text-[10px] text-[var(--text-tertiary)] mb-2">업종 분포</div>
        <div className="h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={industryData} cx="50%" cy="50%" innerRadius={34} outerRadius={56} paddingAngle={2} dataKey="value">
                {industryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(1)}%`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {industryData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[var(--text-secondary)] truncate flex-1">{item.name}</span>
              <span className="text-[var(--text-tertiary)]">{item.value.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Same Province Comparison - using active layer */}
      {compareRegions.length > 0 && (
        <div className="p-4">
          <div className="text-[10px] text-[var(--text-tertiary)] mb-2">
            {provinceName} 내 {currentLayerDef?.label ?? "건강도"} 비교
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: region.name.slice(0, 4), score: activeValue, isCurrent: true },
                  ...compareRegions.map((r) => ({
                    name: r.name.slice(0, 4),
                    score: getRegionValue(r, activeLayer),
                    isCurrent: false,
                  })),
                ]}
                margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatLayerValue(v, activeLayer), currentLayerDef?.label]} />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {[region, ...compareRegions].map((r, i) => {
                    const v = getRegionValue(r, activeLayer);
                    const c = isHealthLayer ? getHealthColor(v) : (i === 0 ? "#2563eb" : "#94a3b8");
                    return <Cell key={i} fill={i === 0 ? "#2563eb" : c + (isHealthLayer ? "80" : "")} />;
                  })}
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
    <div className="bg-white p-2.5">
      <div className="text-[9px] text-[var(--text-tertiary)]">{label}</div>
      <div className="flex items-baseline gap-0.5 mt-0.5">
        <span
          className={`text-base font-semibold ${
            danger ? "text-[var(--danger)]" : positive ? "text-[var(--success)]" : "text-[var(--text-primary)]"
          }`}
        >
          {value}
        </span>
        <span className="text-[9px] text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}
