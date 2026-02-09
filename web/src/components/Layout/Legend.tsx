"use client";

import { getLayerLegendBands, getLayerDef, DataLayerKey } from "@/lib/constants";

interface LegendProps {
  activeLayer: DataLayerKey;
}

export default function Legend({ activeLayer }: LegendProps) {
  const bands = getLayerLegendBands(activeLayer);
  const def = getLayerDef(activeLayer);
  const label = def?.label ?? "";

  return (
    <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 mb-2 font-medium">{label}</div>
      {bands.map((band) => (
        <div key={band.label} className="flex items-center gap-2 text-[11px] mb-1">
          <div
            className="w-4 h-2.5 rounded-sm"
            style={{ backgroundColor: band.color }}
          />
          <span className="text-gray-400">{band.label}</span>
        </div>
      ))}
    </div>
  );
}
