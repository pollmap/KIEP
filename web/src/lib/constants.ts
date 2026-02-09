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

// ── Data Categories & Layers (13 categories, 65 layers) ──

export type DataCategory =
  | "industry" | "population" | "economy" | "realEstate"
  | "employment" | "education" | "commercial" | "healthcare"
  | "safety" | "environment" | "infrastructure" | "transport" | "culture";

export type DataLayerKey =
  // Industry
  | "healthScore" | "companyCount" | "employeeCount" | "growthRate"
  | "newBizRate" | "closureRate" | "manufacturingRatio" | "smeRatio"
  // Population
  | "population" | "populationGrowth" | "agingRate" | "youthRatio"
  | "birthRate" | "foreignRatio" | "netMigration"
  // Economy
  | "grdp" | "grdpGrowth" | "taxRevenue" | "financialIndependence" | "localConsumption"
  // Real Estate
  | "avgLandPrice" | "priceChangeRate" | "aptPrice" | "aptChangeRate" | "buildingPermits"
  // Employment
  | "employmentRate" | "unemploymentRate" | "avgWage" | "jobCreation" | "youthEmployment"
  // Education
  | "schoolCount" | "studentCount" | "universityCount" | "libraryCount" | "educationBudget"
  // Commercial
  | "storeCount" | "storeOpenRate" | "storeCloseRate" | "franchiseCount" | "salesPerStore"
  // Healthcare
  | "hospitalCount" | "doctorCount" | "bedsPerPopulation" | "seniorFacilities" | "daycareCenters"
  // Safety
  | "crimeRate" | "trafficAccidents" | "fireIncidents" | "disasterDamage"
  // Environment
  | "airQuality" | "greenAreaRatio" | "wasteGeneration" | "waterQuality"
  // Infrastructure
  | "roadDensity" | "waterSupply" | "sewerageRate" | "parkArea"
  // Transportation
  | "transitScore" | "subwayStations" | "busRoutes" | "dailyPassengers" | "avgCommute"
  // Culture
  | "culturalFacilities" | "touristVisitors" | "accommodations";

export interface CategoryDef {
  key: DataCategory;
  label: string;
  icon: string;
  layers: LayerDef[];
}

export type DataType = "count" | "rate" | "growth" | "ratio" | "money" | "score" | "density";

export interface LayerDef {
  key: DataLayerKey;
  label: string;
  unit: string;
  format: "number" | "decimal" | "percent" | "signedPercent" | "price" | "score";
  colorScheme: "health" | "quantile" | "diverging" | "inverse";
  palette: string[];
  dataType: DataType;
}

export const DATA_CATEGORIES: CategoryDef[] = [
  {
    key: "industry", label: "산업", icon: "🏭",
    layers: [
      { key: "healthScore", label: "산업건강도", unit: "점", format: "decimal", colorScheme: "health", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "score" },
      { key: "companyCount", label: "사업체 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed"], dataType: "count" },
      { key: "employeeCount", label: "종사자 수", unit: "명", format: "number", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"], dataType: "count" },
      { key: "growthRate", label: "기업성장률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "newBizRate", label: "신규창업률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "rate" },
      { key: "closureRate", label: "폐업률", unit: "%", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "rate" },
      { key: "manufacturingRatio", label: "제조업 비중", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], dataType: "ratio" },
      { key: "smeRatio", label: "중소기업 비율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#fce4ec","#f48fb1","#ec407a","#c2185b","#880e4f"], dataType: "ratio" },
    ],
  },
  {
    key: "population", label: "인구", icon: "👥",
    layers: [
      { key: "population", label: "총인구", unit: "명", format: "number", colorScheme: "quantile", palette: ["#fce4ec","#f48fb1","#ec407a","#c2185b","#880e4f"], dataType: "count" },
      { key: "populationGrowth", label: "인구증감률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "agingRate", label: "고령화율", unit: "%", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "rate" },
      { key: "youthRatio", label: "청년비율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "ratio" },
      { key: "birthRate", label: "출생률", unit: "‰", format: "decimal", colorScheme: "quantile", palette: ["#fef3c7","#fcd34d","#f59e0b","#d97706","#92400e"], dataType: "rate" },
      { key: "foreignRatio", label: "외국인비율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "ratio" },
      { key: "netMigration", label: "순이동률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
    ],
  },
  {
    key: "economy", label: "경제", icon: "💰",
    layers: [
      { key: "grdp", label: "지역내총생산", unit: "십억원", format: "number", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"], dataType: "money" },
      { key: "grdpGrowth", label: "GRDP 성장률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "taxRevenue", label: "지방세수입", unit: "억원", format: "number", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "money" },
      { key: "financialIndependence", label: "재정자립도", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "rate" },
      { key: "localConsumption", label: "지역소비", unit: "십억원", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"], dataType: "money" },
    ],
  },
  {
    key: "realEstate", label: "부동산", icon: "🏠",
    layers: [
      { key: "avgLandPrice", label: "평균지가", unit: "만원/㎡", format: "price", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"], dataType: "money" },
      { key: "priceChangeRate", label: "지가변동률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "aptPrice", label: "아파트매매가", unit: "만원", format: "price", colorScheme: "quantile", palette: ["#fef3c7","#fcd34d","#f59e0b","#d97706","#92400e"], dataType: "money" },
      { key: "aptChangeRate", label: "아파트변동률", unit: "%", format: "signedPercent", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "buildingPermits", label: "건축허가", unit: "건", format: "number", colorScheme: "quantile", palette: ["#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed"], dataType: "count" },
    ],
  },
  {
    key: "employment", label: "고용", icon: "💼",
    layers: [
      { key: "employmentRate", label: "고용률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "rate" },
      { key: "unemploymentRate", label: "실업률", unit: "%", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "rate" },
      { key: "avgWage", label: "평균임금", unit: "만원", format: "price", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "money" },
      { key: "jobCreation", label: "일자리증감", unit: "개", format: "number", colorScheme: "diverging", palette: ["#ef4444","#f97316","#fbbf24","#34d399","#10b981"], dataType: "growth" },
      { key: "youthEmployment", label: "청년고용률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"], dataType: "rate" },
    ],
  },
  {
    key: "education", label: "교육", icon: "🎓",
    layers: [
      { key: "schoolCount", label: "학교 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], dataType: "count" },
      { key: "studentCount", label: "학생 수", unit: "명", format: "number", colorScheme: "quantile", palette: ["#ede9fe","#c4b5fd","#a78bfa","#7c3aed","#5b21b6"], dataType: "count" },
      { key: "universityCount", label: "대학 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"], dataType: "count" },
      { key: "libraryCount", label: "도서관 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"], dataType: "count" },
      { key: "educationBudget", label: "교육재정", unit: "억원", format: "number", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"], dataType: "money" },
    ],
  },
  {
    key: "commercial", label: "상권", icon: "🏪",
    layers: [
      { key: "storeCount", label: "상가 수", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"], dataType: "count" },
      { key: "storeOpenRate", label: "개업률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "rate" },
      { key: "storeCloseRate", label: "폐업률", unit: "%", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "rate" },
      { key: "franchiseCount", label: "프랜차이즈", unit: "개", format: "number", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], dataType: "count" },
      { key: "salesPerStore", label: "점포당매출", unit: "백만원", format: "number", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"], dataType: "density" },
    ],
  },
  {
    key: "healthcare", label: "의료/복지", icon: "🏥",
    layers: [
      { key: "hospitalCount", label: "의료기관", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce4ec","#f48fb1","#ec407a","#c2185b","#880e4f"], dataType: "count" },
      { key: "doctorCount", label: "의사 수", unit: "명", format: "number", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "count" },
      { key: "bedsPerPopulation", label: "병상 수", unit: "개/천명", format: "decimal", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"], dataType: "density" },
      { key: "seniorFacilities", label: "노인복지시설", unit: "개", format: "number", colorScheme: "quantile", palette: ["#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed"], dataType: "count" },
      { key: "daycareCenters", label: "어린이집", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fef3c7","#fcd34d","#f59e0b","#d97706","#92400e"], dataType: "count" },
    ],
  },
  {
    key: "safety", label: "안전", icon: "🛡️",
    layers: [
      { key: "crimeRate", label: "범죄발생률", unit: "건/만명", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "density" },
      { key: "trafficAccidents", label: "교통사고", unit: "건", format: "number", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "count" },
      { key: "fireIncidents", label: "화재발생", unit: "건", format: "number", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "count" },
      { key: "disasterDamage", label: "재해피해액", unit: "백만원", format: "number", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "money" },
    ],
  },
  {
    key: "environment", label: "환경", icon: "🌿",
    layers: [
      { key: "airQuality", label: "미세먼지", unit: "㎍/㎥", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "density" },
      { key: "greenAreaRatio", label: "녹지비율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "ratio" },
      { key: "wasteGeneration", label: "폐기물발생", unit: "톤/일", format: "number", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "density" },
      { key: "waterQuality", label: "수질등급", unit: "등급", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "score" },
    ],
  },
  {
    key: "infrastructure", label: "인프라", icon: "🏗️",
    layers: [
      { key: "roadDensity", label: "도로율", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], dataType: "rate" },
      { key: "waterSupply", label: "상수도보급률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "rate" },
      { key: "sewerageRate", label: "하수도보급률", unit: "%", format: "decimal", colorScheme: "quantile", palette: ["#ccfbf1","#99f6e4","#5eead4","#14b8a6","#0d9488"], dataType: "rate" },
      { key: "parkArea", label: "1인당 공원면적", unit: "㎡", format: "decimal", colorScheme: "quantile", palette: ["#dcfce7","#86efac","#4ade80","#16a34a","#166534"], dataType: "density" },
    ],
  },
  {
    key: "transport", label: "교통", icon: "🚇",
    layers: [
      { key: "transitScore", label: "대중교통접근성", unit: "점", format: "decimal", colorScheme: "quantile", palette: ["#e0f2fe","#7dd3fc","#38bdf8","#0284c7","#075985"], dataType: "score" },
      { key: "subwayStations", label: "지하철역", unit: "개", format: "number", colorScheme: "quantile", palette: ["#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed"], dataType: "count" },
      { key: "busRoutes", label: "버스노선", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"], dataType: "count" },
      { key: "dailyPassengers", label: "일일이용객", unit: "명", format: "number", colorScheme: "quantile", palette: ["#fef9c3","#fde047","#facc15","#ca8a04","#854d0e"], dataType: "count" },
      { key: "avgCommute", label: "평균통근시간", unit: "분", format: "decimal", colorScheme: "inverse", palette: ["#10b981","#34d399","#fbbf24","#f97316","#ef4444"], dataType: "density" },
    ],
  },
  {
    key: "culture", label: "문화관광", icon: "🎭",
    layers: [
      { key: "culturalFacilities", label: "문화시설", unit: "개", format: "number", colorScheme: "quantile", palette: ["#fce7f3","#f9a8d4","#f472b6","#db2777","#9d174d"], dataType: "count" },
      { key: "touristVisitors", label: "관광객 수", unit: "천명", format: "number", colorScheme: "quantile", palette: ["#fef3c7","#fcd34d","#f59e0b","#d97706","#92400e"], dataType: "count" },
      { key: "accommodations", label: "숙박시설", unit: "개", format: "number", colorScheme: "quantile", palette: ["#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], dataType: "count" },
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

// Robust percentile: continuous rank in [0, 1]
function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 0.5;
  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) count++;
    else break;
  }
  // Use midpoint rank to avoid bottom bucket getting all 0-value items
  return (count - 0.5) / Math.max(sorted.length, 1);
}

export function getLayerColor(layerKey: DataLayerKey, value: number, allValues: number[]): string {
  const def = getLayerDef(layerKey);
  if (!def) return "#e2e8f0";

  if (layerKey === "healthScore") return getHealthColor(value);

  if (def.colorScheme === "diverging") {
    const divergingKeys: DataLayerKey[] = [
      "growthRate", "populationGrowth", "priceChangeRate",
      "aptChangeRate", "grdpGrowth", "netMigration", "jobCreation",
    ];
    if (divergingKeys.includes(layerKey)) {
      if (value >= 5) return def.palette[4];
      if (value >= 2) return def.palette[3];
      if (value >= 0) return def.palette[2];
      if (value >= -2) return def.palette[1];
      return def.palette[0];
    }
    const sorted = [...allValues].sort((a, b) => a - b);
    const rank = percentileRank(value, sorted);
    const idx = Math.min(4, Math.max(0, Math.floor(Math.max(0, rank) * 4.999)));
    return def.palette[idx];
  }

  // Quantile-based (covers both "quantile" and "inverse" schemes)
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = Math.max(0, percentileRank(value, sorted));
  const idx = Math.min(4, Math.floor(rank * 4.999));
  return def.palette[idx];
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
    case "score": return value.toFixed(1) + def.unit;
  }
}

// Legend bands
export function getLayerLegendBands(layerKey: DataLayerKey): { label: string; color: string }[] {
  const def = getLayerDef(layerKey);
  if (!def) return [];

  if (layerKey === "healthScore") {
    return HEALTH_BANDS.map((b) => ({ label: b.label, color: b.color }));
  }

  if (def.colorScheme === "diverging") {
    const divergingKeys: DataLayerKey[] = [
      "growthRate", "populationGrowth", "priceChangeRate",
      "aptChangeRate", "grdpGrowth", "netMigration", "jobCreation",
    ];
    if (divergingKeys.includes(layerKey)) {
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

  if (def.colorScheme === "inverse") {
    return [
      { label: "매우 양호 (하위 20%)", color: def.palette[0] },
      { label: "양호", color: def.palette[1] },
      { label: "보통", color: def.palette[2] },
      { label: "주의", color: def.palette[3] },
      { label: "심각 (상위 20%)", color: def.palette[4] },
    ];
  }

  return [
    { label: "매우 높음 (상위 20%)", color: def.palette[4] },
    { label: "높음", color: def.palette[3] },
    { label: "보통", color: def.palette[2] },
    { label: "낮음", color: def.palette[1] },
    { label: "매우 낮음 (하위 20%)", color: def.palette[0] },
  ];
}

// ── Data Type Helpers ──────────────────────────

export const DATA_TYPE_LABELS: Record<DataType, string> = {
  count: "수량",
  rate: "비율",
  growth: "증감률",
  ratio: "구성비",
  money: "금액",
  score: "점수",
  density: "밀도",
};

export const DATA_TYPE_CHART_REC: Record<DataType, string> = {
  count: "bar",       // Counts → bar charts
  rate: "gauge",      // Rates → gauge/meter
  growth: "area",     // Growth → area (shows direction)
  ratio: "pie",       // Composition → pie/donut
  money: "bar",       // Money → bar charts
  score: "radial",    // Scores → radial/circular progress
  density: "bar",     // Density → bar charts
};

export function getDataTypeIcon(dt: DataType): string {
  switch (dt) {
    case "count": return "bar_chart";
    case "rate": return "speed";
    case "growth": return "trending_up";
    case "ratio": return "pie_chart";
    case "money": return "payments";
    case "score": return "stars";
    case "density": return "grid_on";
  }
}

// Returns whether two data types are good for scatter/correlation analysis
export function areTypesCorrelatable(a: DataType, b: DataType): boolean {
  // Same type is always interesting
  if (a === b) return true;
  // Growth vs anything is interesting
  if (a === "growth" || b === "growth") return true;
  // Count vs rate/ratio (structural analysis)
  const structural = new Set<DataType>(["count", "rate", "ratio", "money", "density"]);
  return structural.has(a) && structural.has(b);
}
