"use client";

import { useEffect, useState, useMemo } from "react";
import { PROVINCES, getHealthColor } from "@/lib/constants";

interface ComplexData {
  id: string;
  name: string;
  type: string;
  province: string;
  sigungu: string;
  tenantCount: number;
  operatingCount: number;
  occupancyRate: number;
  production: number;
  exportAmount: number;
  employment: number;
  healthScore: number;
}

function generateComplexData(): ComplexData[] {
  let seed = 123;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
  const randFloat = (min: number, max: number) => +(random() * (max - min) + min).toFixed(1);

  const types = ["국가", "일반", "도시첨단", "농공"];
  const provinces = Object.values(PROVINCES);
  const names = [
    "구미국가산업단지", "창원국가산업단지", "울산미포국가산업단지", "여수국가산업단지",
    "반월특수지역", "시화국가산업단지", "오창과학산업단지", "대불국가산업단지",
    "군산국가산업단지", "아산국가산업단지", "천안5산업단지", "청주산업단지",
    "원주기업도시", "오송생명과학단지", "진천음성혁신도시", "세종산업단지",
    "김포한강신도시", "평택고덕산업단지", "화성동탄산업단지", "이천하이닉스산업단지",
    "대구국가산업단지", "포항철강산업단지", "경주산업단지", "김천혁신도시",
    "광주첨단산업단지", "나주혁신도시", "전주산업단지", "익산국가산업단지",
    "춘천산업단지", "원주산업단지", "강릉산업단지", "속초산업단지",
    "부산신평장림산업단지", "부산강서산업단지", "인천남동산업단지", "인천서구산업단지",
    "대전대덕산업단지", "대전유성산업단지", "울산온산산업단지", "울산매곡산업단지",
    "제주첨단산업단지", "서귀포산업단지", "세종연기산업단지", "세종전의산업단지",
    "수원산업단지", "안산반월산업단지", "시흥정왕산업단지", "파주LCD산업단지",
    "천안두정산업단지", "아산탕정산업단지",
  ];

  return names.map((name, i) => ({
    id: `COMPLEX-${String(i + 1).padStart(4, "0")}`,
    name,
    type: types[i % types.length],
    province: provinces[i % provinces.length],
    sigungu: name.replace(/산업단지|국가|단지|특수지역|과학|생명|혁신도시|기업도시|첨단|신도시/g, ""),
    tenantCount: randInt(50, 2000),
    operatingCount: randInt(40, 1800),
    occupancyRate: randFloat(70, 99),
    production: randInt(1000, 500000),
    exportAmount: randInt(100, 200000),
    employment: randInt(500, 80000),
    healthScore: randFloat(30, 95),
  }));
}

export default function ComplexPage() {
  const [complexes, setComplexes] = useState<ComplexData[]>([]);
  const [selected, setSelected] = useState<ComplexData | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setComplexes(generateComplexData());
  }, []);

  const filtered = useMemo(() => {
    let list = complexes;
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.province.includes(q));
    }
    return list.sort((a, b) => b.employment - a.employment);
  }, [complexes, typeFilter, search]);

  const totalStats = useMemo(() => ({
    count: filtered.length,
    employment: filtered.reduce((s, c) => s + c.employment, 0),
    production: filtered.reduce((s, c) => s + c.production, 0),
  }), [filtered]);

  return (
    <div className="h-[calc(100vh-var(--nav-height))] flex overflow-hidden">
      {/* Left: List */}
      <div className="w-[400px] border-r border-[var(--border)] flex flex-col bg-white">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-3">산업단지 현황</h1>
          <input
            type="text"
            placeholder="산업단지 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] mb-2"
          />
          <div className="flex gap-1">
            {[null, "국가", "일반", "도시첨단", "농공"].map((t) => (
              <button
                key={t ?? "all"}
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]/30"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-transparent"
                }`}
              >
                {t ?? "전체"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-[var(--border-light)]">
          <div className="bg-white p-3 text-center">
            <div className="text-[10px] text-[var(--text-tertiary)]">단지수</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{totalStats.count}</div>
          </div>
          <div className="bg-white p-3 text-center">
            <div className="text-[10px] text-[var(--text-tertiary)]">총 고용</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{(totalStats.employment / 10000).toFixed(1)}만</div>
          </div>
          <div className="bg-white p-3 text-center">
            <div className="text-[10px] text-[var(--text-tertiary)]">총 생산</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">{(totalStats.production / 10000).toFixed(0)}조</div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full px-4 py-3 text-left border-b border-[var(--border-light)] transition-colors ${
                selected?.id === c.id ? "bg-[var(--accent-light)]" : "hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded">{c.type}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text-tertiary)]">
                <span>{c.province}</span>
                <span>입주 {c.tenantCount}</span>
                <span>고용 {c.employment.toLocaleString()}</span>
                <span style={{ color: getHealthColor(c.healthScore) }}>{c.healthScore}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
        {selected ? (
          <div className="p-6 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">{selected.name}</h2>
              <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-1 rounded">{selected.type}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="입주업체" value={selected.tenantCount.toLocaleString()} unit="개" />
              <StatCard label="가동업체" value={selected.operatingCount.toLocaleString()} unit="개" />
              <StatCard label="분양률" value={selected.occupancyRate.toFixed(1)} unit="%" />
              <StatCard label="건강도" value={selected.healthScore.toFixed(1)} unit="/100" color={getHealthColor(selected.healthScore)} />
              <StatCard label="생산액" value={(selected.production / 100).toFixed(0)} unit="억원" />
              <StatCard label="수출액" value={(selected.exportAmount / 1000).toFixed(1)} unit="백만$" />
              <StatCard label="고용인원" value={selected.employment.toLocaleString()} unit="명" />
              <StatCard label="가동률" value={((selected.operatingCount / selected.tenantCount) * 100).toFixed(1)} unit="%" />
            </div>

            <div className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">소재지 정보</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-[var(--text-tertiary)]">시도</div><div className="text-[var(--text-primary)]">{selected.province}</div>
                <div className="text-[var(--text-tertiary)]">유형</div><div className="text-[var(--text-primary)]">{selected.type}산업단지</div>
                <div className="text-[var(--text-tertiary)]">단지코드</div><div className="font-mono text-[var(--text-secondary)]">{selected.id}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
            <div className="text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <div className="text-sm">산업단지를 선택하세요</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
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
