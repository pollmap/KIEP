"use client";

import { useEffect, useState, useMemo } from "react";
import { RegionData, HistoricalData } from "@/lib/types";
import { getHealthColor, PROVINCES, PROVINCE_SHORT, DATA_CATEGORIES, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef } from "@/lib/constants";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  AreaChart, Area, LineChart, Line, BarChart, Bar,
} from "recharts";

export default function AnalysisPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [xAxis, setXAxis] = useState<DataLayerKey>("companyCount");
  const [yAxis, setYAxis] = useState<DataLayerKey>("healthScore");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    Promise.all([
      fetch(`${base}/data/sample-regions.json`).then((r) => r.json()),
      fetch(`${base}/data/sample-historical.json`).then((r) => r.json()),
    ])
      .then(([regionData, histData]) => { setRegions(regionData); setHistoricalData(histData); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const allLayers = useMemo(() => DATA_CATEGORIES.flatMap((c) => c.layers), []);

  const scatterData = useMemo(() => {
    let list = regions;
    if (selectedProvince) list = list.filter((r) => r.code.startsWith(selectedProvince));
    return list.map((r) => ({
      name: r.name,
      province: r.province,
      x: getRegionValue(r, xAxis),
      y: getRegionValue(r, yAxis),
      health: r.healthScore,
      code: r.code,
    }));
  }, [regions, xAxis, yAxis, selectedProvince]);

  const nationalTrend = useMemo(() => {
    if (!historicalData) return [];
    const years = historicalData.endYear - historicalData.startYear + 1;
    return Array.from({ length: years }, (_, i) => {
      const year = historicalData.startYear + i;
      let sumHealth = 0, sumPop = 0, sumCompany = 0, count = 0;
      Object.values(historicalData.data).forEach((regionYears) => {
        const d = regionYears[i];
        if (d) {
          sumHealth += d.healthScore ?? 0;
          sumPop += d.population ?? 0;
          sumCompany += d.companyCount ?? 0;
          count++;
        }
      });
      return {
        year,
        avgHealth: count ? sumHealth / count : 0,
        totalPop: sumPop,
        totalCompany: sumCompany,
      };
    });
  }, [historicalData]);

  const provinceComparison = useMemo(() => {
    const map = new Map<string, { health: number; pop: number; company: number; count: number }>();
    regions.forEach((r) => {
      const prefix = r.code.substring(0, 2);
      const prev = map.get(prefix) || { health: 0, pop: 0, company: 0, count: 0 };
      prev.health += r.healthScore;
      prev.pop += r.population;
      prev.company += r.companyCount;
      prev.count++;
      map.set(prefix, prev);
    });
    return Array.from(map.entries())
      .map(([code, d]) => ({
        name: PROVINCE_SHORT[code] || code,
        avgHealth: d.health / d.count,
        population: d.pop,
        companies: d.company,
      }))
      .sort((a, b) => b.avgHealth - a.avgHealth);
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

  const xDef = getLayerDef(xAxis);
  const yDef = getLayerDef(yAxis);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">분석</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">데이터 간 상관관계 및 추세 분석</p>
        </div>

        {/* Scatter Plot */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">상관관계 분석</h3>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <label className="text-[11px] text-[var(--text-tertiary)]">X축:</label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value as DataLayerKey)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <label className="text-[11px] text-[var(--text-tertiary)]">Y축:</label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value as DataLayerKey)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <select
                value={selectedProvince || ""}
                onChange={(e) => setSelectedProvince(e.target.value || null)}
                className="text-xs border border-[var(--border)] rounded-lg px-2 py-1 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">전체</option>
                {Object.entries(PROVINCE_SHORT).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="x" name={xDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }} label={{ value: xDef?.label, position: "bottom", fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name={yDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }} label={{ value: yDef?.label, angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => [
                    name === "x" ? formatLayerValue(value, xAxis) : formatLayerValue(value, yAxis),
                    name === "x" ? xDef?.label : yDef?.label,
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d, i) => (
                    <Cell key={i} fill={getHealthColor(d.health)} opacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* National Trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">전국 평균 건강도 추이</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nationalTrend} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[40, 80]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1) + "점", "평균 건강도"]} labelFormatter={(l) => `${l}년`} />
                  <Area type="monotone" dataKey="avgHealth" stroke="#2563eb" strokeWidth={2} fill="url(#healthGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">전국 기업 수 추이</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nationalTrend} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="companyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [(v / 10000).toFixed(1) + "만개", "기업 수"]} labelFormatter={(l) => `${l}년`} />
                  <Area type="monotone" dataKey="totalCompany" stroke="#8b5cf6" strokeWidth={2} fill="url(#companyGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Province Comparison */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">광역시도별 비교</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provinceComparison} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avgHealth" name="평균 건강도" radius={[4, 4, 0, 0]}>
                  {provinceComparison.map((p, i) => (
                    <Cell key={i} fill={getHealthColor(p.avgHealth)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
