export interface RegionData {
  code: string;
  name: string;
  province: string;
  companyCount: number;
  employeeCount: number;
  healthScore: number;
  growthRate: number;
  newBizRate: number;
  closureRate: number;
  industryDistribution: Record<string, number>;
}

export interface RegionGeoFeature {
  type: "Feature";
  properties: {
    code: string;
    name: string;
    name_eng?: string;
  };
  geometry: GeoJSON.Geometry;
}

export interface HealthScoreBand {
  label: string;
  min: number;
  max: number;
  color: string;
}

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};
