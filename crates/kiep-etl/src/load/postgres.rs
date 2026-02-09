use sqlx::PgPool;
use tracing::info;

use crate::clients::nps::NpsWorkplace;
use crate::transform::normalize;

/// NPS 사업장 데이터를 companies + employment_series에 upsert
pub async fn upsert_nps_workplaces(
    pool: &PgPool,
    workplaces: &[NpsWorkplace],
) -> anyhow::Result<u32> {
    let mut count = 0u32;

    for wp in workplaces {
        if wp.biz_reg_no.is_empty() || wp.name.is_empty() {
            continue;
        }

        // 사업자번호 정규화 (NPS는 앞 6자리만 제공)
        let biz_no_prefix = normalize::normalize_biz_no(&wp.biz_reg_no);

        // 법정동코드 조합
        let bjd_code = format!("{}{}{}", wp.sido_code, wp.sigungu_code, wp.emd_code);
        let bjd_normalized = normalize::normalize_bjd_code(&bjd_code);
        let sigungu_code = normalize::extract_sigungu_code(&bjd_normalized);

        // companies upsert
        sqlx::query(
            r#"
            INSERT INTO companies (biz_no, name, industry_code, bjd_code, data_source)
            VALUES ($1, $2, $3, $4, 'NPS')
            ON CONFLICT (biz_no) DO UPDATE SET
                name = EXCLUDED.name,
                bjd_code = EXCLUDED.bjd_code,
                updated_at = NOW()
            "#,
        )
        .bind(&biz_no_prefix)
        .bind(&wp.name)
        .bind(&wp.industry_name)
        .bind(&sigungu_code)
        .execute(pool)
        .await?;

        // employment_series upsert
        if !wp.data_year_month.is_empty() {
            let year_month = format_year_month(&wp.data_year_month);
            sqlx::query(
                r#"
                INSERT INTO employment_series (biz_no, year_month, employee_count, new_hires, departures)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (biz_no, year_month) DO UPDATE SET
                    employee_count = EXCLUDED.employee_count,
                    new_hires = EXCLUDED.new_hires,
                    departures = EXCLUDED.departures
                "#,
            )
            .bind(&biz_no_prefix)
            .bind(&year_month)
            .bind(wp.subscriber_count as i32)
            .bind(wp.new_subscribers as i32)
            .bind(wp.lost_subscribers as i32)
            .execute(pool)
            .await?;
        }

        count += 1;
    }

    info!("Upserted {} NPS workplaces", count);
    Ok(count)
}

/// "202401" → "2024-01"
fn format_year_month(raw: &str) -> String {
    if raw.len() >= 6 {
        format!("{}-{}", &raw[..4], &raw[4..6])
    } else {
        raw.to_string()
    }
}
