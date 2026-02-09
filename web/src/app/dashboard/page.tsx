"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData, HistoricalData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, HEALTH_BANDS, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef, DataCategory } from "@/lib/constants";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Treemap,
} from "recharts";

export default function DashboardPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<DataCategory>("industry");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${base}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${base}/data/sample-historical.json`).then((r) => r.json()),
    ])
      .then(([regionData, histData]) => {
        setRegions(regionData);
        setHistoricalData(histData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const catDef = DATA_CATEGORIES.find((c) => c.key === selectedCat) ?? DATA_CATEGORIES[0];

  // Compute national trend for sparklines
  const nationalTrend = useMemo(() => {
    if (!historicalData) return [];
    const years = historicalData.endYear - historicalData.startYear + 1;
    return Array.from({ length: years }, (_, i) => {
      let sumHealth = 0, sumPop = 0, sumCompany = 0, sumEmployee = 0, sumGrdp = 0, sumAging = 0, count = 0;
      Object.values(historicalData.data).forEach((regionYears) => {
        const d = regionYears[i];
        if (d) {
          sumHealth += d.healthScore ?? 0;
          sumPop += d.population ?? 0;
          sumCompany += d.companyCount ?? 0;
          sumEmployee += d.employeeCount ?? 0;
          sumGrdp += d.grdp ?? 0;
          sumAging += d.agingRate ?? 0;
          count++;
        }
      });
      return {
        year: historicalData.startYear + i,
        avgHealth: count ? sumHealth / count : 0,
        totalPop: sumPop,
        totalCompany: sumCompany,
        totalEmployee: sumEmployee,
        totalGrdp: sumGrdp,
        avgAging: count ? sumAging / count : 0,
      };
    });
  }, [historicalData]);

  const stats = useMemo(() => {
    if (!regions.length) return null;
    const avgHealth = regions.reduce((s, r) => s + r.healthScore, 0) / regions.length;
    const totalPop = regions.reduce((s, r) => s + r.population, 0);
    const totalCompany = regions.reduce((s, r) => s + r.companyCount, 0);
    const totalEmployee = regions.reduce((s, r) => s + r.employeeCount, 0);
    const avgGrowth = regions.reduce((s, r) => s + r.growthRate, 0) / regions.length;
    const avgAging = regions.reduce((s, r) => s + r.agingRate, 0) / regions.length;
    const totalGrdp = regions.reduce((s, r) => s + (r.grdp || 0), 0);
    const avgEmployment = regions.reduce((s, r) => s + r.employmentRate, 0) / regions.length;
    return { avgHealth, totalPop, totalCompany, totalEmployee, avgGrowth, avgAging, totalGrdp, avgEmployment };
  }, [regions]);

  // Trend deltas (last 5 years)
  const deltas = useMemo(() => {
    if (nationalTrend.length < 6) return null;
    const recent = nationalTrend[nationalTrend.length - 1];
    const past = nationalTrend[nationalTrend.length - 6];
    return {
      health: recent.avgHealth - past.avgHealth,
      pop: ((recent.totalPop - past.totalPop) / Math.max(past.totalPop, 1)) * 100,
      company: ((recent.totalCompany - past.totalCompany) / Math.max(past.totalCompany, 1)) * 100,
      grdp: ((recent.totalGrdp - past.totalGrdp) / Math.max(past.totalGrdp, 1)) * 100,
      aging: recent.avgAging - past.avgAging,
    };
  }, [nationalTrend]);

  const provinceData = useMemo(() => {
    const map = new Map<string, RegionData[]>();
    regions.forEach((r) => {
      const prefix = r.code.substring(0, 2);
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix)!.push(r);
    });
    return Array.from(map.entries()).map(([code, list]) => ({
      code, name: PROVINCE_SHORT[code] || code,
      avgHealth: list.reduce((s, r) => s + r.healthScore, 0) / list.length,
      count: list.length,
    })).sort((a, b) => b.avgHealth - a.avgHealth);
  }, [regions]);

  const healthDistribution = useMemo(() => {
    return HEALTH_BANDS.map((band) => ({
      label: band.label.split(" ")[0],
      count: regions.filter((r) => r.healthScore >= band.min && r.healthScore <= band.max).length,
      color: band.color,
    }));
  }, [regions]);

  // Category layer rankings
  const catLayerStats = useMemo(() => {
    return catDef.layers.map((layer) => {
      const values = regions.map((r) => getRegionValue(r, layer.key));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const sorted = [...regions].sort((a, b) => getRegionValue(b, layer.key) - getRegionValue(a, layer.key));
      return {
        ...layer,
        avg,
        top3: sorted.slice(0, 3),
        bottom3: sorted.slice(-3).reverse(),
      };
    });
  }, [regions, catDef]);

  // Treemap data - top 30 regions by selected category's first layer
  const treemapData = useMemo(() => {
    const layer = catDef.layers[0];
    const sorted = [...regions].sort((a, b) => getRegionValue(b, layer.key) - getRegionValue(a, layer.key));
    return sorted.slice(0, 30).map((r) => ({
      name: r.name,
      value: Math.max(1, getRegionValue(r, layer.key)),
      health: r.healthScore,
    }));
  }, [regions, catDef]);

  // Category overview with aggregate stats
  const categoryOverview = useMemo(() => {
    return DATA_CATEGORIES.map((cat) => {
      const primaryLayer = cat.layers[0];
      const values = regions.map((r) => getRegionValue(r, primaryLayer.key));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      return { ...cat, avg, max, min, primaryLayer };
    });
  }, [regions]);

  const tooltipStyle = {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
    fontSize: "12px", color: "#334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">대시보드</h1>
          <p className="text-xs md:text-sm text-[var(--text-tertiary)] mt-1">전국 250개 시군구 종합 현황</p>
        </div>

        {/* Key Stats with Sparklines & Trend */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 mb-4 md:mb-6">
            <StatCardEnhanced
              label="평균 건강도" value={stats.avgHealth.toFixed(1)} unit="점"
              color={getHealthColor(stats.avgHealth)}
              delta={deltas?.health} deltaUnit="점"
              sparkline={nationalTrend.slice(-10).map((d) => d.avgHealth)}
              sparkColor="#2563eb"
            />
            <StatCardEnhanced
              label="총 인구" value={(stats.totalPop / 10000).toFixed(0)} unit="만명"
              delta={deltas?.pop} deltaUnit="%"
              sparkline={nationalTrend.slice(-10).map((d) => d.totalPop)}
              sparkColor="#ec4899"
            />
            <StatCardEnhanced
              label="총 사업체" value={(stats.totalCompany / 10000).toFixed(1)} unit="만개"
              delta={deltas?.company} deltaUnit="%"
              sparkline={nationalTrend.slice(-10).map((d) => d.totalCompany)}
              sparkColor="#8b5cf6"
            />
            <StatCardEnhanced
              label="총 GRDP" value={(stats.totalGrdp / 1000).toFixed(0)} unit="조원"
              delta={deltas?.grdp} deltaUnit="%"
              sparkline={nationalTrend.slice(-10).map((d) => d.totalGrdp)}
              sparkColor="#f59e0b"
            />
            <StatCardEnhanced
              label="평균 성장률" value={stats.avgGrowth.toFixed(1)} unit="%"
              positive={stats.avgGrowth > 0} negative={stats.avgGrowth < 0}
            />
            <StatCardEnhanced
              label="평균 고령화율" value={stats.avgAging.toFixed(1)} unit="%"
              danger={stats.avgAging > 20}
              delta={deltas?.aging} deltaUnit="%p" invertDelta
              sparkline={nationalTrend.slice(-10).map((d) => d.avgAging)}
              sparkColor="#ef4444"
            />
          </div>
        )}

        {/* 13 Category Overview */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">13개 분야 종합 개요</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {categoryOverview.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCat(cat.key)}
                className={`text-left p-2.5 rounded-lg border transition-all ${
                  selectedCat === cat.key
                    ? "border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]/20"
                    : "border-[var(--border-light)] hover:border-[var(--border)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">{cat.label}</span>
                  <span className="text-[9px] text-[var(--text-tertiary)] ml-auto">{cat.layers.length}개 지표</span>
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  {cat.primaryLayer.label}: <span className="text-[var(--text-secondary)] font-medium">{formatLayerValue(cat.avg, cat.primaryLayer.key)}</span>
                </div>
                {/* Mini bar showing relative position */}
                <div className="mt-1.5 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((cat.avg - cat.min) / Math.max(cat.max - cat.min, 1)) * 100)}%`,
                      backgroundColor: cat.key === selectedCat ? "var(--accent)" : "#94a3b8",
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category Selector - Scrollable (for detailed selection) */}
        <div className="mb-4 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {DATA_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCat(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedCat === cat.key
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] ${selectedCat === cat.key ? "text-white/70" : "text-[var(--text-tertiary)]"}`}>{cat.layers.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Layer Detail Cards */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{catDef.icon} {catDef.label} 분야 세부 지표</h3>
            <Link href={`/?layer=${catDef.layers[0].key}`} className="text-[11px] text-[var(--accent)] hover:underline">지도에서 보기 →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catLayerStats.map((layer) => (
              <div key={layer.key} className="border border-[var(--border-light)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-primary)]">{layer.label}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">평균 {formatLayerValue(layer.avg, layer.key)}</span>
                </div>
                <div className="space-y-1">
                  {layer.top3.map((r, i) => (
                    <div key={r.code} className="flex items-center text-[11px]">
                      <span className="text-[var(--accent)] font-bold w-4">{i + 1}</span>
                      <span className="text-[var(--text-secondary)] flex-1 truncate">{r.name}</span>
                      <span className="text-[var(--text-primary)] font-medium">{formatLayerValue(getRegionValue(r, layer.key), layer.key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Row: Treemap + Province BarChart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Treemap */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{catDef.icon} {catDef.layers[0].label} 트리맵</h3>
            <p className="text-[10px] text-[var(--text-tertiary)] mb-3">상위 30개 지역 (크기 = {catDef.layers[0].label}, 색상 = 건강도)</p>
            <div className="h-[280px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData}
                  dataKey="value"
                  aspectRatio={4 / 3}
                  stroke="#fff"
                  content={<TreemapCell />}
                >
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => {
                      if (name === "value") return [formatLayerValue(v, catDef.layers[0].key), catDef.layers[0].label];
                      return [v, name];
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Province bar chart */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">광역시도별 평균 건강도</h3>
            <div className="h-[280px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData} layout="vertical" margin={{ top: 0, right: 12, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1) + "점", "건강도"]} />
                  <Bar dataKey="avgHealth" radius={[0, 4, 4, 0]}>
                    {provinceData.map((p) => <Cell key={p.code} fill={getHealthColor(p.avgHealth)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Health Distribution + Province Detail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">건강도 등급 분포</h3>
            <div className="h-[280px] md:h-[300px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="count" nameKey="label">
                    {healthDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}개 지역`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 min-w-[90px]">
                {healthDistribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-[var(--text-secondary)]">{d.label}</span>
                    <span className="ml-auto font-medium text-[var(--text-primary)]">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Province detail table */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">광역시도별 현황</h3>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-1.5 px-2 text-[var(--text-tertiary)] font-medium">시도</th>
                    <th className="text-right py-1.5 px-2 text-[var(--text-tertiary)] font-medium">시군구</th>
                    <th className="text-right py-1.5 px-2 text-[var(--text-tertiary)] font-medium">건강도</th>
                    <th className="text-right py-1.5 px-2 text-[var(--text-tertiary)] font-medium">수준</th>
                  </tr>
                </thead>
                <tbody>
                  {provinceData.map((p) => (
                    <tr key={p.code} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="py-1.5 px-2 font-medium text-[var(--text-primary)]">{p.name}</td>
                      <td className="py-1.5 px-2 text-right text-[var(--text-secondary)]">{p.count}개</td>
                      <td className="py-1.5 px-2 text-right font-bold" style={{ color: getHealthColor(p.avgHealth) }}>{p.avgHealth.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.avgHealth}%`, backgroundColor: getHealthColor(p.avgHealth) }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top/Bottom Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankingCard title="건강도 상위 10개 지역" regions={[...regions].sort((a, b) => b.healthScore - a.healthScore).slice(0, 10)} isTop historicalData={historicalData} />
          <RankingCard title="건강도 하위 10개 지역" regions={[...regions].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10)} isTop={false} totalCount={regions.length} historicalData={historicalData} />
        </div>
      </div>
    </div>
  );
}

/* Treemap custom cell */
function TreemapCell(props: Record<string, unknown>) {
  const { x, y, width, height, name, health } = props as { x: number; y: number; width: number; height: number; name: string; health: number };
  if (width < 4 || height < 4) return null;
  const color = getHealthColor(health ?? 50);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.85} stroke="#fff" strokeWidth={2} rx={3} />
      {width > 40 && height > 20 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={Math.min(11, width / 6)} fontWeight={600}>
          {name}
        </text>
      )}
    </g>
  );
}

/* Mini sparkline SVG */
function MiniSparkline({ data, color, width = 48, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Ranking card with sparklines */
function RankingCard({ title, regions, isTop, totalCount, historicalData }: {
  title: string; regions: RegionData[]; isTop: boolean; totalCount?: number; historicalData?: HistoricalData | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      <div className="space-y-1.5">
        {regions.map((r, i) => {
          // Extract sparkline data from historical
          const sparkData: number[] = [];
          if (historicalData?.data[r.code]) {
            const hist = historicalData.data[r.code];
            const lastN = hist.slice(-8);
            lastN.forEach((d) => { if (d.healthScore) sparkData.push(d.healthScore); });
          }

          return (
            <div key={r.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
              <span className={`text-xs font-bold w-5 ${isTop ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                {isTop ? i + 1 : (totalCount ?? 250) - i}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{r.name}</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">{r.province}</div>
              </div>
              {sparkData.length > 2 && <MiniSparkline data={sparkData} color={isTop ? "#2563eb" : "#ef4444"} />}
              <span className="text-sm font-bold" style={{ color: getHealthColor(r.healthScore) }}>
                {r.healthScore.toFixed(1)}
              </span>
              <span className="text-[11px] font-medium" style={{ color: r.growthRate >= 0 ? "#16a34a" : "#dc2626" }}>
                {r.growthRate >= 0 ? "+" : ""}{r.growthRate.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Enhanced stat card with sparkline and delta */
function StatCardEnhanced({ label, value, unit, color, positive, negative, danger, delta, deltaUnit, invertDelta, sparkline, sparkColor }: {
  label: string; value: string; unit: string; color?: string; positive?: boolean; negative?: boolean; danger?: boolean;
  delta?: number; deltaUnit?: string; invertDelta?: boolean; sparkline?: number[]; sparkColor?: string;
}) {
  const displayColor = color || (danger ? "var(--danger)" : positive ? "var(--success)" : negative ? "var(--danger)" : "var(--text-primary)");
  const deltaGood = delta !== undefined ? (invertDelta ? delta < 0 : delta > 0) : false;
  const deltaBad = delta !== undefined ? (invertDelta ? delta > 0 : delta < 0) : false;

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-3 md:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)]">{label}</div>
        {sparkline && sparkline.length > 2 && (
          <MiniSparkline data={sparkline} color={sparkColor || "#94a3b8"} width={40} height={16} />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl md:text-2xl font-bold" style={{ color: displayColor }}>
          {value}
        </span>
        <span className="text-[10px] md:text-xs text-[var(--text-tertiary)]">{unit}</span>
      </div>
      {delta !== undefined && (
        <div className={`text-[10px] mt-0.5 font-medium ${deltaGood ? "text-[#16a34a]" : deltaBad ? "text-[#dc2626]" : "text-[var(--text-tertiary)]"}`}>
          {deltaGood ? "▲" : deltaBad ? "▼" : "─"} {Math.abs(delta).toFixed(1)}{deltaUnit} <span className="text-[var(--text-tertiary)] font-normal">5년간</span>
        </div>
      )}
    </div>
  );
}
