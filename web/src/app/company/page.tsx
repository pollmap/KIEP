"use client";

import { useState, useMemo } from "react";
import { getHealthColor } from "@/lib/constants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from "recharts";

interface MockCompany {
  bizNo: string;
  name: string;
  status: string;
  industry: string;
  province: string;
  address: string;
  stockCode?: string;
  market?: string;
  employees: number;
  healthScore: number;
  employeeHistory: { month: string; count: number }[];
  financials?: { year: string; revenue: number; profit: number }[];
}

function generateCompanies(): MockCompany[] {
  let seed = 777;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const randInt = (a: number, b: number) => Math.floor(random() * (b - a + 1)) + a;

  const names = [
    "삼성전자", "SK하이닉스", "LG에너지솔루션", "현대자동차", "기아",
    "POSCO홀딩스", "삼성바이오로직스", "LG화학", "NAVER", "카카오",
    "현대모비스", "삼성SDI", "셀트리온", "KB금융", "신한지주",
    "한국전력", "SK이노베이션", "LG전자", "한화솔루션", "두산에너빌리티",
    "넷마블", "크래프톤", "쿠팡", "배달의민족", "당근마켓",
    "토스", "리디", "마켓컬리", "야놀자", "직방",
  ];
  const industries = ["전자부품 제조", "반도체 제조", "배터리 제조", "자동차 제조", "소프트웨어 개발", "철강 제조", "바이오/의약", "화학", "플랫폼 서비스", "금융"];
  const provinces = ["경기도", "서울특별시", "충청남도", "울산광역시", "경상북도", "전라남도", "인천광역시", "대전광역시"];

  return names.map((name, i) => {
    const emp = randInt(100, 120000);
    return {
      bizNo: `${String(100 + i).padStart(3, "0")}-${String(randInt(10, 99))}-${String(randInt(10000, 99999))}`,
      name,
      status: "계속사업자",
      industry: industries[i % industries.length],
      province: provinces[i % provinces.length],
      address: `${provinces[i % provinces.length]} ${name.slice(0, 2)}시`,
      stockCode: i < 20 ? `00${String(5930 + i * 100).padStart(4, "0")}` : undefined,
      market: i < 10 ? "KOSPI" : i < 20 ? "KOSDAQ" : undefined,
      employees: emp,
      healthScore: +(random() * 40 + 55).toFixed(1),
      employeeHistory: Array.from({ length: 12 }, (_, j) => ({
        month: `${2025 - Math.floor(j / 12)}-${String(12 - (j % 12)).padStart(2, "0")}`,
        count: emp + randInt(-emp * 0.05, emp * 0.05),
      })).reverse(),
      financials: i < 20
        ? [
            { year: "2023", revenue: randInt(10000, 3000000), profit: randInt(-50000, 500000) },
            { year: "2024", revenue: randInt(10000, 3000000), profit: randInt(-50000, 500000) },
          ]
        : undefined,
    };
  });
}

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#334155",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

export default function CompanyPage() {
  const [companies] = useState(generateCompanies);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MockCompany | null>(null);

  const filtered = useMemo(() => {
    if (!search) return companies.slice(0, 20);
    const q = search.toLowerCase();
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) || c.bizNo.includes(q) || c.industry.includes(q)
    );
  }, [companies, search]);

  return (
    <div className="h-[calc(100vh-var(--nav-height))] flex overflow-hidden">
      {/* Search Panel */}
      <div className="w-[380px] border-r border-[var(--border)] flex flex-col bg-white">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-3">기업 검색</h1>
          <input
            type="text"
            placeholder="기업명 또는 사업자번호 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.bizNo}
              onClick={() => setSelected(c)}
              className={`w-full px-4 py-3 text-left border-b border-[var(--border-light)] transition-colors ${
                selected?.bizNo === c.bizNo ? "bg-[var(--accent-light)]" : "hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                {c.market && (
                  <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">{c.market}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-tertiary)]">
                <span>{c.industry}</span>
                <span>|</span>
                <span>{c.province}</span>
                <span>|</span>
                <span>{c.employees.toLocaleString()}명</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
        {selected ? (
          <div className="p-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{selected.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                  <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px]">{selected.status}</span>
                  <span>{selected.industry}</span>
                  <span className="text-[var(--text-tertiary)]">|</span>
                  <span>{selected.province}</span>
                  {selected.stockCode && (
                    <>
                      <span className="text-[var(--text-tertiary)]">|</span>
                      <span className="font-mono">{selected.market} {selected.stockCode}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[var(--text-tertiary)]">사업자번호</div>
                <div className="font-mono text-sm text-[var(--text-primary)]">{selected.bizNo}</div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <MetricCard label="직원수" value={selected.employees.toLocaleString()} unit="명" />
              <MetricCard label="건강도" value={selected.healthScore.toFixed(1)} unit="/100" color={getHealthColor(selected.healthScore)} />
              {selected.financials && (
                <>
                  <MetricCard label="매출(2024)" value={(selected.financials[1].revenue / 100).toFixed(0)} unit="억원" />
                  <MetricCard
                    label="영업이익(2024)"
                    value={(selected.financials[1].profit / 100).toFixed(0)}
                    unit="억원"
                    color={selected.financials[1].profit >= 0 ? "#16a34a" : "#dc2626"}
                  />
                </>
              )}
            </div>

            {/* Employee History */}
            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">고용 추이 (최근 12개월)</h3>
              <div className="h-[200px]">
                <ResponsiveContainer>
                  <AreaChart data={selected.employeeHistory} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Financials */}
            {selected.financials && (
              <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">재무 요약</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <BarChart data={selected.financials} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="revenue" name="매출" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="profit" name="영업이익" radius={[3, 3, 0, 0]}>
                        {selected.financials.map((f, i) => (
                          <Cell key={i} fill={f.profit >= 0 ? "#16a34a" : "#dc2626"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <div className="text-sm">기업을 검색하고 선택하세요</div>
              <div className="text-[10px] mt-1">NPS + NTS + FSC + PPS 통합 프로파일</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-3 shadow-sm">
      <div className="text-[10px] text-[var(--text-tertiary)]">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}
