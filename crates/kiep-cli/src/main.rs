use clap::{Parser, Subcommand};
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use kiep_core::Config;

#[derive(Parser)]
#[command(name = "kiep", about = "KIEP CLI - Korea Industrial Ecosystem Platform")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize database schema
    InitDb,

    /// Fetch NPS data for a region
    FetchNps {
        /// 시도코드 (예: 43=충북)
        #[arg(short, long)]
        sido: String,

        /// 시군구코드 (선택)
        #[arg(short = 'g', long)]
        sigungu: Option<String>,
    },

    /// Check NTS business status
    CheckNts {
        /// 사업자등록번호
        #[arg(short, long)]
        biz_no: String,
    },

    /// Export region health data as JSON (for frontend)
    ExportHealth {
        /// Output file path
        #[arg(short, long, default_value = "web/public/data/health.json")]
        output: String,
    },

    /// Show database stats
    Stats,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "kiep=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();
    let config = Config::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await?;

    match cli.command {
        Commands::InitDb => {
            tracing::info!("Initializing database...");
            let schema = include_str!("../../../sql/001_init.sql");
            sqlx::raw_sql(schema).execute(&pool).await?;
            tracing::info!("Database initialized successfully");
        }

        Commands::FetchNps { sido, sigungu } => {
            let api_key = config
                .nps_api_key
                .ok_or_else(|| anyhow::anyhow!("DATA_GO_KR_NPS_KEY not set"))?;

            let nps = kiep_etl::clients::nps::NpsClient::new(&api_key);
            let workplaces = nps
                .fetch_by_region(&sido, sigungu.as_deref())
                .await?;

            tracing::info!("Fetched {} workplaces", workplaces.len());

            let count =
                kiep_etl::load::postgres::upsert_nps_workplaces(&pool, &workplaces).await?;
            tracing::info!("Upserted {} records to database", count);
        }

        Commands::CheckNts { biz_no } => {
            let api_key = config
                .nts_api_key
                .ok_or_else(|| anyhow::anyhow!("DATA_GO_KR_NTS_KEY not set"))?;

            let nts = kiep_etl::clients::nts::NtsClient::new(&api_key);
            match nts.check_status(&biz_no).await? {
                Some(info) => {
                    println!("사업자번호: {}", info.biz_no);
                    println!("상호: {}", info.biz_name);
                    println!("대표자: {}", info.ceo_name);
                    println!("상태: {}", info.status);
                    println!("과세유형: {}", info.tax_type);
                }
                None => println!("해당 사업자번호를 찾을 수 없습니다."),
            }
        }

        Commands::ExportHealth { output } => {
            let entries: Vec<serde_json::Value> = sqlx::query_scalar(
                r#"
                SELECT json_build_object(
                    'code', r.code,
                    'name', r.name,
                    'province', r.province,
                    'healthScore', COALESCE(rh.health_score, 50),
                    'companyCount', COALESCE(rh.company_count, 0),
                    'employeeCount', COALESCE(rh.employee_count, 0),
                    'growthRate', COALESCE(rh.employment_growth, 0)
                )
                FROM regions r
                LEFT JOIN region_health rh ON rh.region_code = r.code
                    AND rh.year_month = (SELECT MAX(year_month) FROM region_health)
                ORDER BY r.code
                "#,
            )
            .fetch_all(&pool)
            .await?;

            let json = serde_json::to_string_pretty(&entries)?;
            std::fs::write(&output, json)?;
            tracing::info!("Exported {} regions to {}", entries.len(), output);
        }

        Commands::Stats => {
            let company_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM companies")
                    .fetch_one(&pool)
                    .await?;

            let region_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM regions")
                    .fetch_one(&pool)
                    .await?;

            let complex_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM industrial_complexes")
                    .fetch_one(&pool)
                    .await?;

            let emp_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM employment_series")
                    .fetch_one(&pool)
                    .await?;

            println!("=== KIEP Database Stats ===");
            println!("Companies:           {}", company_count.0);
            println!("Regions:             {}", region_count.0);
            println!("Industrial Complexes:{}", complex_count.0);
            println!("Employment Records:  {}", emp_count.0);
        }
    }

    Ok(())
}
