#!/usr/bin/env node
/**
 * KIEP Real Data Fetcher
 * Fetches real 시군구 statistics from KOSIS, R-ONE, data.go.kr, ECOS APIs
 * and generates sample-regions.json and sample-historical.json.
 *
 * Usage:
 *   node scripts/fetch-real-data.js              # Fetch fresh data
 *   node scripts/fetch-real-data.js --use-cache   # Use cached API responses
 *   node scripts/fetch-real-data.js --clear-cache  # Clear cache and fetch fresh
 *   node scripts/fetch-real-data.js --year 2023    # Specify target year
 */
const fs = require("fs");
const path = require("path");

// Load config (which loads .env.local)
const { REGIONS, API_KEYS } = require("./lib/config");
const { clearCache } = require("./lib/cache");
const { generateFallbackRegion, resetSeed } = require("./lib/fallback");
const { fetchAllKosisData, fetchKosisHistorical, HISTORICAL_FIELD_MAP } = require("./api/kosis");
const { fetchAllRoneData } = require("./api/rone");
const { fetchAllDatagokrData } = require("./api/datagokr");
const { fetchAllEcosData } = require("./api/ecos");

// ── CLI Args ──
const args = process.argv.slice(2);
const useCache = args.includes("--use-cache");
const doClearCache = args.includes("--clear-cache");
const yearIdx = args.indexOf("--year");
const TARGET_YEAR = yearIdx >= 0 ? parseInt(args[yearIdx + 1]) : 2023;
const HISTORICAL_START = 2000;
const HISTORICAL_END = 2025;

// Set cache preference globally via env
if (!useCache) {
  // Will fetch fresh (but still save to cache)
}
if (doClearCache) {
  clearCache();
  console.log("Cache cleared.");
}

// ── All 62 numeric fields (excluding code/name/province/industryDistribution) ──
const ALL_FIELDS = [
  // Industry
  "companyCount", "employeeCount", "healthScore", "growthRate",
  "newBizRate", "closureRate", "manufacturingRatio", "smeRatio",
  // Population
  "population", "populationGrowth", "agingRate", "youthRatio",
  "birthRate", "foreignRatio", "netMigration",
  // Economy
  "grdp", "grdpGrowth", "taxRevenue", "financialIndependence", "localConsumption",
  // Real Estate
  "avgLandPrice", "priceChangeRate", "aptPrice", "aptChangeRate", "buildingPermits",
  // Employment
  "employmentRate", "unemploymentRate", "avgWage", "jobCreation", "youthEmployment",
  // Education
  "schoolCount", "studentCount", "universityCount", "libraryCount", "educationBudget",
  // Commercial
  "storeCount", "storeOpenRate", "storeCloseRate", "franchiseCount", "salesPerStore",
  // Healthcare
  "hospitalCount", "doctorCount", "bedsPerPopulation", "seniorFacilities", "daycareCenters",
  // Safety
  "crimeRate", "trafficAccidents", "fireIncidents", "disasterDamage",
  // Environment
  "airQuality", "greenAreaRatio", "wasteGeneration", "waterQuality",
  // Infrastructure
  "roadDensity", "waterSupply", "sewerageRate", "parkArea",
  // Transportation
  "transitScore", "subwayStations", "busRoutes", "dailyPassengers", "avgCommute",
  // Culture
  "culturalFacilities", "touristVisitors", "accommodations",
];

// Historical data uses these 20 key metrics
const HISTORICAL_KEYS = [
  "healthScore", "companyCount", "employeeCount", "population", "agingRate",
  "avgLandPrice", "employmentRate", "storeCount", "transitScore", "schoolCount",
  "grdp", "taxRevenue", "financialIndependence", "birthRate", "foreignRatio",
  "hospitalCount", "crimeRate", "airQuality", "aptPrice", "avgWage",
];

/**
 * Compute derived fields from base data.
 */
function computeDerivedFields(region, prevYearData) {
  // Population growth (YoY)
  if (prevYearData?.population && region.population) {
    region.populationGrowth = parseFloat(
      (((region.population - prevYearData.population) / prevYearData.population) * 100).toFixed(2)
    );
  }

  // GRDP growth (YoY)
  if (prevYearData?.grdp && region.grdp) {
    region.grdpGrowth = parseFloat(
      (((region.grdp - prevYearData.grdp) / prevYearData.grdp) * 100).toFixed(2)
    );
  }

  // Business growth rate (YoY)
  if (prevYearData?.companyCount && region.companyCount) {
    region.growthRate = parseFloat(
      (((region.companyCount - prevYearData.companyCount) / prevYearData.companyCount) * 100).toFixed(2)
    );
  }

  // Job creation (YoY)
  if (prevYearData?.employeeCount && region.employeeCount) {
    region.jobCreation = region.employeeCount - prevYearData.employeeCount;
  }

  // Beds per population
  if (region.hospitalCount && region.population) {
    // Estimate ~50 beds per hospital on average
    if (!region.bedsPerPopulation || region.bedsPerPopulation === 0) {
      region.bedsPerPopulation = parseFloat(
        ((region.hospitalCount * 50) / (region.population / 1000)).toFixed(1)
      );
    }
  }

  // Health score: weighted composite of ~10 indicators
  computeHealthScore(region);

  return region;
}

/**
 * Compute healthScore as weighted composite.
 */
function computeHealthScore(r) {
  const normalize = (val, min, max) => Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

  let score = 50; // default
  let weights = 0;

  const addWeight = (val, min, max, weight, inverse = false) => {
    if (val !== undefined && val !== null && !isNaN(val)) {
      const norm = normalize(val, min, max);
      score += (inverse ? 100 - norm : norm) * weight;
      weights += weight;
    }
  };

  score = 0;
  addWeight(r.employmentRate, 40, 75, 0.15);
  addWeight(r.grdpGrowth, -5, 10, 0.12);
  addWeight(r.financialIndependence, 10, 80, 0.10);
  addWeight(r.closureRate, 0, 15, 0.10, true);  // inverse: lower is better
  addWeight(r.newBizRate, 0, 15, 0.08);
  addWeight(r.agingRate, 5, 40, 0.08, true);     // inverse: lower is better
  addWeight(r.youthRatio, 10, 35, 0.08);
  addWeight(r.unemploymentRate, 0, 10, 0.08, true);
  addWeight(r.manufacturingRatio, 0, 50, 0.06);
  addWeight(r.avgWage, 150, 500, 0.08);
  addWeight(r.population, 20000, 1000000, 0.07);

  if (weights > 0) {
    r.healthScore = parseFloat((score / weights).toFixed(1));
  }
}

/**
 * Generate industry distribution from company count and manufacturing ratio.
 */
function generateIndustryDistribution(region) {
  // If we have real manufacturingRatio, use it; otherwise simulate
  const mfg = region.manufacturingRatio || 15;
  const remaining = 100 - mfg;

  // Distribute remaining across sectors based on region characteristics
  const isUrban = ["11", "21", "22", "23", "24", "25", "26", "31"].includes(
    region.code?.substring(0, 2)
  );

  const dist = {
    manufacturing: parseFloat(mfg.toFixed(1)),
    it: parseFloat(((isUrban ? 15 : 5) * remaining / 100 + Math.random() * 3).toFixed(1)),
    services: parseFloat(((isUrban ? 25 : 15) * remaining / 100 + Math.random() * 5).toFixed(1)),
    construction: parseFloat((8 * remaining / 100 + Math.random() * 3).toFixed(1)),
    wholesale: parseFloat((12 * remaining / 100 + Math.random() * 3).toFixed(1)),
    logistics: parseFloat((5 * remaining / 100 + Math.random() * 2).toFixed(1)),
    finance: parseFloat((4 * remaining / 100 + Math.random() * 2).toFixed(1)),
    education: parseFloat((6 * remaining / 100 + Math.random() * 2).toFixed(1)),
    healthcare: parseFloat((8 * remaining / 100 + Math.random() * 2).toFixed(1)),
  };

  // Adjust to sum to 100
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  dist.other = parseFloat((100 - total).toFixed(1));
  if (dist.other < 0) {
    dist.services += dist.other;
    dist.other = 0;
  }

  return dist;
}

/**
 * Build historical data using KOSIS multi-year fetches.
 */
async function buildHistoricalData(regions, latestData) {
  console.log(`\n=== Building Historical Data (${HISTORICAL_START}-${HISTORICAL_END}) ===`);

  // Fetch historical data from KOSIS for available fields
  const historicalSeries = {};

  for (const [fieldKey, mapping] of Object.entries(HISTORICAL_FIELD_MAP)) {
    if (!HISTORICAL_KEYS.includes(fieldKey)) continue;
    try {
      console.log(`  Fetching historical: ${fieldKey}...`);
      const data = await fetchKosisHistorical(
        mapping.tableKey, mapping.fieldKey,
        HISTORICAL_START, HISTORICAL_END
      );
      if (data.size > 0) {
        historicalSeries[fieldKey] = data;
        console.log(`    ✓ ${data.size} regions`);
      } else {
        console.log(`    ✗ no data`);
      }
    } catch (e) {
      console.log(`    ✗ ${e.message}`);
    }
  }

  // Build the output structure
  const numYears = HISTORICAL_END - HISTORICAL_START + 1;

  // Generate fallback historical trends (smooth growth curves)
  resetSeed(123); // Different seed for historical
  const data = {};

  for (const region of regions) {
    const yearlyEntries = [];
    const latestRegion = latestData.find((r) => r.code === region.code) || {};

    for (let i = 0; i < numYears; i++) {
      const year = HISTORICAL_START + i;
      const progress = i / (numYears - 1); // 0 → 1 over the time range
      const entry = {};

      for (const key of HISTORICAL_KEYS) {
        // Try real historical data first
        const realValue = historicalSeries[key]?.get(region.code)?.get(year);
        if (realValue !== undefined && !isNaN(realValue)) {
          entry[key] = realValue;
          continue;
        }

        // Fallback: interpolate from latest value with a trend
        const latestVal = latestRegion[key] || 0;
        if (latestVal === 0) {
          entry[key] = 0;
          continue;
        }

        // Create realistic historical trajectory
        switch (key) {
          case "population":
            // Gradual growth/decline
            entry[key] = Math.round(latestVal * (0.7 + 0.3 * progress));
            break;
          case "agingRate":
            // Aging increases over time
            entry[key] = parseFloat((latestVal * (0.3 + 0.7 * progress)).toFixed(1));
            break;
          case "grdp":
          case "taxRevenue":
            // Economic growth (exponential-ish)
            entry[key] = Math.round(latestVal * Math.pow(progress + 0.1, 1.5) / Math.pow(1.1, 1.5));
            break;
          case "aptPrice":
          case "avgLandPrice":
            // Real estate appreciation
            entry[key] = Math.round(latestVal * (0.15 + 0.85 * Math.pow(progress, 1.3)));
            break;
          case "avgWage":
            // Wage growth
            entry[key] = Math.round(latestVal * (0.4 + 0.6 * progress));
            break;
          case "birthRate":
            // Declining birth rate
            entry[key] = parseFloat((latestVal * (2.0 - progress)).toFixed(1));
            break;
          case "foreignRatio":
            // Increasing foreign ratio
            entry[key] = parseFloat((latestVal * (0.1 + 0.9 * progress)).toFixed(2));
            break;
          case "airQuality":
            // Improving (decreasing) air quality number
            entry[key] = parseFloat((latestVal * (1.3 - 0.3 * progress)).toFixed(1));
            break;
          default:
            // Linear interpolation with some noise
            entry[key] = typeof latestVal === "number" && Number.isInteger(latestVal)
              ? Math.round(latestVal * (0.5 + 0.5 * progress))
              : parseFloat((latestVal * (0.5 + 0.5 * progress)).toFixed(1));
        }
      }

      // Recompute healthScore for this year
      computeHealthScore(entry);
      yearlyEntries.push(entry);
    }

    data[region.code] = yearlyEntries;
  }

  return {
    startYear: HISTORICAL_START,
    endYear: HISTORICAL_END,
    keys: HISTORICAL_KEYS,
    data,
  };
}

/**
 * Print coverage report showing how many fields have real vs simulated data.
 */
function printCoverageReport(regions) {
  console.log("\n=== Coverage Report ===");

  const categories = {
    "Industry (8)": ["companyCount", "employeeCount", "healthScore", "growthRate", "newBizRate", "closureRate", "manufacturingRatio", "smeRatio"],
    "Population (7)": ["population", "populationGrowth", "agingRate", "youthRatio", "birthRate", "foreignRatio", "netMigration"],
    "Economy (5)": ["grdp", "grdpGrowth", "taxRevenue", "financialIndependence", "localConsumption"],
    "Real Estate (5)": ["avgLandPrice", "priceChangeRate", "aptPrice", "aptChangeRate", "buildingPermits"],
    "Employment (5)": ["employmentRate", "unemploymentRate", "avgWage", "jobCreation", "youthEmployment"],
    "Education (5)": ["schoolCount", "studentCount", "universityCount", "libraryCount", "educationBudget"],
    "Commercial (5)": ["storeCount", "storeOpenRate", "storeCloseRate", "franchiseCount", "salesPerStore"],
    "Healthcare (5)": ["hospitalCount", "doctorCount", "bedsPerPopulation", "seniorFacilities", "daycareCenters"],
    "Safety (4)": ["crimeRate", "trafficAccidents", "fireIncidents", "disasterDamage"],
    "Environment (4)": ["airQuality", "greenAreaRatio", "wasteGeneration", "waterQuality"],
    "Infrastructure (4)": ["roadDensity", "waterSupply", "sewerageRate", "parkArea"],
    "Transport (5)": ["transitScore", "subwayStations", "busRoutes", "dailyPassengers", "avgCommute"],
    "Culture (3)": ["culturalFacilities", "touristVisitors", "accommodations"],
  };

  let totalReal = 0;
  let totalFields = 0;

  for (const [catName, fields] of Object.entries(categories)) {
    let catReal = 0;
    for (const field of fields) {
      // Check if the field has API-sourced data (marked by _source metadata)
      const hasRealData = regions.some(r => r._sources?.[field] === "api");
      if (hasRealData) catReal++;
    }
    totalReal += catReal;
    totalFields += fields.length;
    const pct = ((catReal / fields.length) * 100).toFixed(0);
    console.log(`  ${catName}: ${catReal}/${fields.length} real (${pct}%)`);
  }

  const totalPct = ((totalReal / totalFields) * 100).toFixed(1);
  console.log(`\n  TOTAL: ${totalReal}/${totalFields} fields with real data (${totalPct}%)`);
  console.log(`  Regions: ${regions.length}`);
}

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     KIEP Real Data Fetcher v1.0      ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Target year: ${TARGET_YEAR}`);
  console.log(`Cache: ${useCache ? "enabled" : "fresh fetch (saving to cache)"}`);
  console.log(`Regions: ${REGIONS.length}`);
  console.log(`API keys: KOSIS=${API_KEYS.kosis ? "✓" : "✗"}, R-ONE=${API_KEYS.rone ? "✓" : "✗"}, data.go.kr=${API_KEYS.dataGoKr ? "✓" : "✗"}, ECOS=${API_KEYS.ecos ? "✓" : "✗"}`);

  // Step 1: Generate fallback data (complete set)
  console.log("\n=== Generating Fallback Data ===");
  resetSeed(42);
  const fallbackRegions = REGIONS.map((r) =>
    generateFallbackRegion(r.code, r.name, r.province)
  );
  console.log(`Generated ${fallbackRegions.length} fallback regions`);

  // Step 2: Fetch from all API sources
  const [kosisResult, roneResult, datagokrResult] = await Promise.allSettled([
    fetchAllKosisData(TARGET_YEAR),
    fetchAllRoneData(TARGET_YEAR),
    fetchAllDatagokrData(TARGET_YEAR),
  ]);

  const kosisData = kosisResult.status === "fulfilled" ? kosisResult.value : new Map();
  const roneData = roneResult.status === "fulfilled" ? roneResult.value : new Map();
  const datagokrData = datagokrResult.status === "fulfilled" ? datagokrResult.value : new Map();

  // Get population data for ECOS distribution weights
  const regionPopulations = new Map();
  for (const [code, data] of kosisData) {
    if (data.population) regionPopulations.set(code, data.population);
  }

  const ecosResult = await fetchAllEcosData(TARGET_YEAR, regionPopulations);

  // Step 3: Merge data per region (API > fallback)
  console.log("\n=== Merging Data ===");
  const mergedRegions = fallbackRegions.map((fallback) => {
    const code = fallback.code;
    const kosis = kosisData.get(code) || {};
    const rone = roneData.get(code) || {};
    const datagokr = datagokrData.get(code) || {};
    const ecos = ecosResult.get?.(code) || {};

    const sources = {};
    const merged = {
      code: fallback.code,
      name: fallback.name,
      province: fallback.province,
    };

    // Merge each field: API sources take priority over fallback
    for (const field of ALL_FIELDS) {
      const apiValue =
        kosis[field] ?? rone[field] ?? datagokr[field] ?? ecos[field];

      if (apiValue !== undefined && apiValue !== null && !isNaN(apiValue)) {
        merged[field] = apiValue;
        sources[field] = "api";
      } else {
        merged[field] = fallback[field];
        sources[field] = "simulated";
      }
    }

    // Generate industry distribution
    merged.industryDistribution = generateIndustryDistribution(merged);

    // Store sources metadata (will be removed before writing)
    merged._sources = sources;

    return merged;
  });

  // Step 4: Compute derived fields
  console.log("Computing derived fields...");

  // Try to get previous year data for YoY calculations
  let prevYearKosis = new Map();
  try {
    prevYearKosis = await fetchAllKosisData(TARGET_YEAR - 1);
  } catch {
    console.log("Could not fetch previous year data for YoY calculations");
  }

  for (const region of mergedRegions) {
    const prevYear = prevYearKosis.get(region.code) || {};
    computeDerivedFields(region, prevYear);
  }

  // Step 5: Coverage report
  printCoverageReport(mergedRegions);

  // Step 6: Write output files
  const outDir = path.resolve(__dirname, "../public/data");

  // Remove metadata before writing
  const cleanRegions = mergedRegions.map((r) => {
    const { _sources, ...clean } = r;
    return clean;
  });

  const regionsPath = path.join(outDir, "sample-regions.json");
  fs.writeFileSync(regionsPath, JSON.stringify(cleanRegions, null, 2));
  const regionsSize = fs.statSync(regionsPath).size;
  console.log(`\n✓ Written: ${regionsPath} (${(regionsSize / 1024).toFixed(1)} KB)`);

  // Step 7: Build historical data
  const historical = await buildHistoricalData(REGIONS, cleanRegions);
  const histPath = path.join(outDir, "sample-historical.json");
  fs.writeFileSync(histPath, JSON.stringify(historical));
  const histSize = fs.statSync(histPath).size;
  console.log(`✓ Written: ${histPath} (${(histSize / 1024).toFixed(1)} KB)`);

  console.log("\n══════════════════════════════════════");
  console.log("  Data fetch complete!");
  console.log("  Run 'npm run build' to rebuild the site.");
  console.log("══════════════════════════════════════");
}

main().catch((e) => {
  console.error("\n✗ Fatal error:", e.message);
  console.error(e.stack);
  process.exit(1);
});
