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
// landPrice A_2024_00900 confirmed working (5359 rows)
const RONE_TABLES = {
  landPrice: {
    STATBL_ID: "A_2024_00900",   // 지가변동률 (시군구) - CONFIRMED
    fields: { priceChangeRate: null },  // null = take any ITM_NM
  },
};

// Build name → code map with province-aware matching
function buildRoneNameMap() {
  const map = new Map();
  for (const r of REGIONS) {
    // R-ONE format variations: "서울 종로구", "종로구", "서울특별시 종로구"
    const prov = PROVINCES[r.provincePrefix] || "";
    const shortProv = prov.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
    map.set(`${shortProv} ${r.name}`, r.code);
    map.set(`${prov} ${r.name}`, r.code);
    map.set(r.name, map.has(r.name) ? null : r.code); // null = ambiguous
  }
  return map;
}

function matchRoneName(clsNm, roneNameMap) {
  if (!clsNm) return null;
  const clean = clsNm.trim().replace(/\s+/g, " ");

  // Direct match
  const direct = roneNameMap.get(clean);
  if (direct) return direct;

  // Try removing common prefixes
  for (const [name, code] of roneNameMap) {
    if (code && clean.endsWith(name.split(" ").pop())) {
      if (clean.includes(name.split(" ")[0])) return code;
    }
  }

  return null;
}

/**
 * Fetch R-ONE data for a given year.
 * Returns Map<ourRegionCode, { avgLandPrice, priceChangeRate, aptPrice, aptChangeRate }>
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
        console.log(`  ✗ ${tableKey}: no data. Response: ${preview}`);
        continue;
      }

      let matched = 0;
      for (const row of rows) {
        const code = matchRoneName(row.CLS_NM, roneNameMap);
        if (!code) continue;
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

      console.log(`  ✓ ${tableKey}: ${matched} values matched`);
    } catch (e) {
      console.log(`  ✗ ${tableKey}: ${e.message}`);
    }

    await sleep(300);
  }

  console.log(`R-ONE summary: ${merged.size} regions with data`);
  return merged;
}

module.exports = { fetchAllRoneData };
