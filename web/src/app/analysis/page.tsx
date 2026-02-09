"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { RegionData, HistoricalData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, DataLayerKey, getRegionValue, formatLayerValue, getLayerDef, DataCategory, DATA_TYPE_LABELS, areTypesCorrelatable } from "@/lib/constants";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
  ComposedChart, Bar, Area,
} from "recharts";

const tooltipStyle = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
  fontSize: "12px", color: "#334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

type AnalysisTab = "scatter" | "trend" | "correlation" | "composed";

export default function AnalysisPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("scatter");
  const [xKey, setXKey] = useState<DataLayerKey>("companyCount");
  const [yKey, setYKey] = useState<DataLayerKey>("employeeCount");
  const [trendMetric, setTrendMetric] = useState<DataLayerKey>("healthScore");
  const [trendGrouping, setTrendGrouping] = useState<"province" | "national">("national");
  const [corrCat, setCorrCat] = useState<DataCategory>("industry");
  const [composedMetric1, setComposedMetric1] = useState<DataLayerKey>("companyCount");
  const [composedMetric2, setComposedMetric2] = useState<DataLayerKey>("employeeCount");

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

  const allLayers = useMemo(() => DATA_CATEGORIES.flatMap((c) => c.layers), []);

  // Invisible dot for regression line (workaround for Recharts shape typing)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regressionDot: any = (p: any) => <circle cx={p.cx} cy={p.cy} r={0} fill="none" />;

  // Scatter data with regression line
  const scatterData = useMemo(() => {
    return regions.map((r) => ({
      x: getRegionValue(r, xKey),
      y: getRegionValue(r, yKey),
      name: r.name,
      health: r.healthScore,
    }));
  }, [regions, xKey, yKey]);

  // Linear regression
  const regression = useMemo(() => {
    const n = scatterData.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    scatterData.forEach((d) => { sumX += d.x; sumY += d.y; sumXY += d.x * d.y; sumX2 += d.x * d.x; });
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const xMin = Math.min(...scatterData.map((d) => d.x));
    const xMax = Math.max(...scatterData.map((d) => d.x));

    // R-squared
    const yMean = sumY / n;
    let ssTot = 0, ssRes = 0;
    scatterData.forEach((d) => {
      ssTot += (d.y - yMean) ** 2;
      ssRes += (d.y - (slope * d.x + intercept)) ** 2;
    });
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return {
      slope, intercept, r2,
      line: [
        { x: xMin, y: slope * xMin + intercept },
        { x: xMax, y: slope * xMax + intercept },
      ],
    };
  }, [scatterData]);

  // Pearson correlation
  const correlation = useMemo(() => {
    const n = scatterData.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    scatterData.forEach((d) => { sumX += d.x; sumY += d.y; sumXY += d.x * d.y; sumX2 += d.x * d.x; sumY2 += d.y * d.y; });
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den > 0 ? num / den : 0;
  }, [scatterData]);

  // Trend data
  const trendData = useMemo(() => {
    if (!historicalData) return [];
    const years = historicalData.endYear - historicalData.startYear + 1;
    if (trendGrouping === "national") {
      return Array.from({ length: years }, (_, i) => {
        let sum = 0, count = 0;
        Object.values(historicalData.data).forEach((regionYears) => {
          const d = regionYears[i];
          if (d && d[trendMetric] !== undefined) { sum += d[trendMetric]; count++; }
        });
        return { year: historicalData.startYear + i, value: count ? sum / count : 0 };
      });
    } else {
      const provinceMap = new Map<string, Map<number, { sum: number; count: number }>>();
      Object.entries(historicalData.data).forEach(([code, yearData]) => {
        const provCode = code.substring(0, 2);
        const provName = PROVINCE_SHORT[provCode] || provCode;
        if (!provinceMap.has(provName)) provinceMap.set(provName, new Map());
        const pMap = provinceMap.get(provName)!;
        yearData.forEach((d, i) => {
          if (!pMap.has(i)) pMap.set(i, { sum: 0, count: 0 });
          const prev = pMap.get(i)!;
          prev.sum += d[trendMetric] ?? 0;
          prev.count++;
        });
      });
      return Array.from({ length: years }, (_, i) => {
        const row: Record<string, number> = { year: historicalData.startYear + i };
        provinceMap.forEach((pMap, name) => {
          const entry = pMap.get(i);
          row[name] = entry && entry.count ? entry.sum / entry.count : 0;
        });
        return row;
      });
    }
  }, [historicalData, trendMetric, trendGrouping]);

  const provinceKeys = useMemo(() => {
    if (trendGrouping !== "province" || !trendData.length) return [];
    return Object.keys(trendData[0]).filter((k) => k !== "year");
  }, [trendData, trendGrouping]);

  const PROV_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#ec4899", "#0891b2", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#f43f5e", "#0284c7", "#a855f7", "#8b5cf6", "#64748b", "#e11d48"];

  // Correlation matrix
  const corrCatDef = DATA_CATEGORIES.find((c) => c.key === corrCat) ?? DATA_CATEGORIES[0];
  const correlationMatrix = useMemo(() => {
    const layers = corrCatDef.layers;
    const matrix: { xLabel: string; yLabel: string; value: number }[] = [];
    for (let i = 0; i < layers.length; i++) {
      for (let j = 0; j < layers.length; j++) {
        const xVals = regions.map((r) => getRegionValue(r, layers[i].key));
        const yVals = regions.map((r) => getRegionValue(r, layers[j].key));
        const n = xVals.length;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
        for (let k = 0; k < n; k++) {
          sx += xVals[k]; sy += yVals[k]; sxy += xVals[k] * yVals[k];
          sx2 += xVals[k] * xVals[k]; sy2 += yVals[k] * yVals[k];
        }
        const num = n * sxy - sx * sy;
        const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
        matrix.push({ xLabel: layers[i].label, yLabel: layers[j].label, value: den > 0 ? num / den : 0 });
      }
    }
    return { matrix, labels: layers.map((l) => l.label) };
  }, [regions, corrCatDef]);

  // Composed chart data (dual-axis)
  const composedData = useMemo(() => {
    const sorted = [...regions].sort((a, b) => getRegionValue(b, composedMetric1) - getRegionValue(a, composedMetric1)).slice(0, 20);
    return sorted.map((r) => ({
      name: r.name.length > 5 ? r.name.slice(0, 5) + "…" : r.name,
      metric1: getRegionValue(r, composedMetric1),
      metric2: getRegionValue(r, composedMetric2),
    }));
  }, [regions, composedMetric1, composedMetric2]);

  const xDef = getLayerDef(xKey);
  const yDef = getLayerDef(yKey);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">분석</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">지표간 상관관계, 시계열 추세, 복합 차트 분석</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { key: "scatter" as const, label: "산점도 분석" },
            { key: "trend" as const, label: "시계열 추세" },
            { key: "correlation" as const, label: "상관관계 행렬" },
            { key: "composed" as const, label: "복합 차트" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? "bg-[var(--accent)] text-white shadow-sm" : "bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >{tab.label}</button>
          ))}
        </div>

        {activeTab === "scatter" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">X축</span>
                  <select value={xKey} onChange={(e) => setXKey(e.target.value as DataLayerKey)}
                    className="text-sm border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                    {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label} [{DATA_TYPE_LABELS[l.dataType]}]</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">Y축</span>
                  <select value={yKey} onChange={(e) => setYKey(e.target.value as DataLayerKey)}
                    className="text-sm border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                    {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label} [{DATA_TYPE_LABELS[l.dataType]}]</option>)}
                  </select>
                </div>
                {regression && (
                  <div className="flex items-center gap-3 ml-auto text-xs">
                    <span className={`font-bold ${Math.abs(correlation) > 0.5 ? "text-[var(--accent)]" : Math.abs(correlation) > 0.3 ? "text-amber-500" : "text-[var(--text-tertiary)]"}`}>
                      r = {correlation.toFixed(3)}
                    </span>
                    <span className="text-[var(--text-tertiary)]">R² = {regression.r2.toFixed(3)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      Math.abs(correlation) > 0.7 ? "bg-emerald-50 text-emerald-600" :
                      Math.abs(correlation) > 0.4 ? "bg-blue-50 text-blue-600" :
                      Math.abs(correlation) > 0.2 ? "bg-amber-50 text-amber-600" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {Math.abs(correlation) > 0.7 ? "강한 상관" : Math.abs(correlation) > 0.4 ? "보통 상관" : Math.abs(correlation) > 0.2 ? "약한 상관" : "무상관"}
                    </span>
                  </div>
                )}
              </div>

              <div className="h-[400px]">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="x" name={xDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }}
                      label={{ value: xDef?.label || "", position: "bottom", fill: "#64748b", fontSize: 11, offset: 15 }} />
                    <YAxis type="number" dataKey="y" name={yDef?.label} tick={{ fill: "#94a3b8", fontSize: 10 }}
                      label={{ value: yDef?.label || "", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11, offset: -5 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => {
                        const key = name === "x" ? xKey : yKey;
                        return [formatLayerValue(v, key), name === "x" ? xDef?.label : yDef?.label];
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                    />
                    <Scatter data={scatterData} shape="circle">
                      {scatterData.map((d, i) => <Cell key={i} fill={getHealthColor(d.health)} opacity={0.7} r={4} />)}
                    </Scatter>
                    {regression && (
                      <Scatter data={regression.line} shape={regressionDot} line={{ stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "6 3" }} legendType="none" />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick presets - grouped by analysis type */}
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-3">추천 분석 조합</h3>
              {[
                { group: "규모 분석 (수량 vs 수량)", presets: [
                  { x: "companyCount" as const, y: "employeeCount" as const, label: "사업체 vs 종사자" },
                  { x: "population" as const, y: "grdp" as const, label: "인구 vs GRDP" },
                  { x: "storeCount" as const, y: "hospitalCount" as const, label: "상가 vs 의료기관" },
                ]},
                { group: "구조 분석 (비율 vs 비율)", presets: [
                  { x: "agingRate" as const, y: "closureRate" as const, label: "고령화 vs 폐업률" },
                  { x: "employmentRate" as const, y: "youthRatio" as const, label: "고용률 vs 청년비율" },
                  { x: "manufacturingRatio" as const, y: "smeRatio" as const, label: "제조업비중 vs 중소기업" },
                ]},
                { group: "영향 분석 (인과관계)", presets: [
                  { x: "avgLandPrice" as const, y: "population" as const, label: "지가 vs 인구" },
                  { x: "transitScore" as const, y: "aptPrice" as const, label: "교통접근성 vs 집값" },
                  { x: "universityCount" as const, y: "youthRatio" as const, label: "대학 vs 청년비율" },
                  { x: "airQuality" as const, y: "greenAreaRatio" as const, label: "미세먼지 vs 녹지" },
                ]},
                { group: "성장 분석 (증감 관련)", presets: [
                  { x: "growthRate" as const, y: "populationGrowth" as const, label: "기업성장 vs 인구성장" },
                  { x: "grdpGrowth" as const, y: "priceChangeRate" as const, label: "GRDP성장 vs 지가변동" },
                  { x: "avgWage" as const, y: "jobCreation" as const, label: "임금 vs 일자리증감" },
                ]},
              ].map((g) => (
                <div key={g.group} className="mb-2 last:mb-0">
                  <div className="text-[9px] text-[var(--text-tertiary)] mb-1">{g.group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.presets.map((p) => {
                      const xDt = getLayerDef(p.x)?.dataType;
                      const yDt = getLayerDef(p.y)?.dataType;
                      const compatible = xDt && yDt && areTypesCorrelatable(xDt, yDt);
                      return (
                        <button key={p.label} onClick={() => { setXKey(p.x); setYKey(p.y); }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            xKey === p.x && yKey === p.y ? "bg-[var(--accent-light)] text-[var(--accent)]" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {p.label}
                          {compatible && <span className="ml-1 text-[8px] text-emerald-500">&#x2713;</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Data type compatibility hint */}
            <div className="bg-white rounded-xl border border-[var(--border)] p-3 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                <span className="font-medium">현재 조합:</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{DATA_TYPE_LABELS[xDef?.dataType ?? "count"]}</span>
                <span>vs</span>
                <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">{DATA_TYPE_LABELS[yDef?.dataType ?? "count"]}</span>
                {xDef?.dataType && yDef?.dataType && (
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    areTypesCorrelatable(xDef.dataType, yDef.dataType) ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {areTypesCorrelatable(xDef.dataType, yDef.dataType) ? "분석 적합" : "주의: 다른 유형"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "trend" && historicalData && (
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select value={trendMetric} onChange={(e) => setTrendMetric(e.target.value as DataLayerKey)}
                className="text-sm border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
              <div className="flex gap-1">
                <button onClick={() => setTrendGrouping("national")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${trendGrouping === "national" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}>
                  전국 평균
                </button>
                <button onClick={() => setTrendGrouping("province")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${trendGrouping === "province" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}>
                  시도별
                </button>
              </div>
            </div>

            <div className="h-[400px]">
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `${l}년`}
                    formatter={(v: number) => [formatLayerValue(v, trendMetric), getLayerDef(trendMetric)?.label]} />
                  {trendGrouping === "national" ? (
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  ) : (
                    <>
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {provinceKeys.slice(0, 17).map((k, i) => (
                        <Line key={k} type="monotone" dataKey={k} stroke={PROV_COLORS[i % PROV_COLORS.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 2 }} />
                      ))}
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "correlation" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">상관관계 행렬</h3>
                <div className="flex gap-1">
                  {DATA_CATEGORIES.map((cat) => (
                    <button key={cat.key} onClick={() => setCorrCat(cat.key)}
                      className={`px-2 py-1 rounded text-[10px] font-medium ${corrCat === cat.key ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Heatmap */}
              <div className="overflow-x-auto">
                <div className="inline-block">
                  <div className="flex">
                    <div className="w-20 flex-shrink-0" />
                    {correlationMatrix.labels.map((label) => (
                      <div key={label} className="w-16 text-center text-[9px] text-[var(--text-tertiary)] font-medium px-0.5 truncate" title={label}>{label}</div>
                    ))}
                  </div>
                  {correlationMatrix.labels.map((yLabel, yi) => (
                    <div key={yLabel} className="flex items-center">
                      <div className="w-20 text-right pr-2 text-[9px] text-[var(--text-tertiary)] font-medium truncate flex-shrink-0">{yLabel}</div>
                      {correlationMatrix.labels.map((xLabel, xi) => {
                        const entry = correlationMatrix.matrix[yi * correlationMatrix.labels.length + xi];
                        const val = entry?.value ?? 0;
                        const absVal = Math.abs(val);
                        const bg = val > 0
                          ? `rgba(37, 99, 235, ${absVal * 0.7})`
                          : `rgba(220, 38, 38, ${absVal * 0.7})`;
                        return (
                          <div key={xLabel} className="w-16 h-12 flex items-center justify-center border border-white/50 cursor-default"
                            title={`${yLabel} × ${xLabel}: ${val.toFixed(3)}`}
                            style={{ backgroundColor: bg }}
                            onClick={() => {
                              const xLayerKey = corrCatDef.layers[xi]?.key;
                              const yLayerKey = corrCatDef.layers[yi]?.key;
                              if (xLayerKey && yLayerKey) { setXKey(xLayerKey); setYKey(yLayerKey); setActiveTab("scatter"); }
                            }}
                          >
                            <span className={`text-[10px] font-bold ${absVal > 0.4 ? "text-white" : "text-[var(--text-secondary)]"}`}>
                              {val.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-12 h-2 rounded-full" style={{ background: "linear-gradient(to right, rgba(220,38,38,0.7), rgba(220,38,38,0), rgba(37,99,235,0), rgba(37,99,235,0.7))" }} />
                  <span className="text-[var(--text-tertiary)]">-1.0 (역상관) ↔ +1.0 (정상관)</span>
                </div>
                <span className="text-[9px] text-[var(--text-tertiary)]">셀 클릭 → 산점도 분석</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "composed" && (
          <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">막대 (좌측)</span>
                <select value={composedMetric1} onChange={(e) => setComposedMetric1(e.target.value as DataLayerKey)}
                  className="text-sm border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none">
                  {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">선 (우측)</span>
                <select value={composedMetric2} onChange={(e) => setComposedMetric2(e.target.value as DataLayerKey)}
                  className="text-sm border border-[var(--border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--text-primary)] outline-none">
                  {allLayers.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="h-[400px]">
              <ResponsiveContainer>
                <ComposedChart data={composedData} margin={{ top: 10, right: 40, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis yAxisId="left" tick={{ fill: "#2563eb", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#dc2626", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => {
                      const key = name === "metric1" ? composedMetric1 : composedMetric2;
                      return [formatLayerValue(v, key), getLayerDef(key)?.label];
                    }}
                  />
                  <Legend formatter={(value: string) => value === "metric1" ? getLayerDef(composedMetric1)?.label : getLayerDef(composedMetric2)?.label} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="metric1" fill="#2563eb" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="metric2" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[10px] text-[var(--text-tertiary)]">추천:</span>
              {[
                { m1: "companyCount" as const, m2: "employeeCount" as const, label: "사업체 + 종사자" },
                { m1: "grdp" as const, m2: "taxRevenue" as const, label: "GRDP + 세수" },
                { m1: "population" as const, m2: "agingRate" as const, label: "인구 + 고령화" },
                { m1: "aptPrice" as const, m2: "avgLandPrice" as const, label: "아파트가 + 지가" },
              ].map((p) => (
                <button key={p.label} onClick={() => { setComposedMetric1(p.m1); setComposedMetric2(p.m2); }}
                  className="px-2 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">{p.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
