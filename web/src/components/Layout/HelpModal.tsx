"use client";

import { useState } from "react";

interface HelpModalProps {
  onClose: () => void;
}

type TabKey = "overview" | "healthScore" | "layers" | "howto";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "healthScore", label: "건강도 지표" },
  { key: "layers", label: "시각화 레이어" },
  { key: "howto", label: "사용법" },
];

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[var(--panel-border)] rounded-2xl w-[680px] max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
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

        {/* Tabs */}
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

        {/* Content */}
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
        전국 250개 시군구의 산업 생태계 건강도를 지도 위에 시각화하는 플랫폼입니다.
      </p>
      <div className="bg-white/5 rounded-lg p-4 space-y-2">
        <div className="text-xs text-gray-500 font-medium mb-2">통합 데이터 소스</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span><b className="text-white">국민연금</b> - 사업장 고용 데이터</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span><b className="text-white">국세청</b> - 사업자 등록/폐업 현황</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span><b className="text-white">금감원</b> - 기업 재무제표</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span><b className="text-white">나라장터</b> - 조달 실적</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span><b className="text-white">산업단지</b> - 가동/입주 현황</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span><b className="text-white">법정동코드</b> - 지역 매핑</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        사업자등록번호(10자리)를 기준으로 6개 공공데이터를 통합하고,
        법정동코드로 시군구 단위로 집계하여 산업 건강도를 산출합니다.
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
        <div className="text-xs text-gray-500 font-medium">가중치 설명</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-[var(--panel-border)]">
              <th className="text-left py-2 font-medium">요소</th>
              <th className="text-right py-2 font-medium">비중</th>
              <th className="text-left py-2 pl-4 font-medium">의미</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            <tr className="border-b border-[var(--panel-border)]/50">
              <td className="py-2 text-white">고용증감률</td>
              <td className="text-right py-2 text-blue-400">30%</td>
              <td className="pl-4 py-2">전년 대비 고용인원 변화 (국민연금 기반)</td>
            </tr>
            <tr className="border-b border-[var(--panel-border)]/50">
              <td className="py-2 text-white">신규사업자비율</td>
              <td className="text-right py-2 text-blue-400">25%</td>
              <td className="pl-4 py-2">최근 1년 내 신규 사업자 비율 (국세청)</td>
            </tr>
            <tr className="border-b border-[var(--panel-border)]/50">
              <td className="py-2 text-white">1 - 폐업률</td>
              <td className="text-right py-2 text-blue-400">20%</td>
              <td className="pl-4 py-2">사업 지속 안정성 (국세청)</td>
            </tr>
            <tr className="border-b border-[var(--panel-border)]/50">
              <td className="py-2 text-white">매출증가율</td>
              <td className="text-right py-2 text-blue-400">15%</td>
              <td className="pl-4 py-2">지역 기업 매출 성장 (금감원 재무제표)</td>
            </tr>
            <tr>
              <td className="py-2 text-white">산단가동률</td>
              <td className="text-right py-2 text-blue-400">10%</td>
              <td className="pl-4 py-2">산업단지 운영 현황 (KICOX)</td>
            </tr>
          </tbody>
        </table>
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

      <p className="text-xs text-gray-500">
        예를 들어 강남구의 건강도가 89.3이라면, 고용이 안정적으로 증가하고
        신규 창업이 활발하며, 폐업률이 낮고, 매출 성장세가 양호한 지역을 의미합니다.
      </p>
    </div>
  );
}

function LayersTab() {
  return (
    <div className="space-y-4">
      <p>
        지도 상단의 <b className="text-white">레이어 버튼</b>을 클릭하여
        서로 다른 관점에서 지역 데이터를 시각화할 수 있습니다.
      </p>

      <div className="space-y-3">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded" style={{ background: "linear-gradient(135deg, #ef4444, #fbbf24, #10b981)" }} />
            <b className="text-white text-xs">건강도</b>
            <span className="text-[10px] text-gray-500 ml-auto">초록(활발) ~ 빨강(위험)</span>
          </div>
          <p className="text-xs text-gray-400">
            종합 산업 건강도를 5단계 색상으로 표현합니다.
            초록색일수록 산업 생태계가 활발하고, 빨간색일수록 주의가 필요합니다.
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded" style={{ background: "linear-gradient(135deg, #ddd6fe, #7c3aed)" }} />
            <b className="text-white text-xs">기업 수</b>
            <span className="text-[10px] text-gray-500 ml-auto">보라색 농도로 밀집도 표현</span>
          </div>
          <p className="text-xs text-gray-400">
            지역 내 등록 기업 수를 보라색 단계로 표시합니다.
            진한 보라색일수록 기업이 밀집한 지역입니다.
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded" style={{ background: "linear-gradient(135deg, #ccfbf1, #0d9488)" }} />
            <b className="text-white text-xs">고용 인원</b>
            <span className="text-[10px] text-gray-500 ml-auto">청록색 농도로 고용 규모 표현</span>
          </div>
          <p className="text-xs text-gray-400">
            국민연금 기반 총 고용 인원을 청록색 단계로 표시합니다.
            진한 청록색일수록 고용이 많은 지역입니다.
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded" style={{ background: "linear-gradient(135deg, #ef4444, #fbbf24, #10b981)" }} />
            <b className="text-white text-xs">성장률</b>
            <span className="text-[10px] text-gray-500 ml-auto">초록(성장) ~ 빨강(감소)</span>
          </div>
          <p className="text-xs text-gray-400">
            전년 대비 성장률을 초록-빨강 색상으로 표시합니다.
            초록색이 강할수록 성장세가 높고, 빨간색은 마이너스 성장을 나타냅니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function HowtoTab() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
          <div>
            <b className="text-white text-xs">지역 탐색</b>
            <p className="text-xs text-gray-400 mt-1">
              왼쪽 패널에서 지역을 검색하거나, 광역시/도 필터 버튼으로 지역을 좁힐 수 있습니다.
              헤더의 건강도/기업/성장 버튼을 눌러 정렬 기준을 변경하세요.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
          <div>
            <b className="text-white text-xs">지도 클릭 / 목록 클릭</b>
            <p className="text-xs text-gray-400 mt-1">
              지도 위의 지역을 클릭하면 해당 지역이 강조되고, 오른쪽에 상세 정보가 표시됩니다.
              왼쪽 목록에서 클릭해도 지도가 해당 지역으로 이동합니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
          <div>
            <b className="text-white text-xs">레이어 전환</b>
            <p className="text-xs text-gray-400 mt-1">
              지도 위의 레이어 버튼(건강도/기업 수/고용 인원/성장률)으로
              다양한 관점의 데이터를 비교할 수 있습니다. 각 레이어마다 고유 색상 팔레트를 사용합니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
          <div>
            <b className="text-white text-xs">상세 분석</b>
            <p className="text-xs text-gray-400 mt-1">
              지역 선택 시 오른쪽 패널에서 업종 분포, 같은 광역시/도 내 다른 지역과의 비교,
              핵심 지표(기업 수, 고용, 신규 사업자율, 폐업률)를 확인할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
          <div>
            <b className="text-white text-xs">데이터 내보내기</b>
            <p className="text-xs text-gray-400 mt-1">
              왼쪽 패널 상단의 CSV 버튼으로 현재 표시된 지역 데이터를
              엑셀에서 열 수 있는 CSV 파일로 다운로드할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
          <div>
            <b className="text-white text-xs">비교 / 산업단지 / 기업 페이지</b>
            <p className="text-xs text-gray-400 mt-1">
              상단 내비게이션으로 지역 비교, 산업단지 현황, 기업 검색 등
              추가 분석 기능에 접근할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
