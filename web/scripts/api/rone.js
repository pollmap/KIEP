/**
 * R-ONE (부동산통계정보) API wrapper.
 * Fetches real estate statistics by 시군구.
 *
 * API: https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do
 * Note: R-ONE uses region NAMES not codes, requires name matching.
 * Response mixes 시군구 and 읍면동 levels — must filter.
 */
const { API_KEYS, RONE_BASE, REGIONS, nameToCode, PROVINCES } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Unwrap _raw responses from stale cache ──
function unwrapResponse(data) {
  if (data && data._raw && typeof data._raw === "string") {
    try { return JSON.parse(data._raw); } catch { return data; }
  }
  return data;
}

// R-ONE statistical table IDs
const RONE_TABLES = {
  landPrice: {
    STATBL_ID: "A_2024_00900",   // 지가변동률 (시군구) - CONFIRMED 5359 rows
    fields: { priceChangeRate: null },
  },
  aptPrice: {
    STATBL_ID: "A_2024_00045",   // 아파트 매매가격지수 (시군구)
    fields: { aptPrice: null },
  },
};

// Build name → code map with province-aware matching
function buildRoneNameMap() {
  const map = new Map();
  for (const r of REGIONS) {
    const prov = PROVINCES[r.provincePrefix] || "";
    const shortProv = prov.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
    // Full province: "서울특별시 종로구"
    map.set(`${prov} ${r.name}`, r.code);
    // Short province: "서울 종로구"
    map.set(`${shortProv} ${r.name}`, r.code);
    // Just name (null = ambiguous if duplicate)
    map.set(r.name, map.has(r.name) ? null : r.code);
    // Also try with province prefix as two chars
    map.set(`${shortProv}${r.name}`, r.code);
  }
  return map;
}

function matchRoneName(clsNm, roneNameMap) {
  if (!clsNm) return null;
  const clean = clsNm.trim().replace(/\s+/g, " ");

  // Direct match
  const direct = roneNameMap.get(clean);
  if (direct) return direct;

  // Try removing common prefixes/suffixes
  for (const [name, code] of roneNameMap) {
    if (!code) continue;
    if (clean.endsWith(name.split(" ").pop())) {
      if (clean.includes(name.split(" ")[0])) return code;
    }
  }

  return null;
}

/**
 * Check if a CLS_NM value looks like 읍면동 (sub-district) level.
 * 시군구 names end in 시/군/구. 읍면동 end in 읍/면/동/리/가.
 * Returns true if the name should be SKIPPED (is 읍면동 level).
 */
function isEupMyeonDongLevel(clsNm) {
  if (!clsNm) return false;
  const name = clsNm.trim();

  // Skip province-level aggregates
  if (name.endsWith("전체") || name === "전국" || name === "합계" || name === "소계") return true;

  // Explicit 읍/면 suffix → definitely sub-district
  if (/[읍면]$/.test(name)) return true;

  // Short name ending in 동 (≤4 chars) without 구/시/군 → likely 읍면동
  // But names like "해운대구" (contains 구), "강릉시" (contains 시) are 시군구
  if (name.length <= 4 && /동$/.test(name) && !/[구시군]/.test(name)) return true;

  // Names ending in 리/가 → 읍면동 level
  if (/[리가]$/.test(name) && name.length <= 5) return true;

  return false;
}

/**
 * Discover available R-ONE statistical tables.
 * Uses SttsApiTbl.do endpoint for diagnostics.
 */
async function discoverRoneTables() {
  if (!API_KEYS.rone) return [];

  const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTbl.do?KEY=${API_KEYS.rone}`;
  try {
    const raw = await cachedFetch(url);
    const data = unwrapResponse(raw);

    // Response structure: SttsApiTbl[1].row[] with STATBL_ID, STATBL_NM, etc.
    const rows = data?.SttsApiTbl?.[1]?.row
      || data?.SttsApiTbl?.row
      || data?.row
      || [];

    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`[rone:discovery] Found ${rows.length} available tables:`);
      for (const r of rows.slice(0, 15)) {
        console.log(`  - ${r.STATBL_ID}: ${r.STATBL_NM || "unnamed"} (${r.DTACYCLE_CD || "?"})`);
      }
      if (rows.length > 15) console.log(`  ... and ${rows.length - 15} more`);
      return rows;
    } else {
      const preview = JSON.stringify(data).substring(0, 300);
      console.log(`[rone:discovery] Unexpected response: ${preview}`);
    }
  } catch (e) {
    console.log(`[rone:discovery] Failed: ${e.message}`);
  }
  return [];
}

/**
 * Fetch R-ONE data for a given year.
 */
async function fetchAllRoneData(year) {
  console.log(`\n=== R-ONE Data Fetch (year: ${year}) ===`);

  if (!API_KEYS.rone) {
    console.warn("[rone] No API key configured");
    return new Map();
  }

  // Discover available tables for diagnostics
  await discoverRoneTables();

  const roneNameMap = buildRoneNameMap();
  const merged = new Map();

  for (const [tableKey, table] of Object.entries(RONE_TABLES)) {
    try {
      const params = new URLSearchParams({
        KEY: API_KEYS.rone,
        STATBL_ID: table.STATBL_ID,
        DTACYCLE_CD: "YY",
        WRTTIME_IDTFR_ID: String(year),
        Type: "json",
      });
      const url = `${RONE_BASE}?${params.toString()}`;
      const raw = await cachedFetch(url);
      const data = unwrapResponse(raw);

      // R-ONE response structure varies - try multiple paths
      const rows = data?.SttsApiTblData?.[1]?.row
        || data?.SttsApiTblData?.row
        || data?.row
        || data?.body?.items
        || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        const preview = JSON.stringify(data).substring(0, 300);
        console.log(`  ✗ ${tableKey}: no rows. Response: ${preview}`);
        continue;
      }

      // Debug: log first 3 rows
      console.log(`  [rone:debug] ${tableKey}: ${rows.length} total rows`);
      console.log(`  [rone:debug] Row keys: ${Object.keys(rows[0]).join(", ")}`);
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const r = rows[i];
        console.log(`  [rone:debug] row[${i}]: CLS_NM="${r.CLS_NM || "N/A"}", CLS1_NM="${r.CLS1_NM || "N/A"}", CLS2_NM="${r.CLS2_NM || "N/A"}", ITM_NM="${r.ITM_NM || "N/A"}", DTA_VAL="${r.DTA_VAL || "N/A"}"`);
      }

      let matched = 0;
      let unmatched = 0;
      let filtered = 0;
      const unmatchedSamples = [];

      for (const row of rows) {
        // Filter out 읍면동-level rows (keep only 시군구 level)
        const clsForFilter = row.CLS_NM || row.CLS2_NM || "";
        if (isEupMyeonDongLevel(clsForFilter)) {
          filtered++;
          continue;
        }

        let code = null;

        // Priority 1: CLS1_NM (province) + CLS2_NM (district)
        if (!code && row.CLS2_NM && row.CLS1_NM) {
          const combined = `${row.CLS1_NM.trim()} ${row.CLS2_NM.trim()}`;
          code = matchRoneName(combined, roneNameMap);
          if (!code) {
            const shortProv = row.CLS1_NM.trim().replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
            code = matchRoneName(`${shortProv} ${row.CLS2_NM.trim()}`, roneNameMap);
          }
          if (!code) {
            code = matchRoneName(row.CLS2_NM.trim(), roneNameMap);
          }
        }

        // Priority 2: CLS_NM alone (may be composite "서울특별시 종로구")
        if (!code && row.CLS_NM) {
          code = matchRoneName(row.CLS_NM, roneNameMap);
        }

        if (!code) {
          unmatched++;
          if (unmatchedSamples.length < 5) {
            unmatchedSamples.push(row.CLS_NM || row.CLS2_NM || row.CLS1_NM || "empty");
          }
          continue;
        }

        if (!merged.has(code)) merged.set(code, {});
        const value = parseFloat(row.DTA_VAL);
        if (isNaN(value)) continue;

        const itmNm = row.ITM_NM || "";
        for (const [field, keyword] of Object.entries(table.fields)) {
          if (keyword === null || itmNm.includes(keyword) || Object.keys(table.fields).length === 1) {
            merged.get(code)[field] = value;
            matched++;
          }
        }
      }

      console.log(`  ✓ ${tableKey}: ${matched} values matched, ${unmatched} unmatched, ${filtered} filtered (읍면동)`);
      if (unmatchedSamples.length > 0) {
        console.log(`  [rone:debug] Unmatched samples: ${unmatchedSamples.join(", ")}`);
      }
    } catch (e) {
      console.log(`  ✗ ${tableKey}: ${e.message}`);
    }

    await sleep(300);
  }

  console.log(`R-ONE summary: ${merged.size} regions with data`);
  return merged;
}

module.exports = { fetchAllRoneData };
