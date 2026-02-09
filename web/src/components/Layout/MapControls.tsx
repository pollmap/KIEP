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
      if (catKey !== currentCat?.key) {
        onLayerChange(cat.layers[0].key);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="bg-white border border-[var(--border)] rounded-xl p-1 flex gap-0.5 flex-wrap shadow-sm">
          {DATA_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCatClick(cat.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeCat === cat.key
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              <span className="hidden sm:inline">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Help Button */}
        <button
          onClick={onHelpOpen}
          className="bg-white border border-[var(--border)] rounded-xl px-3 py-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors text-xs font-medium whitespace-nowrap shadow-sm"
          title="사용 설명서"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-0.5 mr-1"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
          도움말
        </button>
      </div>

      {/* Sub-Layer Buttons */}
      {selectedCategory.layers.length > 1 && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-1 flex gap-0.5 w-fit shadow-sm">
          {selectedCategory.layers.map((layer) => (
            <button
              key={layer.key}
              onClick={() => onLayerChange(layer.key)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                activeLayer === layer.key
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
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
