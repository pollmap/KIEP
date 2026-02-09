# KIEP v0.2 Data Source Research

## Integration Priority Matrix

| Source | Priority | 시군구 Granularity | Integration Key | API Available | Effort |
|--------|----------|-------------------|-----------------|---------------|--------|
| **KOSIS (통계청)** | HIGH | Yes | 법정동코드 | OpenAPI | Medium |
| **고용노동부 고용행정통계** | HIGH | Yes (시군구코드) | 시군구코드 5자리 | REST XML | Low |
| **DART (전자공시)** | MEDIUM-HIGH | Via company address | 사업자등록번호, 법인등록번호 | REST JSON | Medium |
| **환경부 PRTR** | MEDIUM | Via 사업장 주소 | 사업장명+주소 | REST JSON/XML | Medium |
| **HUG + R-ONE (부동산)** | MEDIUM | Yes | 법정동코드 | REST JSON/XML | Low-Medium |
| **특허청 KIPRIS Plus** | MEDIUM | Via 출원인 주소 | **사업자등록번호** | REST XML | Medium |
| **KICOX Enhanced** | LOW-MEDIUM | Yes (산업단지) | 회사명 (fuzzy) | File only | Medium |
| **신보/기보** | LOW | Limited | No standard key | File only | High |

## Recommended Implementation Order

1. **KOSIS OpenAPI** — GRDP, 인구, 고용, 산업구조 at 시군구 level
2. **고용노동부** — 시군구 고용보험 피보험자수
3. **DART** — 상장기업 재무데이터 (사업자등록번호 연계)
4. **HUG / R-ONE** — 부동산/주거 지표
5. **환경부 PRTR** — ESG/환경 데이터
6. **특허청** — 혁신지표 (특허수)

---

## 1. KOSIS (통계청 국가통계포털)

- **Portal**: https://kosis.kr/openapi/index/index.jsp
- **Base URL**: `https://kosis.kr/openapi/Param/statisticsParameterData.do`
- **Auth**: Free API key (1 key/member, auto-approved)
- **Format**: JSON, XML
- **Rate Limit**: 40,000 records/call, no daily limit

### Key Tables (시군구)

| Dataset | orgId | tblId | 비고 |
|---------|-------|-------|------|
| 사업체수/종사자수 by 시군구 | `118` | `DT_SAUP120` | 고용노동부 |
| 주민등록인구 (읍면동) | `101` | `DT_1B04005N` | 통계청 월간 |
| 주민등록세대수 (시군구) | `101` | `DT_1B040B3` | 통계청 |
| 시군구 GRDP | varies by 시도 | varies | 15개 시도별 |

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `orgId` | 기관 ID | `101` (통계청) |
| `tblId` | 통계표 ID | `DT_SAUP120` |
| `objL1`~`objL8` | 분류항목 | `ALL` |
| `prdSe` | 수록주기 | `Y`(년), `M`(월) |
| `startPrdDe`/`endPrdDe` | 기간 | `2022`/`2024` |

### Python Library
```python
from PublicDataReader import Kosis
api = Kosis("API_KEY")
df = api.get_data("통계자료", orgId="118", tblId="DT_SAUP120", ...)
```

---

## 2. 고용노동부 고용행정통계

- **Portal**: https://eis.work24.go.kr/eisps/opiv/selectOpivList.do
- **Base URL**: `https://eis.work24.go.kr/opi/ipsApi.do`
- **Format**: XML
- **Free**

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `apiSecd` | 서비스코드 | `OPIB` (고용보험 피보험자) |
| `rsdAreaCd` | **시군구 코드** (5자리) | `11110` (종로구) |
| `sxdsCd` | 성별 | `1`/`2` |
| `closStdrYm` | 기준월 | `202101` |

---

## 3. DART (전자공시)

- **Portal**: https://opendart.fss.or.kr
- **Base URL**: `https://opendart.fss.or.kr/api/`
- **Format**: JSON, XML
- **Rate Limit**: ~10,000/day

### Key Endpoints

| API | Endpoint | Description |
|-----|----------|-------------|
| 고유번호 목록 | `/corpCode.xml` | 전체 corp_code 매핑 |
| 기업개황 | `/company.json` | **bizr_no** (사업자등록번호), jurir_no, 주소 |
| 재무제표 | `/fnlttSinglAcnt.json` | 매출, 영업이익, 자산 |

---

## 4. HUG / R-ONE (부동산)

### HUG APIs on data.go.kr

| Dataset | URL |
|---------|-----|
| 지역별 m2당 분양가격 | https://www.data.go.kr/data/15070256/openapi.do |
| 분양이력정보 | https://www.data.go.kr/data/15057686/openapi.do |
| 분양보증 이행현황 | https://www.data.go.kr/data/15056833/openapi.do |

### R-ONE

- **Base URL**: `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do`
- **Stat List**: `SttsApiTbl.do?KEY={key}`
- 미분양, 매매가지수 등 시군구 단위

---

## 5. 환경부 PRTR

- **API**: https://www.data.go.kr/data/15024756/openapi.do
- **Portal**: https://icis.me.go.kr/prtr
- 사업장별 화학물질 대기/수계/토양 배출량

---

## 6. 특허청 KIPRIS Plus

- **출원인 사업자번호 API**: 사업자등록번호 → 특허고객번호 → 특허검색
- **Rate**: 월 1,000회 (data.go.kr), 높은 볼륨은 KIPRIS Plus 직접

---

## Integration Architecture

```
시군구-level aggregate data (KOSIS, 고용노동부, HUG, R-ONE)
  └── JOIN via 법정동코드 앞5자리 (시군구코드)

Company-level data (DART, KIPRIS, PRTR)
  └── JOIN via 사업자등록번호 → NPS record → 법정동코드 → 시군구 aggregation
```
