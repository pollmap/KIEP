/**
 * Generate realistic sample data for KIEP prototype.
 * Maps each 시군구 to mock industrial ecosystem metrics.
 */
const fs = require("fs");

const geo = JSON.parse(
  fs.readFileSync("public/data/regions.json", "utf8")
);

const PROVINCE_MAP = {
  "11": "서울특별시",
  "26": "부산광역시",
  "27": "대구광역시",
  "28": "인천광역시",
  "29": "광주광역시",
  "30": "대전광역시",
  "31": "울산광역시",
  "36": "세종특별자치시",
  "41": "경기도",
  "42": "강원특별자치도",
  "43": "충청북도",
  "44": "충청남도",
  "45": "전북특별자치도",
  "46": "전라남도",
  "47": "경상북도",
  "48": "경상남도",
  "39": "제주특별자치도",
};

// Seeded random for reproducibility
let seed = 42;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 1) {
  const v = random() * (max - min) + min;
  return parseFloat(v.toFixed(decimals));
}

// Province-based base parameters
function getBaseParams(provinceCode) {
  const c = provinceCode;
  // 서울
  if (c === "11") return { compBase: [8000, 25000], empBase: [30000, 150000], healthBase: [60, 92] };
  // 경기
  if (c === "41") return { compBase: [3000, 18000], empBase: [15000, 100000], healthBase: [50, 88] };
  // 광역시
  if (["26", "27", "28", "29", "30", "31"].includes(c))
    return { compBase: [2000, 12000], empBase: [10000, 70000], healthBase: [45, 85] };
  // 세종
  if (c === "36") return { compBase: [3000, 8000], empBase: [15000, 40000], healthBase: [70, 90] };
  // 도 (제주 포함)
  return { compBase: [300, 6000], empBase: [2000, 30000], healthBase: [30, 75] };
}

function generateIndustryDist() {
  const sectors = [
    "manufacturing",
    "it",
    "services",
    "construction",
    "wholesale",
    "logistics",
    "finance",
    "education",
    "healthcare",
    "other",
  ];
  const weights = sectors.map(() => random());
  const total = weights.reduce((a, b) => a + b, 0);
  const dist = {};
  sectors.forEach((s, i) => {
    dist[s] = parseFloat(((weights[i] / total) * 100).toFixed(1));
  });
  return dist;
}

const regionData = geo.features.map((f) => {
  const code = f.properties.code;
  const provinceCode = code.substring(0, 2);
  const province = PROVINCE_MAP[provinceCode] || "기타";
  const params = getBaseParams(provinceCode);

  const companyCount = randInt(...params.compBase);
  const employeeCount = randInt(...params.empBase);
  const healthScore = randFloat(...params.healthBase);

  return {
    code,
    name: f.properties.name,
    province,
    companyCount,
    employeeCount,
    healthScore,
    growthRate: randFloat(-5, 8),
    newBizRate: randFloat(2, 12),
    closureRate: randFloat(1, 8),
    industryDistribution: generateIndustryDist(),
  };
});

fs.writeFileSync(
  "public/data/sample-regions.json",
  JSON.stringify(regionData, null, 2)
);

console.log(`Generated data for ${regionData.length} regions`);
console.log(
  "File size:",
  fs.statSync("public/data/sample-regions.json").size,
  "bytes"
);
