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
    <div className="bg-white border border-[var(--border)] rounded-xl p-3 shadow-sm">
      <div className="text-[10px] text-[var(--text-tertiary)] mb-2 font-medium">{label}</div>
      {bands.map((band) => (
        <div key={band.label} className="flex items-center gap-2 text-[11px] mb-1">
          <div
            className="w-4 h-2.5 rounded-sm"
            style={{ backgroundColor: band.color }}
          />
          <span className="text-[var(--text-secondary)]">{band.label}</span>
        </div>
      ))}
    </div>
  );
}
