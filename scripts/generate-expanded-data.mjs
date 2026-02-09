#!/usr/bin/env node
/**
 * Generate expanded sample data for KIEP platform
 * - 250 Korean 시군구 districts
 * - 65 data layers across 13 categories
 * - 26 years of historical data (2000-2025) with 20 time-series metrics
 *
 * Region classification based on code prefix:
 *   11xxx: Seoul (dense urban)
 *   21-26xxx, 29xxx: Metropolitan cities
 *   31xxx: Gyeonggi (suburban/growing)
 *   32-39xxx with city codes (<300): Provincial capitals/cities
 *   32-39xxx with gun codes (>=300): Rural areas
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "web", "public", "data");

// Load existing data for region codes, names, provinces
const existing = JSON.parse(readFileSync(join(DATA_DIR, "sample-regions.json"), "utf-8"));

// ---------------------------------------------------------------------------
// Seeded PRNG for reproducibility
// ---------------------------------------------------------------------------
let seed = 20250209;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randRange(min, max) { return min + rand() * (max - min); }
function randInt(min, max) { return Math.round(randRange(min, max)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

// Gaussian-ish random (Box-Muller lite, clamped)
function randNorm(mean, std) {
  const u1 = rand() || 0.0001;
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}
function randNormClamped(mean, std, min, max) {
  return clamp(randNorm(mean, std), min, max);
}

// ---------------------------------------------------------------------------
// Region classification
// ---------------------------------------------------------------------------
function classifyRegion(code, name) {
  const prefix2 = code.substring(0, 2);
  const prefix3 = code.substring(0, 3);
  const lastDigits = parseInt(code.substring(2), 10);

  // Seoul
  if (prefix2 === "11") {
    // Gangnam belt: 서초, 강남, 송파
    if (["11220", "11230", "11240"].includes(code)) return "seoul_gangnam";
    return "seoul";
  }

  // Sejong
  if (prefix2 === "29") return "sejong";

  // Metropolitan cities (Busan, Daegu, Incheon, Gwangju, Daejeon, Ulsan)
  if (["21", "22", "23", "24", "25", "26"].includes(prefix2)) {
    // Gun areas within metro cities are more suburban
    if (lastDigits >= 300) return "metro_suburban";
    return "metro";
  }

  // Gyeonggi
  if (prefix2 === "31") {
    // Bundang, Suji, Yongin-Giheung, Gwacheon = affluent suburban
    if (["31023", "31193", "31192", "31110"].includes(code)) return "gyeonggi_affluent";
    // Growing new towns: Hwaseong, Gimpo, Paju, Namyangju
    if (["31240", "31230", "31200", "31130"].includes(code)) return "gyeonggi_growing";
    // Rural Gyeonggi: Yeoncheon, Gapyeong, Yangpyeong
    if (lastDigits >= 300) return "gyeonggi_rural";
    return "gyeonggi";
  }

  // Provincial areas (32-39)
  // Provincial capital cities (시)
  const provincialCapitals = [
    "32010", "32020", "32030",             // Chuncheon, Wonju, Gangneung
    "33041", "33042", "33043", "33044",     // Cheongju
    "33020",                                // Chungju
    "34011", "34012",                       // Cheonan
    "34040",                                // Asan
    "35011", "35012",                       // Jeonju
    "35020", "35030",                       // Gunsan, Iksan
    "36010", "36020", "36030",              // Mokpo, Yeosu, Suncheon
    "37011", "37012",                       // Pohang
    "37050", "37100",                       // Gumi, Gyeongsan
    "38111", "38112", "38113", "38114", "38115", // Changwon
    "38070",                                // Gimhae
    "39010",                                // Jeju
  ];
  if (provincialCapitals.includes(code)) return "provincial_city";

  // Small cities
  if (lastDigits < 300 && parseInt(code.substring(2), 10) < 300) return "small_city";

  // Rural gun areas
  return "rural";
}

// ---------------------------------------------------------------------------
// Base parameter profiles per region type (2025 latest values)
// ---------------------------------------------------------------------------
const PROFILES = {
  seoul_gangnam: {
    companyCount: [18000, 30000], employeeCount: [120000, 200000],
    growthRate: [1, 5], newBizRate: [4, 8], closureRate: [3, 6],
    manufacturingRatio: [3, 10], smeRatio: [85, 93],
    population: [300000, 700000], populationGrowth: [-1, 1], agingRate: [12, 18],
    youthRatio: [22, 32], birthRate: [4, 8], foreignRatio: [2, 6], netMigration: [-1, 2],
    grdp: [30000, 80000], grdpGrowth: [1, 6], taxRevenue: [8000, 30000],
    financialIndependence: [40, 65], localConsumption: [15000, 50000],
    avgLandPrice: [3000, 5000], priceChangeRate: [-1, 10], aptPrice: [100000, 200000],
    aptChangeRate: [-2, 15], buildingPermits: [100, 800],
    employmentRate: [62, 72], unemploymentRate: [2, 5], avgWage: [350, 450],
    jobCreation: [500, 5000], youthEmployment: [50, 65],
    schoolCount: [60, 150], studentCount: [15000, 60000], universityCount: [3, 15],
    libraryCount: [8, 25], educationBudget: [1500, 5000],
    storeCount: [12000, 28000], storeOpenRate: [5, 10], storeCloseRate: [4, 9],
    franchiseCount: [1500, 5000], salesPerStore: [250, 500],
    hospitalCount: [200, 800], doctorCount: [500, 3000], bedsPerPopulation: [5, 15],
    seniorFacilities: [15, 60], daycareCenters: [80, 400],
    crimeRate: [40, 80], trafficAccidents: [300, 1500], fireIncidents: [100, 400],
    disasterDamage: [0, 5000],
    airQuality: [20, 30], greenAreaRatio: [10, 30], wasteGeneration: [300, 2500],
    waterQuality: [1.5, 2.5],
    roadDensity: [25, 40], waterSupply: [98, 100], sewerageRate: [95, 100],
    parkArea: [8, 30],
    transitScore: [85, 95], subwayStations: [5, 15], busRoutes: [60, 200],
    dailyPassengers: [100000, 500000], avgCommute: [35, 60],
    culturalFacilities: [40, 150], touristVisitors: [3000, 15000], accommodations: [200, 2000],
  },
  seoul: {
    companyCount: [5000, 20000], employeeCount: [40000, 150000],
    growthRate: [-1, 4], newBizRate: [3, 7], closureRate: [3, 7],
    manufacturingRatio: [3, 15], smeRatio: [87, 96],
    population: [200000, 600000], populationGrowth: [-2, 0.5], agingRate: [14, 22],
    youthRatio: [18, 28], birthRate: [3, 7], foreignRatio: [2, 8], netMigration: [-2, 1],
    grdp: [8000, 40000], grdpGrowth: [0, 5], taxRevenue: [2000, 15000],
    financialIndependence: [30, 55], localConsumption: [5000, 25000],
    avgLandPrice: [1500, 3500], priceChangeRate: [-2, 8], aptPrice: [40000, 130000],
    aptChangeRate: [-3, 12], buildingPermits: [50, 600],
    employmentRate: [58, 70], unemploymentRate: [2.5, 6], avgWage: [280, 400],
    jobCreation: [-1000, 3000], youthEmployment: [42, 60],
    schoolCount: [40, 120], studentCount: [8000, 45000], universityCount: [1, 10],
    libraryCount: [5, 20], educationBudget: [800, 3500],
    storeCount: [6000, 22000], storeOpenRate: [4, 11], storeCloseRate: [4, 10],
    franchiseCount: [800, 4000], salesPerStore: [200, 450],
    hospitalCount: [100, 600], doctorCount: [200, 2000], bedsPerPopulation: [4, 12],
    seniorFacilities: [10, 50], daycareCenters: [50, 350],
    crimeRate: [35, 90], trafficAccidents: [200, 1200], fireIncidents: [80, 350],
    disasterDamage: [0, 8000],
    airQuality: [20, 32], greenAreaRatio: [8, 35], wasteGeneration: [200, 2000],
    waterQuality: [1.5, 2.8],
    roadDensity: [22, 38], waterSupply: [98, 100], sewerageRate: [95, 100],
    parkArea: [5, 25],
    transitScore: [82, 95], subwayStations: [3, 12], busRoutes: [40, 180],
    dailyPassengers: [50000, 400000], avgCommute: [35, 65],
    culturalFacilities: [25, 120], touristVisitors: [1000, 10000], accommodations: [100, 1500],
  },
  metro: {
    companyCount: [3000, 15000], employeeCount: [20000, 100000],
    growthRate: [-2, 4], newBizRate: [3, 7], closureRate: [3, 7],
    manufacturingRatio: [8, 30], smeRatio: [88, 97],
    population: [100000, 450000], populationGrowth: [-2, 1], agingRate: [14, 24],
    youthRatio: [15, 26], birthRate: [3, 7], foreignRatio: [1.5, 8], netMigration: [-2, 1],
    grdp: [3000, 25000], grdpGrowth: [-1, 5], taxRevenue: [500, 10000],
    financialIndependence: [20, 50], localConsumption: [2000, 15000],
    avgLandPrice: [400, 1800], priceChangeRate: [-2, 8], aptPrice: [15000, 80000],
    aptChangeRate: [-3, 12], buildingPermits: [50, 1000],
    employmentRate: [56, 70], unemploymentRate: [2, 6], avgWage: [230, 360],
    jobCreation: [-2000, 3000], youthEmployment: [40, 58],
    schoolCount: [25, 80], studentCount: [5000, 30000], universityCount: [0, 8],
    libraryCount: [3, 18], educationBudget: [400, 2500],
    storeCount: [3000, 16000], storeOpenRate: [4, 11], storeCloseRate: [3, 10],
    franchiseCount: [400, 3000], salesPerStore: [150, 400],
    hospitalCount: [50, 400], doctorCount: [80, 1500], bedsPerPopulation: [4, 15],
    seniorFacilities: [8, 50], daycareCenters: [30, 250],
    crimeRate: [30, 100], trafficAccidents: [150, 1500], fireIncidents: [50, 350],
    disasterDamage: [0, 10000],
    airQuality: [18, 33], greenAreaRatio: [10, 40], wasteGeneration: [150, 2000],
    waterQuality: [1.5, 3.0],
    roadDensity: [18, 35], waterSupply: [95, 100], sewerageRate: [90, 100],
    parkArea: [5, 25],
    transitScore: [65, 90], subwayStations: [1, 10], busRoutes: [30, 150],
    dailyPassengers: [20000, 250000], avgCommute: [25, 55],
    culturalFacilities: [15, 80], touristVisitors: [500, 8000], accommodations: [50, 800],
  },
  metro_suburban: {
    companyCount: [1500, 8000], employeeCount: [10000, 60000],
    growthRate: [-1, 5], newBizRate: [3, 7], closureRate: [2, 6],
    manufacturingRatio: [10, 35], smeRatio: [90, 98],
    population: [50000, 250000], populationGrowth: [-1, 3], agingRate: [12, 22],
    youthRatio: [16, 28], birthRate: [3, 8], foreignRatio: [2, 10], netMigration: [-1, 3],
    grdp: [2000, 15000], grdpGrowth: [0, 6], taxRevenue: [300, 5000],
    financialIndependence: [15, 40], localConsumption: [1000, 8000],
    avgLandPrice: [200, 1000], priceChangeRate: [-1, 10], aptPrice: [10000, 50000],
    aptChangeRate: [-2, 15], buildingPermits: [50, 1500],
    employmentRate: [58, 72], unemploymentRate: [2, 5.5], avgWage: [220, 340],
    jobCreation: [0, 4000], youthEmployment: [42, 60],
    schoolCount: [15, 60], studentCount: [3000, 20000], universityCount: [0, 4],
    libraryCount: [2, 12], educationBudget: [200, 1500],
    storeCount: [2000, 10000], storeOpenRate: [4, 12], storeCloseRate: [3, 9],
    franchiseCount: [200, 1500], salesPerStore: [150, 380],
    hospitalCount: [30, 200], doctorCount: [50, 800], bedsPerPopulation: [4, 18],
    seniorFacilities: [5, 40], daycareCenters: [20, 200],
    crimeRate: [25, 80], trafficAccidents: [100, 1000], fireIncidents: [40, 250],
    disasterDamage: [0, 15000],
    airQuality: [17, 32], greenAreaRatio: [20, 55], wasteGeneration: [100, 1200],
    waterQuality: [1.5, 2.8],
    roadDensity: [12, 28], waterSupply: [92, 100], sewerageRate: [85, 100],
    parkArea: [8, 35],
    transitScore: [50, 78], subwayStations: [0, 5], busRoutes: [15, 80],
    dailyPassengers: [10000, 120000], avgCommute: [30, 55],
    culturalFacilities: [8, 50], touristVisitors: [300, 5000], accommodations: [30, 500],
  },
  sejong: {
    companyCount: [3000, 6000], employeeCount: [25000, 50000],
    growthRate: [3, 8], newBizRate: [5, 8], closureRate: [2, 4],
    manufacturingRatio: [8, 18], smeRatio: [88, 95],
    population: [350000, 400000], populationGrowth: [3, 5], agingRate: [8, 12],
    youthRatio: [28, 35], birthRate: [8, 12], foreignRatio: [2, 5], netMigration: [3, 5],
    grdp: [8000, 15000], grdpGrowth: [3, 8], taxRevenue: [1500, 5000],
    financialIndependence: [35, 55], localConsumption: [3000, 8000],
    avgLandPrice: [500, 900], priceChangeRate: [2, 15], aptPrice: [25000, 60000],
    aptChangeRate: [0, 20], buildingPermits: [500, 3000],
    employmentRate: [62, 72], unemploymentRate: [2, 4], avgWage: [300, 400],
    jobCreation: [2000, 10000], youthEmployment: [50, 65],
    schoolCount: [25, 50], studentCount: [10000, 25000], universityCount: [1, 5],
    libraryCount: [5, 15], educationBudget: [500, 2000],
    storeCount: [3000, 6000], storeOpenRate: [6, 12], storeCloseRate: [3, 6],
    franchiseCount: [300, 1000], salesPerStore: [200, 400],
    hospitalCount: [40, 100], doctorCount: [60, 300], bedsPerPopulation: [3, 10],
    seniorFacilities: [5, 20], daycareCenters: [50, 200],
    crimeRate: [25, 50], trafficAccidents: [100, 500], fireIncidents: [30, 150],
    disasterDamage: [0, 5000],
    airQuality: [18, 28], greenAreaRatio: [30, 55], wasteGeneration: [200, 800],
    waterQuality: [1.5, 2.5],
    roadDensity: [18, 30], waterSupply: [95, 100], sewerageRate: [92, 100],
    parkArea: [15, 40],
    transitScore: [55, 70], subwayStations: [0, 0], busRoutes: [20, 60],
    dailyPassengers: [15000, 60000], avgCommute: [25, 45],
    culturalFacilities: [10, 40], touristVisitors: [500, 3000], accommodations: [30, 200],
  },
  gyeonggi_affluent: {
    companyCount: [5000, 18000], employeeCount: [40000, 120000],
    growthRate: [0, 5], newBizRate: [4, 8], closureRate: [3, 6],
    manufacturingRatio: [5, 18], smeRatio: [87, 95],
    population: [200000, 500000], populationGrowth: [0, 3], agingRate: [10, 17],
    youthRatio: [22, 32], birthRate: [5, 9], foreignRatio: [2, 6], netMigration: [0, 3],
    grdp: [10000, 40000], grdpGrowth: [1, 6], taxRevenue: [3000, 15000],
    financialIndependence: [35, 55], localConsumption: [5000, 20000],
    avgLandPrice: [1500, 4000], priceChangeRate: [-1, 12], aptPrice: [60000, 180000],
    aptChangeRate: [-2, 18], buildingPermits: [80, 800],
    employmentRate: [60, 72], unemploymentRate: [2, 5], avgWage: [320, 420],
    jobCreation: [500, 5000], youthEmployment: [48, 62],
    schoolCount: [50, 130], studentCount: [15000, 50000], universityCount: [2, 10],
    libraryCount: [6, 22], educationBudget: [1000, 4000],
    storeCount: [6000, 18000], storeOpenRate: [5, 10], storeCloseRate: [4, 9],
    franchiseCount: [800, 3500], salesPerStore: [220, 480],
    hospitalCount: [80, 400], doctorCount: [150, 1500], bedsPerPopulation: [4, 12],
    seniorFacilities: [10, 50], daycareCenters: [60, 350],
    crimeRate: [30, 70], trafficAccidents: [200, 1200], fireIncidents: [60, 300],
    disasterDamage: [0, 5000],
    airQuality: [19, 30], greenAreaRatio: [15, 40], wasteGeneration: [200, 1800],
    waterQuality: [1.5, 2.5],
    roadDensity: [20, 35], waterSupply: [97, 100], sewerageRate: [93, 100],
    parkArea: [10, 35],
    transitScore: [75, 92], subwayStations: [3, 12], busRoutes: [40, 160],
    dailyPassengers: [60000, 350000], avgCommute: [40, 65],
    culturalFacilities: [25, 100], touristVisitors: [800, 8000], accommodations: [80, 1000],
  },
  gyeonggi_growing: {
    companyCount: [4000, 15000], employeeCount: [25000, 100000],
    growthRate: [1, 6], newBizRate: [5, 8], closureRate: [2, 5],
    manufacturingRatio: [10, 30], smeRatio: [89, 97],
    population: [250000, 900000], populationGrowth: [1, 5], agingRate: [9, 15],
    youthRatio: [24, 33], birthRate: [5, 10], foreignRatio: [3, 10], netMigration: [1, 5],
    grdp: [5000, 30000], grdpGrowth: [2, 7], taxRevenue: [1000, 10000],
    financialIndependence: [25, 50], localConsumption: [3000, 18000],
    avgLandPrice: [600, 2000], priceChangeRate: [0, 12], aptPrice: [30000, 100000],
    aptChangeRate: [0, 18], buildingPermits: [200, 3000],
    employmentRate: [60, 72], unemploymentRate: [2, 5], avgWage: [270, 380],
    jobCreation: [1000, 8000], youthEmployment: [45, 62],
    schoolCount: [40, 120], studentCount: [15000, 50000], universityCount: [1, 6],
    libraryCount: [5, 20], educationBudget: [800, 3500],
    storeCount: [5000, 18000], storeOpenRate: [5, 12], storeCloseRate: [3, 8],
    franchiseCount: [600, 3000], salesPerStore: [180, 400],
    hospitalCount: [50, 300], doctorCount: [80, 1000], bedsPerPopulation: [3, 12],
    seniorFacilities: [8, 40], daycareCenters: [50, 350],
    crimeRate: [30, 80], trafficAccidents: [200, 1500], fireIncidents: [60, 350],
    disasterDamage: [0, 10000],
    airQuality: [19, 32], greenAreaRatio: [15, 45], wasteGeneration: [200, 2000],
    waterQuality: [1.5, 2.8],
    roadDensity: [15, 30], waterSupply: [95, 100], sewerageRate: [90, 100],
    parkArea: [10, 35],
    transitScore: [60, 82], subwayStations: [0, 8], busRoutes: [25, 120],
    dailyPassengers: [30000, 250000], avgCommute: [40, 70],
    culturalFacilities: [15, 70], touristVisitors: [500, 5000], accommodations: [50, 600],
  },
  gyeonggi: {
    companyCount: [3000, 14000], employeeCount: [20000, 90000],
    growthRate: [-1, 4], newBizRate: [3, 7], closureRate: [3, 6],
    manufacturingRatio: [10, 35], smeRatio: [89, 97],
    population: [150000, 500000], populationGrowth: [-1, 2], agingRate: [12, 20],
    youthRatio: [18, 28], birthRate: [4, 8], foreignRatio: [2, 12], netMigration: [-1, 2],
    grdp: [3000, 25000], grdpGrowth: [0, 5], taxRevenue: [800, 8000],
    financialIndependence: [22, 48], localConsumption: [2000, 15000],
    avgLandPrice: [500, 2500], priceChangeRate: [-2, 10], aptPrice: [20000, 90000],
    aptChangeRate: [-3, 15], buildingPermits: [80, 1500],
    employmentRate: [58, 71], unemploymentRate: [2, 5.5], avgWage: [250, 370],
    jobCreation: [-500, 4000], youthEmployment: [42, 60],
    schoolCount: [30, 100], studentCount: [8000, 40000], universityCount: [0, 6],
    libraryCount: [4, 18], educationBudget: [500, 3000],
    storeCount: [4000, 16000], storeOpenRate: [4, 10], storeCloseRate: [3, 9],
    franchiseCount: [500, 2500], salesPerStore: [170, 400],
    hospitalCount: [40, 300], doctorCount: [60, 1200], bedsPerPopulation: [4, 14],
    seniorFacilities: [8, 45], daycareCenters: [40, 300],
    crimeRate: [30, 90], trafficAccidents: [150, 1300], fireIncidents: [50, 300],
    disasterDamage: [0, 12000],
    airQuality: [19, 33], greenAreaRatio: [12, 45], wasteGeneration: [150, 1800],
    waterQuality: [1.5, 2.8],
    roadDensity: [15, 32], waterSupply: [94, 100], sewerageRate: [88, 100],
    parkArea: [8, 30],
    transitScore: [58, 85], subwayStations: [0, 8], busRoutes: [20, 120],
    dailyPassengers: [20000, 200000], avgCommute: [35, 65],
    culturalFacilities: [12, 70], touristVisitors: [400, 5000], accommodations: [40, 600],
  },
  gyeonggi_rural: {
    companyCount: [800, 3000], employeeCount: [5000, 25000],
    growthRate: [-2, 3], newBizRate: [2, 6], closureRate: [3, 6],
    manufacturingRatio: [12, 35], smeRatio: [92, 99],
    population: [40000, 120000], populationGrowth: [-2, 1], agingRate: [18, 30],
    youthRatio: [12, 22], birthRate: [3, 7], foreignRatio: [3, 15], netMigration: [-2, 1],
    grdp: [1000, 5000], grdpGrowth: [-1, 4], taxRevenue: [200, 2000],
    financialIndependence: [12, 30], localConsumption: [500, 3000],
    avgLandPrice: [100, 500], priceChangeRate: [-1, 8], aptPrice: [8000, 30000],
    aptChangeRate: [-2, 10], buildingPermits: [30, 500],
    employmentRate: [58, 72], unemploymentRate: [1.5, 5], avgWage: [210, 300],
    jobCreation: [-500, 1500], youthEmployment: [38, 55],
    schoolCount: [12, 35], studentCount: [2000, 10000], universityCount: [0, 2],
    libraryCount: [2, 8], educationBudget: [150, 800],
    storeCount: [1000, 4000], storeOpenRate: [3, 8], storeCloseRate: [3, 8],
    franchiseCount: [100, 600], salesPerStore: [120, 320],
    hospitalCount: [20, 80], doctorCount: [30, 250], bedsPerPopulation: [5, 20],
    seniorFacilities: [5, 30], daycareCenters: [10, 80],
    crimeRate: [25, 70], trafficAccidents: [80, 500], fireIncidents: [30, 180],
    disasterDamage: [0, 20000],
    airQuality: [16, 30], greenAreaRatio: [40, 75], wasteGeneration: [50, 500],
    waterQuality: [1.2, 2.5],
    roadDensity: [8, 20], waterSupply: [85, 98], sewerageRate: [70, 95],
    parkArea: [12, 45],
    transitScore: [30, 55], subwayStations: [0, 2], busRoutes: [8, 40],
    dailyPassengers: [3000, 30000], avgCommute: [35, 60],
    culturalFacilities: [5, 25], touristVisitors: [200, 3000], accommodations: [20, 200],
  },
  provincial_city: {
    companyCount: [2000, 10000], employeeCount: [15000, 70000],
    growthRate: [-2, 4], newBizRate: [3, 7], closureRate: [3, 7],
    manufacturingRatio: [10, 40], smeRatio: [90, 98],
    population: [80000, 350000], populationGrowth: [-1.5, 1], agingRate: [14, 24],
    youthRatio: [14, 25], birthRate: [3, 7], foreignRatio: [1.5, 8], netMigration: [-1.5, 1],
    grdp: [2000, 18000], grdpGrowth: [-1, 5], taxRevenue: [400, 6000],
    financialIndependence: [20, 45], localConsumption: [1000, 10000],
    avgLandPrice: [200, 900], priceChangeRate: [-2, 8], aptPrice: [8000, 40000],
    aptChangeRate: [-3, 12], buildingPermits: [50, 1000],
    employmentRate: [56, 70], unemploymentRate: [2, 6], avgWage: [220, 330],
    jobCreation: [-1500, 3000], youthEmployment: [38, 58],
    schoolCount: [20, 70], studentCount: [5000, 25000], universityCount: [0, 6],
    libraryCount: [3, 15], educationBudget: [300, 2000],
    storeCount: [2000, 12000], storeOpenRate: [3, 10], storeCloseRate: [3, 10],
    franchiseCount: [200, 2000], salesPerStore: [140, 360],
    hospitalCount: [30, 250], doctorCount: [50, 800], bedsPerPopulation: [5, 18],
    seniorFacilities: [8, 50], daycareCenters: [20, 200],
    crimeRate: [25, 90], trafficAccidents: [100, 1200], fireIncidents: [40, 300],
    disasterDamage: [0, 15000],
    airQuality: [17, 33], greenAreaRatio: [15, 50], wasteGeneration: [100, 1500],
    waterQuality: [1.5, 3.0],
    roadDensity: [12, 28], waterSupply: [92, 100], sewerageRate: [85, 100],
    parkArea: [8, 30],
    transitScore: [50, 78], subwayStations: [0, 3], busRoutes: [15, 80],
    dailyPassengers: [10000, 120000], avgCommute: [20, 45],
    culturalFacilities: [10, 60], touristVisitors: [300, 8000], accommodations: [30, 500],
  },
  small_city: {
    companyCount: [1000, 5000], employeeCount: [6000, 35000],
    growthRate: [-3, 3], newBizRate: [2, 6], closureRate: [3, 7],
    manufacturingRatio: [10, 40], smeRatio: [91, 99],
    population: [30000, 150000], populationGrowth: [-2, 0.5], agingRate: [18, 30],
    youthRatio: [12, 22], birthRate: [3, 6], foreignRatio: [1, 8], netMigration: [-2, 0.5],
    grdp: [800, 8000], grdpGrowth: [-2, 4], taxRevenue: [150, 3000],
    financialIndependence: [12, 35], localConsumption: [500, 5000],
    avgLandPrice: [80, 500], priceChangeRate: [-2, 6], aptPrice: [5000, 25000],
    aptChangeRate: [-4, 10], buildingPermits: [20, 500],
    employmentRate: [55, 70], unemploymentRate: [2, 6.5], avgWage: [195, 300],
    jobCreation: [-2000, 1500], youthEmployment: [36, 55],
    schoolCount: [12, 45], studentCount: [2000, 15000], universityCount: [0, 3],
    libraryCount: [2, 10], educationBudget: [150, 1200],
    storeCount: [1000, 6000], storeOpenRate: [3, 9], storeCloseRate: [3, 10],
    franchiseCount: [80, 800], salesPerStore: [120, 320],
    hospitalCount: [20, 150], doctorCount: [30, 500], bedsPerPopulation: [5, 20],
    seniorFacilities: [5, 40], daycareCenters: [10, 120],
    crimeRate: [22, 80], trafficAccidents: [60, 800], fireIncidents: [30, 250],
    disasterDamage: [0, 25000],
    airQuality: [16, 32], greenAreaRatio: [25, 65], wasteGeneration: [60, 800],
    waterQuality: [1.2, 3.0],
    roadDensity: [8, 22], waterSupply: [85, 100], sewerageRate: [75, 100],
    parkArea: [8, 35],
    transitScore: [35, 65], subwayStations: [0, 1], busRoutes: [8, 50],
    dailyPassengers: [3000, 60000], avgCommute: [20, 45],
    culturalFacilities: [5, 35], touristVisitors: [100, 5000], accommodations: [15, 300],
  },
  rural: {
    companyCount: [500, 2500], employeeCount: [2000, 15000],
    growthRate: [-5, 2], newBizRate: [2, 5], closureRate: [3, 8],
    manufacturingRatio: [5, 30], smeRatio: [93, 99],
    population: [15000, 70000], populationGrowth: [-5, -0.5], agingRate: [28, 45],
    youthRatio: [8, 16], birthRate: [2, 5], foreignRatio: [0.5, 10], netMigration: [-5, -0.5],
    grdp: [500, 4000], grdpGrowth: [-3, 3], taxRevenue: [50, 1500],
    financialIndependence: [8, 25], localConsumption: [200, 2500],
    avgLandPrice: [5, 200], priceChangeRate: [-3, 5], aptPrice: [5000, 15000],
    aptChangeRate: [-5, 8], buildingPermits: [20, 300],
    employmentRate: [58, 75], unemploymentRate: [1.5, 5], avgWage: [180, 270],
    jobCreation: [-5000, 500], youthEmployment: [35, 52],
    schoolCount: [10, 30], studentCount: [2000, 8000], universityCount: [0, 1],
    libraryCount: [1, 6], educationBudget: [100, 600],
    storeCount: [500, 3000], storeOpenRate: [3, 8], storeCloseRate: [3, 12],
    franchiseCount: [50, 400], salesPerStore: [100, 280],
    hospitalCount: [20, 80], doctorCount: [30, 200], bedsPerPopulation: [5, 25],
    seniorFacilities: [5, 60], daycareCenters: [10, 60],
    crimeRate: [20, 60], trafficAccidents: [50, 400], fireIncidents: [30, 200],
    disasterDamage: [0, 50000],
    airQuality: [15, 28], greenAreaRatio: [50, 85], wasteGeneration: [50, 400],
    waterQuality: [1.0, 2.5],
    roadDensity: [5, 15], waterSupply: [70, 95], sewerageRate: [50, 90],
    parkArea: [15, 50],
    transitScore: [20, 50], subwayStations: [0, 0], busRoutes: [5, 25],
    dailyPassengers: [1000, 15000], avgCommute: [20, 40],
    culturalFacilities: [5, 20], touristVisitors: [50, 5000], accommodations: [10, 300],
  },
};

// ---------------------------------------------------------------------------
// Industry distribution profiles by region type
// ---------------------------------------------------------------------------
function generateIndustryDistribution(regionType, name) {
  let base;
  switch (regionType) {
    case "seoul_gangnam":
      base = { manufacturing: 4, it: 22, services: 18, construction: 5, wholesale: 8, logistics: 5, finance: 18, education: 10, healthcare: 6, other: 4 };
      break;
    case "seoul":
      base = { manufacturing: 8, it: 14, services: 15, construction: 6, wholesale: 10, logistics: 8, finance: 12, education: 10, healthcare: 8, other: 9 };
      break;
    case "metro":
      base = { manufacturing: 16, it: 8, services: 14, construction: 7, wholesale: 10, logistics: 10, finance: 8, education: 9, healthcare: 9, other: 9 };
      break;
    case "metro_suburban":
      base = { manufacturing: 25, it: 5, services: 12, construction: 8, wholesale: 8, logistics: 12, finance: 5, education: 8, healthcare: 7, other: 10 };
      break;
    case "sejong":
      base = { manufacturing: 10, it: 8, services: 18, construction: 10, wholesale: 6, logistics: 6, finance: 8, education: 15, healthcare: 10, other: 9 };
      break;
    case "gyeonggi_affluent":
      base = { manufacturing: 8, it: 18, services: 16, construction: 6, wholesale: 9, logistics: 7, finance: 12, education: 11, healthcare: 7, other: 6 };
      break;
    case "gyeonggi_growing":
      base = { manufacturing: 22, it: 10, services: 13, construction: 8, wholesale: 8, logistics: 10, finance: 5, education: 8, healthcare: 7, other: 9 };
      break;
    case "gyeonggi":
      base = { manufacturing: 20, it: 8, services: 13, construction: 7, wholesale: 9, logistics: 12, finance: 6, education: 8, healthcare: 8, other: 9 };
      break;
    case "gyeonggi_rural":
      base = { manufacturing: 18, it: 3, services: 10, construction: 8, wholesale: 6, logistics: 8, finance: 3, education: 7, healthcare: 6, other: 31 };
      break;
    case "provincial_city":
      base = { manufacturing: 22, it: 6, services: 13, construction: 7, wholesale: 9, logistics: 9, finance: 6, education: 10, healthcare: 10, other: 8 };
      break;
    case "small_city":
      base = { manufacturing: 25, it: 3, services: 11, construction: 7, wholesale: 8, logistics: 8, finance: 4, education: 8, healthcare: 9, other: 17 };
      break;
    case "rural":
      base = { manufacturing: 15, it: 2, services: 8, construction: 6, wholesale: 5, logistics: 5, finance: 2, education: 5, healthcare: 8, other: 44 };
      break;
    default:
      base = { manufacturing: 18, it: 5, services: 12, construction: 7, wholesale: 8, logistics: 8, finance: 5, education: 8, healthcare: 8, other: 21 };
  }

  // Special cases based on name
  if (name.includes("구미") || name.includes("창원") || name.includes("울산")) {
    base.manufacturing += 10; base.other -= 5; base.services -= 5;
  }
  if (name.includes("대덕") || name.includes("유성")) {
    base.it += 8; base.manufacturing -= 4; base.other -= 4;
  }
  // Tourism areas
  if (name.includes("제주") || name.includes("서귀포") || name.includes("속초") || name.includes("강릉") || name.includes("경주")) {
    base.services += 8; base.other += 5; base.manufacturing -= 8; base.it -= 5;
  }

  // Add randomness
  const keys = Object.keys(base);
  keys.forEach(k => { base[k] = Math.max(0.5, base[k] + randRange(-3, 3)); });

  // Normalize to ~100
  const sum = keys.reduce((s, k) => s + base[k], 0);
  keys.forEach(k => { base[k] = +(base[k] / sum * 100).toFixed(1); });

  // Fix rounding error on 'other'
  const actualSum = keys.reduce((s, k) => s + base[k], 0);
  base.other = +(base.other + (100 - actualSum)).toFixed(1);

  return base;
}

// ---------------------------------------------------------------------------
// Health score calculation (composite)
// ---------------------------------------------------------------------------
function calculateHealthScore(r) {
  // Normalize factors to 0-100 scale
  const growthFactor = clamp((r.growthRate + 5) / 13 * 100, 0, 100); // -5..8 -> 0..100
  const employmentFactor = clamp((r.employmentRate - 50) / 25 * 100, 0, 100); // 50..75 -> 0..100
  const youthFactor = clamp((r.youthRatio - 8) / 27 * 100, 0, 100); // 8..35 -> 0..100
  const infraFactor = clamp((r.waterSupply + r.sewerageRate + r.roadDensity * 2) / 250 * 100, 0, 100);
  const transitFactor = clamp(r.transitScore, 0, 100);
  const newBizFactor = clamp((r.newBizRate - 2) / 6 * 100, 0, 100);
  const agingPenalty = clamp((r.agingRate - 10) / 35 * 50, 0, 50); // high aging = penalty

  const score = (
    growthFactor * 0.20 +
    employmentFactor * 0.20 +
    youthFactor * 0.15 +
    infraFactor * 0.15 +
    transitFactor * 0.10 +
    newBizFactor * 0.10 -
    agingPenalty * 0.20
  );

  // Add a bit of noise
  return +clamp(score + randRange(-3, 3), 25, 95).toFixed(1);
}

// ---------------------------------------------------------------------------
// Generate value from profile range
// ---------------------------------------------------------------------------
function genVal(profile, key, decimals) {
  const range = profile[key];
  if (!range) return 0;
  const val = randRange(range[0], range[1]);
  if (decimals === undefined) {
    // Integer fields
    return Math.round(val);
  }
  return +val.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Historical trend multipliers (2000-2025, relative to 2025=1.0)
// ---------------------------------------------------------------------------
function trendMultiplier(metric, year, regionType) {
  const t = (year - 2000) / 25; // 0..1
  const isUrban = ["seoul", "seoul_gangnam", "metro", "gyeonggi", "gyeonggi_affluent", "gyeonggi_growing", "sejong"].includes(regionType);
  const isRural = ["rural", "gyeonggi_rural"].includes(regionType);
  const isSejong = regionType === "sejong";

  switch (metric) {
    case "population": {
      if (isSejong) return Math.max(0.05, 0.05 + 0.95 * Math.pow(t, 1.2)); // Sejong barely existed before 2012
      if (isUrban) return 0.90 + 0.10 * t + 0.02 * Math.sin(t * Math.PI);
      if (isRural) return 1.30 - 0.30 * t; // rural decline ~30% over 25 yrs
      return 1.10 - 0.10 * t; // small cities slight decline
    }
    case "agingRate": {
      // Korea aging rate roughly doubled 2000-2025
      if (isRural) return 0.55 + 0.45 * t; // already high base, still growing
      return 0.40 + 0.60 * t; // metro areas aging faster proportionally
    }
    case "avgLandPrice": {
      // Strong upward trend with cycles
      const base = 0.25 + 0.75 * Math.pow(t, 0.65);
      const dip2003 = year >= 2002 && year <= 2004 ? -0.03 * (1 - Math.abs(year - 2003) / 2) : 0;
      const dip2008 = year >= 2007 && year <= 2010 ? -0.10 * (1 - Math.abs(year - 2009) / 2.5) : 0;
      const boom2020 = year >= 2019 && year <= 2022 ? 0.08 * (1 - Math.abs(year - 2021) / 3) : 0;
      return Math.max(0.2, base + dip2003 + dip2008 + boom2020);
    }
    case "aptPrice": {
      const base = 0.20 + 0.80 * Math.pow(t, 0.6);
      const dip2008 = year >= 2007 && year <= 2010 ? -0.08 * (1 - Math.abs(year - 2009) / 2.5) : 0;
      const boom2020 = year >= 2019 && year <= 2022 ? 0.12 * (1 - Math.abs(year - 2021) / 3) : 0;
      const cool2023 = year >= 2022 && year <= 2024 ? -0.05 * (1 - Math.abs(year - 2023) / 2) : 0;
      return Math.max(0.15, base + dip2008 + boom2020 + cool2023);
    }
    case "employmentRate": {
      const base = 0.94 + 0.06 * t;
      const dip2003 = year === 2003 ? -0.02 : 0;
      const dip2009 = year === 2009 ? -0.03 : year === 2010 ? -0.01 : 0;
      const covid = year === 2020 ? -0.04 : year === 2021 ? -0.02 : 0;
      return clamp(base + dip2003 + dip2009 + covid, 0.85, 1.06);
    }
    case "healthScore": {
      return 0.70 + 0.30 * t; // gradual improvement
    }
    case "companyCount": {
      const base = 0.50 + 0.50 * t;
      const covid = year === 2020 ? -0.03 : 0;
      return Math.max(0.4, base + covid);
    }
    case "employeeCount": {
      const base = 0.55 + 0.45 * t;
      const dip2009 = year === 2009 ? -0.03 : 0;
      const covid = year === 2020 ? -0.04 : year === 2021 ? -0.02 : 0;
      return Math.max(0.45, base + dip2009 + covid);
    }
    case "storeCount": {
      const base = 0.60 + 0.40 * t;
      const covid = year === 2020 ? -0.06 : year === 2021 ? -0.04 : 0;
      return Math.max(0.45, base + covid);
    }
    case "transitScore": {
      return 0.60 + 0.40 * t; // infrastructure steadily improving
    }
    case "schoolCount": {
      // Peak around 2010-2015, then declining (consolidation due to low birth rate)
      const peak = 0.85 + 0.30 * Math.sin(t * Math.PI * 0.9);
      return clamp(peak, 0.80, 1.10);
    }
    case "grdp": {
      const base = 0.40 + 0.60 * Math.pow(t, 0.7);
      const dip2009 = year === 2009 ? -0.05 : 0;
      const covid = year === 2020 ? -0.03 : 0;
      return Math.max(0.3, base + dip2009 + covid);
    }
    case "taxRevenue": {
      return 0.35 + 0.65 * Math.pow(t, 0.75);
    }
    case "financialIndependence": {
      // Has been relatively stable or slightly declining for rural, improving for metro
      if (isUrban) return 0.85 + 0.15 * t;
      return 1.05 - 0.05 * t; // rural areas slightly declining
    }
    case "birthRate": {
      // Korea's dramatic decline: ~10‰ in 2000 -> ~5‰ in 2025 (halved)
      return 2.0 - 1.0 * t; // multiplier goes from 2.0 to 1.0
    }
    case "foreignRatio": {
      // Rapidly increasing, especially in industrial/rural areas
      return 0.15 + 0.85 * Math.pow(t, 0.6);
    }
    case "hospitalCount": {
      return 0.65 + 0.35 * t;
    }
    case "crimeRate": {
      // Generally declining trend in Korea
      return 1.25 - 0.25 * t;
    }
    case "airQuality": {
      // PM2.5: was worse in mid-period, improving recently
      const base = 0.90 + 0.20 * Math.sin(t * Math.PI * 0.8);
      return clamp(base, 0.85, 1.15);
    }
    case "avgWage": {
      return 0.45 + 0.55 * Math.pow(t, 0.7);
    }
    default:
      return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Generate current-year (2025) data for all 250 regions
// ---------------------------------------------------------------------------
const regions = existing.map((r) => {
  const regionType = classifyRegion(r.code, r.name);
  const profile = PROFILES[regionType] || PROFILES.small_city;

  // ---- Industry ----
  const companyCount = genVal(profile, "companyCount");
  const employeeCount = genVal(profile, "employeeCount");
  const growthRate = genVal(profile, "growthRate", 1);
  const newBizRate = genVal(profile, "newBizRate", 1);
  const closureRate = genVal(profile, "closureRate", 1);
  const manufacturingRatio = genVal(profile, "manufacturingRatio", 1);
  const smeRatio = genVal(profile, "smeRatio", 1);

  // ---- Population ----
  const population = genVal(profile, "population");
  const populationGrowth = genVal(profile, "populationGrowth", 1);
  const agingRate = genVal(profile, "agingRate", 1);
  const youthRatio = genVal(profile, "youthRatio", 1);
  const birthRate = genVal(profile, "birthRate", 1);
  const foreignRatio = genVal(profile, "foreignRatio", 1);
  const netMigration = genVal(profile, "netMigration", 1);

  // ---- Economy ----
  const grdp = genVal(profile, "grdp");
  const grdpGrowth = genVal(profile, "grdpGrowth", 1);
  const taxRevenue = genVal(profile, "taxRevenue");
  const financialIndependence = genVal(profile, "financialIndependence", 1);
  const localConsumption = genVal(profile, "localConsumption");

  // ---- Real Estate ----
  const avgLandPrice = genVal(profile, "avgLandPrice");
  const priceChangeRate = genVal(profile, "priceChangeRate", 1);
  const aptPrice = genVal(profile, "aptPrice");
  const aptChangeRate = genVal(profile, "aptChangeRate", 1);
  const buildingPermits = genVal(profile, "buildingPermits");

  // ---- Employment ----
  const employmentRate = genVal(profile, "employmentRate", 1);
  const unemploymentRate = genVal(profile, "unemploymentRate", 1);
  const avgWage = genVal(profile, "avgWage");
  const jobCreation = genVal(profile, "jobCreation");
  const youthEmployment = genVal(profile, "youthEmployment", 1);

  // ---- Education ----
  const schoolCount = genVal(profile, "schoolCount");
  const studentCount = genVal(profile, "studentCount");
  const universityCount = genVal(profile, "universityCount");
  const libraryCount = genVal(profile, "libraryCount");
  const educationBudget = genVal(profile, "educationBudget");

  // ---- Commercial ----
  const storeCount = genVal(profile, "storeCount");
  const storeOpenRate = genVal(profile, "storeOpenRate", 1);
  const storeCloseRate = genVal(profile, "storeCloseRate", 1);
  const franchiseCount = genVal(profile, "franchiseCount");
  const salesPerStore = genVal(profile, "salesPerStore");

  // ---- Healthcare ----
  const hospitalCount = genVal(profile, "hospitalCount");
  const doctorCount = genVal(profile, "doctorCount");
  const bedsPerPopulation = genVal(profile, "bedsPerPopulation", 1);
  const seniorFacilities = genVal(profile, "seniorFacilities");
  const daycareCenters = genVal(profile, "daycareCenters");

  // ---- Safety ----
  const crimeRate = genVal(profile, "crimeRate", 1);
  const trafficAccidents = genVal(profile, "trafficAccidents");
  const fireIncidents = genVal(profile, "fireIncidents");
  const disasterDamage = genVal(profile, "disasterDamage");

  // ---- Environment ----
  const airQuality = genVal(profile, "airQuality", 1);
  const greenAreaRatio = genVal(profile, "greenAreaRatio", 1);
  const wasteGeneration = genVal(profile, "wasteGeneration");
  const waterQuality = genVal(profile, "waterQuality", 1);

  // ---- Infrastructure ----
  const roadDensity = genVal(profile, "roadDensity", 1);
  const waterSupply = genVal(profile, "waterSupply", 1);
  const sewerageRate = genVal(profile, "sewerageRate", 1);
  const parkArea = genVal(profile, "parkArea", 1);

  // ---- Transportation ----
  const transitScore = genVal(profile, "transitScore", 1);
  const subwayStations = genVal(profile, "subwayStations");
  const busRoutes = genVal(profile, "busRoutes");
  const dailyPassengers = genVal(profile, "dailyPassengers");
  const avgCommute = genVal(profile, "avgCommute");

  // ---- Culture ----
  const culturalFacilities = genVal(profile, "culturalFacilities");
  const touristVisitors = genVal(profile, "touristVisitors");
  const accommodations = genVal(profile, "accommodations");

  // ---- Industry Distribution ----
  const industryDistribution = generateIndustryDistribution(regionType, r.name);

  // Build region object (without healthScore yet)
  const region = {
    code: r.code,
    name: r.name,
    province: r.province,
    // Industry
    companyCount, employeeCount, healthScore: 0, growthRate, newBizRate, closureRate,
    manufacturingRatio, smeRatio,
    // Population
    population, populationGrowth, agingRate, youthRatio, birthRate, foreignRatio, netMigration,
    // Economy
    grdp, grdpGrowth, taxRevenue, financialIndependence, localConsumption,
    // Real Estate
    avgLandPrice, priceChangeRate, aptPrice, aptChangeRate, buildingPermits,
    // Employment
    employmentRate, unemploymentRate, avgWage, jobCreation, youthEmployment,
    // Education
    schoolCount, studentCount, universityCount, libraryCount, educationBudget,
    // Commercial
    storeCount, storeOpenRate, storeCloseRate, franchiseCount, salesPerStore,
    // Healthcare
    hospitalCount, doctorCount, bedsPerPopulation, seniorFacilities, daycareCenters,
    // Safety
    crimeRate, trafficAccidents, fireIncidents, disasterDamage,
    // Environment
    airQuality, greenAreaRatio, wasteGeneration, waterQuality,
    // Infrastructure
    roadDensity, waterSupply, sewerageRate, parkArea,
    // Transportation
    transitScore, subwayStations, busRoutes, dailyPassengers, avgCommute,
    // Culture
    culturalFacilities, touristVisitors, accommodations,
    // Distribution
    industryDistribution,
  };

  // Calculate composite health score
  region.healthScore = calculateHealthScore(region);

  return region;
});

// ---------------------------------------------------------------------------
// Generate historical data (2000-2025, 26 years)
// ---------------------------------------------------------------------------
const START_YEAR = 2000;
const END_YEAR = 2025;
const HIST_KEYS = [
  "healthScore", "companyCount", "employeeCount", "population",
  "agingRate", "avgLandPrice", "employmentRate", "storeCount",
  "transitScore", "schoolCount", "grdp", "taxRevenue",
  "financialIndependence", "birthRate", "foreignRatio", "hospitalCount",
  "crimeRate", "airQuality", "aptPrice", "avgWage",
];

// Fields that should be rounded to 1 decimal (rates/scores/quality)
const DECIMAL_FIELDS = new Set([
  "healthScore", "agingRate", "employmentRate", "transitScore",
  "financialIndependence", "birthRate", "foreignRatio",
  "crimeRate", "airQuality",
]);

const historical = {
  startYear: START_YEAR,
  endYear: END_YEAR,
  keys: HIST_KEYS,
  data: {},
};

for (const r of regions) {
  const regionType = classifyRegion(r.code, r.name);
  const years = [];

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const yearData = {};

    for (const key of HIST_KEYS) {
      const current = r[key];
      if (current === undefined || current === null) continue;

      const mult = trendMultiplier(key, year, regionType);
      const noise = 1 + randRange(-0.025, 0.025); // 2.5% noise
      let val = current * mult * noise;

      // Domain constraints
      if (key === "agingRate") val = clamp(val, 3, 48);
      if (key === "employmentRate") val = clamp(val, 40, 78);
      if (key === "healthScore") val = clamp(val, 15, 98);
      if (key === "transitScore") val = clamp(val, 5, 99);
      if (key === "financialIndependence") val = clamp(val, 5, 70);
      if (key === "birthRate") val = clamp(val, 2, 20);
      if (key === "foreignRatio") val = clamp(val, 0.1, 18);
      if (key === "crimeRate") val = clamp(val, 10, 150);
      if (key === "airQuality") val = clamp(val, 12, 50);

      // Round
      if (DECIMAL_FIELDS.has(key)) {
        yearData[key] = +val.toFixed(1);
      } else {
        yearData[key] = Math.round(val);
      }
    }

    years.push(yearData);
  }
  historical.data[r.code] = years;
}

// ---------------------------------------------------------------------------
// Write output files
// ---------------------------------------------------------------------------
writeFileSync(
  join(DATA_DIR, "sample-regions.json"),
  JSON.stringify(regions, null, 0),
  "utf-8"
);

const regionSize = JSON.stringify(regions).length;
console.log(`Written sample-regions.json: ${regions.length} regions, ${(regionSize / 1024).toFixed(0)}KB`);

// Count data fields (excluding code, name, province, industryDistribution)
const dataFieldCount = Object.keys(regions[0]).filter(
  k => !["code", "name", "province", "industryDistribution"].includes(k)
).length;
console.log(`  Data layers: ${dataFieldCount} fields per region`);
console.log(`  Industry distribution: 10 sectors`);

writeFileSync(
  join(DATA_DIR, "sample-historical.json"),
  JSON.stringify(historical, null, 0),
  "utf-8"
);

const histSize = JSON.stringify(historical).length;
console.log(`Written sample-historical.json: ${Object.keys(historical.data).length} regions x ${END_YEAR - START_YEAR + 1} years (${START_YEAR}-${END_YEAR}), ${(histSize / 1024).toFixed(0)}KB`);
console.log(`  Time-series metrics: ${HIST_KEYS.length}`);

// Sanity checks
console.log("\n--- Sanity Checks ---");
const seoul = regions.find(r => r.code === "11230"); // Gangnam
const rural = regions.find(r => r.code === "35320"); // Jinan-gun
const sejong = regions.find(r => r.code === "29010");

if (seoul) {
  console.log(`Gangnam (11230): pop=${seoul.population}, aging=${seoul.agingRate}%, aptPrice=${seoul.aptPrice}만원, transit=${seoul.transitScore}, health=${seoul.healthScore}`);
}
if (rural) {
  console.log(`Jinan (35320): pop=${rural.population}, aging=${rural.agingRate}%, aptPrice=${rural.aptPrice}만원, transit=${rural.transitScore}, health=${rural.healthScore}`);
}
if (sejong) {
  console.log(`Sejong (29010): pop=${sejong.population}, aging=${sejong.agingRate}%, popGrowth=${sejong.populationGrowth}%, health=${sejong.healthScore}`);
}

// Check historical trend direction for a Seoul district
const seoulHist = historical.data["11230"];
if (seoulHist) {
  const first = seoulHist[0];
  const last = seoulHist[seoulHist.length - 1];
  console.log(`\nGangnam historical (2000 vs 2025):`);
  console.log(`  Population: ${first.population} -> ${last.population}`);
  console.log(`  Aging: ${first.agingRate}% -> ${last.agingRate}%`);
  console.log(`  Land price: ${first.avgLandPrice} -> ${last.avgLandPrice}`);
  console.log(`  Apt price: ${first.aptPrice} -> ${last.aptPrice}`);
  console.log(`  Birth rate: ${first.birthRate}‰ -> ${last.birthRate}‰`);
}

// Check a rural area
const ruralHist = historical.data["35320"];
if (ruralHist) {
  const first = ruralHist[0];
  const last = ruralHist[ruralHist.length - 1];
  console.log(`\nJinan historical (2000 vs 2025):`);
  console.log(`  Population: ${first.population} -> ${last.population}`);
  console.log(`  Aging: ${first.agingRate}% -> ${last.agingRate}%`);
  console.log(`  Companies: ${first.companyCount} -> ${last.companyCount}`);
}

console.log("\nDone.");
