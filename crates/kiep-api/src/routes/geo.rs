use std::sync::Arc;

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use super::regions::AppError;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/choropleth", get(get_choropleth))
}

#[derive(Deserialize)]
pub struct ChoroplethParams {
    year_month: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct ChoroplethEntry {
    code: String,
    name: String,
    province: String,
    health_score: Option<f64>,
    company_count: Option<i32>,
    employee_count: Option<i32>,
    geojson: Option<serde_json::Value>,
}

async fn get_choropleth(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ChoroplethParams>,
) -> Result<Json<Vec<ChoroplethEntry>>, AppError> {
    let year_month = params.year_month.unwrap_or_default();

    let entries = sqlx::query_as::<_, ChoroplethEntry>(
        r#"
        SELECT
            r.code,
            r.name,
            r.province,
            rh.health_score,
            rh.company_count,
            rh.employee_count,
            ST_AsGeoJSON(r.geom)::jsonb as geojson
        FROM regions r
        LEFT JOIN region_health rh ON rh.region_code = r.code
            AND ($1::text = '' OR rh.year_month = $1)
            AND rh.year_month = (
                SELECT MAX(year_month) FROM region_health
                WHERE region_code = r.code
                AND ($1::text = '' OR year_month = $1)
            )
        WHERE r.geom IS NOT NULL
        ORDER BY r.code
        "#,
    )
    .bind(&year_month)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(entries))
}
