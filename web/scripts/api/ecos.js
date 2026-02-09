/**
 * 한국은행 경제통계시스템 (ECOS) API wrapper.
 * Fetches regional economic indicators.
 *
 * API: https://ecos.bok.or.kr/api/
 * Note: ECOS data is mostly 시도(province) level, not 시군구.
 * We distribute province-level values to 시군구 proportionally.
 */
const { API_KEYS, ECOS_BASE, REGIONS, PROVINCES } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Province name normalization for ECOS matching
const ECOS_PROVINCE_MAP = {
  "서울": "11", "부산": "21", "대구": "22", "인천": "23",
  "광주": "24", "대전": "25", "울산": "26", "세종": "29",
  "경기": "31", "강원": "32", "충북": "33", "충남": "34",
  "전북": "35", "전남": "36", "경북": "37", "경남": "38",
  "제주": "39",
};

/**
 * Fetch ECOS data for a statistical code.
 * @param {string} statCode - ECOS statistical table code
 * @param {string} itemCode - Item code within the table
 * @param {string} cycle - A=annual, Q=quarterly, M=monthly
 * @param {number} startYear
 * @param {number} endYear
 */
async function fetchEcosTable(statCode, itemCode, cycle, startYear, endYear) {
  if (!API_KEYS.ecos) return [];

  const url = `${ECOS_BASE}/${API_KEYS.ecos}/json/kr/1/1000/${statCode}/${cycle}/${startYear}/${endYear}/${itemCode}`;

  try {
    const data = await cachedFetch(url);
    const rows = data?.StatisticSearch?.row || [];
    if (rows.length === 0 && data) {
      const preview = JSON.stringify(data).substring(0, 300);
      console.warn(`[ecos:${statCode}] Empty response: ${preview}`);
    }
    return rows;
  } catch (e) {
    console.warn(`[ecos] Fetch failed for ${statCode}: ${e.message}`);
    return [];
  }
}

/**
 * Distribute province-level values to 시군구 based on population or GRDP weights.
 * @param {Map<string, number>} provinceValues - Map of province prefix → value
 * @param {Map<string, number>} regionWeights - Map of region code → weight (e.g., population)
 * @returns {Map<string, number>} - Map of region code → distributed value
 */
function distributeToSigungu(provinceValues, regionWeights) {
  const result = new Map();

  // Group regions by province and calculate total weight per province
  const provinceGroups = new Map();
  for (const r of REGIONS) {
    if (!provinceGroups.has(r.provincePrefix)) {
      provinceGroups.set(r.provincePrefix, []);
    }
    provinceGroups.get(r.provincePrefix).push(r);
  }

  for (const [prefix, regions] of provinceGroups) {
    const provinceValue = provinceValues.get(prefix);
    if (provinceValue === undefined) continue;

    const totalWeight = regions.reduce(
      (sum, r) => sum + (regionWeights.get(r.code) || 1),
      0
    );

    for (const r of regions) {
      const weight = regionWeights.get(r.code) || 1;
      const share = weight / totalWeight;
      result.set(r.code, parseFloat((provinceValue * share).toFixed(2)));
    }
  }

  return result;
}

/**
 * Fetch all ECOS data and distribute to 시군구 level.
 * Returns Map<ourRegionCode, { localConsumption }>
 */
async function fetchAllEcosData(year, regionPopulations) {
  console.log(`\n=== BOK ECOS Data Fetch (year: ${year}) ===`);

  if (!API_KEYS.ecos) {
    console.warn("[ecos] No API key configured");
    return new Map();
  }

  const merged = new Map();

  // Try fetching 지역별 민간소비 (regional private consumption)
  try {
    // Try multiple ECOS stat codes for regional consumption
    let rows = await fetchEcosTable("901Y015", "*", "A", year, year);
    if (rows.length === 0) {
      rows = await fetchEcosTable("200Y004", "*", "A", year, year);
    }

    if (rows.length > 0) {
      const provinceValues = new Map();
      for (const row of rows) {
        const name = row.ITEM_NAME1 || "";
        // Match province name
        for (const [shortName, prefix] of Object.entries(ECOS_PROVINCE_MAP)) {
          if (name.includes(shortName)) {
            const value = parseFloat(row.DATA_VALUE?.replace(/,/g, "") || "0");
            if (!isNaN(value) && value > 0) {
              provinceValues.set(prefix, value);
            }
            break;
          }
        }
      }

      if (provinceValues.size > 0) {
        console.log(`  ✓ Regional consumption: ${provinceValues.size} provinces`);
        const distributed = distributeToSigungu(
          provinceValues,
          regionPopulations || new Map()
        );
        for (const [code, value] of distributed) {
          if (!merged.has(code)) merged.set(code, {});
          merged.get(code).localConsumption = value;
        }
      }
    } else {
      console.log("  ✗ Regional consumption: no data");
    }
  } catch (e) {
    console.log(`  ✗ Regional consumption: ${e.message}`);
  }

  console.log(`ECOS summary: ${merged.size} regions with data`);
  return merged;
}

module.exports = { fetchAllEcosData, distributeToSigungu };
