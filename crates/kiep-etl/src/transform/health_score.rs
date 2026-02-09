use kiep_core::models::RegionHealth;

/// 지역 건강도 스코어 계산기
pub struct HealthScoreCalculator;

impl HealthScoreCalculator {
    /// 고용, 사업자, 재무, 산단 데이터로부터 건강도 산출
    pub fn calculate(
        employment_growth: f64,
        new_biz_rate: f64,
        closure_rate: f64,
        avg_revenue_growth: f64,
        complex_utilization: f64,
    ) -> f64 {
        RegionHealth::calculate_score(
            employment_growth,
            new_biz_rate,
            closure_rate,
            avg_revenue_growth,
            complex_utilization,
        )
    }

    /// 여러 지역의 건강도를 일괄 계산
    pub fn calculate_batch(
        regions: &[(String, f64, f64, f64, f64, f64)],
    ) -> Vec<(String, f64)> {
        regions
            .iter()
            .map(|(code, eg, nb, cr, rg, cu)| {
                (code.clone(), Self::calculate(*eg, *nb, *cr, *rg, *cu))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_score_high() {
        // 고용 +5%, 신규사업 10%, 폐업 2%, 매출증가 15%, 가동률 95%
        let score = HealthScoreCalculator::calculate(5.0, 10.0, 2.0, 15.0, 95.0);
        assert!(score > 70.0, "High-performing region should score above 70, got {}", score);
    }

    #[test]
    fn test_health_score_low() {
        // 고용 -8%, 신규사업 1%, 폐업 15%, 매출감소 -10%, 가동률 30%
        let score = HealthScoreCalculator::calculate(-8.0, 1.0, 15.0, -10.0, 30.0);
        assert!(score < 30.0, "Struggling region should score below 30, got {}", score);
    }

    #[test]
    fn test_score_bounds() {
        let max = HealthScoreCalculator::calculate(20.0, 30.0, 0.0, 50.0, 100.0);
        let min = HealthScoreCalculator::calculate(-20.0, 0.0, 30.0, -30.0, 0.0);
        assert!(max <= 100.0);
        assert!(min >= 0.0);
    }
}
