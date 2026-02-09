import { HealthScoreBand, MapViewState, RegionData } from "./types";

export const KOREA_CENTER: MapViewState = {
  longitude: 127.7,
  latitude: 36.0,
  zoom: 6.8,
};

export const HEALTH_BANDS: HealthScoreBand[] = [
  { label: "활발 (90+)", min: 90, max: 100, color: "#10b981" },
  { label: "양호 (70-89)", min: 70, max: 89, color: "#34d399" },
  { label: "보통 (50-69)", min: 50, max: 69, color: "#fbbf24" },
  { label: "주의 (30-49)", min: 30, max: 49, color: "#f97316" },
  { label: "위험 (<30)", min: 0, max: 29, color: "#ef4444" },
];

export function getHealthColor(score: number): string {
  for (const band of HEALTH_BANDS) {
    if (score >= band.min && score <= band.max) {
      return band.color;
    }
  }
  return "#6b7280";
}

export const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: "제조업",
  it: "IT/소프트웨어",
  services: "서비스업",
  construction: "건설업",
  wholesale: "도소매업",
  logistics: "운수/물류",
  finance: "금융/보험",
  education: "교육",
  healthcare: "의료/복지",
  other: "기타",
};

export const INDUSTRY_COLORS: Record<string, string> = {
  manufacturing: "#3b82f6",
  it: "#8b5cf6",
  services: "#ec4899",
  construction: "#f97316",
  wholesale: "#eab308",
  logistics: "#06b6d4",
  finance: "#10b981",
  education: "#6366f1",
  healthcare: "#14b8a6",
  other: "#6b7280",
};

export const PROVINCES: Record<string, string> = {
  "11": "서울특별시",
  "21": "부산광역시",
  "22": "대구광역시",
  "23": "인천광역시",
  "24": "광주광역시",
  "25": "대전광역시",
  "26": "울산광역시",
  "29": "세종특별자치시",
  "31": "경기도",
  "32": "강원특별자치도",
  "33": "충청북도",
  "34": "충청남도",
  "35": "전북특별자치도",
  "36": "전라남도",
  "37": "경상북도",
  "38": "경상남도",
  "39": "제주특별자치도",
};

export const PROVINCE_SHORT: Record<string, string> = {
  "11": "서울", "21": "부산", "22": "대구", "23": "인천",
  "24": "광주", "25": "대전", "26": "울산", "29": "세종",
  "31": "경기", "32": "강원", "33": "충북", "34": "충남",
  "35": "전북", "36": "전남", "37": "경북", "38": "경남",
  "39": "제주",
};

// ── Data Categories & Layers ──────────────────────────

export type DataCategory = "industry" | "population" | "realEstate" | "employment" | "education" | "commercial" | "transport";

export type DataLayerKey =
  | "healthScore" | "companyCount" | "employeeCount" | "growthRate"
  | "population" | "populationGrowth" | "agingRate" | "youthRatio"
  | "avgLandPrice" | "priceChangeRate"
  | "employmentRate" | "unemploymentRate"
  | "schoolCount" | "studentCount"
  | "storeCount" | "storeOpenRate" | "storeCloseRate"
  | "transitScore";

export interface CategoryDef {
  key: DataCategory;
  label: string;
  icon: string;
  layers: LayerDef[];
}

export interface LayerDef {
  key: DataLayerKey;
  label: string;
  unit: string;
  format: "number" | "decimal" | "percent" | "signedPercent" | "price";
  colorScheme: "health" | "quantile" | "diverging";
  palette: string[]; // 5 colors from low to high
}

export const DATA_CATEGORIES: CategoryDef[] = [
  {
    key: "industry", label: "산업", icon: "🏭",
    layers: [
      { key: "healthScore", label: "건강도", unit: "점", format: "decimal", colorScheme: "health", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"] },
      { key: "companyCount", label: "기업 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed"] },
      { key: "employeeCount", label: "고용 인원", unit: "명", format: "number", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"] },
      { key: "growthRate", label: "성장률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"] },
    ],
  },
  {
    key: "population", label: "인구", icon: "👥",
    layers: [
      { key: "population", label: "총인구", unit: "명", format: "number", colorScheme: "quantile", palette: ["#fce4ec","#f48fb1","#ec407a","#c2185b","#880e4f"] },
      { key: "populationGrowth", label: "인구증감률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"] },
      { key: "agingRate", label: "고령화율", unit: "%", format: "decimal", colorScheme: "diverging", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"] },
      { key: "youthRatio", label: "청년비율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"] },
    ],
  },
  {
    key: "realEstate", label: "부동산", icon: "🏠",
    layers: [
      { key: "avgLandPrice", label: "평균지가", unit: "만원/㎡", format: "price", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"] },
      { key: "priceChangeRate", label: "지가변동률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"] },
    ],
  },
  {
    key: "employment", label: "고용", icon: "💼",
    layers: [
      { key: "employmentRate", label: "고용률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"] },
      { key: "unemploymentRate", label: "실업률", unit: "%", format: "decimal", colorScheme: "diverging", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"] },
    ],
  },
  {
    key: "education", label: "교육", icon: "🎓",
    layers: [
      { key: "schoolCount", label: "학교 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"] },
      { key: "studentCount", label: "학생 수", unit: "명", format: "number", colorScheme: "quantile", palette: ["#ede9fe","#c4b5fd","#a78bfa","#7c3aed","#5b21b6"] },
    ],
  },
  {
    key: "commercial", label: "상권", icon: "🏪",
    layers: [
      { key: "storeCount", label: "상가 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"] },
      { key: "storeOpenRate", label: "개업률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"] },
      { key: "storeCloseRate", label: "폐업률", unit: "%", format: "decimal", colorScheme: "diverging", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"] },
    ],
  },
  {
    key: "transport", label: "교통", icon: "🚇",
    layers: [
      { key: "transitScore", label: "교통접근성", unit: "점", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"] },
    ],
  },
];

// Quick lookup helpers
export function getCategoryForLayer(layerKey: DataLayerKey): CategoryDef | undefined {
  return DATA_CATEGORIES.find((c) => c.layers.some((l) => l.key === layerKey));
}

export function getLayerDef(layerKey: DataLayerKey): LayerDef | undefined {
  for (const cat of DATA_CATEGORIES) {
    const found = cat.layers.find((l) => l.key === layerKey);
    if (found) return found;
  }
  return undefined;
}

// Backward compat
export type MapLayerType = DataLayerKey;
export const MAP_LAYERS = DATA_CATEGORIES[0].layers.map((l) => ({ key: l.key, label: l.label }));

export const BASEMAP_TILES = {
  url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
};

// ── Color utilities ──────────────────────────

export function getRegionValue(region: RegionData, layerKey: DataLayerKey): number {
  return (region as unknown as Record<string, number>)[layerKey] ?? 0;
}

// Robust percentile: counts how many values are <= the given value
function percentileRank(value: number, sorted: number[]): number {
  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) count++;
    else break;
  }
  return count / Math.max(sorted.length, 1);
}

export function getLayerColor(layerKey: DataLayerKey, value: number, allValues: number[]): string {
  const def = getLayerDef(layerKey);
  if (!def) return "#6b7280";

  if (layerKey === "healthScore") return getHealthColor(value);

  if (def.colorScheme === "diverging") {
    if (layerKey === "growthRate" || layerKey === "populationGrowth" || layerKey === "priceChangeRate") {
      if (value >= 5) return def.palette[4];
      if (value >= 2) return def.palette[3];
      if (value >= 0) return def.palette[2];
      if (value >= -2) return def.palette[1];
      return def.palette[0];
    }
    if (layerKey === "agingRate" || layerKey === "storeCloseRate" || layerKey === "unemploymentRate") {
      const sorted = [...allValues].sort((a, b) => a - b);
      const rank = percentileRank(value, sorted);
      const idx = Math.min(4, Math.max(0, Math.floor(rank * 4.999)));
      return def.palette[idx];
    }
    if (value >= 5) return def.palette[4];
    if (value >= 2) return def.palette[3];
    if (value >= 0) return def.palette[2];
    if (value >= -2) return def.palette[1];
    return def.palette[0];
  }

  // Quantile-based
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = percentileRank(value, sorted);
  if (rank > 0.8) return def.palette[4];
  if (rank > 0.6) return def.palette[3];
  if (rank > 0.4) return def.palette[2];
  if (rank > 0.2) return def.palette[1];
  return def.palette[0];
}

export function formatLayerValue(value: number, layerKey: DataLayerKey): string {
  const def = getLayerDef(layerKey);
  if (!def) return String(value);
  switch (def.format) {
    case "number": return value.toLocaleString() + def.unit;
    case "decimal": return value.toFixed(1) + def.unit;
    case "percent": return value.toFixed(1) + "%";
    case "signedPercent": return (value >= 0 ? "+" : "") + value.toFixed(1) + "%";
    case "price": return value.toLocaleString() + def.unit;
  }
}

// Legend bands (generated from layer definition)
export function getLayerLegendBands(layerKey: DataLayerKey): { label: string; color: string }[] {
  const def = getLayerDef(layerKey);
  if (!def) return [];

  if (layerKey === "healthScore") {
    return HEALTH_BANDS.map((b) => ({ label: b.label, color: b.color }));
  }

  if (def.colorScheme === "diverging") {
    if (layerKey === "growthRate" || layerKey === "populationGrowth" || layerKey === "priceChangeRate") {
      return [
        { label: "고성장 (5%+)", color: def.palette[4] },
        { label: "성장 (2~5%)", color: def.palette[3] },
        { label: "정체 (0~2%)", color: def.palette[2] },
        { label: "감소 (0~-2%)", color: def.palette[1] },
        { label: "급감 (-2% 이하)", color: def.palette[0] },
      ];
    }
    return [
      { label: "매우 낮음 (하위 20%)", color: def.palette[0] },
      { label: "낮음", color: def.palette[1] },
      { label: "보통", color: def.palette[2] },
      { label: "높음", color: def.palette[3] },
      { label: "매우 높음 (상위 20%)", color: def.palette[4] },
    ];
  }

  return [
    { label: `매우 많음 (상위 20%)`, color: def.palette[4] },
    { label: "많음", color: def.palette[3] },
    { label: "보통", color: def.palette[2] },
    { label: "적음", color: def.palette[1] },
    { label: `매우 적음 (하위 20%)`, color: def.palette[0] },
  ];
}
