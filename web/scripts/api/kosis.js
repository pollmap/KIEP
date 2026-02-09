/**
 * KOSIS (통계청) OpenAPI wrapper.
 * Fetches 시군구-level statistics from multiple KOSIS tables.
 *
 * API docs: https://kosis.kr/openapi/index/index.jsp
 * Key: KOSIS uses standard 행정구역코드, our system uses SGIS codes.
 * Matching is done by region NAME (C1_NM / C2_NM) not code.
 */
const { API_KEYS, KOSIS_BASE, REGIONS, matchRegionName, PROVINCES } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const DELAY_MS = 300; // Rate limit between calls
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * KOSIS table definitions.
 * Each entry maps our fields to a KOSIS table.
 * Note: tblId values are best-effort. If a table fails, it's silently skipped.
 */
const KOSIS_TABLES = {
  // ── 주민등록인구 (총인구) ──
  population: {
    orgId: "101",
    tblId: "DT_1B040A3",
    itmId: "T2",       // 총인구수
    objL1: "ALL",      // 시군구 전체
    objL2: "",
    prdSe: "Y",
    fields: { population: { itmFilter: null, parse: "int" } },
    regionField: "C1_NM",
  },

  // ── 연령별 인구 (고령화율, 청년비율) ──
  populationAge: {
    orgId: "101",
    tblId: "DT_1B04005N",
    itmId: "ALL",
    objL1: "ALL",      // 시군구
    objL2: "ALL",      // 연령
    prdSe: "Y",
    fields: {
      agingRate: { compute: "aging" },     // 65세이상 / 총인구 * 100
      youthRatio: { compute: "youth" },    // 15-34세 / 총인구 * 100
    },
    regionField: "C1_NM",
    special: "ageStructure",
  },

  // ── 사업체조사 (사업체수, 종사자수) ──
  business: {
    orgId: "101",
    tblId: "DT_1K52B01",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      companyCount: { itmNm: "사업체수", parse: "int" },
      employeeCount: { itmNm: "종사자수", parse: "int" },
    },
    regionField: "C1_NM",
  },

  // ── 지역내총생산 (GRDP) ──
  grdp: {
    orgId: "101",
    tblId: "DT_1C65",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      grdp: { itmNm: "지역내총생산", parse: "float", scale: 0.001 }, // 백만원→십억원
    },
    regionField: "C1_NM",
  },

  // ── 지방재정 (세입, 재정자립도) ──
  fiscal: {
    orgId: "101",
    tblId: "DT_1YL20921",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      taxRevenue: { itmNm: "지방세", parse: "float" },
      financialIndependence: { itmNm: "재정자립도", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // ── 고용률/실업률 ──
  employment: {
    orgId: "101",
    tblId: "DT_1ES4F01",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      employmentRate: { itmNm: "고용률", parse: "float" },
      unemploymentRate: { itmNm: "실업률", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // ── 인구동태 (출생률) ──
  birthDeath: {
    orgId: "101",
    tblId: "DT_1IN1503",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      birthRate: { itmNm: "출생", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // ── 학교/학생 수 ──
  education: {
    orgId: "334",
    tblId: "DT_334N_A1",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      schoolCount: { itmNm: "학교수", parse: "int" },
      studentCount: { itmNm: "학생수", parse: "int" },
    },
    regionField: "C1_NM",
  },

  // ── 의료기관 ──
  healthcare: {
    orgId: "354",
    tblId: "DT_354N_AA",
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

  // ── 범죄통계 ──
  crime: {
    orgId: "132",
    tblId: "DT_132N_01",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      crimeRate: { itmNm: null, parse: "float" },
    },
    regionField: "C1_NM",
  },

  // ── 교통사고 ──
  traffic: {
    orgId: "132",
    tblId: "DT_132N_04",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      trafficAccidents: { itmNm: null, parse: "int" },
    },
    regionField: "C1_NM",
  },

  // ── 대기질 (미세먼지) ──
  airQuality: {
    orgId: "106",
    tblId: "DT_106N_01",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      airQuality: { itmNm: "미세먼지", parse: "float" },
    },
    regionField: "C1_NM",
  },

  // ── 상하수도 보급률 ──
  waterInfra: {
    orgId: "106",
    tblId: "DT_106N_04",
    itmId: "ALL",
    objL1: "ALL",
    objL2: "",
    prdSe: "Y",
    fields: {
      waterSupply: { itmNm: "상수도", parse: "float" },
      sewerageRate: { itmNm: "하수도", parse: "float" },
    },
    regionField: "C1_NM",
  },
};

/**
 * Fetch a single KOSIS table.
 * Returns Map<ourRegionCode, { field1: value1, field2: value2 }>
 */
async function fetchKosisTable(tableKey, year) {
  const table = KOSIS_TABLES[tableKey];
  if (!table) return new Map();
  if (!API_KEYS.kosis) {
    console.warn(`[kosis] No API key configured, skipping ${tableKey}`);
    return new Map();
  }

  const params = new URLSearchParams({
    method: "getList",
    apiKey: API_KEYS.kosis,
    itmId: table.itmId,
    objL1: table.objL1,
    objL2: table.objL2 || "",
    objL3: "",
    objL4: "",
    objL5: "",
    objL6: "",
    objL7: "",
    objL8: "",
    format: "json",
    jsonVD: "Y",
    prdSe: table.prdSe,
    startPrdDe: String(year),
    endPrdDe: String(year),
    orgId: table.orgId,
    tblId: table.tblId,
  });

  const url = `${KOSIS_BASE}?${params.toString()}`;

  try {
    const data = await cachedFetch(url);

    if (!Array.isArray(data)) {
      // KOSIS returns error as object - log full response for debugging
      const errMsg = data?.err || data?.errMsg || data?.message || data?.result?.message || "";
      const errCode = data?.errCd || data?.result?.code || "";
      if (errMsg || errCode) {
        console.warn(`[kosis:${tableKey}] API error (${errCode}): ${errMsg}`);
      } else {
        // Dump first 300 chars of response for diagnosis
        const preview = JSON.stringify(data).substring(0, 300);
        console.warn(`[kosis:${tableKey}] Non-array response: ${preview}`);
      }
      return new Map();
    }

    console.log(`[kosis:${tableKey}] Received ${data.length} rows for year ${year}`);
    return parseKosisResponse(data, table);
  } catch (e) {
    console.warn(`[kosis:${tableKey}] Fetch failed: ${e.message}`);
    return new Map();
  }
}

/**
 * Parse KOSIS API response into our region-keyed map.
 */
function parseKosisResponse(rows, table) {
  const result = new Map();

  for (const row of rows) {
    // Get region name from response
    const regionName = row[table.regionField] || row.C1_NM || "";
    // Try to get parent region (province) for disambiguation
    const provinceName = row.C1_OBJ_NM || row.UP_NM || "";

    const ourCode = matchRegionName(regionName, provinceName);
    if (!ourCode) continue;

    if (!result.has(ourCode)) {
      result.set(ourCode, {});
    }
    const entry = result.get(ourCode);
    const value = parseFloat(row.DT || row.TDT || "0");
    const itemName = row.ITM_NM || row.ITM_NM_ENG || "";

    // Match fields by item name pattern
    for (const [fieldKey, fieldDef] of Object.entries(table.fields)) {
      if (fieldDef.itmNm === null || (fieldDef.itmNm && itemName.includes(fieldDef.itmNm))) {
        let parsed = fieldDef.parse === "int" ? Math.round(value) : value;
        if (fieldDef.scale) parsed *= fieldDef.scale;
        entry[fieldKey] = parseFloat(parsed.toFixed(2));
      }
    }
  }

  return result;
}

/**
 * Fetch all KOSIS data for a given year.
 * Returns Map<ourRegionCode, Partial<RegionData>>
 */
async function fetchAllKosisData(year) {
  console.log(`\n=== KOSIS Data Fetch (year: ${year}) ===`);
  const merged = new Map();

  const tableKeys = Object.keys(KOSIS_TABLES);
  let successCount = 0;
  let failCount = 0;

  for (const key of tableKeys) {
    try {
      const tableData = await fetchKosisTable(key, year);
      if (tableData.size > 0) {
        successCount++;
        // Merge into main map
        for (const [code, fields] of tableData) {
          if (!merged.has(code)) merged.set(code, {});
          Object.assign(merged.get(code), fields);
        }
        console.log(`  ✓ ${key}: ${tableData.size} regions`);
      } else {
        failCount++;
        console.log(`  ✗ ${key}: no data`);
      }
    } catch (e) {
      failCount++;
      console.log(`  ✗ ${key}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`KOSIS summary: ${successCount} tables succeeded, ${failCount} failed, ${merged.size} regions with data`);
  return merged;
}

/**
 * Fetch historical KOSIS data for a specific table across multiple years.
 * Returns Map<ourRegionCode, Map<year, value>>
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
    const data = await cachedFetch(url);
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
      const value = parseFloat(row.DT || row.TDT || "0");
      const itemName = row.ITM_NM || "";

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

// Map our field names to KOSIS table/field keys for historical data
const HISTORICAL_FIELD_MAP = {
  population: { tableKey: "population", fieldKey: "population" },
  companyCount: { tableKey: "business", fieldKey: "companyCount" },
  employeeCount: { tableKey: "business", fieldKey: "employeeCount" },
  grdp: { tableKey: "grdp", fieldKey: "grdp" },
  taxRevenue: { tableKey: "fiscal", fieldKey: "taxRevenue" },
  financialIndependence: { tableKey: "fiscal", fieldKey: "financialIndependence" },
  employmentRate: { tableKey: "employment", fieldKey: "employmentRate" },
  birthRate: { tableKey: "birthDeath", fieldKey: "birthRate" },
  schoolCount: { tableKey: "education", fieldKey: "schoolCount" },
  hospitalCount: { tableKey: "healthcare", fieldKey: "hospitalCount" },
  crimeRate: { tableKey: "crime", fieldKey: "crimeRate" },
  airQuality: { tableKey: "airQuality", fieldKey: "airQuality" },
};

module.exports = {
  fetchAllKosisData,
  fetchKosisTable,
  fetchKosisHistorical,
  KOSIS_TABLES,
  HISTORICAL_FIELD_MAP,
};
