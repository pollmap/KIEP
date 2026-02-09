export interface RegionData {
  code: string;
  name: string;
  province: string;
  // Industry
  companyCount: number;
  employeeCount: number;
  healthScore: number;
  growthRate: number;
  newBizRate: number;
  closureRate: number;
  industryDistribution: Record<string, number>;
  // Population
  population: number;
  populationGrowth: number;
  agingRate: number;
  youthRatio: number;
  // Real Estate
  avgLandPrice: number;
  priceChangeRate: number;
  // Employment
  employmentRate: number;
  unemploymentRate: number;
  // Education
  schoolCount: number;
  studentCount: number;
  // Commercial
  storeCount: number;
  storeOpenRate: number;
  storeCloseRate: number;
  // Transportation
  transitScore: number;
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

export interface HistoricalData {
  startYear: number;
  endYear: number;
  keys: string[];
  data: Record<string, Record<string, number>[]>;
}
