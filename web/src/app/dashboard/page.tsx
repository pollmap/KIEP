"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, HEALTH_BANDS } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, AreaChart, Area,
} from "recharts";

export default function DashboardPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${base}/data/sample-regions.json`)
      .then((r) => r.json())
      .then((data) => { setRegions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
    return { avgHealth, totalPop, totalCompany, totalEmployee, avgGrowth, avgAging, avgEmployment, avgTransit };
  }, [regions]);

  const provinceData = useMemo(() => {
    const map = new Map<string, RegionData[]>();
    regions.forEach((r) => {
      const prefix = r.code.substring(0, 2);
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix)!.push(r);
    });
    return Array.from(map.entries()).map(([code, list]) => ({
      code,
      name: PROVINCE_SHORT[code] || code,
      avgHealth: list.reduce((s, r) => s + r.healthScore, 0) / list.length,
      totalCompany: list.reduce((s, r) => s + r.companyCount, 0),
      totalPop: list.reduce((s, r) => s + r.population, 0),
      avgGrowth: list.reduce((s, r) => s + r.growthRate, 0) / list.length,
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

  const topRegions = useMemo(() => {
    return [...regions].sort((a, b) => b.healthScore - a.healthScore).slice(0, 10);
  }, [regions]);

  const bottomRegions = useMemo(() => {
    return [...regions].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10);
  }, [regions]);

  const tooltipStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#334155",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">대시보드</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">전국 250개 시군구 종합 현황</p>
        </div>

        {/* Key Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="평균 산업 건강도" value={stats.avgHealth.toFixed(1)} unit="점" color={getHealthColor(stats.avgHealth)} />
            <StatCard label="총 인구" value={(stats.totalPop / 10000).toFixed(0)} unit="만명" />
            <StatCard label="총 기업 수" value={(stats.totalCompany / 10000).toFixed(1)} unit="만개" />
            <StatCard label="총 고용 인원" value={(stats.totalEmployee / 10000).toFixed(1)} unit="만명" />
            <StatCard label="평균 성장률" value={stats.avgGrowth.toFixed(1)} unit="%" positive={stats.avgGrowth > 0} negative={stats.avgGrowth < 0} />
            <StatCard label="평균 고령화율" value={stats.avgAging.toFixed(1)} unit="%" danger={stats.avgAging > 20} />
            <StatCard label="평균 고용률" value={stats.avgEmployment.toFixed(1)} unit="%" />
            <StatCard label="평균 교통접근성" value={stats.avgTransit.toFixed(1)} unit="점" />
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Province Health Ranking */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">광역시도별 평균 건강도</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={provinceData} layout="vertical" margin={{ top: 0, right: 12, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1) + "점", "건강도"]} />
                  <Bar dataKey="avgHealth" radius={[0, 4, 4, 0]}>
                    {provinceData.map((p) => (
                      <Cell key={p.code} fill={getHealthColor(p.avgHealth)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Health Distribution */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">건강도 등급 분포</h3>
            <div className="h-[300px] flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="label">
                    {healthDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}개 지역`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 min-w-[100px]">
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

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Top 10 */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              건강도 상위 10개 지역
            </h3>
            <div className="space-y-1.5">
              {topRegions.map((r, i) => (
                <div key={r.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                  <span className="text-xs font-bold text-[var(--accent)] w-5">{i + 1}</span>
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

          {/* Bottom 10 */}
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              건강도 하위 10개 지역
            </h3>
            <div className="space-y-1.5">
              {bottomRegions.map((r, i) => (
                <div key={r.code} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                  <span className="text-xs font-bold text-[var(--danger)] w-5">{regions.length - i}</span>
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
        </div>

        {/* Data Categories Overview */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">데이터 카테고리</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {DATA_CATEGORIES.map((cat) => (
              <div key={cat.key} className="p-3 rounded-xl bg-[var(--bg-secondary)] text-center">
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">{cat.label}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{cat.layers.length}개 레이어</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color, positive, negative, danger }: {
  label: string;
  value: string;
  unit: string;
  color?: string;
  positive?: boolean;
  negative?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-bold"
          style={{
            color: color || (danger ? "var(--danger)" : positive ? "var(--success)" : negative ? "var(--danger)" : "var(--text-primary)"),
          }}
        >
          {value}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}
