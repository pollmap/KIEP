use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub api_host: String,
    pub api_port: u16,

    // data.go.kr API keys
    pub nps_api_key: Option<String>,
    pub nts_api_key: Option<String>,
    pub fsc_api_key: Option<String>,
    pub pps_api_key: Option<String>,

    // VWorld
    pub vworld_api_key: Option<String>,
}

impl Config {
    pub fn from_env() -> crate::Result<Self> {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| crate::Error::Config("DATABASE_URL must be set".into()))?;

        Ok(Self {
            database_url,
            api_host: env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            api_port: env::var("API_PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .unwrap_or(8080),
            nps_api_key: env::var("DATA_GO_KR_NPS_KEY").ok(),
            nts_api_key: env::var("DATA_GO_KR_NTS_KEY").ok(),
            fsc_api_key: env::var("DATA_GO_KR_FSC_KEY").ok(),
            pps_api_key: env::var("DATA_GO_KR_PPS_KEY").ok(),
            vworld_api_key: env::var("VWORLD_API_KEY").ok(),
        })
    }
}
