"use client";

import { useState } from "react";
import { DATA_CATEGORIES } from "@/lib/constants";

interface HelpModalProps {
  onClose: () => void;
}

type TabKey = "overview" | "healthScore" | "layers" | "howto";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "healthScore", label: "건강도 지표" },
  { key: "layers", label: "데이터 카테고리" },
  { key: "howto", label: "사용법" },
];

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-[var(--border)] rounded-2xl w-full max-w-[680px] max-h-[80vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            <span className="text-[var(--accent)]">KIEP</span> 플랫폼 가이드
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </div>

        <div className="flex border-b border-[var(--border)] px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[60vh] text-sm text-[var(--text-secondary)] leading-relaxed">
          {tab === "overview" && <OverviewTab />}
          {tab === "healthScore" && <HealthScoreTab />}
          {tab === "layers" && <LayersTab />}
          {tab === "howto" && <HowtoTab />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-4">
      <p>
        <b className="text-[var(--text-primary)]">KIEP</b> (Korea Industrial Ecosystem Platform)는
        전국 250개 시군구의 산업 생태계를 포함한 종합 지역 데이터를 지도 위에 시각화하는 플랫폼입니다.
      </p>
      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-2">
        <div className="text-xs text-[var(--text-tertiary)] font-medium mb-2">13개 데이터 카테고리 · 65개 지표</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {DATA_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center gap-2">
              <span className="text-base">{cat.icon}</span>
              <span><b className="text-[var(--text-primary)]">{cat.label}</b> — {cat.layers.length}개 레이어</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-2">
        <div className="text-xs text-[var(--text-tertiary)] font-medium mb-2">통합 데이터 소스</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { color: "#2563eb", name: "국민연금", desc: "사업장 고용 데이터" },
            { color: "#16a34a", name: "국세청", desc: "사업자 등록/폐업" },
            { color: "#7c3aed", name: "금감원", desc: "기업 재무제표" },
            { color: "#ea580c", name: "통계청", desc: "인구/고용 통계" },
            { color: "#0891b2", name: "국토교통부", desc: "부동산/교통" },
            { color: "#ca8a04", name: "소상공인진흥공단", desc: "상권 데이터" },
          ].map((src) => (
            <div key={src.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: src.color }} />
              <span><b className="text-[var(--text-primary)]">{src.name}</b> - {src.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        2000년부터 2025년까지 26년간의 시계열 데이터를 통해 각 지역의 변화 추이를 분석할 수 있습니다.
      </p>
    </div>
  );
}

function HealthScoreTab() {
  return (
    <div className="space-y-4">
      <p>
        <b className="text-[var(--text-primary)]">산업 건강도</b>는 각 시군구의 산업 생태계 활력을 0~100 점으로 나타낸 종합 지표입니다.
      </p>
      <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
        <div className="text-xs text-[var(--text-tertiary)] font-medium mb-3">산출 공식</div>
        <div className="font-mono text-xs bg-[var(--bg-tertiary)] rounded-lg p-3 text-[var(--accent)] leading-loose">
          건강도 = 0.30 &times; 고용증감률<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; 신규사업자비율<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; (1 - 폐업률)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; 매출증가율<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; 산단가동률
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-[var(--text-tertiary)] font-medium">등급 기준</div>
        <div className="flex gap-2">
          {[
            { label: "활발", range: "90+", color: "#10b981" },
            { label: "양호", range: "70-89", color: "#34d399" },
            { label: "보통", range: "50-69", color: "#fbbf24" },
            { label: "주의", range: "30-49", color: "#f97316" },
            { label: "위험", range: "<30", color: "#ef4444" },
          ].map((b) => (
            <div key={b.label} className="flex-1 rounded-lg p-2 text-center" style={{ backgroundColor: b.color + "12", border: `1px solid ${b.color}25` }}>
              <div className="text-xs font-bold" style={{ color: b.color }}>{b.label}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">{b.range}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayersTab() {
  return (
    <div className="space-y-4">
      <p>
        상단의 <b className="text-[var(--text-primary)]">카테고리 탭</b>을 클릭하여 서로 다른 데이터 영역을 전환하고,
        하위 <b className="text-[var(--text-primary)]">레이어 버튼</b>으로 세부 지표를 선택하세요.
      </p>
      <div className="space-y-2">
        {DATA_CATEGORIES.map((cat) => (
          <div key={cat.key} className="bg-[var(--bg-secondary)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{cat.icon}</span>
              <b className="text-[var(--text-primary)] text-xs">{cat.label}</b>
              <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">{cat.layers.length}개 레이어</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.layers.map((l) => (
                <span key={l.key} className="text-[10px] px-2 py-0.5 rounded-md bg-white text-[var(--text-secondary)] border border-[var(--border-light)]">
                  {l.label} ({l.unit})
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowtoTab() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { title: "지역 탐색", desc: "왼쪽 패널에서 지역을 검색하거나, 광역시/도 필터로 지역을 좁히세요. 스크롤 휠이나 더블클릭으로 지도를 줌인/줌아웃할 수 있습니다." },
          { title: "카테고리 & 레이어", desc: "상단의 13개 카테고리(산업, 인구, 경제, 부동산, 고용, 교육, 상권, 의료/복지, 안전, 환경, 인프라, 교통, 문화관광) 탭을 전환하고, 각 카테고리의 세부 레이어를 선택하세요." },
          { title: "교통 인프라 오버레이", desc: "지도 오른쪽 상단의 '지하철', '고속도로' 버튼으로 전국 지하철 노선과 고속도로를 지도 위에 표시할 수 있습니다." },
          { title: "지도 클릭 / 목록 클릭", desc: "지도 위의 지역을 클릭하면 상세 정보가 표시됩니다. 더블클릭하면 해당 지역으로 줌인됩니다." },
          { title: "타임라인 재생", desc: "하단 타임라인에서 2000~2025년 데이터를 재생하세요. 재생 버튼을 누르면 자동 재생되고, 속도(0.5x~4x)를 조절할 수 있습니다." },
          { title: "시계열 트렌드", desc: "지역 선택 시 오른쪽 패널에서 선택한 레이어의 26년 변화 추이 그래프를 확인할 수 있습니다." },
          { title: "데이터 내보내기", desc: "왼쪽 패널의 CSV 버튼으로 현재 데이터를 엑셀 파일로 다운로드하세요. 선택한 연도와 지역 필터가 반영됩니다." },
          { title: "초기화", desc: "타임라인의 초기화 버튼을 눌러 모든 설정을 기본값으로 되돌릴 수 있습니다." },
        ].map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
            <div>
              <b className="text-[var(--text-primary)] text-xs">{step.title}</b>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
