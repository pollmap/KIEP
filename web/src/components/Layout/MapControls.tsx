"use client";

import { useState } from "react";
import {
  DATA_CATEGORIES,
  DataCategory,
  DataLayerKey,
  getCategoryForLayer,
} from "@/lib/constants";

interface MapControlsProps {
  activeLayer: DataLayerKey;
  onLayerChange: (layer: DataLayerKey) => void;
  onHelpOpen: () => void;
}

export default function MapControls({
  activeLayer,
  onLayerChange,
  onHelpOpen,
}: MapControlsProps) {
  const currentCat = getCategoryForLayer(activeLayer);
  const [activeCat, setActiveCat] = useState<DataCategory>(currentCat?.key ?? "industry");

  const selectedCategory = DATA_CATEGORIES.find((c) => c.key === activeCat) ?? DATA_CATEGORIES[0];

  const handleCatClick = (catKey: DataCategory) => {
    setActiveCat(catKey);
    const cat = DATA_CATEGORIES.find((c) => c.key === catKey);
    if (cat && cat.layers.length > 0) {
      // If switching category, select first layer of new category
      if (catKey !== currentCat?.key) {
        onLayerChange(cat.layers[0].key);
      }
    }
  };

  return (
    <div className="absolute top-4 left-[340px] z-10 flex flex-col gap-2" style={{ maxWidth: "calc(100vw - 360px - 16px)" }}>
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-1 flex gap-0.5 flex-wrap">
          {DATA_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCatClick(cat.key)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                activeCat === cat.key
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Help Button */}
        <button
          onClick={onHelpOpen}
          className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg px-3 py-1.5 text-gray-500 hover:text-blue-400 hover:border-blue-500/30 transition-colors text-xs font-medium whitespace-nowrap"
          title="사용 설명서"
        >
          사용 설명서
        </button>
      </div>

      {/* Sub-Layer Buttons */}
      {selectedCategory.layers.length > 1 && (
        <div className="bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-lg p-1 flex gap-0.5 w-fit">
          {selectedCategory.layers.map((layer) => (
            <button
              key={layer.key}
              onClick={() => onLayerChange(layer.key)}
              className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                activeLayer === layer.key
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
