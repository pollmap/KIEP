use std::sync::Arc;

use axum::Router;

pub mod regions;
pub mod companies;
pub mod complexes;
pub mod geo;
pub mod health;

use crate::AppState;

pub fn api_router() -> Router<Arc<AppState>> {
    Router::new()
        .nest("/regions", regions::router())
        .nest("/companies", companies::router())
        .nest("/complexes", complexes::router())
        .nest("/geo", geo::router())
        .nest("/health", health::router())
}
