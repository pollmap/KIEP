import { HealthScoreBand, MapViewState } from "./types";

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
  "26": "부산광역시",
  "27": "대구광역시",
  "28": "인천광역시",
  "29": "광주광역시",
  "30": "대전광역시",
  "31": "울산광역시",
  "36": "세종특별자치시",
  "41": "경기도",
  "42": "강원특별자치도",
  "43": "충청북도",
  "44": "충청남도",
  "45": "전북특별자치도",
  "46": "전라남도",
  "47": "경상북도",
  "48": "경상남도",
  "39": "제주특별자치도",
};

export type MapLayerType = "healthScore" | "companyCount" | "employeeCount" | "growthRate";

export const MAP_LAYERS: { key: MapLayerType; label: string }[] = [
  { key: "healthScore", label: "건강도" },
  { key: "companyCount", label: "기업 수" },
  { key: "employeeCount", label: "고용 인원" },
  { key: "growthRate", label: "성장률" },
];

export type BasemapStyle = "vworld-base" | "vworld-midnight" | "vworld-satellite" | "carto-dark";

export function getBasemapTiles(style: BasemapStyle): { url: string; attribution: string } {
  const vworldKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY || "";

  switch (style) {
    case "vworld-base":
      return {
        url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Base/{z}/{y}/{x}.png`,
        attribution: "&copy; VWorld",
      };
    case "vworld-midnight":
      return {
        url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/midnight/{z}/{y}/{x}.png`,
        attribution: "&copy; VWorld",
      };
    case "vworld-satellite":
      return {
        url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Satellite/{z}/{y}/{x}.jpeg`,
        attribution: "&copy; VWorld",
      };
    case "carto-dark":
      return {
        url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      };
  }
}

export function getLayerColor(layerType: MapLayerType, value: number, allValues: number[]): string {
  if (layerType === "healthScore") {
    return getHealthColor(value);
  }

  // For other layers, use quantile-based coloring
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.indexOf(value) / sorted.length;

  if (layerType === "growthRate") {
    // Diverging: red(-) → yellow(0) → green(+)
    if (value < -2) return "#ef4444";
    if (value < 0) return "#f97316";
    if (value < 2) return "#fbbf24";
    if (value < 5) return "#34d399";
    return "#10b981";
  }

  // Sequential: light → dark blue
  if (rank < 0.2) return "#1e3a5f";
  if (rank < 0.4) return "#1d4ed8";
  if (rank < 0.6) return "#3b82f6";
  if (rank < 0.8) return "#60a5fa";
  return "#93c5fd";
}
