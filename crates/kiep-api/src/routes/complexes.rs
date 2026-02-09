use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use super::regions::AppError;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_complexes))
        .route("/{id}", get(get_complex))
}

#[derive(Deserialize)]
pub struct ListParams {
    complex_type: Option<String>,
    province: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct ComplexListItem {
    id: String,
    name: String,
    complex_type: String,
    province: String,
    tenant_count: Option<i32>,
    operating_count: Option<i32>,
    occupancy_rate: Option<f64>,
}

async fn list_complexes(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListParams>,
) -> Result<Json<Vec<ComplexListItem>>, AppError> {
    let complexes = sqlx::query_as::<_, ComplexListItem>(
        r#"
        SELECT id, name, complex_type, province, tenant_count, operating_count, occupancy_rate
        FROM industrial_complexes
        WHERE ($1::text IS NULL OR complex_type = $1)
          AND ($2::text IS NULL OR province = $2)
        ORDER BY tenant_count DESC NULLS LAST
        "#,
    )
    .bind(&params.complex_type)
    .bind(&params.province)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(complexes))
}

#[derive(Serialize, FromRow)]
pub struct ComplexDetail {
    id: String,
    name: String,
    complex_type: String,
    province: String,
    sigungu: Option<String>,
    designated_area: Option<f64>,
    industrial_area: Option<f64>,
    tenant_count: Option<i32>,
    operating_count: Option<i32>,
    occupancy_rate: Option<f64>,
}

#[derive(Serialize, FromRow)]
pub struct ComplexSeriesEntry {
    year_quarter: String,
    production: Option<i64>,
    export_amount: Option<i64>,
    employment: Option<i32>,
    operating_count: Option<i32>,
}

#[derive(Serialize, FromRow)]
pub struct ComplexCompanyItem {
    biz_no: String,
    name: String,
    stock_code: Option<String>,
    employee_count: Option<i32>,
}

#[derive(Serialize)]
pub struct ComplexFullProfile {
    complex: ComplexDetail,
    series: Vec<ComplexSeriesEntry>,
    top_companies: Vec<ComplexCompanyItem>,
}

async fn get_complex(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Option<ComplexFullProfile>>, AppError> {
    let complex = sqlx::query_as::<_, ComplexDetail>(
        r#"
        SELECT id, name, complex_type, province, sigungu,
               designated_area, industrial_area, tenant_count, operating_count, occupancy_rate
        FROM industrial_complexes WHERE id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?;

    let Some(complex) = complex else {
        return Ok(Json(None));
    };

    let series = sqlx::query_as::<_, ComplexSeriesEntry>(
        r#"
        SELECT year_quarter, production, export_amount, employment, operating_count
        FROM complex_series
        WHERE complex_id = $1
        ORDER BY year_quarter DESC
        LIMIT 12
        "#,
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;

    // Use LEFT JOIN with LATERAL to avoid N+1 subquery
    let top_companies = sqlx::query_as::<_, ComplexCompanyItem>(
        r#"
        SELECT c.biz_no, c.name, c.stock_code, latest_emp.employee_count
        FROM companies c
        LEFT JOIN LATERAL (
            SELECT es.employee_count
            FROM employment_series es
            WHERE es.biz_no = c.biz_no
            ORDER BY es.year_month DESC
            LIMIT 1
        ) latest_emp ON true
        WHERE c.complex_id = $1
        ORDER BY c.stock_code IS NOT NULL DESC, c.name
        LIMIT 20
        "#,
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(Some(ComplexFullProfile {
        complex,
        series,
        top_companies,
    })))
}
