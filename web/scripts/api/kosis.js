/**
 * KOSIS (통계청) OpenAPI wrapper.
 * Fetches 시군구-level statistics from KOSIS tables.
 *
 * Strategy:
 * 1. Use statisticsList API to discover available e-지방지표 tables
 * 2. Fetch data from discovered + hardcoded tables
 * 3. Match regions by NAME (C1_NM) since KOSIS uses 행정구역코드, we use SGIS codes
 */
const { API_KEYS, KOSIS_BASE, REGIONS, matchRegionName } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const DELAY_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Unwrap _raw responses from stale cache ──
function unwrapResponse(data) {
  if (data && data._raw && typeof data._raw === "string") {
    try {
      return JSON.parse(data._raw);
    } catch {
      return data;
    }
  }
  return data;
}

// ── Field mapping: our field name → keywords to search in KOSIS item names ──
const FIELD_KEYWORDS = {
  // Population
  population: ["총인구", "인구수", "인구현황"],
  populationGrowth: ["인구증가", "인구증감"],
  agingRate: ["고령인구", "65세이상", "고령화"],
  youthRatio: ["청년인구", "청년비율"],
  birthRate: ["출생", "조출생"],
  foreignRatio: ["외국인", "외국인주민"],
  netMigration: ["순이동", "전입전출"],
  // Economy
  grdp: ["지역내총생산", "GRDP"],
  taxRevenue: ["지방세", "세입"],
  financialIndependence: ["재정자립도"],
  // Business
  companyCount: ["사업체수", "사업체 수"],
  employeeCount: ["종사자수", "종사자 수"],
  // Employment
  employmentRate: ["고용률"],
  unemploymentRate: ["실업률"],
  // Infrastructure
  roadDensity: ["도로율", "도로포장"],
  waterSupply: ["상수도보급률", "상수도"],
  sewerageRate: ["하수도보급률", "하수도"],
  parkArea: ["공원면적", "1인당 공원"],
  // Safety
  crimeRate: ["범죄발생", "범죄"],
  trafficAccidents: ["교통사고"],
  fireIncidents: ["화재발생", "화재"],
  // Healthcare
  hospitalCount: ["의료기관수", "의료기관"],
  doctorCount: ["의사수", "의사"],
  // Education
  schoolCount: ["학교수", "학교 수"],
  studentCount: ["학생수", "학생 수"],
  libraryCount: ["도서관수", "도서관"],
  // Environment
  airQuality: ["미세먼지", "대기오염"],
  greenAreaRatio: ["녹지비율", "녹지율"],
  wasteGeneration: ["폐기물", "쓰레기"],
  // Culture
  culturalFacilities: ["문화시설", "문화기반"],
  touristVisitors: ["관광객", "관광"],
  accommodations: ["숙박시설", "숙박업"],
};

/**
 * Discover available e-지방지표 tables from KOSIS.
 * These tables (DT_1YL2XXXX) are specifically designed for 시군구-level data.
 */
async function discoverKosisTables() {
  if (!API_KEYS.kosis) return [];

  console.log("[kosis] Discovering available e-지방지표 tables...");

  const discovered = [];
  // e-지방지표 category IDs to search
  const categoryIds = [
    "F_29",      // e-지방지표 root
    "F_29_001",  // 인구
    "F_29_002",  // 경제
    "F_29_003",  // 복지
    "F_29_004",  // 안전
    "F_29_005",  // 환경
    "F_29_006",  // 교육
    "F_29_007",  // 교통
    "F_29_008",  // 문화
  ];

  for (const catId of categoryIds) {
    try {
      const url = `https://kosis.kr/openapi/statisticsList.do?method=getList&apiKey=${API_KEYS.kosis}&vwCd=MT_GTITLE01&parentListId=${catId}&format=json&jsonVD=Y`;
      const data = unwrapResponse(await cachedFetch(url));

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.TBL_ID && item.TBL_NM) {
            discovered.push({
              tblId: item.TBL_ID,
              tblNm: item.TBL_NM,
              orgId: item.ORG_ID || "101",
              catId,
            });
          }
        }
      }
    } catch (e) {
      // Silent - discovery is best-effort
    }
    await sleep(200);
  }

  if (discovered.length > 0) {
    console.log(`[kosis] Discovered ${discovered.length} tables`);
    // Log table names for debugging
    for (const t of discovered.slice(0, 20)) {
      console.log(`  - ${t.tblId}: ${t.tblNm}`);
    }
    if (discovered.length > 20) {
      console.log(`  ... and ${discovered.length - 20} more`);
    }
  }

  return discovered;
}

/**
 * Try to match discovered tables to our data fields.
 * Returns additional table configs to fetch.
 */
function matchDiscoveredTables(discovered) {
  const configs = [];

  for (const table of discovered) {
    const name = table.tblNm;
    const matchedFields = {};

    for (const [fieldKey, keywords] of Object.entries(FIELD_KEYWORDS)) {
      for (const kw of keywords) {
        if (name.includes(kw)) {
          matchedFields[fieldKey] = { itmNm: kw, parse: name.includes("수") || name.includes("건") ? "int" : "float" };
          break;
        }
      }
    }

    if (Object.keys(matchedFields).length > 0) {
      configs.push({
        key: `discovered_${table.tblId}`,
        orgId: table.orgId,
        tblId: table.tblId,
        tblNm: table.tblNm,
        itmId: "ALL",
        objL1: "ALL",
        objL2: "",
        prdSe: "Y",
        fields: matchedFields,
        regionField: "C1_NM",
      });
    }
  }

  return configs;
}

// ── Hardcoded tables (confirmed or high-confidence) ──
const KOSIS_TABLES = {
  // CONFIRMED WORKING: e-지방지표 외국인/고령인구 (DT_1YL20631)
  foreigner_aging: {
    orgId: "101",
    tblId: "DT_1YL20631",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      foreignRatio: { itmNm: "외국인", parse: "float" },
      agingRate: { itmNm: "고령", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // CONFIRMED WORKING: 재정자립도 (DT_1YL20921)
  fiscal: {
    orgId: "101",
    tblId: "DT_1YL20921",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      financialIndependence: { itmNm: "재정자립도", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // 주민등록인구 - try without objL2
  population_v2: {
    orgId: "101",
    tblId: "DT_1B040A3",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",     // Try empty (some tables don't accept "0")
    prdSe: "Y",
    fields: { population: { itmNm: null, parse: "int" } },
    regionField: "C1_NM",
  },

  // 주민등록인구 - alternative table
  population_v3: {
    orgId: "101",
    tblId: "DT_1B04005N",
    itmId: "T2",
    objL1: "ALL",
    objL2: "0",    // 총계 only (avoid 40K cell limit)
    prdSe: "Y",
    fields: { population: { itmNm: null, parse: "int" } },
    regionField: "C1_NM",
  },
};

/**
 * Fetch a single KOSIS table.
 */
async function fetchKosisTable(tableConfig, year) {
  if (!API_KEYS.kosis) return new Map();

  const params = new URLSearchParams({
    method: "getList",
    apiKey: API_KEYS.kosis,
    itmId: tableConfig.itmId,
    objL1: tableConfig.objL1,
    objL2: tableConfig.objL2 || "",
    objL3: "", objL4: "", objL5: "", objL6: "", objL7: "", objL8: "",
    format: "json",
    jsonVD: "Y",
    prdSe: tableConfig.prdSe,
    startPrdDe: String(year),
    endPrdDe: String(year),
    orgId: tableConfig.orgId,
    tblId: tableConfig.tblId,
  });

  const url = `${KOSIS_BASE}?${params.toString()}`;

  try {
    let data = unwrapResponse(await cachedFetch(url));

    if (!Array.isArray(data)) {
      if (data?.err) {
        console.warn(`[kosis:${tableConfig.tblId}] err ${data.err}: ${data.errMsg}`);
      }
      return new Map();
    }

    return parseKosisResponse(data, tableConfig);
  } catch (e) {
    console.warn(`[kosis:${tableConfig.tblId}] Fetch failed: ${e.message}`);
    return new Map();
  }
}

/**
 * Parse KOSIS API response into our region-keyed map.
 */
function parseKosisResponse(rows, table) {
  const result = new Map();

  for (const row of rows) {
    const regionName = row[table.regionField] || row.C1_NM || "";
    const provinceName = row.C1_OBJ_NM || row.UP_NM || "";
    const ourCode = matchRegionName(regionName, provinceName);
    if (!ourCode) continue;

    if (!result.has(ourCode)) result.set(ourCode, {});
    const entry = result.get(ourCode);
    const rawValue = (row.DT || row.TDT || "").replace(/,/g, "");
    const value = parseFloat(rawValue);
    if (isNaN(value)) continue;

    const itemName = row.ITM_NM || "";

    for (const [fieldKey, fieldDef] of Object.entries(table.fields)) {
      if (fieldDef.itmNm === null || (fieldDef.itmNm && itemName.includes(fieldDef.itmNm))) {
        let parsed = fieldDef.parse === "int" ? Math.round(value) : value;
        if (fieldDef.scale) parsed *= fieldDef.scale;
        // Only overwrite if we don't already have a value (first match wins)
        if (entry[fieldKey] === undefined) {
          entry[fieldKey] = parseFloat(parsed.toFixed(2));
        }
      }
    }
  }

  return result;
}

/**
 * Fetch all KOSIS data for a given year.
 * First discovers available tables, then fetches from all sources.
 */
async function fetchAllKosisData(year) {
  console.log(`\n=== KOSIS Data Fetch (year: ${year}) ===`);
  const merged = new Map();
  let successCount = 0;
  let failCount = 0;

  // Step 1: Discover available e-지방지표 tables
  const discovered = await discoverKosisTables();
  const dynamicConfigs = matchDiscoveredTables(discovered);
  if (dynamicConfigs.length > 0) {
    console.log(`[kosis] Matched ${dynamicConfigs.length} discovered tables to data fields`);
  }

  // Step 2: Fetch from hardcoded tables
  for (const [key, config] of Object.entries(KOSIS_TABLES)) {
    const tableData = await fetchKosisTable(config, year);
    if (tableData.size > 0) {
      successCount++;
      for (const [code, fields] of tableData) {
        if (!merged.has(code)) merged.set(code, {});
        const existing = merged.get(code);
        // Only set fields that don't already have values
        for (const [k, v] of Object.entries(fields)) {
          if (existing[k] === undefined) existing[k] = v;
        }
      }
      console.log(`  ✓ ${key} (${config.tblId}): ${tableData.size} regions`);
    } else {
      failCount++;
      console.log(`  ✗ ${key} (${config.tblId}): no data`);
    }
    await sleep(DELAY_MS);
  }

  // Step 3: Fetch from discovered tables
  for (const config of dynamicConfigs) {
    // Skip if we already have all the fields this table would provide
    const neededFields = Object.keys(config.fields).filter(f => {
      for (const [, existing] of merged) {
        if (existing[f] !== undefined) return false;
      }
      return true;
    });
    if (neededFields.length === 0) continue;

    const tableData = await fetchKosisTable(config, year);
    if (tableData.size > 0) {
      successCount++;
      for (const [code, fields] of tableData) {
        if (!merged.has(code)) merged.set(code, {});
        const existing = merged.get(code);
        for (const [k, v] of Object.entries(fields)) {
          if (existing[k] === undefined) existing[k] = v;
        }
      }
      console.log(`  ✓ [discovered] ${config.tblNm} (${config.tblId}): ${tableData.size} regions`);
    }
    await sleep(DELAY_MS);
  }

  // Log field coverage
  const allFields = new Set();
  for (const [, fields] of merged) {
    for (const k of Object.keys(fields)) allFields.add(k);
  }
  console.log(`KOSIS summary: ${successCount} tables ok, ${failCount} failed, ${merged.size} regions, fields: [${[...allFields].join(", ")}]`);
  return merged;
}

/**
 * Fetch historical KOSIS data for a specific table across multiple years.
 */
async function fetchKosisHistorical(tableKey, fieldKey, startYear, endYear) {
  const table = KOSIS_TABLES[tableKey];
  if (!table || !API_KEYS.kosis) return new Map();

  const params = new URLSearchParams({
    method: "getList",
    apiKey: API_KEYS.kosis,
    itmId: table.itmId,
    objL1: table.objL1,
    objL2: table.objL2 || "",
    objL3: "", objL4: "", objL5: "", objL6: "", objL7: "", objL8: "",
    format: "json",
    jsonVD: "Y",
    prdSe: table.prdSe,
    startPrdDe: String(startYear),
    endPrdDe: String(endYear),
    orgId: table.orgId,
    tblId: table.tblId,
  });

  const url = `${KOSIS_BASE}?${params.toString()}`;

  try {
    let data = unwrapResponse(await cachedFetch(url));
    if (!Array.isArray(data)) return new Map();

    const result = new Map();
    const fieldDef = table.fields[fieldKey];
    if (!fieldDef) return result;

    for (const row of data) {
      const regionName = row[table.regionField] || row.C1_NM || "";
      const provinceName = row.C1_OBJ_NM || row.UP_NM || "";
      const ourCode = matchRegionName(regionName, provinceName);
      if (!ourCode) continue;

      const year = parseInt(row.PRD_DE);
      const rawValue = (row.DT || row.TDT || "").replace(/,/g, "");
      const value = parseFloat(rawValue);
      const itemName = row.ITM_NM || "";

      if (isNaN(value)) continue;
      if (fieldDef.itmNm === null || (fieldDef.itmNm && itemName.includes(fieldDef.itmNm))) {
        if (!result.has(ourCode)) result.set(ourCode, new Map());
        let parsed = fieldDef.parse === "int" ? Math.round(value) : value;
        if (fieldDef.scale) parsed *= fieldDef.scale;
        result.get(ourCode).set(year, parseFloat(parsed.toFixed(2)));
      }
    }

    return result;
  } catch (e) {
    console.warn(`[kosis:historical:${tableKey}] Failed: ${e.message}`);
    return new Map();
  }
}

const HISTORICAL_FIELD_MAP = {
  financialIndependence: { tableKey: "fiscal", fieldKey: "financialIndependence" },
};

module.exports = {
  fetchAllKosisData,
  fetchKosisTable,
  fetchKosisHistorical,
  KOSIS_TABLES,
  HISTORICAL_FIELD_MAP,
};
