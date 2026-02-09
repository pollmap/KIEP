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
        .route("/", get(list_regions))
        .route("/{code}", get(get_region))
        .route("/{code}/health", get(get_region_health))
        .route("/compare", get(compare_regions))
}

#[derive(Deserialize)]
pub struct ListParams {
    province: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct RegionListItem {
    code: String,
    name: String,
    province: String,
}

async fn list_regions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListParams>,
) -> Json<Vec<RegionListItem>> {
    let regions = if let Some(province) = params.province {
        sqlx::query_as::<_, RegionListItem>(
            "SELECT code, name, province FROM regions WHERE province = $1 ORDER BY name",
        )
        .bind(province)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, RegionListItem>(
            "SELECT code, name, province FROM regions ORDER BY province, name",
        )
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
    };

    Json(regions)
}

#[derive(Serialize, FromRow)]
pub struct RegionDetail {
    code: String,
    name: String,
    province: String,
    center_lon: Option<f64>,
    center_lat: Option<f64>,
    area_km2: Option<f64>,
    company_count: Option<i64>,
    employee_count: Option<i64>,
}

async fn get_region(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Json<Option<RegionDetail>> {
    let region = sqlx::query_as::<_, RegionDetail>(
        r#"
        SELECT
            r.code, r.name, r.province, r.center_lon, r.center_lat, r.area_km2,
            (SELECT COUNT(*) FROM companies c WHERE c.bjd_code = r.code) as company_count,
            (SELECT COALESCE(SUM(es.employee_count::bigint), 0)
             FROM employment_series es
             JOIN companies c ON c.biz_no = es.biz_no
             WHERE c.bjd_code = r.code
             AND es.year_month = (SELECT MAX(year_month) FROM employment_series)
            ) as employee_count
        FROM regions r
        WHERE r.code = $1
        "#,
    )
    .bind(&code)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    Json(region)
}

#[derive(Serialize, FromRow)]
pub struct RegionHealthEntry {
    year_month: String,
    health_score: f64,
    company_count: Option<i32>,
    employee_count: Option<i32>,
}

async fn get_region_health(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Json<Vec<RegionHealthEntry>> {
    let entries = sqlx::query_as::<_, RegionHealthEntry>(
        r#"
        SELECT year_month, health_score, company_count, employee_count
        FROM region_health
        WHERE region_code = $1
        ORDER BY year_month DESC
        LIMIT 36
        "#,
    )
    .bind(&code)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Json(entries)
}

#[derive(Deserialize)]
pub struct CompareParams {
    codes: String,
}

async fn compare_regions(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CompareParams>,
) -> Json<Vec<RegionDetail>> {
    let codes: Vec<&str> = params.codes.split(',').map(|s| s.trim()).collect();

    let mut results = Vec::new();
    for code in codes {
        if let Ok(Some(region)) = sqlx::query_as::<_, RegionDetail>(
            r#"
            SELECT
                r.code, r.name, r.province, r.center_lon, r.center_lat, r.area_km2,
                (SELECT COUNT(*) FROM companies c WHERE c.bjd_code = r.code) as company_count,
                (SELECT COALESCE(SUM(es.employee_count::bigint), 0)
                 FROM employment_series es
                 JOIN companies c ON c.biz_no = es.biz_no
                 WHERE c.bjd_code = r.code
                 AND es.year_month = (SELECT MAX(year_month) FROM employment_series)
                ) as employee_count
            FROM regions r
            WHERE r.code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(&state.pool)
        .await
        {
            results.push(region);
        }
    }

    Json(results)
}
