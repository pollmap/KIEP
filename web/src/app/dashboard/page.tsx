"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, HEALTH_BANDS, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef, DataCategory } from "@/lib/constants";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie,
} from "recharts";

export default function DashboardPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<DataCategory>("industry");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${base}/data/sample-regions.json`)
      .then((r) => r.json())
      .then((data) => { setRegions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const catDef = DATA_CATEGORIES.find((c) => c.key === selectedCat) ?? DATA_CATEGORIES[0];

  const stats = useMemo(() => {
    if (!regions.length) return null;
    const avgHealth = regions.reduce((s, r) => s + r.healthScore, 0) / regions.length;
    const totalPop = regions.reduce((s, r) => s + r.population, 0);
    const totalCompany = regions.reduce((s, r) => s + r.companyCount, 0);
    const totalEmployee = regions.reduce((s, r) => s + r.employeeCount, 0);
    const avgGrowth = regions.reduce((s, r) => s + r.growthRate, 0) / regions.length;
    const avgAging = regions.reduce((s, r) => s + r.agingRate, 0) / regions.length;
    const avgEmployment = regions.reduce((s, r) => s + r.employmentRate, 0) / regions.length;
    const avgTransit = regions.reduce((s, r) => s + r.transitScore, 0) / regions.length;
    const totalGrdp = regions.reduce((s, r) => s + (r.grdp || 0), 0);
    const avgFinIndep = regions.reduce((s, r) => s + (r.financialIndependence || 0), 0) / regions.length;
    const avgCrime = regions.reduce((s, r) => s + (r.crimeRate || 0), 0) / regions.length;
    const avgAirQuality = regions.reduce((s, r) => s + (r.airQuality || 0), 0) / regions.length;
    return { avgHealth, totalPop, totalCompany, totalEmployee, avgGrowth, avgAging, avgEmployment, avgTransit, totalGrdp, avgFinIndep, avgCrime, avgAirQuality };
  }, [regions]);

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

        {/* Category Selector - Scrollable */}
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

        {/* Key Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 mb-4 md:mb-6">
            <StatCard label="평균 건강도" value={stats.avgHealth.toFixed(1)} unit="점" color={getHealthColor(stats.avgHealth)} />
            <StatCard label="총 인구" value={(stats.totalPop / 10000).toFixed(0)} unit="만명" />
            <StatCard label="총 사업체" value={(stats.totalCompany / 10000).toFixed(1)} unit="만개" />
            <StatCard label="총 GRDP" value={(stats.totalGrdp / 1000).toFixed(0)} unit="조원" />
            <StatCard label="평균 성장률" value={stats.avgGrowth.toFixed(1)} unit="%" positive={stats.avgGrowth > 0} negative={stats.avgGrowth < 0} />
            <StatCard label="평균 고령화율" value={stats.avgAging.toFixed(1)} unit="%" danger={stats.avgAging > 20} />
          </div>
        )}

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

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
        </div>

        {/* Top/Bottom Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RankingCard title="건강도 상위 10개 지역" regions={[...regions].sort((a, b) => b.healthScore - a.healthScore).slice(0, 10)} isTop />
          <RankingCard title="건강도 하위 10개 지역" regions={[...regions].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10)} isTop={false} totalCount={regions.length} />
        </div>
      </div>
    </div>
  );
}

function RankingCard({ title, regions, isTop, totalCount }: { title: string; regions: RegionData[]; isTop: boolean; totalCount?: number }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{title}</h3>
      <div className="space-y-1.5">
        {regions.map((r, i) => (
          <div key={r.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
            <span className={`text-xs font-bold w-5 ${isTop ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
              {isTop ? i + 1 : (totalCount ?? 250) - i}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">{r.name}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">{r.province}</div>
            </div>
            <span className="text-sm font-bold" style={{ color: getHealthColor(r.healthScore) }}>
              {r.healthScore.toFixed(1)}
            </span>
            <span className="text-[11px] font-medium" style={{ color: r.growthRate >= 0 ? "#16a34a" : "#dc2626" }}>
              {r.growthRate >= 0 ? "+" : ""}{r.growthRate.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color, positive, negative, danger }: {
  label: string; value: string; unit: string; color?: string; positive?: boolean; negative?: boolean; danger?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-3 md:p-4 shadow-sm">
      <div className="text-[10px] md:text-[11px] text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl md:text-2xl font-bold"
          style={{ color: color || (danger ? "var(--danger)" : positive ? "var(--success)" : negative ? "var(--danger)" : "var(--text-primary)") }}>
          {value}
        </span>
        <span className="text-[10px] md:text-xs text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}
