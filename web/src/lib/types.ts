export interface RegionData {
  code: string;
  name: string;
  province: string;

  // ── Industry (산업) ──
  companyCount: number;        // 사업체 수
  employeeCount: number;       // 종사자 수
  healthScore: number;         // 산업건강도 (종합)
  growthRate: number;          // 기업성장률 (%)
  newBizRate: number;          // 신규창업률 (%)
  closureRate: number;         // 폐업률 (%)
  manufacturingRatio: number;  // 제조업 비중 (%)
  smeRatio: number;            // 중소기업 비율 (%)
  industryDistribution: Record<string, number>;

  // ── Population (인구) ──
  population: number;          // 총인구
  populationGrowth: number;    // 인구증감률 (%)
  agingRate: number;           // 고령화율 (%)
  youthRatio: number;          // 청년비율 (%)
  birthRate: number;           // 출생률 (‰)
  foreignRatio: number;        // 외국인비율 (%)
  netMigration: number;        // 순이동률 (%)

  // ── Economy (경제) ──
  grdp: number;                // 지역내총생산 (십억원)
  grdpGrowth: number;          // GRDP 성장률 (%)
  taxRevenue: number;          // 지방세수입 (억원)
  financialIndependence: number; // 재정자립도 (%)
  localConsumption: number;    // 지역소비 (십억원)

  // ── Real Estate (부동산) ──
  avgLandPrice: number;        // 평균지가 (만원/㎡)
  priceChangeRate: number;     // 지가변동률 (%)
  aptPrice: number;            // 아파트평균매매가 (만원)
  aptChangeRate: number;       // 아파트가격변동률 (%)
  buildingPermits: number;     // 건축허가건수

  // ── Employment (고용) ──
  employmentRate: number;      // 고용률 (%)
  unemploymentRate: number;    // 실업률 (%)
  avgWage: number;             // 평균임금 (만원/월)
  jobCreation: number;         // 일자리증감 (개)
  youthEmployment: number;     // 청년고용률 (%)

  // ── Education (교육) ──
  schoolCount: number;         // 학교 수
  studentCount: number;        // 학생 수
  universityCount: number;     // 대학 수
  libraryCount: number;        // 도서관 수
  educationBudget: number;     // 교육재정 (억원)

  // ── Commercial (상권) ──
  storeCount: number;          // 상가 수
  storeOpenRate: number;       // 개업률 (%)
  storeCloseRate: number;      // 폐업률 (%)
  franchiseCount: number;      // 프랜차이즈 수
  salesPerStore: number;       // 점포당매출 (백만원)

  // ── Healthcare (의료/복지) ──
  hospitalCount: number;       // 의료기관 수
  doctorCount: number;         // 의사 수
  bedsPerPopulation: number;   // 인구천명당 병상 수
  seniorFacilities: number;    // 노인복지시설 수
  daycareCenters: number;      // 어린이집 수

  // ── Safety (안전) ──
  crimeRate: number;           // 범죄발생률 (건/만명)
  trafficAccidents: number;    // 교통사고 건수
  fireIncidents: number;       // 화재 건수
  disasterDamage: number;      // 재해피해액 (백만원)

  // ── Environment (환경) ──
  airQuality: number;          // 미세먼지 농도 (㎍/㎥)
  greenAreaRatio: number;      // 녹지비율 (%)
  wasteGeneration: number;     // 폐기물발생량 (톤/일)
  waterQuality: number;        // 수질등급 (1-5, 1=최우수)

  // ── Infrastructure (인프라) ──
  roadDensity: number;         // 도로율 (%)
  waterSupply: number;         // 상수도보급률 (%)
  sewerageRate: number;        // 하수도보급률 (%)
  parkArea: number;            // 1인당 공원면적 (㎡)

  // ── Transportation (교통) ──
  transitScore: number;        // 대중교통접근성 (점)
  subwayStations: number;      // 지하철역 수
  busRoutes: number;           // 버스노선 수
  dailyPassengers: number;     // 일일이용객 수
  avgCommute: number;          // 평균통근시간 (분)

  // ── Culture/Tourism (문화관광) ──
  culturalFacilities: number;  // 문화시설 수
  touristVisitors: number;     // 관광객 수 (천명)
  accommodations: number;      // 숙박시설 수
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
