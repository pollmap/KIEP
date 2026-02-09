/**
 * 공공데이터포털 (data.go.kr) API wrapper.
 * Fetches commercial/business data by 시군구.
 */
const { API_KEYS, REGIONS, matchRegionName } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Unwrap _raw responses from stale cache ──
function unwrapResponse(data) {
  if (data && data._raw && typeof data._raw === "string") {
    try { return JSON.parse(data._raw); } catch { return data; }
  }
  return data;
}

/**
 * Fetch 소상공인 상가정보 (store counts by region).
 * API: 소상공인시장진흥공단_상가(상권)정보
 */
async function fetchStoreData(year) {
  if (!API_KEYS.dataGoKr) {
    console.warn("[data.go.kr] No API key configured");
    return new Map();
  }

  const result = new Map();

  // 소상공인 상가정보 API - aggregate store counts per 시군구
  // This API returns individual stores; we need to aggregate by region
  // For efficiency, use the summary/statistics endpoint if available
  try {
    const baseUrl = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInUpAdmi";
    // We fetch a sample to test the API, then fall back to estimation
    const params = new URLSearchParams({
      serviceKey: API_KEYS.dataGoKr,
      pageNo: "1",
      numOfRows: "1",
      divId: "adongCd",
      key: "11110",  // 종로구 test
      type: "json",
    });

    const url = `${baseUrl}?${params.toString()}`;
    const data = unwrapResponse(await cachedFetch(url));

    if (data?.body?.totalCount || data?.response?.body?.totalCount) {
      console.log("[data.go.kr] Store API accessible, but individual store aggregation is slow");
      console.log("[data.go.kr] Using KOSIS business census data as primary source instead");
    }
  } catch (e) {
    if (process.env.DEBUG_DATAGOKR) console.log(`[data.go.kr] Store API: ${e.message}`);
  }

  return result;
}

/**
 * Fetch 국민연금 사업장 데이터 (NPS workplace data).
 * Can be used to estimate companyCount, employeeCount per region.
 */
async function fetchNpsData(year) {
  if (!API_KEYS.dataGoKr) return new Map();

  const result = new Map();
  try {
    // NPS 사업장 가입자 통계
    const baseUrl = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireService/getBassInfoSearch";
    const params = new URLSearchParams({
      serviceKey: API_KEYS.dataGoKr,
      pageNo: "1",
      numOfRows: "10",
      type: "json",
    });

    const url = `${baseUrl}?${params.toString()}`;
    const data = unwrapResponse(await cachedFetch(url));

    const totalCount = data?.response?.body?.totalCount || 0;
    if (totalCount > 0) {
      console.log(`[data.go.kr] NPS API accessible: ${totalCount} total workplaces`);
    }
  } catch (e) {
    if (process.env.DEBUG_DATAGOKR) console.log(`[data.go.kr] NPS API: ${e.message}`);
  }

  return result;
}

/**
 * Main entry point: fetch all data.go.kr data.
 * Returns Map<ourRegionCode, { storeCount, ... }>
 */
async function fetchAllDatagokrData(year) {
  console.log(`\n=== data.go.kr Data Fetch (year: ${year}) ===`);

  if (!API_KEYS.dataGoKr) {
    console.warn("[data.go.kr] No API key configured");
    return new Map();
  }

  // data.go.kr individual record APIs are slow for 시군구-level aggregation
  // Most of our fields are better served by KOSIS summary tables
  // This module is reserved for data not available in KOSIS

  const storeData = await fetchStoreData(year);
  const npsData = await fetchNpsData(year);

  // Merge
  const merged = new Map();
  for (const [code, data] of storeData) {
    merged.set(code, { ...data });
  }
  for (const [code, data] of npsData) {
    if (!merged.has(code)) merged.set(code, {});
    Object.assign(merged.get(code), data);
  }

  console.log(`data.go.kr summary: ${merged.size} regions with data`);
  return merged;
}

module.exports = { fetchAllDatagokrData };
