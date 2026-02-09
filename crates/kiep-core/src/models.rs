use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

// ============================================================
// 기업 (Company)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Company {
    pub biz_no: String,
    pub corp_no: Option<String>,
    pub name: String,
    pub ceo_name: Option<String>,
    pub biz_status: BizStatus,
    pub biz_type: Option<String>,
    pub biz_sector: Option<String>,
    pub industry_code: Option<String>,

    pub bjd_code: Option<String>,
    pub address: Option<String>,
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,

    pub stock_code: Option<String>,
    pub market_type: Option<MarketType>,
    pub listing_date: Option<NaiveDate>,

    pub complex_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BizStatus {
    Active,
    Suspended,
    Closed,
}

impl Default for BizStatus {
    fn default() -> Self {
        Self::Active
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MarketType {
    KOSPI,
    KOSDAQ,
    KONEX,
}

// ============================================================
// 지역 (Region)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub code: String,
    pub name: String,
    pub name_eng: Option<String>,
    pub province: String,
    pub center_lon: Option<f64>,
    pub center_lat: Option<f64>,
    pub area_km2: Option<f64>,
}

// ============================================================
// 지역 건강도 (RegionHealth)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionHealth {
    pub region_code: String,
    pub year_month: String,

    pub company_count: i32,
    pub employee_count: i32,
    pub new_biz_count: i32,
    pub closed_biz_count: i32,

    pub employment_growth: Option<f64>,
    pub new_biz_rate: Option<f64>,
    pub closure_rate: Option<f64>,
    pub avg_revenue_growth: Option<f64>,
    pub complex_utilization: Option<f64>,

    pub health_score: f64,
}

// ============================================================
// 산업단지 (IndustrialComplex)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndustrialComplex {
    pub id: String,
    pub name: String,
    pub complex_type: ComplexType,
    pub province: String,
    pub sigungu: Option<String>,
    pub bjd_code: Option<String>,

    pub designated_area: Option<f64>,
    pub industrial_area: Option<f64>,
    pub tenant_count: Option<i32>,
    pub operating_count: Option<i32>,
    pub occupancy_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ComplexType {
    National,
    General,
    UrbanHighTech,
    Agro,
}

// ============================================================
// 고용 시계열
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmploymentPoint {
    pub biz_no: String,
    pub year_month: String,
    pub employee_count: i32,
    pub new_hires: i32,
    pub departures: i32,
}

// ============================================================
// 재무 데이터
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Financial {
    pub biz_no: String,
    pub fiscal_year: i32,
    pub quarter: i16,
    pub revenue: Option<i64>,
    pub operating_income: Option<i64>,
    pub net_income: Option<i64>,
    pub total_assets: Option<i64>,
    pub total_equity: Option<i64>,
    pub total_debt: Option<i64>,
}

// ============================================================
// 조달 데이터
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Procurement {
    pub bid_no: Option<String>,
    pub contract_no: Option<String>,
    pub title: Option<String>,
    pub biz_no: Option<String>,
    pub contract_type: Option<String>,
    pub amount: Option<i64>,
    pub contract_date: Option<NaiveDate>,
    pub agency: Option<String>,
}

// ============================================================
// API 응답 타입
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct RegionSummary {
    pub code: String,
    pub name: String,
    pub province: String,
    pub health_score: f64,
    pub company_count: i32,
    pub employee_count: i32,
    pub growth_rate: f64,
    pub industry_distribution: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompanyProfile {
    pub company: Company,
    pub employment_history: Vec<EmploymentPoint>,
    pub financials: Vec<Financial>,
    pub procurements: Vec<Procurement>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegionComparison {
    pub regions: Vec<RegionSummary>,
    pub axes: Vec<String>,
}

// ============================================================
// 건강도 스코어 산출
// ============================================================

impl RegionHealth {
    /// 건강도 스코어 산출
    /// health_score = (
    ///     0.30 × 고용증감률_정규화 +
    ///     0.25 × 신규사업자비율 +
    ///     0.20 × (1 - 폐업률) +
    ///     0.15 × 상장사매출증가율_평균 +
    ///     0.10 × 산단가동률
    /// ) × 100
    pub fn calculate_score(
        employment_growth: f64,
        new_biz_rate: f64,
        closure_rate: f64,
        avg_revenue_growth: f64,
        complex_utilization: f64,
    ) -> f64 {
        let eg = normalize(employment_growth, -10.0, 10.0);
        let nb = normalize(new_biz_rate, 0.0, 20.0);
        let cr = 1.0 - normalize(closure_rate, 0.0, 20.0);
        let rg = normalize(avg_revenue_growth, -20.0, 30.0);
        let cu = normalize(complex_utilization, 0.0, 100.0);

        let score = (0.30 * eg + 0.25 * nb + 0.20 * cr + 0.15 * rg + 0.10 * cu) * 100.0;
        score.clamp(0.0, 100.0)
    }
}

fn normalize(value: f64, min: f64, max: f64) -> f64 {
    ((value - min) / (max - min)).clamp(0.0, 1.0)
}
