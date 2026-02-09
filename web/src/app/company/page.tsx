"use client";

import { useState, useMemo } from "react";
import Navigation from "@/components/Layout/Navigation";
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
    <div className="w-screen h-screen bg-[var(--background)] flex flex-col">
      <Navigation />

      <div className="flex-1 pt-14 flex overflow-hidden">
        {/* Search Panel */}
        <div className="w-[380px] border-r border-[var(--panel-border)] flex flex-col">
          <div className="p-4 border-b border-[var(--panel-border)]">
            <h1 className="text-lg font-bold mb-3">기업 검색</h1>
            <input
              type="text"
              placeholder="기업명 또는 사업자번호 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 border border-[var(--panel-border)] rounded text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.bizNo}
                onClick={() => setSelected(c)}
                className={`w-full px-4 py-3 text-left border-b border-[var(--panel-border)]/50 transition-colors ${
                  selected?.bizNo === c.bizNo ? "bg-blue-500/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.market && (
                    <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{c.market}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  <span>{c.industry}</span>
                  <span className="text-gray-700">|</span>
                  <span>{c.province}</span>
                  <span className="text-gray-700">|</span>
                  <span>{c.employees.toLocaleString()}명</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <div className="p-6 max-w-4xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px]">{selected.status}</span>
                    <span>{selected.industry}</span>
                    <span className="text-gray-600">|</span>
                    <span>{selected.province}</span>
                    {selected.stockCode && (
                      <>
                        <span className="text-gray-600">|</span>
                        <span className="font-mono">{selected.market} {selected.stockCode}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500">사업자번호</div>
                  <div className="font-mono text-sm">{selected.bizNo}</div>
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
                      color={selected.financials[1].profit >= 0 ? "#10b981" : "#ef4444"}
                    />
                  </>
                )}
              </div>

              {/* Employee History */}
              <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium mb-3">고용 추이 (최근 12개월)</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <AreaChart data={selected.employeeHistory} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 12, color: "#eee" }} />
                      <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Financials */}
              {selected.financials && (
                <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">재무 요약</h3>
                  <div className="h-[200px]">
                    <ResponsiveContainer>
                      <BarChart data={selected.financials} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="year" tick={{ fill: "#999", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 12, color: "#eee" }} />
                        <Bar dataKey="revenue" name="매출" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="profit" name="영업이익" radius={[3, 3, 0, 0]}>
                          {selected.financials.map((f, i) => (
                            <Cell key={i} fill={f.profit >= 0 ? "#10b981" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <div className="text-4xl mb-3">B</div>
                <div className="text-sm">기업을 검색하고 선택하세요</div>
                <div className="text-[10px] text-gray-700 mt-1">NPS + NTS + FSC + PPS 통합 프로파일</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-3">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-bold" style={color ? { color } : undefined}>{value}</span>
        <span className="text-[10px] text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
