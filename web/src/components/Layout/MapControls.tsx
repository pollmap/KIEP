"use client";

import {
  MAP_LAYERS,
  MapLayerType,
  BasemapStyle,
} from "@/lib/constants";

interface MapControlsProps {
  activeLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  basemapStyle: BasemapStyle;
  onBasemapChange: (style: BasemapStyle) => void;
}

const BASEMAPS: { key: BasemapStyle; label: string; short: string }[] = [
  { key: "vworld-base", label: "VWorld 기본", short: "기본" },
  { key: "vworld-midnight", label: "VWorld 야간", short: "야간" },
  { key: "vworld-satellite", label: "VWorld 위성", short: "위성" },
  { key: "carto-dark", label: "CARTO Dark", short: "CARTO" },
];

export default function MapControls({
  activeLayer,
  onLayerChange,
  basemapStyle,
  onBasemapChange,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 left-[340px] z-10 flex flex-col gap-2">
      {/* Layer Toggle */}
      <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-1 flex gap-0.5">
        {MAP_LAYERS.map((layer) => (
          <button
            key={layer.key}
            onClick={() => onLayerChange(layer.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeLayer === layer.key
                ? "bg-blue-500/20 text-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Basemap Toggle */}
      <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-1 flex gap-0.5">
        {BASEMAPS.map((bm) => (
          <button
            key={bm.key}
            onClick={() => onBasemapChange(bm.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              basemapStyle === bm.key
                ? "bg-white/10 text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {bm.short}
          </button>
        ))}
      </div>
    </div>
  );
}
