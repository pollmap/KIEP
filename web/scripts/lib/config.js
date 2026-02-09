/**
 * Configuration: loads API keys from .env.local and builds region lookup maps.
 */
const path = require("path");
const fs = require("fs");

// Load .env.local
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });

// API Keys
const API_KEYS = {
  kosis: process.env.KOSIS_API_KEY || "",
  dataGoKr: process.env.DATA_GO_KR_API_KEY || "",
  openDart: process.env.OPEN_DART_API_KEY || "",
  rone: process.env.RONE_API_KEY || "",
  ecos: process.env.BOK_ECOS_API_KEY || "",
};

// Base URLs
const KOSIS_BASE = "https://kosis.kr/openapi/Param/statisticsParameterData.do";
const RONE_BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";
const ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch";
const DATA_GO_KR_BASE = "https://apis.data.go.kr";

// Load regions from GeoJSON
const geoPath = path.resolve(__dirname, "../../public/data/regions.json");
const geo = JSON.parse(fs.readFileSync(geoPath, "utf8"));

// Province lookup (SGIS codes used in our system)
const PROVINCES = {
  "11": "서울특별시", "21": "부산광역시", "22": "대구광역시", "23": "인천광역시",
  "24": "광주광역시", "25": "대전광역시", "26": "울산광역시", "29": "세종특별자치시",
  "31": "경기도", "32": "강원특별자치도", "33": "충청북도", "34": "충청남도",
  "35": "전북특별자치도", "36": "전라남도", "37": "경상북도", "38": "경상남도",
  "39": "제주특별자치도",
};

// SGIS → Standard 행정구역코드 province prefix mapping
// Our system uses SGIS codes, KOSIS uses standard 행정구역코드
const SGIS_TO_STANDARD_PREFIX = {
  "11": "11", // 서울
  "21": "26", // 부산
  "22": "27", // 대구
  "23": "28", // 인천
  "24": "29", // 광주
  "25": "30", // 대전
  "26": "31", // 울산
  "29": "36", // 세종
  "31": "41", // 경기
  "32": "42", // 강원
  "33": "43", // 충북
  "34": "44", // 충남
  "35": "45", // 전북
  "36": "46", // 전남
  "37": "47", // 경북
  "38": "48", // 경남
  "39": "50", // 제주
};

const STANDARD_TO_SGIS_PREFIX = Object.fromEntries(
  Object.entries(SGIS_TO_STANDARD_PREFIX).map(([k, v]) => [v, k])
);

// Build region lists
const REGIONS = geo.features.map((f) => ({
  code: f.properties.code,
  name: f.properties.name,
  province: PROVINCES[f.properties.code.substring(0, 2)] || "기타",
  provincePrefix: f.properties.code.substring(0, 2),
}));

// Short province names for matching
const SHORT_PROVINCE_MAP = {
  "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
  "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
  "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도",
  "강원": "강원특별자치도", "충북": "충청북도", "충남": "충청남도",
  "전북": "전북특별자치도", "전남": "전라남도", "경북": "경상북도",
  "경남": "경상남도", "제주": "제주특별자치도",
  // Legacy names
  "강원도": "강원특별자치도", "전라북도": "전북특별자치도",
};

// Name-based lookup: "서울특별시_종로구" → "11010"
const nameToCode = new Map();
const codeToRegion = new Map();
for (const r of REGIONS) {
  nameToCode.set(`${r.province}_${r.name}`, r.code);
  // Also short province forms
  const shortProv = Object.entries(SHORT_PROVINCE_MAP).find(([, v]) => v === r.province)?.[0];
  if (shortProv) {
    nameToCode.set(`${shortProv}_${r.name}`, r.code);
  }
  // Also store just name for unique names
  nameToCode.set(r.name, nameToCode.has(r.name) ? "__AMBIGUOUS__" : r.code);
  codeToRegion.set(r.code, r);
}

/**
 * Match KOSIS region name to our code.
 * KOSIS may return names like "종로구", "서울특별시 종로구", "서울 종로구", etc.
 */
function matchRegionName(kosisName, kosisProvince) {
  if (!kosisName) return null;

  const cleanName = kosisName.trim().replace(/\s+/g, " ");
  const cleanProv = (kosisProvince || "").trim();

  // 1. Try exact province_name match
  if (cleanProv) {
    const key = `${cleanProv}_${cleanName}`;
    if (nameToCode.has(key)) return nameToCode.get(key);

    // Try resolving short/legacy province name
    const fullProv = SHORT_PROVINCE_MAP[cleanProv] || cleanProv;
    const key2 = `${fullProv}_${cleanName}`;
    if (nameToCode.has(key2)) return nameToCode.get(key2);

    // Try prefix matching (e.g., "서울" matches "서울특별시_종로구")
    for (const [mapKey, code] of nameToCode.entries()) {
      if (code === "__AMBIGUOUS__") continue;
      if (mapKey.includes("_") && mapKey.endsWith(`_${cleanName}`)) {
        const mapProv = mapKey.split("_")[0];
        if (mapProv.startsWith(cleanProv.substring(0, 2))) {
          return code;
        }
      }
    }
  }

  // 2. Try just the name (works for unique names)
  const byName = nameToCode.get(cleanName);
  if (byName && byName !== "__AMBIGUOUS__") return byName;

  // 3. Try extracting province + district from composite like "서울특별시 종로구"
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2) {
    const province = parts[0];
    const district = parts.slice(1).join(" ");

    // Direct match
    const key = `${province}_${district}`;
    if (nameToCode.has(key)) return nameToCode.get(key);

    // Short province → full province
    const fullProv = SHORT_PROVINCE_MAP[province] || province;
    const key2 = `${fullProv}_${district}`;
    if (nameToCode.has(key2)) return nameToCode.get(key2);

    // Try stripping suffix (e.g., "서울특별시" → "서울")
    const shortProv = province.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
    const key3 = `${shortProv}_${district}`;
    if (nameToCode.has(key3)) return nameToCode.get(key3);

    // Resolve short and try full
    const resolved = SHORT_PROVINCE_MAP[shortProv];
    if (resolved) {
      const key4 = `${resolved}_${district}`;
      if (nameToCode.has(key4)) return nameToCode.get(key4);
    }
  }

  return null;
}

module.exports = {
  API_KEYS,
  KOSIS_BASE,
  RONE_BASE,
  ECOS_BASE,
  DATA_GO_KR_BASE,
  PROVINCES,
  SGIS_TO_STANDARD_PREFIX,
  STANDARD_TO_SGIS_PREFIX,
  REGIONS,
  nameToCode,
  codeToRegion,
  matchRegionName,
};
