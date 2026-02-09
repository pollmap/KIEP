#!/usr/bin/env node
/**
 * fetch-data.mjs -- KIEP ETL script
 *
 * Fetches real data from Korean public APIs (KOSIS + data.go.kr) and generates:
 *   - web/public/data/sample-regions.json   (250 시군구, current year snapshot)
 *   - web/public/data/sample-historical.json (2000-2025 time series)
 *
 * Usage:
 *   KOSIS_API_KEY=xxx DATA_GO_KR_API_KEY=yyy node scripts/fetch-data.mjs
 *   node scripts/fetch-data.mjs --dry-run       # test API connectivity only
 *
 * Environment variables:
 *   KOSIS_API_KEY       - API key for kosis.kr (통계청 KOSIS 오픈API)
 *   DATA_GO_KR_API_KEY  - API key for data.go.kr (공공데이터포털)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "web", "public", "data");
const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────────────────
// 0. Configuration & Constants
// ─────────────────────────────────────────────────────────────────────────────

const KOSIS_API_KEY = process.env.KOSIS_API_KEY || "";
const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || "";

const CURRENT_YEAR = "2023"; // latest year with complete data in most KOSIS tables
const HIST_START = 2000;
const HIST_END = 2025;

/** Province code -> province name */
const PROVINCES = {
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

/** All 65 data fields that populate a RegionData record. */
const ALL_FIELD_KEYS = [
  // Industry (8)
  "companyCount", "employeeCount", "healthScore", "growthRate",
  "newBizRate", "closureRate", "manufacturingRatio", "smeRatio",
  // Population (7)
  "population", "populationGrowth", "agingRate", "youthRatio",
  "birthRate", "foreignRatio", "netMigration",
  // Economy (5)
  "grdp", "grdpGrowth", "taxRevenue", "financialIndependence", "localConsumption",
  // Real Estate (5)
  "avgLandPrice", "priceChangeRate", "aptPrice", "aptChangeRate", "buildingPermits",
  // Employment (5)
  "employmentRate", "unemploymentRate", "avgWage", "jobCreation", "youthEmployment",
  // Education (5)
  "schoolCount", "studentCount", "universityCount", "libraryCount", "educationBudget",
  // Commercial (5)
  "storeCount", "storeOpenRate", "storeCloseRate", "franchiseCount", "salesPerStore",
  // Healthcare (5)
  "hospitalCount", "doctorCount", "bedsPerPopulation", "seniorFacilities", "daycareCenters",
  // Safety (4)
  "crimeRate", "trafficAccidents", "fireIncidents", "disasterDamage",
  // Environment (4)
  "airQuality", "greenAreaRatio", "wasteGeneration", "waterQuality",
  // Infrastructure (4)
  "roadDensity", "waterSupply", "sewerageRate", "parkArea",
  // Transportation (5)
  "transitScore", "subwayStations", "busRoutes", "dailyPassengers", "avgCommute",
  // Culture (3)
  "culturalFacilities", "touristVisitors", "accommodations",
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Logging & Fetch Summary
// ─────────────────────────────────────────────────────────────────────────────

const fetchResults = []; // { source, status, fields[], message }

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logSuccess(source, fields, count) {
  const msg = `${count} regions populated`;
  fetchResults.push({ source, status: "OK", fields, message: msg });
  log(`  OK  ${source}: ${msg} (fields: ${fields.join(", ")})`);
}

function logFail(source, fields, err) {
  const msg = err instanceof Error ? err.message : String(err);
  fetchResults.push({ source, status: "FAIL", fields, message: msg });
  log(` FAIL ${source}: ${msg}`);
}

function logSkip(source, fields, reason) {
  fetchResults.push({ source, status: "SKIP", fields, message: reason });
  log(` SKIP ${source}: ${reason}`);
}

function printSummary() {
  console.log("\n" + "=".repeat(72));
  console.log("FETCH SUMMARY");
  console.log("=".repeat(72));

  const ok = fetchResults.filter((r) => r.status === "OK");
  const fail = fetchResults.filter((r) => r.status === "FAIL");
  const skip = fetchResults.filter((r) => r.status === "SKIP");

  console.log(`  Succeeded: ${ok.length}`);
  console.log(`  Failed:    ${fail.length}`);
  console.log(`  Skipped:   ${skip.length}`);
  console.log("");

  for (const r of fetchResults) {
    const icon = r.status === "OK" ? "[OK]  " : r.status === "FAIL" ? "[FAIL]" : "[SKIP]";
    console.log(`  ${icon} ${r.source.padEnd(40)} ${r.message}`);
    console.log(`         fields: ${r.fields.join(", ")}`);
  }

  // Show which fields are populated vs zero
  const allPopulatedFields = new Set();
  for (const r of ok) {
    for (const f of r.fields) allPopulatedFields.add(f);
  }
  const missingFields = ALL_FIELD_KEYS.filter((f) => !allPopulatedFields.has(f));
  console.log("");
  console.log(`  Fields with data: ${allPopulatedFields.size}/${ALL_FIELD_KEYS.length}`);
  if (missingFields.length > 0) {
    console.log(`  Fields left at 0: ${missingFields.join(", ")}`);
  }
  console.log("=".repeat(72));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Region List Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the 250 시군구 region codes from the GeoJSON file.
 * Tries sigungu-geo.json first, falls back to regions.json.
 * Returns: Map<code, { code, name, province }>
 */
function loadRegions() {
  const candidates = [
    join(DATA_DIR, "sigungu-geo.json"),
    join(DATA_DIR, "regions.json"),
  ];

  let geoPath = null;
  for (const p of candidates) {
    if (existsSync(p)) {
      geoPath = p;
      break;
    }
  }
  if (!geoPath) {
    throw new Error("Cannot find GeoJSON file (sigungu-geo.json or regions.json) in " + DATA_DIR);
  }

  log(`Loading regions from ${geoPath}`);
  const geojson = JSON.parse(readFileSync(geoPath, "utf-8"));

  const regions = new Map();
  for (const feature of geojson.features) {
    const code = feature.properties.code;
    const name = feature.properties.name;
    const provCode = code.substring(0, 2);
    const province = PROVINCES[provCode] || "알수없음";
    regions.set(code, { code, name, province });
  }

  log(`Loaded ${regions.size} regions`);
  return regions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Region Data Map -- single record per region, accumulating fields
// ─────────────────────────────────────────────────────────────────────────────

/** Initialize the data map: every field starts at 0. */
function initRegionDataMap(regions) {
  const dataMap = new Map();
  for (const [code, info] of regions) {
    const record = {
      code: info.code,
      name: info.name,
      province: info.province,
      industryDistribution: {
        manufacturing: 0,
        it: 0,
        services: 0,
        construction: 0,
        wholesale: 0,
        logistics: 0,
        finance: 0,
        education: 0,
        healthcare: 0,
        other: 0,
      },
    };
    for (const key of ALL_FIELD_KEYS) {
      record[key] = 0;
    }
    dataMap.set(code, record);
  }
  return dataMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Historical Data Map -- per region, per year, all fields
// ─────────────────────────────────────────────────────────────────────────────

function initHistoricalDataMap(regions) {
  const histMap = new Map();
  for (const [code] of regions) {
    const years = [];
    for (let y = HIST_START; y <= HIST_END; y++) {
      const yearRecord = {};
      for (const key of ALL_FIELD_KEYS) {
        yearRecord[key] = 0;
      }
      years.push(yearRecord);
    }
    histMap.set(code, years);
  }
  return histMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HTTP Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_DELAY_MS = 300; // delay between API calls

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON from a URL with timeout and error handling.
 * Returns parsed JSON or throws.
 */
async function fetchJSON(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();

    // KOSIS sometimes returns error messages as plain text or HTML
    if (text.startsWith("<") || text.startsWith("err")) {
      throw new Error(`API returned non-JSON: ${text.substring(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from ${label}: ${text.substring(0, 200)}`);
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(`Timeout after ${FETCH_TIMEOUT_MS}ms for ${label}`);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. KOSIS API Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a KOSIS statisticsParameterData URL.
 *
 * @param {object} opts
 * @param {string} opts.tblId     - Table ID (e.g., "DT_1YL20501")
 * @param {string} opts.orgId     - Organization ID (default "101" for Statistics Korea)
 * @param {string} opts.startYear - Start year (e.g., "2023")
 * @param {string} opts.endYear   - End year (e.g., "2023")
 * @param {string} opts.prdSe     - Period type: "Y" (yearly), "H" (half-year), "Q" (quarter), "M" (month)
 * @param {string} opts.objL1     - Level 1 classification code ("ALL" for all)
 * @param {string} opts.objL2     - Level 2 classification code (optional)
 * @param {string} opts.objL3     - Level 3 classification code (optional)
 * @param {string} opts.itmId     - Item ID ("ALL" for all items)
 */
function buildKosisUrl(opts) {
  const params = new URLSearchParams({
    method: "getList",
    apiKey: KOSIS_API_KEY,
    orgId: opts.orgId || "101",
    tblId: opts.tblId,
    itmId: opts.itmId || "ALL",
    objL1: opts.objL1 || "ALL",
    format: "json",
    jsonVD: "Y",
    prdSe: opts.prdSe || "Y",
    startPrdDe: opts.startYear || CURRENT_YEAR,
    endPrdDe: opts.endYear || CURRENT_YEAR,
  });
  if (opts.objL2) params.set("objL2", opts.objL2);
  if (opts.objL3) params.set("objL3", opts.objL3);

  return `https://kosis.kr/openapi/Param/statisticsParameterData.do?${params.toString()}`;
}

/**
 * Parse KOSIS response rows.
 * Returns a Map<regionCode, Map<itemName, value>> for a single year
 * or Map<regionCode, Map<year, Map<itemName, value>>> for multi-year.
 *
 * KOSIS row fields:
 *   C1      - Classification 1 code (usually region code)
 *   C1_NM   - Classification 1 name
 *   C2      - Classification 2 code (sub-level or category)
 *   C2_NM   - Classification 2 name
 *   ITM_ID  - Item ID
 *   ITM_NM  - Item name (Korean)
 *   DT      - Data value (string, may be "-" or empty)
 *   PRD_DE  - Period (e.g., "2023", "20231" for H1)
 */
function parseKosisRows(rows, { regionField = "C1", multiYear = false } = {}) {
  if (!Array.isArray(rows)) {
    throw new Error("KOSIS response is not an array");
  }

  if (multiYear) {
    // Map<code, Map<year, Map<itemName, number>>>
    const result = new Map();
    for (const row of rows) {
      const code = normalizeKosisCode(row[regionField]);
      if (!code) continue;

      const itemName = (row.ITM_NM || "").trim();
      const rawVal = row.DT;
      const value = parseKosisValue(rawVal);
      const year = parseKosisPeriod(row.PRD_DE);
      if (!year) continue;

      if (!result.has(code)) result.set(code, new Map());
      const yearMap = result.get(code);
      if (!yearMap.has(year)) yearMap.set(year, new Map());
      yearMap.get(year).set(itemName, value);
    }
    return result;
  }

  // Single year: Map<code, Map<itemName, number>>
  const result = new Map();
  for (const row of rows) {
    const code = normalizeKosisCode(row[regionField]);
    if (!code) continue;

    const itemName = (row.ITM_NM || "").trim();
    const rawVal = row.DT;
    const value = parseKosisValue(rawVal);

    if (!result.has(code)) result.set(code, new Map());
    result.get(code).set(itemName, value);
  }
  return result;
}

/**
 * Normalize a KOSIS region code to our 5-digit code.
 * KOSIS codes can be 5-digit, 8-digit (with "000"), or 10-digit.
 */
function normalizeKosisCode(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Already 5 digits
  if (/^\d{5}$/.test(s)) return s;

  // 8 digits: take first 5
  if (/^\d{8}$/.test(s)) return s.substring(0, 5);

  // 10 digits: take first 5
  if (/^\d{10}$/.test(s)) return s.substring(0, 5);

  // 2 digits (province level) -- skip, we want 시군구
  if (/^\d{2}$/.test(s)) return null;

  // 7 digits -- take first 5
  if (/^\d{7}$/.test(s)) return s.substring(0, 5);

  // Some KOSIS tables use special prefixes -- try to extract digits
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 5) return digits.substring(0, 5);

  return null;
}

/** Parse KOSIS data value (may be "-", "", or a numeric string with commas). */
function parseKosisValue(raw) {
  if (raw === null || raw === undefined || raw === "-" || raw === "" || raw === "…") {
    return 0;
  }
  const cleaned = String(raw).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Parse KOSIS period string to a year number. */
function parseKosisPeriod(prd) {
  if (!prd) return null;
  const s = String(prd).trim();
  // "2023", "20231" (H1), "20232" (H2), "202301" (M01)
  const year = parseInt(s.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. KOSIS Data Sources -- Current Year
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each KOSIS source definition:
 *   label       - human-readable name
 *   tblId       - KOSIS table ID
 *   fields      - which RegionData fields this populates
 *   opts        - extra options for buildKosisUrl
 *   parse(rows, dataMap) - function to extract data from rows into dataMap
 */
const KOSIS_SOURCES = [
  // ── Population (인구) ────────────────────────────────────────
  {
    label: "KOSIS Population (DT_1YL20501)",
    tblId: "DT_1YL20501",
    fields: ["population", "populationGrowth"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        // Common item names for this table:
        // "총인구", "총인구 (명)", "인구", "총인구(명)"
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("총인구") || n === "인구" || n === "인구(명)") {
            record.population = val;
            count++;
          }
          if (n.includes("인구증감률") || n.includes("증감률")) {
            record.populationGrowth = round1(val);
          }
        }
      }
      return count;
    },
  },

  // ── Aging Rate (고령화율) ────────────────────────────────────
  {
    label: "KOSIS Aging Rate (DT_1YL20631)",
    tblId: "DT_1YL20631",
    fields: ["agingRate", "youthRatio"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("고령화율") || n.includes("65세이상") || n.includes("고령인구비율")) {
            record.agingRate = round1(val);
            count++;
          }
          if (n.includes("청년") || n.includes("15-64") || n.includes("15~64") || n.includes("생산가능인구")) {
            // youth ratio can be derived: if this is working-age pop ratio
            record.youthRatio = round1(val);
          }
          if (n.includes("유소년") || n.includes("0-14") || n.includes("0~14")) {
            // youthRatio is specifically 15-34 in our context, but KOSIS may give age ranges
          }
        }
      }
      return count;
    },
  },

  // ── Employment (고용률) ──────────────────────────────────────
  {
    label: "KOSIS Employment (DT_1ES3A03_A01S)",
    tblId: "DT_1ES3A03_A01S",
    fields: ["employmentRate", "unemploymentRate"],
    opts: { prdSe: "H" }, // half-yearly; we take the latest
    parse(rows, dataMap) {
      // For half-yearly data, take the latest period per region
      const byRegion = new Map(); // code -> { period, items }
      for (const row of rows) {
        const code = normalizeKosisCode(row.C1);
        if (!code) continue;
        const prd = row.PRD_DE || "";
        const existing = byRegion.get(code);
        if (!existing || prd > existing.period) {
          if (!byRegion.has(code)) byRegion.set(code, { period: prd, items: new Map() });
          const entry = byRegion.get(code);
          if (prd >= entry.period) {
            entry.period = prd;
          }
        }
      }

      // Re-parse taking only latest period per region
      const latestPeriods = new Map();
      for (const row of rows) {
        const code = normalizeKosisCode(row.C1);
        if (!code) continue;
        const prd = row.PRD_DE || "";
        const cur = latestPeriods.get(code) || "";
        if (prd > cur) latestPeriods.set(code, prd);
      }

      let count = 0;
      for (const row of rows) {
        const code = normalizeKosisCode(row.C1);
        if (!code) continue;
        if (row.PRD_DE !== latestPeriods.get(code)) continue;

        const record = dataMap.get(code);
        if (!record) continue;
        const name = (row.ITM_NM || "").replace(/\s/g, "");
        const val = parseKosisValue(row.DT);

        if (name.includes("고용률")) {
          record.employmentRate = round1(val);
          count++;
        }
        if (name.includes("실업률")) {
          record.unemploymentRate = round1(val);
        }
      }
      return count;
    },
  },

  // ── Education (학교/학생) ────────────────────────────────────
  {
    label: "KOSIS Education (DT_1YL15001)",
    tblId: "DT_1YL15001",
    fields: ["schoolCount", "studentCount"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("학교수") || n === "학교" || n.includes("학교(개)")) {
            record.schoolCount = Math.round(val);
            count++;
          }
          if (n.includes("학생수") || n === "학생" || n.includes("학생(명)")) {
            record.studentCount = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── Business Census (사업체조사) ─────────────────────────────
  {
    label: "KOSIS Business Census (DT_1K52B01)",
    tblId: "DT_1K52B01",
    fields: ["companyCount", "employeeCount"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("사업체수") || n.includes("사업체(개)")) {
            record.companyCount = Math.round(val);
            count++;
          }
          if (n.includes("종사자수") || n.includes("종사자(명)")) {
            record.employeeCount = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── GRDP (지역내총생산) ──────────────────────────────────────
  {
    label: "KOSIS GRDP (DT_1C81)",
    tblId: "DT_1C81",
    fields: ["grdp", "grdpGrowth"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("지역내총생산") || n.includes("GRDP") || n.includes("총생산")) {
            record.grdp = Math.round(val);
            count++;
          }
          if (n.includes("성장률") || n.includes("증가율")) {
            record.grdpGrowth = round1(val);
          }
        }
      }
      return count;
    },
  },

  // ── Fiscal Independence (재정자립도) ─────────────────────────
  {
    label: "KOSIS Fiscal (DT_1YL04201)",
    tblId: "DT_1YL04201",
    fields: ["financialIndependence", "taxRevenue"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("재정자립도")) {
            record.financialIndependence = round1(val);
            count++;
          }
          if (n.includes("지방세") || n.includes("세입") || n.includes("세수")) {
            record.taxRevenue = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── Land Price (지가) ────────────────────────────────────────
  {
    label: "KOSIS Land Price (DT_1YL12001)",
    tblId: "DT_1YL12001",
    fields: ["avgLandPrice", "priceChangeRate"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("지가") || n.includes("공시지가") || n.includes("평균지가")) {
            record.avgLandPrice = Math.round(val);
            count++;
          }
          if (n.includes("변동률") || n.includes("지가변동률")) {
            record.priceChangeRate = round1(val);
          }
        }
      }
      return count;
    },
  },

  // ── Birth Statistics (출생통계) ──────────────────────────────
  {
    label: "KOSIS Birth Statistics (DT_1B80A01)",
    tblId: "DT_1B80A01",
    fields: ["birthRate"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("출생률") || n.includes("조출생률") || n.includes("출생")) {
            record.birthRate = round1(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Foreign Residents (외국인) ───────────────────────────────
  {
    label: "KOSIS Foreign Residents (DT_1YL20701)",
    tblId: "DT_1YL20701",
    fields: ["foreignRatio"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("외국인") && (n.includes("비율") || n.includes("비") || n.includes("%"))) {
            record.foreignRatio = round1(val);
            count++;
          } else if (n.includes("외국인") || n.includes("등록외국인")) {
            // Absolute count: compute ratio if we have population
            const record2 = dataMap.get(code);
            if (record2 && record2.population > 0 && val > 0) {
              record.foreignRatio = round1((val / record2.population) * 100);
              count++;
            }
          }
        }
      }
      return count;
    },
  },

  // ── Migration (인구이동) ─────────────────────────────────────
  {
    label: "KOSIS Migration (DT_1YL20301E)",
    tblId: "DT_1YL20301E",
    fields: ["netMigration"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("순이동") || n.includes("순이동률")) {
            record.netMigration = round1(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Hospitals (의료기관) ─────────────────────────────────────
  {
    label: "KOSIS Hospitals (DT_1YL1502E)",
    tblId: "DT_1YL1502E",
    fields: ["hospitalCount", "doctorCount", "bedsPerPopulation"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("의료기관수") || n.includes("기관수") || n.includes("의료기관")) {
            record.hospitalCount = Math.round(val);
            count++;
          }
          if (n.includes("의사수") || n.includes("의사") || n.includes("의료인력")) {
            record.doctorCount = Math.round(val);
          }
          if (n.includes("병상수") || n.includes("병상")) {
            // Per 1,000 population
            if (record.population > 0) {
              record.bedsPerPopulation = round1((val / record.population) * 1000);
            } else {
              record.bedsPerPopulation = round1(val);
            }
          }
        }
      }
      return count;
    },
  },

  // ── Crime (범죄) ─────────────────────────────────────────────
  {
    label: "KOSIS Crime (DT_1YL2101SE)",
    tblId: "DT_1YL2101SE",
    fields: ["crimeRate"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("범죄발생") || n.includes("범죄") || n.includes("발생건수")) {
            // Convert to per-10000-population rate if absolute
            if (record.population > 0 && val > 100) {
              record.crimeRate = round1((val / record.population) * 10000);
            } else {
              record.crimeRate = round1(val);
            }
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Traffic Accidents (교통사고) ─────────────────────────────
  {
    label: "KOSIS Traffic Accidents (DT_1YL21201E)",
    tblId: "DT_1YL21201E",
    fields: ["trafficAccidents"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("교통사고") || n.includes("발생건수") || n.includes("사고건수")) {
            record.trafficAccidents = Math.round(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Fire Incidents (화재) ────────────────────────────────────
  {
    label: "KOSIS Fire (DT_1YL21301E)",
    tblId: "DT_1YL21301E",
    fields: ["fireIncidents"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("화재") || n.includes("화재발생") || n.includes("건수")) {
            record.fireIncidents = Math.round(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Water Supply / Sewerage (상하수도) ───────────────────────
  {
    label: "KOSIS Water Supply (DT_1YL12501E)",
    tblId: "DT_1YL12501E",
    fields: ["waterSupply", "sewerageRate"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("상수도") && (n.includes("보급률") || n.includes("율"))) {
            record.waterSupply = round1(val);
            count++;
          }
          if (n.includes("하수도") && (n.includes("보급률") || n.includes("율"))) {
            record.sewerageRate = round1(val);
          }
        }
      }
      return count;
    },
  },

  // ── Parks (공원) ─────────────────────────────────────────────
  {
    label: "KOSIS Parks (DT_1YL14001E)",
    tblId: "DT_1YL14001E",
    fields: ["parkArea"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("1인당") && n.includes("공원")) {
            record.parkArea = round1(val);
            count++;
          } else if (n.includes("공원면적") || n.includes("공원")) {
            // If total area, compute per capita
            if (record.population > 0 && val > 100) {
              record.parkArea = round1(val / record.population);
            } else {
              record.parkArea = round1(val);
            }
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Cultural Facilities (문화기반시설) ───────────────────────
  {
    label: "KOSIS Cultural Facilities (DT_1YL13101E)",
    tblId: "DT_1YL13101E",
    fields: ["culturalFacilities", "libraryCount"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("문화시설") || n.includes("문화기반시설") || n.includes("문화기반")) {
            record.culturalFacilities = Math.round(val);
            count++;
          }
          if (n.includes("도서관") || n.includes("공공도서관")) {
            record.libraryCount = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── Welfare Facilities (복지시설) ────────────────────────────
  {
    label: "KOSIS Welfare (DT_1YL20921E)",
    tblId: "DT_1YL20921E",
    fields: ["seniorFacilities", "daycareCenters"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("노인복지시설") || n.includes("노인") && n.includes("시설")) {
            record.seniorFacilities = Math.round(val);
            count++;
          }
          if (n.includes("어린이집") || n.includes("보육시설") || n.includes("보육")) {
            record.daycareCenters = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── Air Quality (대기환경) ───────────────────────────────────
  {
    label: "KOSIS Air Quality (DT_1YL14101E)",
    tblId: "DT_1YL14101E",
    fields: ["airQuality"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("미세먼지") || n.includes("PM10") || n.includes("PM2.5")) {
            record.airQuality = round1(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Waste Generation (폐기물) ────────────────────────────────
  {
    label: "KOSIS Waste (DT_1YL14201E)",
    tblId: "DT_1YL14201E",
    fields: ["wasteGeneration"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("폐기물") || n.includes("생활폐기물") || n.includes("발생량")) {
            record.wasteGeneration = round1(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Road Density (도로) ──────────────────────────────────────
  {
    label: "KOSIS Roads (DT_1YL12101E)",
    tblId: "DT_1YL12101E",
    fields: ["roadDensity"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("도로율") || n.includes("도로보급률") || n.includes("포장률")) {
            record.roadDensity = round1(val);
            count++;
          }
        }
      }
      return count;
    },
  },

  // ── Accommodation / Tourism (숙박/관광) ──────────────────────
  {
    label: "KOSIS Tourism (DT_1YL13301E)",
    tblId: "DT_1YL13301E",
    fields: ["accommodations", "touristVisitors"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("숙박") || n.includes("숙박업") || n.includes("숙박시설")) {
            record.accommodations = Math.round(val);
            count++;
          }
          if (n.includes("관광") || n.includes("관광객") || n.includes("방문")) {
            record.touristVisitors = Math.round(val);
          }
        }
      }
      return count;
    },
  },

  // ── Building Permits (건축허가) ──────────────────────────────
  {
    label: "KOSIS Building Permits (DT_1YL11601E)",
    tblId: "DT_1YL11601E",
    fields: ["buildingPermits"],
    opts: {},
    parse(rows, dataMap) {
      const parsed = parseKosisRows(rows);
      let count = 0;
      for (const [code, items] of parsed) {
        const record = dataMap.get(code);
        if (!record) continue;
        for (const [name, val] of items) {
          const n = name.replace(/\s/g, "");
          if (n.includes("건축허가") || n.includes("허가건수") || n.includes("건축")) {
            record.buildingPermits = Math.round(val);
            count++;
          }
        }
      }
      return count;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 8. KOSIS Historical Data Sources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Historical KOSIS sources: same tables but fetched for the full date range.
 * We only fetch historical data for a subset of the most important fields,
 * since querying all tables for 25 years would be excessive.
 */
const KOSIS_HISTORICAL_SOURCES = [
  {
    label: "Historical Population (DT_1YL20501)",
    tblId: "DT_1YL20501",
    field: "population",
    matchItem: (n) => n.includes("총인구") || n === "인구",
    transform: (v) => Math.round(v),
  },
  {
    label: "Historical Aging (DT_1YL20631)",
    tblId: "DT_1YL20631",
    field: "agingRate",
    matchItem: (n) => n.includes("고령화율") || n.includes("65세이상"),
    transform: (v) => round1(v),
  },
  {
    label: "Historical Employment (DT_1ES3A03_A01S)",
    tblId: "DT_1ES3A03_A01S",
    field: "employmentRate",
    prdSe: "H",
    matchItem: (n) => n.includes("고용률"),
    transform: (v) => round1(v),
  },
  {
    label: "Historical Education (DT_1YL15001)",
    tblId: "DT_1YL15001",
    field: "schoolCount",
    matchItem: (n) => n.includes("학교수") || n === "학교",
    transform: (v) => Math.round(v),
  },
  {
    label: "Historical Business (DT_1K52B01)",
    tblId: "DT_1K52B01",
    field: "companyCount",
    matchItem: (n) => n.includes("사업체수"),
    transform: (v) => Math.round(v),
  },
  {
    label: "Historical Land Price (DT_1YL12001)",
    tblId: "DT_1YL12001",
    field: "avgLandPrice",
    matchItem: (n) => n.includes("지가") || n.includes("공시지가"),
    transform: (v) => Math.round(v),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 9. data.go.kr Data Sources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch NPS (국민연금) business establishment data from data.go.kr.
 * This aggregates company/employee counts by 시군구 code.
 *
 * The NPS API returns paginated results of individual businesses.
 * We fetch a limited number of pages and aggregate.
 */
async function fetchNpsData(dataMap) {
  if (!DATA_GO_KR_API_KEY) {
    logSkip("data.go.kr NPS", ["companyCount", "employeeCount"], "No DATA_GO_KR_API_KEY set");
    return;
  }

  const fields = ["companyCount", "employeeCount"];
  const baseUrl = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireService/getDetailInfoSearch";

  try {
    // Test connectivity with a small request
    const testUrl = `${baseUrl}?serviceKey=${encodeURIComponent(DATA_GO_KR_API_KEY)}&pageNo=1&numOfRows=1&type=json`;

    if (DRY_RUN) {
      log("  [dry-run] Testing NPS API connectivity...");
      const testData = await fetchJSON(testUrl, "NPS test");
      log("  [dry-run] NPS API responded OK");
      logSuccess("data.go.kr NPS (dry-run)", fields, 0);
      return;
    }

    // Fetch paginated results and aggregate by region
    // We use ldong_addr_mgpl_dggt_cd (법정동 시군구코드) for grouping
    // NPS data has wkpl_stplc_1 (사업장소재지 시도), wkpl_stplc_2 (시군구) etc.
    //
    // Due to API rate limits and the volume of data (millions of records),
    // we fetch a sample to get aggregate statistics per region.
    // A full ETL would need multiple batched runs.

    const regionCounts = new Map(); // code -> { companies, employees }

    // Fetch first few pages to get an idea of the data structure
    const MAX_PAGES = 50;
    const ROWS_PER_PAGE = 1000;
    let totalFetched = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${baseUrl}?serviceKey=${encodeURIComponent(DATA_GO_KR_API_KEY)}&pageNo=${page}&numOfRows=${ROWS_PER_PAGE}&type=json`;

      try {
        const data = await fetchJSON(url, `NPS page ${page}`);
        const body = data?.response?.body;
        if (!body) break;

        const items = body.items?.item || body.items || [];
        const itemList = Array.isArray(items) ? items : [items];

        if (itemList.length === 0) break;

        for (const item of itemList) {
          // Try to extract 시군구 code from the address info
          // Fields: wkpl_stplc_1 (시도), wkpl_stplc_2 (시군구), bzowrRgstNo, etc.
          const addrCode = item.ldong_addr_mgpl_dggt_cd || item.wkpl_roadNmDtlAddr || "";
          const sigunguCode = extractSigunguCode(addrCode, item);

          if (sigunguCode && dataMap.has(sigunguCode)) {
            if (!regionCounts.has(sigunguCode)) {
              regionCounts.set(sigunguCode, { companies: 0, employees: 0 });
            }
            const rc = regionCounts.get(sigunguCode);
            rc.companies += 1;
            const empCount = parseInt(item.jnngpCnt || item.nmbr_of_jnngp || "0", 10);
            rc.employees += isNaN(empCount) ? 0 : empCount;
          }
        }

        totalFetched += itemList.length;

        // Check if we've reached the end
        const totalCount = parseInt(body.totalCount || "0", 10);
        if (totalFetched >= totalCount || totalFetched >= MAX_PAGES * ROWS_PER_PAGE) break;

        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (err) {
        log(`  Warning: NPS page ${page} failed: ${err.message}`);
        break;
      }
    }

    // Apply aggregated counts to dataMap (only if we got data from NPS
    // and the existing data is 0, so we don't overwrite KOSIS data)
    let count = 0;
    for (const [code, rc] of regionCounts) {
      const record = dataMap.get(code);
      if (!record) continue;
      if (record.companyCount === 0 && rc.companies > 0) {
        record.companyCount = rc.companies;
      }
      if (record.employeeCount === 0 && rc.employees > 0) {
        record.employeeCount = rc.employees;
      }
      count++;
    }

    logSuccess("data.go.kr NPS", fields, count);
  } catch (err) {
    logFail("data.go.kr NPS", fields, err);
  }
}

/**
 * Try to extract a 5-digit 시군구 code from NPS record fields.
 */
function extractSigunguCode(addrCode, item) {
  // If we have a direct code field
  if (addrCode && /^\d{5,}/.test(addrCode)) {
    return addrCode.substring(0, 5);
  }

  // Try to extract from address text (시도 + 시군구)
  // This is a best-effort approach
  const addr = item.wkpl_stplc_1 || item.wkplRoadNmDtlAddr || "";
  // Not reliable for exact mapping, return null
  return null;
}

/**
 * Fetch store data from data.go.kr 소상공인시장진흥공단 상가정보.
 *
 * The store API returns stores in a specific 법정동. We aggregate by 시군구.
 * Due to API limits, we fetch a sample of 동 codes per 시군구.
 */
async function fetchStoreData(dataMap, regions) {
  if (!DATA_GO_KR_API_KEY) {
    logSkip("data.go.kr Stores", ["storeCount"], "No DATA_GO_KR_API_KEY set");
    return;
  }

  const fields = ["storeCount"];
  const baseUrl = "https://apis.data.go.kr/B553077/api/open/sdsc/storeListInDong";

  try {
    // Test connectivity
    const testUrl = `${baseUrl}?serviceKey=${encodeURIComponent(DATA_GO_KR_API_KEY)}&divId=ctprvnCd&key=11&pageNo=1&numOfRows=1&type=json`;

    if (DRY_RUN) {
      log("  [dry-run] Testing Store API connectivity...");
      const testData = await fetchJSON(testUrl, "Store test");
      log("  [dry-run] Store API responded OK");
      logSuccess("data.go.kr Stores (dry-run)", fields, 0);
      return;
    }

    // For each 시군구, try to get the total store count
    // The API supports divId=signguCd with key=시군구코드
    let count = 0;
    const codes = [...regions.keys()];

    for (const code of codes) {
      try {
        const url = `${baseUrl}?serviceKey=${encodeURIComponent(DATA_GO_KR_API_KEY)}&divId=signguCd&key=${code}&pageNo=1&numOfRows=1&type=json`;
        const data = await fetchJSON(url, `Store ${code}`);

        const body = data?.body || data?.response?.body || data;
        const totalCount = parseInt(body?.totalCount || body?.items?.totalCount || "0", 10);

        if (totalCount > 0) {
          const record = dataMap.get(code);
          if (record && record.storeCount === 0) {
            record.storeCount = totalCount;
            count++;
          }
        }

        // Rate limit: be gentle with the API
        if (count % 10 === 0) await sleep(RATE_LIMIT_DELAY_MS);
      } catch {
        // Skip individual region failures silently
        continue;
      }
    }

    logSuccess("data.go.kr Stores", fields, count);
  } catch (err) {
    logFail("data.go.kr Stores", fields, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Health Score Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a composite health score from available fields.
 * Only for regions where healthScore is still 0 (not fetched from an API).
 *
 * Components (each normalized 0-100):
 *   - Employment rate contribution
 *   - Company count (relative to population)
 *   - Financial independence
 *   - Population growth (positive = better)
 *   - Youth ratio
 */
function computeHealthScores(dataMap) {
  for (const [, record] of dataMap) {
    if (record.healthScore > 0) continue; // already has a value

    let score = 50; // base
    let adjustments = 0;

    // Employment rate: national avg ~63%, range 45-72
    if (record.employmentRate > 0) {
      score += (record.employmentRate - 58) * 1.2;
      adjustments++;
    }

    // Financial independence: range 10-90%
    if (record.financialIndependence > 0) {
      score += (record.financialIndependence - 40) * 0.3;
      adjustments++;
    }

    // Population growth: range -3% to +3%
    if (record.populationGrowth !== 0) {
      score += record.populationGrowth * 3;
      adjustments++;
    }

    // Youth ratio: higher = better
    if (record.youthRatio > 0) {
      score += (record.youthRatio - 18) * 0.5;
      adjustments++;
    }

    // Company density: companies per 1000 population
    if (record.population > 0 && record.companyCount > 0) {
      const density = (record.companyCount / record.population) * 1000;
      score += (density - 30) * 0.2;
      adjustments++;
    }

    if (adjustments > 0) {
      record.healthScore = round1(Math.max(5, Math.min(98, score)));
    }
  }
}

/**
 * Compute derived fields that depend on other fields.
 */
function computeDerivedFields(dataMap) {
  for (const [, record] of dataMap) {
    // Growth rate from population or company data
    // (These remain 0 if we have no basis for computation)

    // Manufacturing ratio from industry distribution
    if (record.industryDistribution && record.industryDistribution.manufacturing > 0) {
      if (record.manufacturingRatio === 0) {
        record.manufacturingRatio = round1(record.industryDistribution.manufacturing);
      }
    }

    // Transit score: basic estimate from subway/bus if available
    if (record.transitScore === 0) {
      if (record.subwayStations > 0 || record.busRoutes > 0) {
        const subwayScore = Math.min(50, record.subwayStations * 3);
        const busScore = Math.min(50, record.busRoutes * 0.5);
        record.transitScore = round1(subwayScore + busScore);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Output Writing
// ─────────────────────────────────────────────────────────────────────────────

function writeRegionsJson(dataMap) {
  const regions = [];
  for (const [, record] of dataMap) {
    regions.push(record);
  }

  // Sort by code for deterministic output
  regions.sort((a, b) => a.code.localeCompare(b.code));

  const outPath = join(DATA_DIR, "sample-regions.json");
  writeFileSync(outPath, JSON.stringify(regions), "utf-8");
  const sizeKB = (JSON.stringify(regions).length / 1024).toFixed(0);
  log(`Written ${outPath} (${regions.length} regions, ${sizeKB}KB)`);
}

function writeHistoricalJson(histMap) {
  const data = {};
  for (const [code, years] of histMap) {
    data[code] = years;
  }

  const historical = {
    startYear: HIST_START,
    endYear: HIST_END,
    keys: ALL_FIELD_KEYS,
    data,
  };

  const outPath = join(DATA_DIR, "sample-historical.json");
  writeFileSync(outPath, JSON.stringify(historical), "utf-8");
  const sizeKB = (JSON.stringify(historical).length / 1024).toFixed(0);
  log(`Written ${outPath} (${Object.keys(data).length} regions x ${HIST_END - HIST_START + 1} years, ${sizeKB}KB)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Main Execution
// ─────────────────────────────────────────────────────────────────────────────

function round1(v) {
  return Math.round(v * 10) / 10;
}

async function main() {
  console.log("=".repeat(72));
  console.log("KIEP ETL -- Fetch Data from Korean Public APIs");
  console.log("=".repeat(72));
  console.log(`  Mode:       ${DRY_RUN ? "DRY RUN (testing connections only)" : "FULL FETCH"}`);
  console.log(`  KOSIS key:  ${KOSIS_API_KEY ? KOSIS_API_KEY.substring(0, 8) + "..." : "(not set)"}`);
  console.log(`  data.go.kr: ${DATA_GO_KR_API_KEY ? DATA_GO_KR_API_KEY.substring(0, 8) + "..." : "(not set)"}`);
  console.log(`  Year:       ${CURRENT_YEAR}`);
  console.log(`  Historical: ${HIST_START}-${HIST_END}`);
  console.log(`  Output:     ${DATA_DIR}`);
  console.log("");

  // ── Load regions ──
  const regions = loadRegions();
  const dataMap = initRegionDataMap(regions);
  const histMap = initHistoricalDataMap(regions);

  // ── KOSIS: Current Year Data ──
  log("--- KOSIS: Fetching current year data ---");

  if (!KOSIS_API_KEY) {
    log("WARNING: KOSIS_API_KEY not set. All KOSIS sources will be skipped.");
    for (const src of KOSIS_SOURCES) {
      logSkip(src.label, src.fields, "No KOSIS_API_KEY set");
    }
  } else {
    for (const src of KOSIS_SOURCES) {
      try {
        const url = buildKosisUrl({
          tblId: src.tblId,
          startYear: CURRENT_YEAR,
          endYear: CURRENT_YEAR,
          ...src.opts,
        });

        if (DRY_RUN) {
          log(`  [dry-run] Testing ${src.label}...`);
          const data = await fetchJSON(url, src.label);
          const rowCount = Array.isArray(data) ? data.length : 0;
          log(`  [dry-run] ${src.label} returned ${rowCount} rows`);
          logSuccess(`${src.label} (dry-run)`, src.fields, 0);
          await sleep(RATE_LIMIT_DELAY_MS);
          continue;
        }

        log(`  Fetching ${src.label}...`);
        const data = await fetchJSON(url, src.label);

        if (!Array.isArray(data)) {
          throw new Error(`Response is not an array (got ${typeof data}): ${JSON.stringify(data).substring(0, 200)}`);
        }

        const count = src.parse(data, dataMap);
        logSuccess(src.label, src.fields, count);
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (err) {
        logFail(src.label, src.fields, err);
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
  }

  // ── data.go.kr Sources ──
  log("");
  log("--- data.go.kr: Fetching supplementary data ---");
  await fetchNpsData(dataMap);
  await sleep(RATE_LIMIT_DELAY_MS);
  await fetchStoreData(dataMap, regions);

  // ── Compute derived fields ──
  if (!DRY_RUN) {
    log("");
    log("--- Computing derived fields ---");
    computeDerivedFields(dataMap);
    computeHealthScores(dataMap);
    log("  Health scores computed for regions without API data");
  }

  // ── KOSIS: Historical Data ──
  log("");
  log("--- KOSIS: Fetching historical data ---");

  if (!KOSIS_API_KEY) {
    log("WARNING: Skipping historical fetch (no KOSIS_API_KEY).");
    for (const src of KOSIS_HISTORICAL_SOURCES) {
      logSkip(`Historical: ${src.label}`, [src.field], "No KOSIS_API_KEY set");
    }
  } else if (DRY_RUN) {
    log("  [dry-run] Skipping historical data fetch");
    for (const src of KOSIS_HISTORICAL_SOURCES) {
      logSkip(`Historical: ${src.label}`, [src.field], "Dry run");
    }
  } else {
    for (const src of KOSIS_HISTORICAL_SOURCES) {
      try {
        log(`  Fetching ${src.label} (${HIST_START}-${HIST_END})...`);
        const url = buildKosisUrl({
          tblId: src.tblId,
          startYear: String(HIST_START),
          endYear: String(HIST_END),
          prdSe: src.prdSe || "Y",
        });

        const data = await fetchJSON(url, src.label);
        if (!Array.isArray(data)) {
          throw new Error("Response is not an array");
        }

        // Parse multi-year data
        let count = 0;
        const byRegionYear = new Map(); // code -> Map<year, value>

        for (const row of data) {
          const code = normalizeKosisCode(row.C1);
          if (!code || !histMap.has(code)) continue;

          const itemName = (row.ITM_NM || "").replace(/\s/g, "");
          if (!src.matchItem(itemName)) continue;

          const val = parseKosisValue(row.DT);
          const year = parseKosisPeriod(row.PRD_DE);
          if (!year || year < HIST_START || year > HIST_END) continue;

          // For half-yearly data, keep the latest (higher) period per year
          const key = `${code}_${year}`;
          if (!byRegionYear.has(key) || row.PRD_DE > byRegionYear.get(key).prd) {
            byRegionYear.set(key, { code, year, val, prd: row.PRD_DE });
          }
        }

        for (const [, { code, year, val }] of byRegionYear) {
          const yearIndex = year - HIST_START;
          const years = histMap.get(code);
          if (years && yearIndex >= 0 && yearIndex < years.length) {
            years[yearIndex][src.field] = src.transform(val);
            count++;
          }
        }

        logSuccess(`Historical: ${src.label}`, [src.field], count);
        await sleep(RATE_LIMIT_DELAY_MS);
      } catch (err) {
        logFail(`Historical: ${src.label}`, [src.field], err);
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    // Copy current-year data into the historical last year slot
    // so the historical data is consistent with current snapshot
    log("  Syncing current-year data to historical endpoint...");
    const lastYearIndex = HIST_END - HIST_START;
    for (const [code, record] of dataMap) {
      const years = histMap.get(code);
      if (!years || lastYearIndex >= years.length) continue;
      for (const key of ALL_FIELD_KEYS) {
        if (record[key] !== 0 && years[lastYearIndex][key] === 0) {
          years[lastYearIndex][key] = record[key];
        }
      }
    }
  }

  // ── Write output ──
  if (!DRY_RUN) {
    log("");
    log("--- Writing output files ---");
    writeRegionsJson(dataMap);
    writeHistoricalJson(histMap);
  } else {
    log("");
    log("--- [dry-run] Skipping file output ---");
  }

  // ── Summary ──
  printSummary();
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  process.exit(1);
});
