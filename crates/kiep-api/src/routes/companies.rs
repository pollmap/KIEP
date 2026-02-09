use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/search", get(search_companies))
        .route("/{biz_no}", get(get_company))
}

#[derive(Deserialize)]
pub struct SearchParams {
    q: String,
    limit: Option<i64>,
}

#[derive(Serialize, FromRow)]
pub struct CompanySearchResult {
    biz_no: String,
    name: String,
    biz_status: Option<String>,
    industry_code: Option<String>,
    bjd_code: Option<String>,
    stock_code: Option<String>,
    market_type: Option<String>,
}

async fn search_companies(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> Json<Vec<CompanySearchResult>> {
    let limit = params.limit.unwrap_or(20).min(100);
    let pattern = format!("%{}%", params.q);

    let results = sqlx::query_as::<_, CompanySearchResult>(
        r#"
        SELECT biz_no, name, biz_status, industry_code, bjd_code, stock_code, market_type
        FROM companies
        WHERE name ILIKE $1 OR biz_no = $2
        ORDER BY similarity(name, $3) DESC
        LIMIT $4
        "#,
    )
    .bind(&pattern)
    .bind(&params.q)
    .bind(&params.q)
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(results)
}

#[derive(Serialize, FromRow)]
pub struct CompanyDetail {
    biz_no: String,
    name: String,
    corp_no: Option<String>,
    ceo_name: Option<String>,
    biz_status: Option<String>,
    biz_type: Option<String>,
    biz_sector: Option<String>,
    industry_code: Option<String>,
    bjd_code: Option<String>,
    address: Option<String>,
    stock_code: Option<String>,
    market_type: Option<String>,
    complex_id: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct EmploymentEntry {
    year_month: String,
    employee_count: i32,
    new_hires: Option<i32>,
    departures: Option<i32>,
}

#[derive(Serialize, FromRow)]
pub struct FinancialEntry {
    fiscal_year: i32,
    quarter: i16,
    revenue: Option<i64>,
    operating_income: Option<i64>,
    net_income: Option<i64>,
    total_assets: Option<i64>,
}

#[derive(Serialize)]
pub struct CompanyFullProfile {
    company: CompanyDetail,
    employment: Vec<EmploymentEntry>,
    financials: Vec<FinancialEntry>,
}

async fn get_company(
    State(state): State<Arc<AppState>>,
    Path(biz_no): Path<String>,
) -> Json<Option<CompanyFullProfile>> {
    let company = sqlx::query_as::<_, CompanyDetail>(
        r#"
        SELECT biz_no, name, corp_no, ceo_name, biz_status, biz_type, biz_sector,
               industry_code, bjd_code, address, stock_code, market_type, complex_id
        FROM companies WHERE biz_no = $1
        "#,
    )
    .bind(&biz_no)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let Some(company) = company else {
        return Json(None);
    };

    let employment = sqlx::query_as::<_, EmploymentEntry>(
        r#"
        SELECT year_month, employee_count, new_hires, departures
        FROM employment_series
        WHERE biz_no = $1
        ORDER BY year_month DESC
        LIMIT 36
        "#,
    )
    .bind(&biz_no)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let financials = sqlx::query_as::<_, FinancialEntry>(
        r#"
        SELECT fiscal_year, quarter, revenue, operating_income, net_income, total_assets
        FROM financials
        WHERE biz_no = $1
        ORDER BY fiscal_year DESC, quarter DESC
        LIMIT 12
        "#,
    )
    .bind(&biz_no)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(Some(CompanyFullProfile {
        company,
        employment,
        financials,
    }))
}
