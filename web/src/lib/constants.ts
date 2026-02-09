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

export const VWORLD_TILE_URL =
  "https://api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png";

export const OSM_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const CARTO_DARK_TILE_URL =
  "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";
