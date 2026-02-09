"use client";

import { HEALTH_BANDS } from "@/lib/constants";

export default function Legend() {
  return (
    <div className="absolute bottom-6 left-6 bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-3 z-10">
      <div className="text-xs text-gray-400 mb-2 font-medium">산업 건강도</div>
      {HEALTH_BANDS.map((band) => (
        <div key={band.label} className="flex items-center gap-2 text-xs mb-1">
          <div
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: band.color }}
          />
          <span className="text-gray-300">{band.label}</span>
        </div>
      ))}
    </div>
  );
}
