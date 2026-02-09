/**
 * KOSIS (통계청) OpenAPI wrapper.
 * Fetches 시군구-level statistics from KOSIS tables.
 *
 * Strategy:
 * 1. Use statisticsList API to discover available e-지방지표 tables
 * 2. Fetch data from discovered + hardcoded tables
 * 3. Match regions by NAME (C1_NM / C2_NM) since KOSIS uses 행정구역코드, we use SGIS codes
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
  population: ["총인구", "인구수", "인구현황"],
  populationGrowth: ["인구증가", "인구증감"],
  agingRate: ["고령인구", "65세이상", "고령화"],
  youthRatio: ["청년인구", "청년비율"],
  birthRate: ["출생", "조출생"],
  foreignRatio: ["외국인", "외국인주민"],
  netMigration: ["순이동", "전입전출"],
  grdp: ["지역내총생산", "GRDP"],
  taxRevenue: ["지방세", "세입"],
  financialIndependence: ["재정자립도"],
  companyCount: ["사업체수", "사업체 수"],
  employeeCount: ["종사자수", "종사자 수"],
  employmentRate: ["고용률"],
  unemploymentRate: ["실업률"],
  roadDensity: ["도로율", "도로포장"],
  waterSupply: ["상수도보급률", "상수도"],
  sewerageRate: ["하수도보급률", "하수도"],
  parkArea: ["공원면적", "1인당 공원"],
  crimeRate: ["범죄발생", "범죄"],
  trafficAccidents: ["교통사고"],
  fireIncidents: ["화재발생", "화재"],
  hospitalCount: ["의료기관수", "의료기관"],
  doctorCount: ["의사수", "의사"],
  schoolCount: ["학교수", "학교 수"],
  studentCount: ["학생수", "학생 수"],
  libraryCount: ["도서관수", "도서관"],
  airQuality: ["미세먼지", "대기오염"],
  greenAreaRatio: ["녹지비율", "녹지율"],
  wasteGeneration: ["폐기물", "쓰레기"],
  culturalFacilities: ["문화시설", "문화기반"],
  touristVisitors: ["관광객", "관광"],
  accommodations: ["숙박시설", "숙박업"],
};

/**
 * Discover available e-지방지표 tables from KOSIS.
 * Uses statisticsList.do API with recursive drill-down.
 */
async function discoverKosisTables() {
  if (!API_KEYS.kosis) return [];

  console.log("[kosis] Discovering available e-지방지표 tables...");

  const discovered = [];

  // Step 1: Try root with empty parentListId
  let categoryIds = [];
  try {
    const rootUrl = `https://kosis.kr/openapi/statisticsList.do?method=getList&apiKey=${API_KEYS.kosis}&vwCd=MT_GTITLE01&parentListId=&format=json&jsonVD=Y`;
    const rootData = unwrapResponse(await cachedFetch(rootUrl));

    console.log(`[kosis:discovery] Root response: type=${typeof rootData}, isArray=${Array.isArray(rootData)}`);

    if (Array.isArray(rootData) && rootData.length > 0) {
      console.log(`[kosis:discovery] Root returned ${rootData.length} items`);
      for (const item of rootData.slice(0, 5)) {
        console.log(`  LIST_ID=${item.LIST_ID || "N/A"}, LIST_NM=${item.LIST_NM || "N/A"}, TBL_ID=${item.TBL_ID || "none"}`);
      }

      // Collect categories (items with LIST_ID but no TBL_ID)
      for (const item of rootData) {
        if (item.TBL_ID && item.TBL_NM) {
          discovered.push({ tblId: item.TBL_ID, tblNm: item.TBL_NM, orgId: item.ORG_ID || "101" });
        } else if (item.LIST_ID) {
          categoryIds.push(item.LIST_ID);
        }
      }
    } else if (rootData && typeof rootData === "object" && !Array.isArray(rootData)) {
      // Log non-array response for debugging
      console.log(`[kosis:discovery] Root returned object: ${JSON.stringify(rootData).substring(0, 300)}`);
    }
  } catch (e) {
    console.log(`[kosis:discovery] Root query failed: ${e.message}`);
  }

  // Step 2: If root returned nothing, try known category prefixes
  if (categoryIds.length === 0 && discovered.length === 0) {
    console.log("[kosis:discovery] Root returned no categories, trying known prefixes...");
    categoryIds = [
      "A", "A_01", "A_02", "A_03", "A_04", "A_05", "A_06", "A_07", "A_08", "A_09", "A_10", "A_11", "A_12",
      "F_29", "F_29_001", "F_29_002", "F_29_003", "F_29_004", "F_29_005", "F_29_006", "F_29_007", "F_29_008",
    ];
  }

  // Step 3: Drill into categories (level 1)
  const subCategoryIds = [];
  for (const catId of categoryIds) {
    try {
      const url = `https://kosis.kr/openapi/statisticsList.do?method=getList&apiKey=${API_KEYS.kosis}&vwCd=MT_GTITLE01&parentListId=${catId}&format=json&jsonVD=Y`;
      const data = unwrapResponse(await cachedFetch(url));

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.TBL_ID && item.TBL_NM) {
            discovered.push({ tblId: item.TBL_ID, tblNm: item.TBL_NM, orgId: item.ORG_ID || "101" });
          } else if (item.LIST_ID) {
            subCategoryIds.push(item.LIST_ID);
          }
        }
      } else if (data && !Array.isArray(data) && catId.length <= 5) {
        // Log non-array for short category IDs (debugging)
        console.log(`[kosis:discovery] catId=${catId}: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (e) {
      // Silent
    }
    await sleep(150);
  }

  // Step 4: Drill into subcategories (level 2) if any
  if (subCategoryIds.length > 0) {
    console.log(`[kosis:discovery] Drilling ${subCategoryIds.length} subcategories...`);
    for (const subId of subCategoryIds.slice(0, 30)) {
      try {
        const url = `https://kosis.kr/openapi/statisticsList.do?method=getList&apiKey=${API_KEYS.kosis}&vwCd=MT_GTITLE01&parentListId=${subId}&format=json&jsonVD=Y`;
        const data = unwrapResponse(await cachedFetch(url));

        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.TBL_ID && item.TBL_NM) {
              discovered.push({ tblId: item.TBL_ID, tblNm: item.TBL_NM, orgId: item.ORG_ID || "101" });
            }
          }
        }
      } catch (e) {
        // Silent
      }
      await sleep(150);
    }
  }

  if (discovered.length > 0) {
    console.log(`[kosis] Discovered ${discovered.length} tables`);
    for (const t of discovered.slice(0, 30)) {
      console.log(`  - ${t.tblId}: ${t.tblNm}`);
    }
    if (discovered.length > 30) {
      console.log(`  ... and ${discovered.length - 30} more`);
    }
  } else {
    console.log("[kosis:discovery] No tables discovered (will use hardcoded tables only)");
  }

  return discovered;
}

/**
 * Try to match discovered tables to our data fields.
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

// ══════════════════════════════════════════════
// Hardcoded tables (confirmed + research-based)
// ══════════════════════════════════════════════
const KOSIS_TABLES = {
  // ── CONFIRMED WORKING ──

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

  population_v2: {
    orgId: "101",
    tblId: "DT_1B040A3",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: { population: { itmNm: null, parse: "int" } },
    regionField: "C1_NM",
  },

  population_v3: {
    orgId: "101",
    tblId: "DT_1B04005N",
    itmId: "T2",
    objL1: "ALL",
    objL2: "0",
    prdSe: "Y",
    fields: { population: { itmNm: null, parse: "int" } },
    regionField: "C1_NM",
  },

  // ── NEW: Research-based tables (e-지방지표 DT_1YL series) ──

  birth: {
    orgId: "101",
    tblId: "DT_1YL20601",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      birthRate: { itmNm: "출생", parse: "float" },
    },
    regionField: "C1_NM",
  },

  crime: {
    orgId: "101",
    tblId: "DT_1YL20671",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      crimeRate: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  traffic_accidents: {
    orgId: "101",
    tblId: "DT_1YL20681",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      trafficAccidents: { itmNm: null, parse: "int" },
    },
    regionField: "C1_NM",
  },

  fire: {
    orgId: "101",
    tblId: "DT_1YL20691",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      fireIncidents: { itmNm: null, parse: "int" },
    },
    regionField: "C1_NM",
  },

  healthcare: {
    orgId: "101",
    tblId: "DT_1YL20981",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      hospitalCount: { itmNm: "의료기관", parse: "int" },
      doctorCount: { itmNm: "의사", parse: "int" },
    },
    regionField: "C1_NM",
  },

  road: {
    orgId: "101",
    tblId: "DT_1YL21091",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      roadDensity: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  water_supply: {
    orgId: "101",
    tblId: "DT_1YL21101",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      waterSupply: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  sewerage: {
    orgId: "101",
    tblId: "DT_1YL21111",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      sewerageRate: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  park: {
    orgId: "101",
    tblId: "DT_1YL21121",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      parkArea: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  air_quality: {
    orgId: "101",
    tblId: "DT_1YL21131",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      airQuality: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  culture: {
    orgId: "101",
    tblId: "DT_1YL21161",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      culturalFacilities: { itmNm: null, parse: "int" },
    },
    regionField: "C1_NM",
  },

  // Combined safety table (alternative IDs)
  safety_combined: {
    orgId: "101",
    tblId: "DT_1YL3001",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      crimeRate: { itmNm: "범죄", parse: "float" },
      trafficAccidents: { itmNm: "교통사고", parse: "int" },
      fireIncidents: { itmNm: "화재", parse: "int" },
    },
    regionField: "C1_NM",
  },

  // 사업체수/종사자수 (orgId=118 고용노동부)
  business_census: {
    orgId: "118",
    tblId: "DT_SAUP120",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "ALL",
    prdSe: "Y",
    fields: {
      companyCount: { itmNm: "사업체수", parse: "int" },
      employeeCount: { itmNm: "종사자수", parse: "int" },
    },
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

    // Debug: log first row structure for new tables
    if (data.length > 0) {
      const sample = data[0];
      const keys = Object.keys(sample);
      // Only log debug for tables that might have C2_NM
      if (sample.C2_NM !== undefined) {
        console.log(`[kosis:${tableConfig.tblId}] 2-level: C1="${sample.C1_NM}", C2="${sample.C2_NM}", ITM="${sample.ITM_NM}"`);
      }
    }

    return parseKosisResponse(data, tableConfig);
  } catch (e) {
    console.warn(`[kosis:${tableConfig.tblId}] Fetch failed: ${e.message}`);
    return new Map();
  }
}

/**
 * Parse KOSIS API response into our region-keyed map.
 * Handles both 1-level (C1_NM=시군구) and 2-level (C1_NM=시도, C2_NM=시군구) tables.
 */
function parseKosisResponse(rows, table) {
  const result = new Map();

  // Detect 2-level tables (C1=province, C2=district)
  const hasTwoLevels = rows.length > 0 && rows[0].C2_NM && rows[0].C2_NM.trim() !== "";

  for (const row of rows) {
    let regionName, provinceName;

    if (hasTwoLevels) {
      // Two-level: C1=시도, C2=시군구
      regionName = (row.C2_NM || "").trim();
      provinceName = (row.C1_NM || "").trim();
      // Skip province-level aggregates (e.g., "소계", "합계")
      if (!regionName || regionName === "소계" || regionName === "합계" || regionName === "계") continue;
    } else {
      // Single-level: C1=시군구 (or composite like "서울특별시 종로구")
      regionName = (row[table.regionField] || row.C1_NM || "").trim();
      provinceName = (row.C1_OBJ_NM || row.UP_NM || "").trim();
    }

    const ourCode = matchRegionName(regionName, provinceName);
    if (!ourCode) continue;

    if (!result.has(ourCode)) result.set(ourCode, {});
    const entry = result.get(ourCode);
    const rawValue = (row.DT || row.TDT || "").replace(/,/g, "").replace(/-$/, "");
    const value = parseFloat(rawValue);
    if (isNaN(value)) continue;

    const itemName = row.ITM_NM || "";

    for (const [fieldKey, fieldDef] of Object.entries(table.fields)) {
      if (fieldDef.itmNm === null || (fieldDef.itmNm && itemName.includes(fieldDef.itmNm))) {
        let parsed = fieldDef.parse === "int" ? Math.round(value) : value;
        if (fieldDef.scale) parsed *= fieldDef.scale;
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
        for (const [k, v] of Object.entries(fields)) {
          if (existing[k] === undefined) existing[k] = v;
        }
      }
      console.log(`  ✓ ${key} (${config.tblId}): ${tableData.size} regions`);
    } else {
      failCount++;
    }
    await sleep(DELAY_MS);
  }

  // Step 3: Fetch from discovered tables (skip fields we already have)
  for (const config of dynamicConfigs) {
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
  console.log(`KOSIS summary: ${successCount} ok, ${failCount} failed, ${merged.size} regions, fields: [${[...allFields].sort().join(", ")}]`);
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

    // Detect 2-level
    const hasTwoLevels = data.length > 0 && data[0].C2_NM && data[0].C2_NM.trim() !== "";

    for (const row of data) {
      let regionName, provinceName;
      if (hasTwoLevels) {
        regionName = (row.C2_NM || "").trim();
        provinceName = (row.C1_NM || "").trim();
        if (!regionName || regionName === "소계" || regionName === "합계") continue;
      } else {
        regionName = (row[table.regionField] || row.C1_NM || "").trim();
        provinceName = (row.C1_OBJ_NM || row.UP_NM || "").trim();
      }

      const ourCode = matchRegionName(regionName, provinceName);
      if (!ourCode) continue;

      const year = parseInt(row.PRD_DE);
      const rawValue = (row.DT || row.TDT || "").replace(/,/g, "").replace(/-$/, "");
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

// ── Historical field map: which tables provide multi-year data ──
const HISTORICAL_FIELD_MAP = {
  financialIndependence: { tableKey: "fiscal", fieldKey: "financialIndependence" },
  population: { tableKey: "population_v3", fieldKey: "population" },
  foreignRatio: { tableKey: "foreigner_aging", fieldKey: "foreignRatio" },
  agingRate: { tableKey: "foreigner_aging", fieldKey: "agingRate" },
  birthRate: { tableKey: "birth", fieldKey: "birthRate" },
  companyCount: { tableKey: "business_census", fieldKey: "companyCount" },
  employeeCount: { tableKey: "business_census", fieldKey: "employeeCount" },
  hospitalCount: { tableKey: "healthcare", fieldKey: "hospitalCount" },
  crimeRate: { tableKey: "crime", fieldKey: "crimeRate" },
  airQuality: { tableKey: "air_quality", fieldKey: "airQuality" },
};

module.exports = {
  fetchAllKosisData,
  fetchKosisTable,
  fetchKosisHistorical,
  KOSIS_TABLES,
  HISTORICAL_FIELD_MAP,
};
