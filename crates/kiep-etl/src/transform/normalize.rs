/// 사업자등록번호 정규화: 하이픈 제거, 10자리 패딩
pub fn normalize_biz_no(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    format!("{:0>10}", digits)
}

/// 법정동코드 정규화: 8자리 → 10자리 (뒤 2자리 00 패딩)
pub fn normalize_bjd_code(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    format!("{:0<10}", digits)
}

/// 법정동코드에서 시군구 코드(5자리) 추출
pub fn extract_sigungu_code(bjd_code: &str) -> String {
    let normalized = normalize_bjd_code(bjd_code);
    normalized[..5].to_string()
}

/// 법정동코드에서 시도 코드(2자리) 추출
pub fn extract_sido_code(bjd_code: &str) -> String {
    let normalized = normalize_bjd_code(bjd_code);
    normalized[..2].to_string()
}

/// NPS 시도코드 → 법정동 시도코드 매핑
pub fn nps_sido_to_bjd(nps_sido: &str) -> Option<&'static str> {
    match nps_sido {
        "11" => Some("11"), // 서울
        "26" => Some("26"), // 부산
        "27" => Some("27"), // 대구
        "28" => Some("28"), // 인천
        "29" => Some("29"), // 광주
        "30" => Some("30"), // 대전
        "31" => Some("31"), // 울산
        "36" => Some("36"), // 세종
        "41" => Some("41"), // 경기
        "42" => Some("42"), // 강원
        "43" => Some("43"), // 충북
        "44" => Some("44"), // 충남
        "45" => Some("45"), // 전북
        "46" => Some("46"), // 전남
        "47" => Some("47"), // 경북
        "48" => Some("48"), // 경남
        "50" | "39" => Some("39"), // 제주
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_biz_no() {
        assert_eq!(normalize_biz_no("123-45-67890"), "1234567890");
        assert_eq!(normalize_biz_no("1234567890"), "1234567890");
        assert_eq!(normalize_biz_no("12345"), "0000012345");
    }

    #[test]
    fn test_normalize_bjd_code() {
        assert_eq!(normalize_bjd_code("11010"), "1101000000");
        assert_eq!(normalize_bjd_code("1101010100"), "1101010100");
        assert_eq!(normalize_bjd_code("4311000"), "4311000000");
    }

    #[test]
    fn test_extract_sigungu() {
        assert_eq!(extract_sigungu_code("1101010100"), "11010");
        assert_eq!(extract_sigungu_code("43110"), "43110");
    }
}
