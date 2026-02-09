#!/usr/bin/env node
/**
 * generate-complexes.js
 *
 * Generates a comprehensive GeoJSON dataset of Korean industrial complexes (산업단지).
 * Reads regions.json (for geometry centroids) and sample-regions.json (for region metadata),
 * then produces industrial-complexes.json with ~600 complexes across all four types.
 *
 * Uses a deterministic seeded PRNG for reproducibility.
 */

const fs = require('fs');
const path = require('path');

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240601); // deterministic seed

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 1) {
  return parseFloat((rand() * (max - min) + min).toFixed(decimals));
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Load Data ───────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'public', 'data');

const regionsGeoJSON = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'regions.json'), 'utf8')
);
const sampleRegionsRaw = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'sample-regions.json'), 'utf8')
);

// sample-regions.json is an object with numeric keys
const sampleRegions = Array.isArray(sampleRegionsRaw)
  ? sampleRegionsRaw
  : Object.values(sampleRegionsRaw);

// ─── Build lookup maps ───────────────────────────────────────────────────────

// code → { code, name, province, ... }
const regionByCode = {};
for (const r of sampleRegions) {
  regionByCode[r.code] = r;
}

// name → code (first match)
const regionByName = {};
for (const r of sampleRegions) {
  regionByName[r.name] = r.code;
}

// Compute centroids from regions.json polygons
function computeCentroid(geometry) {
  let sumX = 0,
    sumY = 0,
    count = 0;

  function processCoords(coords) {
    for (const c of coords) {
      if (Array.isArray(c[0])) {
        processCoords(c);
      } else {
        sumX += c[0];
        sumY += c[1];
        count++;
      }
    }
  }

  processCoords(geometry.coordinates);
  return count > 0 ? [sumX / count, sumY / count] : [127.0, 36.5];
}

const centroidByCode = {};
for (const feature of regionsGeoJSON.features) {
  const code = feature.properties.code;
  centroidByCode[code] = computeCentroid(feature.geometry);
}

// ─── Helper: find region code by partial name match ──────────────────────────
function findCode(searchName) {
  // Exact match first
  if (regionByName[searchName]) return regionByName[searchName];
  // Partial match
  for (const r of sampleRegions) {
    if (r.name.includes(searchName) || searchName.includes(r.name)) {
      return r.code;
    }
  }
  return null;
}

// ─── Helper: get coordinates with offset ─────────────────────────────────────
function getCoords(code, offsetScale = 0.01) {
  const base = centroidByCode[code];
  if (!base) {
    console.warn(`No centroid for code ${code}, using fallback`);
    return [127.0 + rand() * 0.1, 36.5 + rand() * 0.1];
  }
  return [
    parseFloat((base[0] + (rand() - 0.5) * offsetScale).toFixed(5)),
    parseFloat((base[1] + (rand() - 0.5) * offsetScale).toFixed(5)),
  ];
}

// ─── Main Industries ─────────────────────────────────────────────────────────
const nationalIndustries = [
  '전자/반도체', '자동차/부품', '석유화학', '철강/금속',
  '기계/장비', '조선/해양', '섬유/의류', '식품/바이오',
  '디스플레이', '2차전지', 'IT/소프트웨어', '의료기기',
  '항공/우주', '신재생에너지', '정밀화학', '로봇/자동화',
];

const generalIndustries = [
  '기계/부품', '자동차부품', '전자부품', '금속가공',
  '화학/소재', '식품가공', '섬유/봉제', '인쇄/포장',
  '플라스틱/고무', '목재/가구', '건축자재', '물류/유통',
  '전기장비', '정밀기기', '환경산업', '의료/바이오',
];

const urbanIndustries = [
  'IT/SW', 'AI/빅데이터', '바이오/의료', '문화콘텐츠',
  '디자인', 'R&D', '신소재', '로봇/자동화',
  '핀테크', '스마트팩토리', 'IoT/센서', '에너지',
];

const agroIndustries = [
  '식품가공', '농산물가공', '목재/가구', '섬유/봉제',
  '건축자재', '플라스틱', '금속가공', '포장재',
  '사료/비료', '한약재/건강식품',
];

// ─── National Industrial Complexes (53) ──────────────────────────────────────
// Map each complex to the ACTUAL code from sample-regions.json

const nationalComplexDefs = [
  { name: '구미국가산업단지 1단지', sigungu: '구미시', code: '37050', industry: '전자/반도체', est: 1969 },
  { name: '구미국가산업단지 2단지', sigungu: '구미시', code: '37050', industry: '전자/반도체', est: 1973 },
  { name: '구미국가산업단지 3단지', sigungu: '구미시', code: '37050', industry: '디스플레이', est: 1978 },
  { name: '구미국가산업단지 4단지', sigungu: '구미시', code: '37050', industry: '2차전지', est: 2003 },
  { name: '구미국가산업단지 5단지', sigungu: '구미시', code: '37050', industry: 'IT/소프트웨어', est: 2012 },
  { name: '창원국가산업단지', sigungu: '창원시의창구', code: '38111', industry: '기계/장비', est: 1974 },
  { name: '울산미포국가산업단지', sigungu: '남구', code: '26020', industry: '자동차/부품', est: 1962 },
  { name: '여수국가산업단지', sigungu: '여수시', code: '36020', industry: '석유화학', est: 1967 },
  { name: '반월특수지역', sigungu: '안산시상록구', code: '31091', industry: '기계/부품', est: 1977 },
  { name: '시화국가산업단지', sigungu: '시흥시', code: '31150', industry: '금속가공', est: 1987 },
  { name: '시화MTV국가산업단지', sigungu: '시흥시', code: '31150', industry: '첨단산업', est: 2001 },
  { name: '온산국가산업단지', sigungu: '울주군', code: '26310', industry: '석유화학', est: 1974 },
  { name: '대불국가산업단지', sigungu: '영암군', code: '36410', industry: '조선/해양', est: 1997 },
  { name: '군산국가산업단지', sigungu: '군산시', code: '35020', industry: '자동차/부품', est: 1990 },
  { name: '군장국가산업단지', sigungu: '군산시', code: '35020', industry: '화학/소재', est: 1989 },
  { name: '아산국가산업단지', sigungu: '아산시', code: '34040', industry: '디스플레이', est: 2002 },
  { name: '석문국가산업단지', sigungu: '당진시', code: '34080', industry: '철강/금속', est: 2005 },
  { name: '한국수출자유지역(마산)', sigungu: '창원시마산합포구', code: '38113', industry: '전자/반도체', est: 1970 },
  { name: '한국수출자유지역(익산)', sigungu: '익산시', code: '35030', industry: '섬유/의류', est: 1973 },
  { name: '광양국가산업단지', sigungu: '광양시', code: '36060', industry: '철강/금속', est: 1982 },
  { name: '포항철강산업단지', sigungu: '포항시남구', code: '37011', industry: '철강/금속', est: 1970 },
  { name: '울산석유화학산업단지', sigungu: '남구', code: '26020', industry: '석유화학', est: 1972 },
  { name: '부산과학산업단지', sigungu: '강서구', code: '21120', industry: 'IT/소프트웨어', est: 2000 },
  { name: '녹산국가산업단지', sigungu: '강서구', code: '21120', industry: '자동차/부품', est: 1992 },
  { name: '달성국가산업단지 1,2차', sigungu: '달성군', code: '22310', industry: '기계/장비', est: 1993 },
  { name: '달성2차국가산업단지', sigungu: '달성군', code: '22310', industry: '자동차/부품', est: 2008 },
  { name: '익산국가산업단지', sigungu: '익산시', code: '35030', industry: '식품/바이오', est: 1985 },
  { name: '진해국가산업단지', sigungu: '창원시진해구', code: '38115', industry: '조선/해양', est: 1983 },
  { name: '장항국가산업단지', sigungu: '서천군', code: '34340', industry: '정밀화학', est: 1966 },
  { name: '성산산업단지', sigungu: '성남시수정구', code: '31021', industry: 'IT/소프트웨어', est: 1984 },
  { name: '서산국가산업단지', sigungu: '서산시', code: '34050', industry: '석유화학', est: 2004 },
  { name: '오창국가산업단지', sigungu: '청주시흥덕구', code: '33043', industry: '바이오/의료', est: 2000 },
  { name: '천안5국가산업단지', sigungu: '천안시서북구', code: '34012', industry: '디스플레이', est: 2009 },
  { name: '구미하이테크밸리', sigungu: '구미시', code: '37050', industry: '2차전지', est: 2010 },
  { name: '새만금국가산업단지', sigungu: '군산시', code: '35020', industry: '신재생에너지', est: 2018 },
  { name: '국가식품클러스터', sigungu: '익산시', code: '35030', industry: '식품/바이오', est: 2012 },
  { name: '평택국가산업단지', sigungu: '평택시', code: '31070', industry: '전자/반도체', est: 2005 },
  { name: '오송생명과학단지', sigungu: '청주시청원구', code: '33044', industry: '의료기기', est: 2004 },
  { name: '대구테크노폴리스', sigungu: '달성군', code: '22310', industry: 'IT/소프트웨어', est: 2005 },
  { name: '김천혁신도시', sigungu: '김천시', code: '37030', industry: '기계/장비', est: 2007 },
  { name: '진주혁신도시', sigungu: '진주시', code: '38030', industry: '항공/우주', est: 2007 },
  { name: '원주혁신도시', sigungu: '원주시', code: '32020', industry: '의료기기', est: 2007 },
  { name: '충주산업단지', sigungu: '충주시', code: '33020', industry: '기계/장비', est: 1969 },
  { name: '부산정관산업단지', sigungu: '기장군', code: '21310', industry: '전자부품', est: 2001 },
  { name: '대구국가산업단지', sigungu: '달서구', code: '22070', industry: '기계/장비', est: 1984 },
  { name: '북평국가산업단지', sigungu: '동해시', code: '32040', industry: '시멘트/소재', est: 1974 },
  { name: '양산국가산업단지', sigungu: '양산시', code: '38100', industry: '자동차/부품', est: 2005 },
  { name: '포항국가산업단지 블루밸리', sigungu: '포항시북구', code: '37012', industry: '신소재/에너지', est: 2011 },
  { name: '나주혁신산업단지', sigungu: '나주시', code: '36040', industry: '신재생에너지', est: 2012 },
  { name: '세종국가산업단지', sigungu: '세종시', code: '29010', industry: 'IT/소프트웨어', est: 2013 },
  { name: '진천혁신도시', sigungu: '진천군', code: '33350', industry: '식품/바이오', est: 2007 },
  { name: '음성국가산업단지', sigungu: '음성군', code: '33370', industry: '전자부품', est: 2009 },
  { name: '비봉국가산업단지', sigungu: '화성시', code: '31240', industry: '자동차/부품', est: 2006 },
  { name: '인천남동산업단지', sigungu: '남동구', code: '23050', industry: '기계/부품', est: 1985 },
  { name: '남동인더스파크(국가)', sigungu: '남동구', code: '23050', industry: '전자부품', est: 1997 },
  { name: '지방이전지구(전북혁신도시)', sigungu: '전주시완산구', code: '35011', industry: 'R&D/공공', est: 2007 },
  { name: '율촌국가산업단지', sigungu: '여수시', code: '36020', industry: '석유화학', est: 1998 },
];

console.log(`National complex definitions: ${nationalComplexDefs.length}`);

// Validate all national codes exist
for (const def of nationalComplexDefs) {
  if (!regionByCode[def.code]) {
    console.error(`ERROR: National complex "${def.name}" has invalid code ${def.code}`);
    process.exit(1);
  }
}

// ─── Generate Features ───────────────────────────────────────────────────────
const features = [];
let idCounters = { NAT: 0, GEN: 0, URB: 0, AGR: 0 };

function makeId(prefix) {
  idCounters[prefix]++;
  return `${prefix}-${String(idCounters[prefix]).padStart(3, '0')}`;
}

function makeFeature({ id, name, type, regionCode, area, industrialArea, tenantCount, operatingCount, occupancyRate, production, exportAmount, employment, mainIndustry, established }) {
  const region = regionByCode[regionCode];
  const coords = getCoords(regionCode, type === '국가' ? 0.015 : type === '일반' ? 0.012 : 0.01);

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coords,
    },
    properties: {
      id,
      name,
      type,
      province: region.province,
      sigungu: region.name,
      regionCode,
      area: parseFloat(area.toFixed(1)),
      industrialArea: parseFloat(industrialArea.toFixed(1)),
      tenantCount,
      operatingCount,
      occupancyRate: parseFloat(occupancyRate.toFixed(1)),
      production,
      exportAmount,
      employment,
      mainIndustry,
      established,
    },
  };
}

// ─── 1. National Complexes (국가산업단지) ────────────────────────────────────
for (const def of nationalComplexDefs) {
  const area = randFloat(500, 25000, 1);
  const industrialArea = parseFloat((area * randFloat(0.55, 0.82, 2)).toFixed(1));
  const tenantCount = randInt(100, 3000);
  const operatingCount = Math.max(
    Math.floor(tenantCount * randFloat(0.85, 0.98, 2)),
    1
  );
  const occupancyRate = randFloat(75, 99.9, 1);
  const production = randInt(10000, 500000);
  const exportAmount = randInt(1000, 200000);
  const employment = randInt(5000, 80000);

  features.push(
    makeFeature({
      id: makeId('NAT'),
      name: def.name,
      type: '국가',
      regionCode: def.code,
      area,
      industrialArea,
      tenantCount,
      operatingCount,
      occupancyRate,
      production,
      exportAmount,
      employment,
      mainIndustry: def.industry,
      established: def.est,
    })
  );
}

console.log(`Generated ${idCounters.NAT} national complexes`);

// ─── 2. General Industrial Complexes (일반산업단지, ~300) ────────────────────

// Province distribution weights for 일반산업단지
const generalProvinceWeights = {
  '경기도': 55,
  '경상북도': 35,
  '경상남도': 35,
  '충청남도': 30,
  '충청북도': 25,
  '전라남도': 25,
  '전북특별자치도': 20,
  '강원특별자치도': 18,
  '인천광역시': 12,
  '부산광역시': 10,
  '대구광역시': 10,
  '울산광역시': 8,
  '광주광역시': 6,
  '대전광역시': 5,
  '세종특별자치시': 3,
  '제주특별자치도': 3,
};

// Get regions grouped by province
const regionsByProvince = {};
for (const r of sampleRegions) {
  if (!regionsByProvince[r.province]) regionsByProvince[r.province] = [];
  regionsByProvince[r.province].push(r);
}

// General complex name patterns
const generalNamePatterns = [
  (name) => `${name}일반산업단지`,
  (name) => `${name}제1산업단지`,
  (name) => `${name}제2산업단지`,
  (name) => `${name}제3산업단지`,
  (name) => `${name}테크노파크`,
  (name) => `${name}산업단지`,
  (name) => `${name}일반공업단지`,
  (name) => `${name}중소기업단지`,
  (name) => `${name}첨단산업단지`,
  (name) => `${name}벤처산업단지`,
  (name) => `${name}테크노밸리`,
  (name) => `${name}스마트산업단지`,
  (name) => `${name}에코산업단지`,
  (name) => `${name}지식산업단지`,
];

const usedGeneralNames = new Set();

for (const [province, weight] of Object.entries(generalProvinceWeights)) {
  const regions = regionsByProvince[province];
  if (!regions || regions.length === 0) continue;

  for (let i = 0; i < weight; i++) {
    const region = pick(regions);
    let nameBase = region.name;

    // Try different name patterns until we find a unique one
    let complexName;
    let attempts = 0;
    do {
      const pattern = pick(generalNamePatterns);
      complexName = pattern(nameBase);
      attempts++;
      if (attempts > 20) {
        complexName = `${nameBase}제${randInt(4, 20)}산업단지`;
      }
    } while (usedGeneralNames.has(complexName));
    usedGeneralNames.add(complexName);

    const area = randFloat(100, 3000, 1);
    const industrialArea = parseFloat((area * randFloat(0.5, 0.8, 2)).toFixed(1));
    const tenantCount = randInt(30, 500);
    const operatingCount = Math.max(
      Math.floor(tenantCount * randFloat(0.8, 0.97, 2)),
      1
    );
    const occupancyRate = randFloat(60, 99, 1);
    const production = randInt(1000, 100000);
    const exportAmount = randInt(100, 50000);
    const employment = randInt(1000, 20000);
    const established = randInt(1985, 2022);

    features.push(
      makeFeature({
        id: makeId('GEN'),
        name: complexName,
        type: '일반',
        regionCode: region.code,
        area,
        industrialArea,
        tenantCount,
        operatingCount,
        occupancyRate,
        production,
        exportAmount,
        employment,
        mainIndustry: pick(generalIndustries),
        established,
      })
    );
  }
}

console.log(`Generated ${idCounters.GEN} general complexes`);

// ─── 3. Urban High-Tech Complexes (도시첨단산업단지, 48) ─────────────────────

// These go in urban areas - metro cities and larger cities
const urbanRegionCodes = [
  // Seoul
  '11010', '11040', '11170', '11180', '11230', '11240',
  // Busan
  '21050', '21090', '21120',
  // Daegu
  '22020', '22050', '22070',
  // Incheon
  '23050', '23060', '23080',
  // Gwangju
  '24020', '24040', '24050',
  // Daejeon
  '25030', '25040', '25050',
  // Ulsan
  '26020', '26040',
  // Sejong
  '29010',
  // Gyeonggi larger cities
  '31014', '31023', '31050', '31091', '31150', '31240', '31070',
  // Provincial cities
  '32010', '32020',  // Chuncheon, Wonju
  '33041', '33043',  // Cheongju
  '34011', '34012',  // Cheonan
  '35011', '35020',  // Jeonju, Gunsan
  '36020', '36030',  // Yeosu, Suncheon
  '37011', '37050',  // Pohang, Gumi
  '38111', '38070',  // Changwon, Gimhae
  '39010',           // Jeju
];

const urbanNamePatterns = [
  (name) => `${name}첨단산업단지`,
  (name) => `${name}첨단과학단지`,
  (name) => `${name}도시첨단산업단지`,
  (name) => `${name}스마트시티산업단지`,
  (name) => `${name}디지털산업단지`,
  (name) => `${name}테크노벨리`,
  (name) => `${name}이노밸리`,
  (name) => `${name}첨단벤처단지`,
  (name) => `${name}R&D사이언스파크`,
  (name) => `${name}미래산업단지`,
];

const usedUrbanNames = new Set();

for (let i = 0; i < 48; i++) {
  const code = urbanRegionCodes[i % urbanRegionCodes.length];
  const region = regionByCode[code];
  if (!region) {
    console.warn(`Skipping urban complex: no region for code ${code}`);
    continue;
  }

  let complexName;
  let attempts = 0;
  do {
    const pattern = pick(urbanNamePatterns);
    complexName = pattern(region.name);
    attempts++;
    if (attempts > 20) {
      complexName = `${region.name}도시첨단제${randInt(2, 10)}단지`;
    }
  } while (usedUrbanNames.has(complexName));
  usedUrbanNames.add(complexName);

  const area = randFloat(50, 800, 1);
  const industrialArea = parseFloat((area * randFloat(0.45, 0.75, 2)).toFixed(1));
  const tenantCount = randInt(20, 200);
  const operatingCount = Math.max(
    Math.floor(tenantCount * randFloat(0.78, 0.96, 2)),
    1
  );
  const occupancyRate = randFloat(55, 98, 1);
  const production = randInt(500, 50000);
  const exportAmount = randInt(50, 20000);
  const employment = randInt(500, 10000);
  const established = randInt(2000, 2023);

  features.push(
    makeFeature({
      id: makeId('URB'),
      name: complexName,
      type: '도시첨단',
      regionCode: code,
      area,
      industrialArea,
      tenantCount,
      operatingCount,
      occupancyRate,
      production,
      exportAmount,
      employment,
      mainIndustry: pick(urbanIndustries),
      established,
    })
  );
}

console.log(`Generated ${idCounters.URB} urban high-tech complexes`);

// ─── 4. Agro-Industrial Complexes (농공단지, ~200) ───────────────────────────

// 농공단지 are mostly in rural areas
const agroProvinceWeights = {
  '전라남도': 40,
  '경상북도': 35,
  '충청남도': 25,
  '경상남도': 22,
  '전북특별자치도': 20,
  '충청북도': 18,
  '강원특별자치도': 18,
  '경기도': 12,
  '제주특별자치도': 5,
  '세종특별자치시': 2,
  '인천광역시': 2, // 강화군, 옹진군
  '대구광역시': 1, // 달성군
};

// Prefer rural (군) regions for 농공단지
function isRuralRegion(region) {
  return (
    region.name.endsWith('군') ||
    region.name.includes('군')
  );
}

// 읍면 names for rural areas by province
const ruralSubNames = {
  '전라남도': ['해제', '삼호', '학산', '서호', '덕치', '비아', '용산', '남평', '반남', '봉산', '대마', '압해', '비금', '지도', '무안', '일로'],
  '경상북도': ['기계', '양북', '외서', '녹전', '다산', '점촌', '화동', '진보', '풍산', '하양', '와촌', '자인', '압량'],
  '충청남도': ['광천', '결성', '청양', '정산', '대흥', '예산', '삽교', '고대', '합덕', '송악', '면천'],
  '경상남도': ['진영', '장유', '내서', '봉림', '산청', '시천', '단성', '가야', '합천', '고령', '함안'],
  '전북특별자치도': ['이서', '고산', '운주', '비봉', '소양', '상관', '봉동', '삼례'],
  '충청북도': ['감곡', '대소', '삼성', '금왕', '괴산', '불정', '청안', '미원', '남일'],
  '강원특별자치도': ['내면', '서석', '갑천', '둔내', '수주', '방림', '봉평', '진부', '대화', '주천', '영월'],
  '경기도': ['양서', '서종', '강상', '대신', '소흘', '영북', '가남', '금사'],
  '제주특별자치도': ['한림', '대정', '남원', '구좌', '조천', '성산', '표선', '안덕'],
  '인천광역시': ['강화', '교동', '길상', '양도'],
  '대구광역시': ['하빈', '논공', '다사', '화원', '옥포'],
  '세종특별자치시': ['연기', '연서', '전의', '전동', '조치원'],
};

const usedAgroNames = new Set();

for (const [province, weight] of Object.entries(agroProvinceWeights)) {
  const regions = regionsByProvince[province];
  if (!regions || regions.length === 0) continue;

  // Prefer rural regions
  const ruralRegions = regions.filter(isRuralRegion);
  const targetRegions = ruralRegions.length > 0 ? ruralRegions : regions;

  const subNames = ruralSubNames[province] || ['중앙'];

  for (let i = 0; i < weight; i++) {
    const region = pick(targetRegions);
    let complexName;
    let attempts = 0;
    do {
      if (rand() < 0.5) {
        const sub = pick(subNames);
        complexName = `${sub}농공단지`;
      } else {
        complexName = `${region.name}농공단지`;
        if (usedAgroNames.has(complexName)) {
          complexName = `${region.name}제${randInt(2, 5)}농공단지`;
        }
      }
      attempts++;
      if (attempts > 30) {
        complexName = `${region.name}${pick(subNames)}농공단지`;
      }
    } while (usedAgroNames.has(complexName));
    usedAgroNames.add(complexName);

    const area = randFloat(30, 500, 1);
    const industrialArea = parseFloat((area * randFloat(0.4, 0.7, 2)).toFixed(1));
    const tenantCount = randInt(10, 100);
    const operatingCount = Math.max(
      Math.floor(tenantCount * randFloat(0.75, 0.95, 2)),
      1
    );
    const occupancyRate = randFloat(50, 98, 1);
    const production = randInt(100, 10000);
    const exportAmount = randInt(5, 5000);
    const employment = randInt(200, 3000);
    const established = randInt(1990, 2020);

    features.push(
      makeFeature({
        id: makeId('AGR'),
        name: complexName,
        type: '농공',
        regionCode: region.code,
        area,
        industrialArea,
        tenantCount,
        operatingCount,
        occupancyRate,
        production,
        exportAmount,
        employment,
        mainIndustry: pick(agroIndustries),
        established,
      })
    );
  }
}

console.log(`Generated ${idCounters.AGR} agro-industrial complexes`);

// ─── Assemble GeoJSON ────────────────────────────────────────────────────────
const geojson = {
  type: 'FeatureCollection',
  metadata: {
    title: '한국 산업단지 현황',
    description: 'Korean Industrial Complexes (산업단지) dataset',
    generated: new Date().toISOString().split('T')[0],
    source: 'KICOX (한국산업단지공단) 기반 생성 데이터',
    counts: {
      total: features.length,
      national: idCounters.NAT,
      general: idCounters.GEN,
      urbanHighTech: idCounters.URB,
      agroIndustrial: idCounters.AGR,
    },
  },
  features,
};

// ─── Write output ────────────────────────────────────────────────────────────
const outPath = path.join(dataDir, 'industrial-complexes.json');
const jsonStr = JSON.stringify(geojson, null, 2);
fs.writeFileSync(outPath, jsonStr, 'utf8');

const fileSizeMB = (Buffer.byteLength(jsonStr, 'utf8') / (1024 * 1024)).toFixed(2);

console.log('');
console.log('=== Generation Complete ===');
console.log(`Output: ${outPath}`);
console.log(`File size: ${fileSizeMB} MB`);
console.log(`Total complexes: ${features.length}`);
console.log(`  국가산업단지: ${idCounters.NAT}`);
console.log(`  일반산업단지: ${idCounters.GEN}`);
console.log(`  도시첨단산업단지: ${idCounters.URB}`);
console.log(`  농공단지: ${idCounters.AGR}`);

// Verify all regionCodes are valid
const invalidCodes = features.filter(
  (f) => !regionByCode[f.properties.regionCode]
);
if (invalidCodes.length > 0) {
  console.error(
    `\nERROR: ${invalidCodes.length} features have invalid region codes!`
  );
  invalidCodes.forEach((f) =>
    console.error(`  ${f.properties.id} ${f.properties.name}: ${f.properties.regionCode}`)
  );
  process.exit(1);
} else {
  console.log('\nAll region codes validated successfully.');
}

// Province distribution summary
const byProvince = {};
for (const f of features) {
  const p = f.properties.province;
  byProvince[p] = (byProvince[p] || 0) + 1;
}
console.log('\nProvince distribution:');
Object.entries(byProvince)
  .sort((a, b) => b[1] - a[1])
  .forEach(([p, c]) => console.log(`  ${p}: ${c}`));
