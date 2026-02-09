"use client";

interface HeaderProps {
  totalRegions: number;
  avgHealthScore: number;
}

export default function Header({ totalRegions, avgHealthScore }: HeaderProps) {
  return (
    <header className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2.5">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-blue-400">K</span>
            <span>IEP</span>
          </div>
          <div className="w-px h-5 bg-[var(--panel-border)]" />
          <div className="text-xs text-gray-500">
            Korea Industrial<br />Ecosystem Platform
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-4 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-4 py-2.5">
          <div className="text-center">
            <div className="text-xs text-gray-500">분석 지역</div>
            <div className="text-sm font-semibold">{totalRegions}</div>
          </div>
          <div className="w-px h-8 bg-[var(--panel-border)]" />
          <div className="text-center">
            <div className="text-xs text-gray-500">평균 건강도</div>
            <div className="text-sm font-semibold">{avgHealthScore.toFixed(1)}</div>
          </div>
          <div className="w-px h-8 bg-[var(--panel-border)]" />
          <div className="text-center">
            <div className="text-xs text-gray-500">데이터 기준</div>
            <div className="text-sm font-semibold text-gray-400">샘플</div>
          </div>
        </div>
      </div>
    </header>
  );
}
