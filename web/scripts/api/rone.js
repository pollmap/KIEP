/**
 * R-ONE (부동산통계정보) API wrapper.
 * Fetches real estate statistics by 시군구.
 *
 * API: https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do
 * Note: R-ONE uses region NAMES not codes, requires name matching.
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
 * Fetch R-ONE data for a given year.
 */
async function fetchAllRoneData(year) {
  console.log(`\n=== R-ONE Data Fetch (year: ${year}) ===`);

  if (!API_KEYS.rone) {
    console.warn("[rone] No API key configured");
    return new Map();
  }

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

      // Debug: log first 5 rows to understand field structure
      console.log(`  [rone:debug] ${tableKey}: ${rows.length} total rows`);
      console.log(`  [rone:debug] Row keys: ${Object.keys(rows[0]).join(", ")}`);
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const r = rows[i];
        console.log(`  [rone:debug] row[${i}]: CLS_NM="${r.CLS_NM || "N/A"}", CLS_ID="${r.CLS_ID || "N/A"}", CLS1_NM="${r.CLS1_NM || "N/A"}", CLS2_NM="${r.CLS2_NM || "N/A"}", ITM_NM="${r.ITM_NM || "N/A"}", DTA_VAL="${r.DTA_VAL || "N/A"}"`);
      }

      let matched = 0;
      let unmatched = 0;
      const unmatchedSamples = [];

      for (const row of rows) {
        // Try multiple CLS field combinations for matching
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

      console.log(`  ✓ ${tableKey}: ${matched} values matched, ${unmatched} unmatched`);
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
