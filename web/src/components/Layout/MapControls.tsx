"use client";

import {
  MAP_LAYERS,
  MapLayerType,
} from "@/lib/constants";

interface MapControlsProps {
  activeLayer: MapLayerType;
  onLayerChange: (layer: MapLayerType) => void;
  onHelpOpen: () => void;
}

export default function MapControls({
  activeLayer,
  onLayerChange,
  onHelpOpen,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 left-[340px] z-10 flex items-start gap-2">
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

      {/* Help Button */}
      <button
        onClick={onHelpOpen}
        className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-gray-500 hover:text-blue-400 hover:border-blue-500/30 transition-colors text-xs font-medium"
        title="사용 설명서"
      >
        사용 설명서
      </button>
    </div>
  );
}
