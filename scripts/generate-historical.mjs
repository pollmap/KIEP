#!/usr/bin/env node
/**
 * Generate historical + extended sample data for KIEP platform
 * - Extends sample-regions.json with population, real estate, employment, education, commercial, transport data
 * - Creates sample-historical.json with 2005-2025 time series
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "web", "public", "data");

const existing = JSON.parse(readFileSync(join(DATA_DIR, "sample-regions.json"), "utf-8"));

// Seeded random for reproducibility
let seed = 42;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randRange(min, max) { return min + rand() * (max - min); }
function randInt(min, max) { return Math.round(randRange(min, max)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Province-specific base parameters (2025 values)
const PROV = {
  "11": { pop: 370000, aging: 17.5, land: 2800, empl: 63.5, school: 95, store: 14000, transit: 92, popGr: -0.3, youth: 22 },
  "21": { pop: 200000, aging: 20.5, land: 750,  empl: 61.0, school: 55, store: 7500,  transit: 78, popGr: -0.8, youth: 18 },
  "22": { pop: 150000, aging: 19.8, land: 620,  empl: 60.5, school: 45, store: 6000,  transit: 76, popGr: -0.9, youth: 17 },
  "23": { pop: 180000, aging: 16.2, land: 900,  empl: 62.0, school: 60, store: 8000,  transit: 80, popGr: 0.2,  youth: 21 },
  "24": { pop: 110000, aging: 18.0, land: 480,  empl: 59.5, school: 35, store: 4500,  transit: 72, popGr: -0.5, youth: 19 },
  "25": { pop: 120000, aging: 17.0, land: 520,  empl: 61.0, school: 40, store: 5000,  transit: 74, popGr: -0.3, youth: 20 },
  "26": { pop: 135000, aging: 16.5, land: 550,  empl: 63.0, school: 38, store: 4800,  transit: 68, popGr: -1.0, youth: 18 },
  "29": { pop: 130000, aging: 10.5, land: 650,  empl: 62.5, school: 30, store: 3500,  transit: 65, popGr: 8.0,  youth: 28 },
  "31": { pop: 280000, aging: 15.0, land: 1200, empl: 63.0, school: 85, store: 12000, transit: 82, popGr: 0.5,  youth: 24 },
  "32": { pop: 65000,  aging: 24.5, land: 280,  empl: 57.0, school: 25, store: 2200,  transit: 42, popGr: -1.5, youth: 13 },
  "33": { pop: 75000,  aging: 22.0, land: 320,  empl: 58.5, school: 28, store: 2800,  transit: 45, popGr: -0.8, youth: 14 },
  "34": { pop: 85000,  aging: 23.5, land: 350,  empl: 58.0, school: 30, store: 3000,  transit: 48, popGr: -0.5, youth: 14 },
  "35": { pop: 80000,  aging: 25.0, land: 280,  empl: 57.5, school: 28, store: 2500,  transit: 46, popGr: -1.2, youth: 13 },
  "36": { pop: 60000,  aging: 28.5, land: 220,  empl: 56.0, school: 22, store: 1800,  transit: 35, popGr: -2.0, youth: 11 },
  "37": { pop: 75000,  aging: 24.0, land: 280,  empl: 57.5, school: 26, store: 2400,  transit: 40, popGr: -1.5, youth: 13 },
  "38": { pop: 100000, aging: 21.0, land: 380,  empl: 59.0, school: 35, store: 3500,  transit: 52, popGr: -1.0, youth: 16 },
  "39": { pop: 90000,  aging: 18.5, land: 600,  empl: 60.0, school: 30, store: 4000,  transit: 45, popGr: 1.0,  youth: 20 },
};

// Historical trend multipliers (relative to 2025=1.0)
function trendMultiplier(metric, year, provCode) {
  const t = (year - 2005) / 20; // 0..1
  switch (metric) {
    case "population": {
      // Metro growing then stable, rural declining
      const isMetro = ["11","21","22","23","24","25","26","31"].includes(provCode);
      const isSejong = provCode === "29";
      if (isSejong) return 0.1 + 0.9 * Math.pow(t, 0.8); // explosive growth
      if (isMetro) return 0.95 + 0.05 * Math.sin(t * Math.PI * 0.8);
      return 1.15 - 0.15 * t; // rural decline
    }
    case "agingRate":
      return 0.45 + 0.55 * t; // aging rate was ~half in 2005
    case "avgLandPrice": {
      // General upward trend with 2008 dip
      const base = 0.35 + 0.65 * Math.pow(t, 0.7);
      const dip2008 = year >= 2008 && year <= 2010 ? -0.08 * (1 - Math.abs(year - 2009) / 2) : 0;
      return Math.max(0.3, base + dip2008);
    }
    case "employmentRate": {
      // Relatively stable with COVID dip
      const base = 0.95 + 0.05 * t;
      const covid = year === 2020 ? -0.04 : year === 2021 ? -0.02 : 0;
      return clamp(base + covid, 0.88, 1.05);
    }
    case "healthScore":
      return 0.75 + 0.25 * t; // gradual improvement
    case "companyCount":
      return 0.55 + 0.45 * t; // growing
    case "employeeCount":
      return 0.60 + 0.40 * t;
    case "storeCount": {
      const base = 0.65 + 0.35 * t;
      const covid = year === 2020 ? -0.05 : year === 2021 ? -0.03 : 0;
      return Math.max(0.5, base + covid);
    }
    case "transitScore":
      return 0.70 + 0.30 * t; // infrastructure improvement
    case "schoolCount":
      return 1.05 - 0.05 * t; // slight decline (consolidation)
    default:
      return 1.0;
  }
}

// Generate extended current-year data
const enhanced = existing.map((r) => {
  const prov = r.code.substring(0, 2);
  const base = PROV[prov] || PROV["37"];
  const v = () => 0.6 + rand() * 0.8; // variance factor

  const population = randInt(base.pop * 0.5, base.pop * 1.5);
  const agingRate = +clamp(base.aging * (0.8 + rand() * 0.4), 5, 42).toFixed(1);
  const youthRatio = +clamp(base.youth * (0.8 + rand() * 0.4), 6, 35).toFixed(1);
  const populationGrowth = +(base.popGr + randRange(-1.5, 1.5)).toFixed(1);
  const avgLandPrice = randInt(base.land * 0.4, base.land * 1.8);
  const priceChangeRate = +randRange(-3, 8).toFixed(1);
  const employmentRate = +clamp(base.empl * (0.92 + rand() * 0.16), 48, 72).toFixed(1);
  const unemploymentRate = +clamp(randRange(2.0, 6.5), 1.5, 9.0).toFixed(1);
  const schoolCount = randInt(base.school * 0.5, base.school * 1.5);
  const studentCount = randInt(schoolCount * 120, schoolCount * 350);
  const storeCount = randInt(base.store * 0.5, base.store * 1.5);
  const storeOpenRate = +randRange(3, 12).toFixed(1);
  const storeCloseRate = +randRange(2, 10).toFixed(1);
  const transitScore = +clamp(base.transit * (0.85 + rand() * 0.3), 10, 98).toFixed(1);

  return {
    ...r,
    population,
    populationGrowth,
    agingRate,
    youthRatio,
    avgLandPrice,
    priceChangeRate,
    employmentRate,
    unemploymentRate,
    schoolCount,
    studentCount,
    storeCount,
    storeOpenRate,
    storeCloseRate,
    transitScore,
  };
});

// Generate historical data (2005-2025)
const START_YEAR = 2005;
const END_YEAR = 2025;
const HIST_KEYS = [
  "healthScore", "companyCount", "employeeCount", "population",
  "agingRate", "avgLandPrice", "employmentRate", "storeCount",
  "transitScore", "schoolCount",
];

const historical = {
  startYear: START_YEAR,
  endYear: END_YEAR,
  keys: HIST_KEYS,
  data: {},
};

for (const r of enhanced) {
  const prov = r.code.substring(0, 2);
  const years = [];
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const yearData = {};
    for (const key of HIST_KEYS) {
      const current = r[key];
      if (current === undefined) continue;
      const mult = trendMultiplier(key, year, prov);
      const noise = 1 + randRange(-0.03, 0.03); // 3% noise
      let val = current * mult * noise;

      // Apply domain constraints
      if (key === "agingRate") val = clamp(val, 3, 45);
      if (key === "employmentRate") val = clamp(val, 40, 75);
      if (key === "healthScore") val = clamp(val, 8, 98);
      if (key === "transitScore") val = clamp(val, 5, 99);

      // Round appropriately
      if (["agingRate", "employmentRate", "healthScore", "transitScore"].includes(key)) {
        yearData[key] = +val.toFixed(1);
      } else {
        yearData[key] = Math.round(val);
      }
    }
    years.push(yearData);
  }
  historical.data[r.code] = years;
}

// Write files
writeFileSync(
  join(DATA_DIR, "sample-regions.json"),
  JSON.stringify(enhanced, null, 0), // compact
  "utf-8"
);
console.log(`Written enhanced sample-regions.json (${enhanced.length} regions)`);

writeFileSync(
  join(DATA_DIR, "sample-historical.json"),
  JSON.stringify(historical, null, 0),
  "utf-8"
);

const histSize = JSON.stringify(historical).length;
console.log(`Written sample-historical.json (${Object.keys(historical.data).length} regions × ${END_YEAR - START_YEAR + 1} years = ${(histSize / 1024).toFixed(0)}KB)`);
