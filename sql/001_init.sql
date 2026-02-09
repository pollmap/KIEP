-- KIEP Database Schema
-- PostgreSQL 16 + PostGIS 3.4

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 텍스트 유사 검색용

-- ============================================================
-- 1. 법정동 코드 매핑 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS bjd_codes (
    code        VARCHAR(10) PRIMARY KEY,       -- 법정동코드 (10자리)
    sido        VARCHAR(20) NOT NULL,          -- 시도명
    sigungu     VARCHAR(30),                   -- 시군구명
    eupmyeondong VARCHAR(30),                  -- 읍면동명
    level       SMALLINT NOT NULL DEFAULT 3,   -- 1=시도, 2=시군구, 3=읍면동
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_bjd_sido ON bjd_codes(sido);
CREATE INDEX idx_bjd_level ON bjd_codes(level);

-- ============================================================
-- 2. 지역 (시군구 단위 GIS 포함)
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
    code        VARCHAR(10) PRIMARY KEY,       -- 시군구 법정동코드 (5자리)
    name        VARCHAR(50) NOT NULL,          -- 시군구명
    name_eng    VARCHAR(100),                  -- 영문명
    province    VARCHAR(20) NOT NULL,          -- 시도명
    geom        GEOMETRY(MultiPolygon, 4326),  -- 경계 폴리곤 (WGS84)
    center_lon  DOUBLE PRECISION,              -- 중심 경도
    center_lat  DOUBLE PRECISION,              -- 중심 위도
    area_km2    DOUBLE PRECISION,              -- 면적(km²)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regions_geom ON regions USING GIST(geom);
CREATE INDEX idx_regions_province ON regions(province);

-- ============================================================
-- 3. 기업 (통합 프로파일)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    biz_no          VARCHAR(10) PRIMARY KEY,        -- 사업자등록번호
    corp_no         VARCHAR(13),                    -- 법인등록번호
    name            VARCHAR(200) NOT NULL,          -- 기업명
    ceo_name        VARCHAR(100),                   -- 대표자명
    biz_status      VARCHAR(10) DEFAULT 'active',   -- active/suspended/closed
    biz_type        VARCHAR(100),                   -- 업태
    biz_sector      VARCHAR(100),                   -- 종목
    industry_code   VARCHAR(10),                    -- KSIC 업종코드

    -- 위치 정보
    bjd_code        VARCHAR(10),                    -- 소재지 법정동코드
    address         TEXT,                           -- 주소
    coordinates     GEOMETRY(Point, 4326),          -- 위경도

    -- 상장 정보
    stock_code      VARCHAR(10),                    -- 종목코드
    market_type     VARCHAR(20),                    -- KOSPI/KOSDAQ/KONEX
    listing_date    DATE,                           -- 상장일

    -- 산업단지 소속
    complex_id      VARCHAR(20),                    -- 산업단지 ID

    -- 메타
    data_source     VARCHAR(50),                    -- 최초 데이터 출처
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_bjd ON companies(bjd_code);
CREATE INDEX idx_companies_industry ON companies(industry_code);
CREATE INDEX idx_companies_name_trgm ON companies USING gin(name gin_trgm_ops);
CREATE INDEX idx_companies_corp_no ON companies(corp_no);
CREATE INDEX idx_companies_stock ON companies(stock_code);
CREATE INDEX idx_companies_complex ON companies(complex_id);
CREATE INDEX idx_companies_geom ON companies USING GIST(coordinates);

-- ============================================================
-- 4. 고용 시계열 (NPS 기반, 월별)
-- ============================================================
CREATE TABLE IF NOT EXISTS employment_series (
    id              BIGSERIAL PRIMARY KEY,
    biz_no          VARCHAR(10) NOT NULL REFERENCES companies(biz_no),
    year_month      VARCHAR(7) NOT NULL,            -- '2024-01'
    employee_count  INTEGER NOT NULL,               -- 국민연금 가입자수
    new_hires       INTEGER DEFAULT 0,              -- 신규 취득자수
    departures      INTEGER DEFAULT 0,              -- 상실자수
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emp_biz ON employment_series(biz_no);
CREATE INDEX idx_emp_month ON employment_series(year_month);
CREATE UNIQUE INDEX idx_emp_unique ON employment_series(biz_no, year_month);

-- ============================================================
-- 5. 재무 데이터 (FSC/DART 기반, 분기별)
-- ============================================================
CREATE TABLE IF NOT EXISTS financials (
    id              BIGSERIAL PRIMARY KEY,
    biz_no          VARCHAR(10) NOT NULL REFERENCES companies(biz_no),
    fiscal_year     INTEGER NOT NULL,               -- 회계연도
    quarter         SMALLINT NOT NULL,              -- 1~4

    revenue         BIGINT,                         -- 매출액 (원)
    operating_income BIGINT,                        -- 영업이익
    net_income      BIGINT,                         -- 당기순이익
    total_assets    BIGINT,                         -- 자산총계
    total_equity    BIGINT,                         -- 자본총계
    total_debt      BIGINT,                         -- 부채총계

    data_source     VARCHAR(20),                    -- FSC/DART
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fin_biz ON financials(biz_no);
CREATE INDEX idx_fin_period ON financials(fiscal_year, quarter);
CREATE UNIQUE INDEX idx_fin_unique ON financials(biz_no, fiscal_year, quarter);

-- ============================================================
-- 6. 산업단지
-- ============================================================
CREATE TABLE IF NOT EXISTS industrial_complexes (
    id              VARCHAR(20) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    complex_type    VARCHAR(20) NOT NULL,           -- national/general/urban_high_tech/agro
    province        VARCHAR(20) NOT NULL,           -- 시도
    sigungu         VARCHAR(30),                    -- 시군구
    bjd_code        VARCHAR(10),                    -- 법정동코드
    geom            GEOMETRY(MultiPolygon, 4326),   -- 산단 경계

    -- 기본 통계
    designated_area DOUBLE PRECISION,               -- 지정면적(천㎡)
    industrial_area DOUBLE PRECISION,               -- 산업용지면적(천㎡)
    tenant_count    INTEGER DEFAULT 0,              -- 입주업체수
    operating_count INTEGER DEFAULT 0,              -- 가동업체수
    occupancy_rate  DOUBLE PRECISION,               -- 분양률(%)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complex_type ON industrial_complexes(complex_type);
CREATE INDEX idx_complex_province ON industrial_complexes(province);
CREATE INDEX idx_complex_geom ON industrial_complexes USING GIST(geom);

-- ============================================================
-- 7. 산업단지 시계열 (분기별 생산/수출/고용)
-- ============================================================
CREATE TABLE IF NOT EXISTS complex_series (
    id              BIGSERIAL PRIMARY KEY,
    complex_id      VARCHAR(20) NOT NULL REFERENCES industrial_complexes(id),
    year_quarter    VARCHAR(7) NOT NULL,            -- '2024-Q1'

    production      BIGINT,                         -- 생산액 (백만원)
    export_amount   BIGINT,                         -- 수출액 (천달러)
    employment      INTEGER,                        -- 고용인원
    operating_count INTEGER,                        -- 가동업체수

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cseries_complex ON complex_series(complex_id);
CREATE UNIQUE INDEX idx_cseries_unique ON complex_series(complex_id, year_quarter);

-- ============================================================
-- 8. 조달 데이터 (PPS 나라장터)
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement (
    id              BIGSERIAL PRIMARY KEY,
    bid_no          VARCHAR(30),                    -- 입찰공고번호
    contract_no     VARCHAR(30),                    -- 계약번호
    title           TEXT,                           -- 공고명/계약명
    biz_no          VARCHAR(10) REFERENCES companies(biz_no),

    contract_type   VARCHAR(20),                    -- 물품/공사/용역
    amount          BIGINT,                         -- 계약금액 (원)
    contract_date   DATE,                           -- 계약일
    agency          VARCHAR(100),                   -- 발주기관

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proc_biz ON procurement(biz_no);
CREATE INDEX idx_proc_date ON procurement(contract_date);
CREATE INDEX idx_proc_type ON procurement(contract_type);

-- ============================================================
-- 9. 지역 건강도 집계 (시군구별, 월별)
-- ============================================================
CREATE TABLE IF NOT EXISTS region_health (
    id              BIGSERIAL PRIMARY KEY,
    region_code     VARCHAR(10) NOT NULL REFERENCES regions(code),
    year_month      VARCHAR(7) NOT NULL,            -- '2024-01'

    company_count   INTEGER DEFAULT 0,              -- 총 기업수
    employee_count  INTEGER DEFAULT 0,              -- 총 고용인원
    new_biz_count   INTEGER DEFAULT 0,              -- 신규 사업자수
    closed_biz_count INTEGER DEFAULT 0,             -- 폐업 사업자수

    -- 건강도 스코어 구성 요소
    employment_growth   DOUBLE PRECISION,           -- 고용증감률
    new_biz_rate        DOUBLE PRECISION,           -- 신규사업자비율
    closure_rate        DOUBLE PRECISION,           -- 폐업률
    avg_revenue_growth  DOUBLE PRECISION,           -- 상장사 평균매출증가율
    complex_utilization DOUBLE PRECISION,           -- 산단가동률

    -- 종합 스코어
    health_score    DOUBLE PRECISION NOT NULL,       -- 0~100

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rh_region ON region_health(region_code);
CREATE INDEX idx_rh_month ON region_health(year_month);
CREATE UNIQUE INDEX idx_rh_unique ON region_health(region_code, year_month);

-- ============================================================
-- 10. 데이터 수집 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS etl_logs (
    id              BIGSERIAL PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,           -- NPS/NTS/FSC/PPS/KICOX
    job_type        VARCHAR(30) NOT NULL,           -- full_sync/incremental/status_check
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    records_fetched INTEGER DEFAULT 0,
    records_upserted INTEGER DEFAULT 0,
    status          VARCHAR(10) DEFAULT 'running',  -- running/success/failed
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
