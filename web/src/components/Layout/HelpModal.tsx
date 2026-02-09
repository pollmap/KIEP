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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[var(--panel-border)] rounded-2xl w-[680px] max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--panel-border)]">
          <h2 className="text-lg font-bold">
            <span className="text-blue-400">KIEP</span> 플랫폼 가이드
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-[var(--panel-border)] px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[60vh] text-sm text-gray-300 leading-relaxed">
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
        <b className="text-white">KIEP</b> (Korea Industrial Ecosystem Platform)는
        전국 250개 시군구의 산업 생태계를 포함한 종합 지역 데이터를 지도 위에 시각화하는 플랫폼입니다.
      </p>
      <div className="bg-white/5 rounded-lg p-4 space-y-2">
        <div className="text-xs text-gray-500 font-medium mb-2">7개 데이터 카테고리</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {DATA_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center gap-2">
              <span className="text-base">{cat.icon}</span>
              <span><b className="text-white">{cat.label}</b> — {cat.layers.map((l) => l.label).join(", ")}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/5 rounded-lg p-4 space-y-2">
        <div className="text-xs text-gray-500 font-medium mb-2">통합 데이터 소스</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span><b className="text-white">국민연금</b> - 사업장 고용 데이터</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span><b className="text-white">국세청</b> - 사업자 등록/폐업</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span><b className="text-white">금감원</b> - 기업 재무제표</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span><b className="text-white">통계청</b> - 인구/고용 통계</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span><b className="text-white">국토교통부</b> - 부동산/교통</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span><b className="text-white">소상공인진흥공단</b> - 상권 데이터</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        2005년부터 2025년까지 20년간의 시계열 데이터를 통해 각 지역의 변화 추이를 분석할 수 있습니다.
      </p>
    </div>
  );
}

function HealthScoreTab() {
  return (
    <div className="space-y-4">
      <p>
        <b className="text-white">산업 건강도</b>는 각 시군구의 산업 생태계 활력을 0~100 점으로 나타낸 종합 지표입니다.
      </p>
      <div className="bg-white/5 rounded-lg p-4">
        <div className="text-xs text-gray-500 font-medium mb-3">산출 공식</div>
        <div className="font-mono text-xs bg-black/30 rounded p-3 text-blue-300 leading-loose">
          건강도 = 0.30 &times; 고용증감률<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.25 &times; 신규사업자비율<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.20 &times; (1 - 폐업률)<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.15 &times; 매출증가율<br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.10 &times; 산단가동률
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-gray-500 font-medium">등급 기준</div>
        <div className="flex gap-2">
          {[
            { label: "활발", range: "90+", color: "#10b981" },
            { label: "양호", range: "70-89", color: "#34d399" },
            { label: "보통", range: "50-69", color: "#fbbf24" },
            { label: "주의", range: "30-49", color: "#f97316" },
            { label: "위험", range: "<30", color: "#ef4444" },
          ].map((b) => (
            <div key={b.label} className="flex-1 rounded-lg p-2 text-center" style={{ backgroundColor: b.color + "15", border: `1px solid ${b.color}30` }}>
              <div className="text-xs font-bold" style={{ color: b.color }}>{b.label}</div>
              <div className="text-[10px] text-gray-500">{b.range}</div>
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
        상단의 <b className="text-white">카테고리 탭</b>을 클릭하여 서로 다른 데이터 영역을 전환하고,
        하위 <b className="text-white">레이어 버튼</b>으로 세부 지표를 선택하세요.
      </p>
      <div className="space-y-2">
        {DATA_CATEGORIES.map((cat) => (
          <div key={cat.key} className="bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{cat.icon}</span>
              <b className="text-white text-xs">{cat.label}</b>
              <span className="text-[10px] text-gray-500 ml-auto">{cat.layers.length}개 레이어</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.layers.map((l) => (
                <span key={l.key} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
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
          { title: "카테고리 & 레이어", desc: "상단의 7개 카테고리(산업, 인구, 부동산, 고용, 교육, 상권, 교통) 탭을 전환하고, 각 카테고리의 세부 레이어를 선택하세요." },
          { title: "지도 클릭 / 목록 클릭", desc: "지도 위의 지역을 클릭하면 상세 정보가 표시됩니다. 더블클릭하면 해당 지역으로 줌인됩니다." },
          { title: "타임라인 재생", desc: "하단 타임라인에서 2005~2025년 데이터를 재생하세요. 재생 버튼(▶)을 누르면 자동 재생되고, 속도(0.5x~4x)를 조절할 수 있습니다." },
          { title: "시계열 트렌드", desc: "지역 선택 시 오른쪽 패널에서 선택한 레이어의 20년 변화 추이 그래프를 확인할 수 있습니다." },
          { title: "데이터 내보내기", desc: "왼쪽 패널의 CSV 버튼으로 현재 데이터를 엑셀 파일로 다운로드하세요. 선택한 연도와 지역 필터가 반영됩니다." },
          { title: "초기화", desc: "타임라인의 초기화 버튼(↻)을 눌러 모든 설정을 기본값으로 되돌릴 수 있습니다." },
        ].map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
            <div>
              <b className="text-white text-xs">{step.title}</b>
              <p className="text-xs text-gray-400 mt-1">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
