/**
 * Fallback simulated data generator.
 * Extracted from generate-sample-data.js for use when API calls fail.
 * Uses seeded random for reproducibility.
 */

// Seeded PRNG (same as generate-sample-data.js)
let seed = 42;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 1) {
  return parseFloat((random() * (max - min) + min).toFixed(decimals));
}

// Province-based base parameters (for realistic ranges)
function getBaseParams(provincePrefix) {
  const c = provincePrefix;
  if (c === "11") return { compBase: [8000, 25000], empBase: [30000, 150000], healthBase: [60, 92], popBase: [100000, 600000] };
  if (c === "31") return { compBase: [3000, 18000], empBase: [15000, 100000], healthBase: [50, 88], popBase: [100000, 1200000] };
  if (["21","22","23","24","25","26"].includes(c))
    return { compBase: [2000, 12000], empBase: [10000, 70000], healthBase: [45, 85], popBase: [50000, 500000] };
  if (c === "29") return { compBase: [3000, 8000], empBase: [15000, 40000], healthBase: [70, 90], popBase: [100000, 400000] };
  return { compBase: [300, 6000], empBase: [2000, 30000], healthBase: [30, 75], popBase: [20000, 300000] };
}

function generateIndustryDist() {
  const sectors = ["manufacturing","it","services","construction","wholesale","logistics","finance","education","healthcare","other"];
  const weights = sectors.map(() => random());
  const total = weights.reduce((a, b) => a + b, 0);
  const dist = {};
  sectors.forEach((s, i) => { dist[s] = parseFloat(((weights[i] / total) * 100).toFixed(1)); });
  return dist;
}

/**
 * Generate a complete set of fallback values for a region.
 * Call this ONCE per region to maintain seed consistency.
 */
function generateFallbackRegion(code, name, province) {
  const prefix = code.substring(0, 2);
  const params = getBaseParams(prefix);

  const companyCount = randInt(...params.compBase);
  const employeeCount = randInt(...params.empBase);
  const population = randInt(...params.popBase);

  return {
    code, name, province,
    // Industry
    companyCount,
    employeeCount,
    healthScore: randFloat(...params.healthBase),
    growthRate: randFloat(-5, 8),
    newBizRate: randFloat(2, 12),
    closureRate: randFloat(1, 8),
    manufacturingRatio: randFloat(5, 45),
    smeRatio: randFloat(70, 99),
    industryDistribution: generateIndustryDist(),
    // Population
    population,
    populationGrowth: randFloat(-3, 3),
    agingRate: randFloat(5, 40),
    youthRatio: randFloat(10, 35),
    birthRate: randFloat(3, 12),
    foreignRatio: randFloat(0.5, 10),
    netMigration: randFloat(-5, 5),
    // Economy
    grdp: randInt(500, 50000),
    grdpGrowth: randFloat(-3, 8),
    taxRevenue: randInt(100, 20000),
    financialIndependence: randFloat(10, 80),
    localConsumption: randInt(100, 30000),
    // Real Estate
    avgLandPrice: randInt(10, 5000),
    priceChangeRate: randFloat(-5, 10),
    aptPrice: randInt(5000, 250000),
    aptChangeRate: randFloat(-5, 15),
    buildingPermits: randInt(50, 5000),
    // Employment
    employmentRate: randFloat(50, 72),
    unemploymentRate: randFloat(1.5, 8),
    avgWage: randInt(180, 450),
    jobCreation: randInt(-5000, 10000),
    youthEmployment: randFloat(30, 60),
    // Education
    schoolCount: randInt(10, 300),
    studentCount: randInt(1000, 150000),
    universityCount: randInt(0, 15),
    libraryCount: randInt(1, 30),
    educationBudget: randInt(100, 5000),
    // Commercial
    storeCount: randInt(500, 30000),
    storeOpenRate: randFloat(5, 18),
    storeCloseRate: randFloat(3, 15),
    franchiseCount: randInt(50, 5000),
    salesPerStore: randInt(50, 500),
    // Healthcare
    hospitalCount: randInt(10, 800),
    doctorCount: randInt(20, 5000),
    bedsPerPopulation: randFloat(2, 20),
    seniorFacilities: randInt(5, 200),
    daycareCenters: randInt(10, 500),
    // Safety
    crimeRate: randFloat(10, 80),
    trafficAccidents: randInt(100, 5000),
    fireIncidents: randInt(50, 1500),
    disasterDamage: randInt(0, 50000),
    // Environment
    airQuality: randFloat(15, 40),
    greenAreaRatio: randFloat(5, 70),
    wasteGeneration: randFloat(50, 3000),
    waterQuality: randFloat(1, 4, 1),
    // Infrastructure
    roadDensity: randFloat(5, 35),
    waterSupply: randFloat(70, 100),
    sewerageRate: randFloat(50, 100),
    parkArea: randFloat(3, 50),
    // Transportation
    transitScore: randFloat(10, 95),
    subwayStations: prefix === "11" || prefix === "31" ? randInt(1, 30) : randInt(0, 5),
    busRoutes: randInt(5, 200),
    dailyPassengers: randInt(1000, 500000),
    avgCommute: randFloat(20, 70),
    // Culture
    culturalFacilities: randInt(5, 200),
    touristVisitors: randInt(10, 10000),
    accommodations: randInt(10, 1000),
  };
}

/**
 * Reset the seed (call before generating a full set of fallbacks to ensure reproducibility).
 */
function resetSeed(s = 42) {
  seed = s;
}

/**
 * Generate a single field's fallback value given existing context.
 */
function generateFallbackField(fieldName, provincePrefix) {
  const params = getBaseParams(provincePrefix);
  const FIELD_RANGES = {
    companyCount: () => randInt(...params.compBase),
    employeeCount: () => randInt(...params.empBase),
    healthScore: () => randFloat(...params.healthBase),
    growthRate: () => randFloat(-5, 8),
    newBizRate: () => randFloat(2, 12),
    closureRate: () => randFloat(1, 8),
    manufacturingRatio: () => randFloat(5, 45),
    smeRatio: () => randFloat(70, 99),
    population: () => randInt(...params.popBase),
    populationGrowth: () => randFloat(-3, 3),
    agingRate: () => randFloat(5, 40),
    youthRatio: () => randFloat(10, 35),
    birthRate: () => randFloat(3, 12),
    foreignRatio: () => randFloat(0.5, 10),
    netMigration: () => randFloat(-5, 5),
    grdp: () => randInt(500, 50000),
    grdpGrowth: () => randFloat(-3, 8),
    taxRevenue: () => randInt(100, 20000),
    financialIndependence: () => randFloat(10, 80),
    localConsumption: () => randInt(100, 30000),
    avgLandPrice: () => randInt(10, 5000),
    priceChangeRate: () => randFloat(-5, 10),
    aptPrice: () => randInt(5000, 250000),
    aptChangeRate: () => randFloat(-5, 15),
    buildingPermits: () => randInt(50, 5000),
    employmentRate: () => randFloat(50, 72),
    unemploymentRate: () => randFloat(1.5, 8),
    avgWage: () => randInt(180, 450),
    jobCreation: () => randInt(-5000, 10000),
    youthEmployment: () => randFloat(30, 60),
    schoolCount: () => randInt(10, 300),
    studentCount: () => randInt(1000, 150000),
    universityCount: () => randInt(0, 15),
    libraryCount: () => randInt(1, 30),
    educationBudget: () => randInt(100, 5000),
    storeCount: () => randInt(500, 30000),
    storeOpenRate: () => randFloat(5, 18),
    storeCloseRate: () => randFloat(3, 15),
    franchiseCount: () => randInt(50, 5000),
    salesPerStore: () => randInt(50, 500),
    hospitalCount: () => randInt(10, 800),
    doctorCount: () => randInt(20, 5000),
    bedsPerPopulation: () => randFloat(2, 20),
    seniorFacilities: () => randInt(5, 200),
    daycareCenters: () => randInt(10, 500),
    crimeRate: () => randFloat(10, 80),
    trafficAccidents: () => randInt(100, 5000),
    fireIncidents: () => randInt(50, 1500),
    disasterDamage: () => randInt(0, 50000),
    airQuality: () => randFloat(15, 40),
    greenAreaRatio: () => randFloat(5, 70),
    wasteGeneration: () => randFloat(50, 3000),
    waterQuality: () => randFloat(1, 4, 1),
    roadDensity: () => randFloat(5, 35),
    waterSupply: () => randFloat(70, 100),
    sewerageRate: () => randFloat(50, 100),
    parkArea: () => randFloat(3, 50),
    transitScore: () => randFloat(10, 95),
    subwayStations: () => randInt(0, 10),
    busRoutes: () => randInt(5, 200),
    dailyPassengers: () => randInt(1000, 500000),
    avgCommute: () => randFloat(20, 70),
    culturalFacilities: () => randInt(5, 200),
    touristVisitors: () => randInt(10, 10000),
    accommodations: () => randInt(10, 1000),
  };

  const gen = FIELD_RANGES[fieldName];
  return gen ? gen() : 0;
}

module.exports = { generateFallbackRegion, generateFallbackField, resetSeed };
