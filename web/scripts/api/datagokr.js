/**
 * 공공데이터포털 (data.go.kr) API wrapper.
 * Fetches 시군구-level data from AirKorea and Tourism BigData APIs.
 */
const { API_KEYS, REGIONS, PROVINCES, matchRegionName } = require("../lib/config");
const { cachedFetch } = require("../lib/cache");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Unwrap _raw responses from stale cache ──
function unwrapResponse(data) {
  if (data && data._raw && typeof data._raw === "string") {
    try { return JSON.parse(data._raw); } catch { return data; }
  }
  return data;
}

// Province names for AirKorea iteration (SGIS prefix → short name)
const SIDO_LIST = [
  { name: "서울", prefix: "11" },
  { name: "부산", prefix: "21" },
  { name: "대구", prefix: "22" },
  { name: "인천", prefix: "23" },
  { name: "광주", prefix: "24" },
  { name: "대전", prefix: "25" },
  { name: "울산", prefix: "26" },
  { name: "세종", prefix: "29" },
  { name: "경기", prefix: "31" },
  { name: "강원", prefix: "32" },
  { name: "충북", prefix: "33" },
  { name: "충남", prefix: "34" },
  { name: "전북", prefix: "35" },
  { name: "전남", prefix: "36" },
  { name: "경북", prefix: "37" },
  { name: "경남", prefix: "38" },
  { name: "제주", prefix: "39" },
];

/**
 * Fetch AirKorea PM2.5 data by iterating all 17 시도.
 * API: 한국환경공단_에어코리아_대기오염통계 현황
 * Endpoint: ArpltnStatsSvc/getCtprvnMesureLIst
 * Returns 시군구-level PM2.5 annual averages.
 */
async function fetchAirKoreaData(year) {
  if (!API_KEYS.dataGoKr) return new Map();

  console.log("[data.go.kr:airkorea] Fetching PM2.5 data by 시도...");
  const result = new Map();
  let totalMatched = 0;

  for (const sido of SIDO_LIST) {
    try {
      const params = new URLSearchParams({
        serviceKey: API_KEYS.dataGoKr,
        returnType: "json",
        numOfRows: "200",
        pageNo: "1",
        sidoName: sido.name,
        searchCondition: "DAILY",
      });
      const url = `https://apis.data.go.kr/B552584/ArpltnStatsSvc/getCtprvnMesureLIst?${params.toString()}`;
      const raw = unwrapResponse(await cachedFetch(url));

      // Parse response — structure: response.body.items[]
      const items = raw?.response?.body?.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        // Some API responses nest items differently
        const altItems = raw?.response?.body?.items?.item || raw?.items || [];
        if (Array.isArray(altItems) && altItems.length > 0) {
          processAirItems(altItems, sido, result);
          totalMatched += altItems.length;
        }
        continue;
      }

      processAirItems(items, sido, result);
    } catch (e) {
      console.log(`[data.go.kr:airkorea] ${sido.name}: ${e.message}`);
    }
    await sleep(300);
  }

  console.log(`[data.go.kr:airkorea] ${result.size} regions with PM2.5 data`);
  return result;
}

function processAirItems(items, sido, result) {
  const provinceName = PROVINCES[sido.prefix] || "";

  for (const item of items) {
    // cityName or cityNameEng — this is the 시군구 name
    const cityName = (item.cityName || item.stationName || "").trim();
    if (!cityName) continue;

    // Get PM2.5 value
    const pm25 = parseFloat(item.pm25Value);
    if (isNaN(pm25) || pm25 <= 0) continue;

    // Match to our region
    const code = matchRegionName(cityName, provinceName);
    if (!code) continue;

    if (!result.has(code)) result.set(code, { _sum: 0, _cnt: 0 });
    const entry = result.get(code);
    entry._sum += pm25;
    entry._cnt++;
  }

  // Compute averages
  for (const [code, entry] of result) {
    if (entry._cnt > 0) {
      result.set(code, { airQuality: parseFloat((entry._sum / entry._cnt).toFixed(1)) });
    }
  }
}

/**
 * Fetch tourism visitor data by 시군구.
 * API: 한국관광공사_관광빅데이터 정보서비스
 * Endpoint: DataLabService/metcoRegnVisitrDDList
 * NOTE: May need separate API key registration — gracefully degrades.
 */
async function fetchTourismData(year) {
  if (!API_KEYS.dataGoKr) return new Map();

  console.log("[data.go.kr:tourism] Fetching visitor data...");
  const result = new Map();

  // TourAPI area codes → our SGIS prefixes
  const TOUR_AREAS = [
    { areaCd: "1", prefix: "11" },   // 서울
    { areaCd: "2", prefix: "23" },   // 인천
    { areaCd: "3", prefix: "25" },   // 대전
    { areaCd: "4", prefix: "22" },   // 대구
    { areaCd: "5", prefix: "24" },   // 광주
    { areaCd: "6", prefix: "21" },   // 부산
    { areaCd: "7", prefix: "26" },   // 울산
    { areaCd: "8", prefix: "29" },   // 세종
    { areaCd: "31", prefix: "31" },  // 경기
    { areaCd: "32", prefix: "32" },  // 강원
    { areaCd: "33", prefix: "33" },  // 충북
    { areaCd: "34", prefix: "34" },  // 충남
    { areaCd: "35", prefix: "35" },  // 전북
    { areaCd: "36", prefix: "36" },  // 전남
    { areaCd: "37", prefix: "37" },  // 경북
    { areaCd: "38", prefix: "38" },  // 경남
    { areaCd: "39", prefix: "39" },  // 제주
  ];

  // Use a single month to test, then aggregate if working
  const startYmd = `${year}0601`;
  const endYmd = `${year}0630`;

  let apiWorks = false;

  // Test with first area
  try {
    const testParams = new URLSearchParams({
      serviceKey: API_KEYS.dataGoKr,
      MobileOS: "ETC",
      MobileApp: "KIEP",
      startYmd,
      endYmd,
      areaCd: "1",
      _type: "json",
    });
    const testUrl = `https://apis.data.go.kr/B551011/DataLabService/metcoRegnVisitrDDList?${testParams.toString()}`;
    const testRaw = unwrapResponse(await cachedFetch(testUrl));

    const testItems = testRaw?.response?.body?.items?.item || [];
    if (Array.isArray(testItems) && testItems.length > 0) {
      apiWorks = true;
      console.log("[data.go.kr:tourism] API accessible, fetching all areas...");
    } else {
      const errCode = testRaw?.response?.header?.resultCode || "unknown";
      const errMsg = testRaw?.response?.header?.resultMsg || JSON.stringify(testRaw).substring(0, 200);
      console.log(`[data.go.kr:tourism] API returned: code=${errCode}, msg=${errMsg}`);
    }
  } catch (e) {
    console.log(`[data.go.kr:tourism] Test failed: ${e.message}`);
  }

  if (!apiWorks) {
    console.log("[data.go.kr:tourism] API not accessible (may need separate key registration)");
    return result;
  }

  // Fetch all areas
  for (const area of TOUR_AREAS) {
    try {
      const params = new URLSearchParams({
        serviceKey: API_KEYS.dataGoKr,
        MobileOS: "ETC",
        MobileApp: "KIEP",
        startYmd,
        endYmd,
        areaCd: area.areaCd,
        _type: "json",
      });
      const url = `https://apis.data.go.kr/B551011/DataLabService/metcoRegnVisitrDDList?${params.toString()}`;
      const raw = unwrapResponse(await cachedFetch(url));

      const items = raw?.response?.body?.items?.item || [];
      if (!Array.isArray(items)) continue;

      const provinceName = PROVINCES[area.prefix] || "";

      for (const item of items) {
        const signguNm = (item.signguNm || "").trim();
        if (!signguNm) continue;

        const touNum = parseInt(item.touNum || "0");
        if (isNaN(touNum) || touNum <= 0) continue;

        const code = matchRegionName(signguNm, provinceName);
        if (!code) continue;

        if (!result.has(code)) result.set(code, {});
        const existing = result.get(code);
        existing.touristVisitors = (existing.touristVisitors || 0) + touNum;
      }
    } catch (e) {
      // Silent — individual area failures are expected
    }
    await sleep(300);
  }

  // Scale monthly to annual estimate (x12) and convert to thousands
  for (const [, data] of result) {
    if (data.touristVisitors) {
      data.touristVisitors = Math.round((data.touristVisitors * 12) / 1000);
    }
  }

  console.log(`[data.go.kr:tourism] ${result.size} regions with visitor data`);
  return result;
}

/**
 * Main entry point: fetch all data.go.kr data.
 * Returns Map<ourRegionCode, { airQuality, touristVisitors, ... }>
 */
async function fetchAllDatagokrData(year) {
  console.log(`\n=== data.go.kr Data Fetch (year: ${year}) ===`);

  if (!API_KEYS.dataGoKr) {
    console.warn("[data.go.kr] No API key configured");
    return new Map();
  }

  // Fetch from sub-APIs in parallel
  const [airResult, tourResult] = await Promise.allSettled([
    fetchAirKoreaData(year),
    fetchTourismData(year),
  ]);

  const merged = new Map();

  // Merge airQuality data
  const airData = airResult.status === "fulfilled" ? airResult.value : new Map();
  for (const [code, data] of airData) {
    if (!merged.has(code)) merged.set(code, {});
    Object.assign(merged.get(code), data);
  }

  // Merge tourism data
  const tourData = tourResult.status === "fulfilled" ? tourResult.value : new Map();
  for (const [code, data] of tourData) {
    if (!merged.has(code)) merged.set(code, {});
    Object.assign(merged.get(code), data);
  }

  const fields = new Set();
  for (const [, d] of merged) {
    for (const k of Object.keys(d)) fields.add(k);
  }
  console.log(`data.go.kr summary: ${merged.size} regions, fields: [${[...fields].join(", ")}]`);
  return merged;
}

module.exports = { fetchAllDatagokrData };
