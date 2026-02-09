use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_http::compression::CompressionLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use kiep_core::Config;

mod routes;

pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Init tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "kiep_api=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load config
    let config = Config::from_env()?;

    // Connect to database
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to database");

    let state = Arc::new(AppState { pool, config: config.clone() });

    // Build router
    let app = Router::new()
        .nest("/api/v1", routes::api_router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .with_state(state);

    // Start server
    let addr = SocketAddr::new(
        config.api_host.parse().unwrap_or([0, 0, 0, 0].into()),
        config.api_port,
    );
    tracing::info!("Starting KIEP API server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
