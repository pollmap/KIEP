use std::sync::Arc;

use axum::{
    routing::get,
    Json, Router,
};

use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/ping", get(ping))
}

async fn ping() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "kiep-api",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
