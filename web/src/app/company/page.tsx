"use client";

import { useState, useMemo, useEffect } from "react";
import { RegionData } from "@/lib/types";
import { getHealthColor, PROVINCE_SHORT, DATA_CATEGORIES, getRegionValue, formatLayerValue, DataLayerKey } from "@/lib/constants";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Cell, Legend,
  PieChart, Pie,
  ComposedChart, Line,
} from "recharts";

const tooltipStyle = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
  fontSize: "12px", color: "#334155", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

// Generate deterministic company data based on region
function seedRandom(s: number) {
  let seed = s;
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

interface Company {
  id: string;
  name: string;
  industry: string;
  employees: number;
  revenue: number;
  profit: number;
  founded: number;
  regionCode: string;
  regionName: string;
  province: string;
  growth: number;
  npsStatus: string;
  creditRating: string;
}

const INDUSTRY_NAMES: Record<string, string> = {
  manufacturing: "제조업", it: "IT/소프트웨어", services: "서비스업",
  construction: "건설업", wholesale: "도소매업", logistics: "운수/물류",
  finance: "금융/보험", education: "교육", healthcare: "의료/복지", other: "기타"
};

const INDUSTRY_COLORS: Record<string, string> = {
  "제조업": "#3b82f6", "IT/소프트웨어": "#8b5cf6", "서비스업": "#ec4899",
  "건설업": "#f97316", "도소매업": "#eab308", "운수/물류": "#06b6d4",
  "금융/보험": "#10b981", "교육": "#6366f1", "의료/복지": "#14b8a6", "기타": "#6b7280",
};

const CREDIT_RATINGS = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB"];

function generateCompaniesFromRegions(regions: RegionData[]): Company[] {
  const companies: Company[] = [];
  const rand = seedRandom(42);

  const koreanSurnames = ["삼성", "현대", "SK", "LG", "롯데", "한화", "포스코", "효성", "두산", "CJ", "GS", "한진", "대한", "동양", "한국", "신한", "우리", "KB", "미래", "코리아"];
  const suffixes = ["전자", "중공업", "건설", "화학", "모터스", "에너지", "텔레콤", "반도체", "바이오", "솔루션", "테크", "시스템", "물산", "산업", "글로벌", "리서치", "네트웍스", "푸드", "제약", "소프트"];

  regions.forEach((region) => {
    const numCompanies = Math.max(3, Math.floor(region.companyCount / 500));
    const industries = Object.keys(INDUSTRY_NAMES);

    for (let i = 0; i < Math.min(numCompanies, 15); i++) {
      const industry = INDUSTRY_NAMES[industries[Math.floor(rand() * industries.length)]];
      const employees = Math.floor(rand() * 5000) + 10;
      const revenue = Math.floor(rand() * 100000 + employees * 20);
      const profitMargin = rand() * 0.3 - 0.05;
      const growth = (rand() * 30 - 5);

      companies.push({
        id: `${region.code}-${i}`,
        name: `${koreanSurnames[Math.floor(rand() * koreanSurnames.length)]}${suffixes[Math.floor(rand() * suffixes.length)]}`,
        industry,
        employees,
        revenue,
        profit: Math.floor(revenue * profitMargin),
        founded: 1960 + Math.floor(rand() * 60),
        regionCode: region.code,
        regionName: region.name,
        province: region.province,
        growth,
        npsStatus: rand() > 0.1 ? "정상" : "체납",
        creditRating: CREDIT_RATINGS[Math.floor(rand() * CREDIT_RATINGS.length)],
      });
    }
  });

  return companies.sort((a, b) => b.revenue - a.revenue);
}

export default function CompanyPage() {
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);
  const [provinceFilter, setProvinceFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"revenue" | "employees" | "growth" | "profit">("revenue");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Company | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "analytics">("list");
  const PAGE_SIZE = 20;

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${base}/data/sample-regions.json`)
      .then((r) => r.json())
      .then((data) => { setRegions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const companies = useMemo(() => generateCompaniesFromRegions(regions), [regions]);

  const filtered = useMemo(() => {
    let list = companies;
    if (industryFilter) list = list.filter((c) => c.industry === industryFilter);
    if (provinceFilter) list = list.filter((c) => c.regionCode.startsWith(provinceFilter));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.regionName.includes(q) || c.industry.includes(q));
    }
    list.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      return typeof va === "number" && typeof vb === "number" ? vb - va : 0;
    });
    return list;
  }, [companies, industryFilter, provinceFilter, search, sortKey]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Analytics data
  const industryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; employees: number }>();
    filtered.forEach((c) => {
      const prev = map.get(c.industry) || { count: 0, revenue: 0, employees: 0 };
      prev.count++;
      prev.revenue += c.revenue;
      prev.employees += c.employees;
      map.set(c.industry, prev);
    });
    return Array.from(map.entries())
      .map(([industry, d]) => ({ industry, ...d, color: INDUSTRY_COLORS[industry] || "#6b7280" }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const provinceBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filtered.forEach((c) => {
      const prev = map.get(c.province) || { count: 0, revenue: 0 };
      prev.count++;
      prev.revenue += c.revenue;
      map.set(c.province, prev);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name: name.replace(/특별자치도|특별시|광역시|도$/, ""), ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filtered]);

  const revenueVsProfit = useMemo(() => {
    return filtered.slice(0, 20).map((c) => ({
      name: c.name.length > 6 ? c.name.slice(0, 6) + "…" : c.name,
      revenue: c.revenue,
      profit: c.profit,
      margin: c.revenue ? (c.profit / c.revenue * 100) : 0,
    }));
  }, [filtered]);

  const stats = useMemo(() => ({
    totalCount: filtered.length,
    totalRevenue: filtered.reduce((s, c) => s + c.revenue, 0),
    totalEmployees: filtered.reduce((s, c) => s + c.employees, 0),
    avgGrowth: filtered.length ? filtered.reduce((s, c) => s + c.growth, 0) / filtered.length : 0,
    profitableRatio: filtered.length ? filtered.filter((c) => c.profit > 0).length / filtered.length * 100 : 0,
  }), [filtered]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[var(--text-tertiary)]">데이터 로딩 중...</div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">기업 분석</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">사업자등록 기반 기업 현황 및 재무 분석</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {[
            { label: "기업 수", value: stats.totalCount.toLocaleString(), unit: "개" },
            { label: "총 매출", value: (stats.totalRevenue / 10000).toFixed(0), unit: "조원" },
            { label: "총 고용", value: (stats.totalEmployees / 10000).toFixed(1), unit: "만명" },
            { label: "평균 성장률", value: stats.avgGrowth.toFixed(1), unit: "%", positive: stats.avgGrowth > 0 },
            { label: "흑자 비율", value: stats.profitableRatio.toFixed(0), unit: "%" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[var(--border)] p-3 shadow-sm">
              <div className="text-[10px] text-[var(--text-tertiary)]">{s.label}</div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-xl font-bold ${"positive" in s && s.positive ? "text-[#16a34a]" : "text-[var(--text-primary)]"}`}>{s.value}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <input type="text" placeholder="기업명, 지역, 업종..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] w-48" />
            <select value={industryFilter ?? ""} onChange={(e) => { setIndustryFilter(e.target.value || null); setPage(0); }}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-white text-[var(--text-primary)] outline-none">
              <option value="">전체 업종</option>
              {Object.values(INDUSTRY_NAMES).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={provinceFilter ?? ""} onChange={(e) => { setProvinceFilter(e.target.value || null); setPage(0); }}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-white text-[var(--text-primary)] outline-none">
              <option value="">전국</option>
              {Object.entries(PROVINCE_SHORT).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => { setSortKey(e.target.value as typeof sortKey); setPage(0); }}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-white text-[var(--text-primary)] outline-none">
              <option value="revenue">매출순</option>
              <option value="employees">고용순</option>
              <option value="growth">성장률순</option>
              <option value="profit">이익순</option>
            </select>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setViewMode("list")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${viewMode === "list" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}>목록</button>
              <button onClick={() => setViewMode("analytics")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${viewMode === "analytics" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"}`}>분석</button>
              <span className="text-xs text-[var(--text-tertiary)] ml-2">{filtered.length.toLocaleString()}개</span>
            </div>
          </div>
        </div>

        {viewMode === "analytics" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Industry breakdown */}
              <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">업종별 매출 분포</h3>
                <div className="h-[280px] flex items-center">
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie data={industryBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={2} dataKey="revenue" nameKey="industry">
                        {industryBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [(v / 10000).toFixed(0) + "조원", "매출"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 flex-1">
                    {industryBreakdown.slice(0, 8).map((d) => (
                      <div key={d.industry} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[var(--text-secondary)] truncate">{d.industry}</span>
                        <span className="ml-auto font-medium text-[var(--text-primary)] whitespace-nowrap">{d.count}사</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Province breakdown */}
              <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">시도별 기업 현황</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={provinceBreakdown} layout="vertical" margin={{ top: 0, right: 8, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} width={36} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v + "개", "기업 수"]} />
                      <Bar dataKey="count" fill="#2563eb" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Revenue vs Profit composed chart */}
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">매출 vs 영업이익 (상위 20)</h3>
              <div className="h-[320px]">
                <ResponsiveContainer>
                  <ComposedChart data={revenueVsProfit} margin={{ top: 10, right: 40, bottom: 30, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                    <YAxis yAxisId="left" tick={{ fill: "#2563eb", fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#dc2626", fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="revenue" fill="#2563eb" name="매출" opacity={0.7} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#16a34a" name="영업이익" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Company List */}
            <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] w-10">#</th>
                      <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">기업명</th>
                      <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">업종</th>
                      <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">소재지</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">매출</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">이익</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">고용</th>
                      <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">성장률</th>
                      <th className="text-center px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)]">등급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c, i) => (
                      <tr key={c.id} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                        onClick={() => setSelected(c)}
                      >
                        <td className="px-4 py-2.5 text-xs text-[var(--text-tertiary)]">{page * PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-[var(--text-primary)]">{c.name}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">설립 {c.founded}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: (INDUSTRY_COLORS[c.industry] || "#6b7280") + "18", color: INDUSTRY_COLORS[c.industry] || "#6b7280" }}>{c.industry}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{c.regionName}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium text-[var(--text-primary)]">{(c.revenue / 100).toFixed(0)}억</td>
                        <td className="px-4 py-2.5 text-right text-sm font-medium" style={{ color: c.profit >= 0 ? "#16a34a" : "#dc2626" }}>{(c.profit / 100).toFixed(0)}억</td>
                        <td className="px-4 py-2.5 text-right text-xs text-[var(--text-secondary)]">{c.employees.toLocaleString()}명</td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: c.growth >= 0 ? "#16a34a" : "#dc2626" }}>
                          {c.growth >= 0 ? "+" : ""}{c.growth.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            c.creditRating.startsWith("AA") ? "bg-emerald-50 text-emerald-600"
                            : c.creditRating.startsWith("A") ? "bg-blue-50 text-blue-600"
                            : "bg-amber-50 text-amber-600"
                          }`}>{c.creditRating}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed">이전</button>
                  <span className="text-xs text-[var(--text-tertiary)]">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed">다음</button>
                </div>
              )}
            </div>

            {/* Company Detail Modal */}
            {selected && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
                <div className="bg-white rounded-xl shadow-2xl border border-[var(--border)] max-w-md w-full max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">{selected.name}</h2>
                      <div className="text-xs text-[var(--text-tertiary)]">{selected.province} {selected.regionName} · {selected.industry} · 설립 {selected.founded}</div>
                    </div>
                    <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-secondary)]">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "매출액", value: `${(selected.revenue / 100).toFixed(0)}억원` },
                      { label: "영업이익", value: `${(selected.profit / 100).toFixed(0)}억원`, color: selected.profit >= 0 ? "#16a34a" : "#dc2626" },
                      { label: "이익률", value: `${(selected.revenue ? selected.profit / selected.revenue * 100 : 0).toFixed(1)}%` },
                      { label: "종업원", value: `${selected.employees.toLocaleString()}명` },
                      { label: "성장률", value: `${selected.growth >= 0 ? "+" : ""}${selected.growth.toFixed(1)}%`, color: selected.growth >= 0 ? "#16a34a" : "#dc2626" },
                      { label: "신용등급", value: selected.creditRating },
                      { label: "국민연금", value: selected.npsStatus },
                      { label: "설립연도", value: `${selected.founded}년` },
                    ].map((s) => (
                      <div key={s.label} className="bg-[var(--bg-secondary)] rounded-lg p-2.5">
                        <div className="text-[9px] text-[var(--text-tertiary)]">{s.label}</div>
                        <div className="text-sm font-bold mt-0.5" style={{ color: "color" in s && s.color ? s.color : "var(--text-primary)" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Benchmarking vs region average */}
                  <div className="border-t border-[var(--border)] pt-3">
                    <h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-2">소속 지역 벤치마크</h3>
                    {(() => {
                      const region = regions.find((r) => r.code === selected.regionCode);
                      if (!region) return null;
                      return (
                        <div className="space-y-1.5">
                          {[
                            { label: "지역 건강도", value: region.healthScore.toFixed(1) + "점", color: getHealthColor(region.healthScore) },
                            { label: "지역 평균임금", value: region.avgWage.toLocaleString() + "만원" },
                            { label: "지역 고용률", value: region.employmentRate.toFixed(1) + "%" },
                            { label: "지역 사업체", value: region.companyCount.toLocaleString() + "개" },
                          ].map((item) => (
                            <div key={item.label} className="flex justify-between text-[11px]">
                              <span className="text-[var(--text-tertiary)]">{item.label}</span>
                              <span className="font-medium" style={"color" in item && item.color ? { color: item.color } : undefined}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
