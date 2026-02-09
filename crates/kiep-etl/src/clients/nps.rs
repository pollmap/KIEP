use serde::{Deserialize, Serialize};
use tracing::info;

use super::common::ApiClient;

const NPS_BASE_URL: &str = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireService";

/// NPS 사업장 가입 현황 클라이언트
pub struct NpsClient {
    client: ApiClient,
}

/// NPS API 응답 구조
#[derive(Debug, Deserialize)]
pub struct NpsResponse {
    pub response: NpsResponseBody,
}

#[derive(Debug, Deserialize)]
pub struct NpsResponseBody {
    pub header: NpsHeader,
    pub body: Option<NpsBody>,
}

#[derive(Debug, Deserialize)]
pub struct NpsHeader {
    #[serde(rename = "resultCode")]
    pub result_code: String,
    #[serde(rename = "resultMsg")]
    pub result_msg: String,
}

#[derive(Debug, Deserialize)]
pub struct NpsBody {
    pub items: Option<NpsItems>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
}

#[derive(Debug, Deserialize)]
pub struct NpsItems {
    pub item: Vec<NpsWorkplace>,
}

/// 국민연금 사업장 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NpsWorkplace {
    /// 사업장명
    #[serde(rename = "wkplNm", default)]
    pub name: String,
    /// 사업자등록번호 (앞6자리)
    #[serde(rename = "bzowrRgstNo", default)]
    pub biz_reg_no: String,
    /// 가입자수
    #[serde(rename = "jnngpCnt", default)]
    pub subscriber_count: u32,
    /// 신규취득자수
    #[serde(rename = "crrmmNwAcqzrCnt", default)]
    pub new_subscribers: u32,
    /// 상실자수
    #[serde(rename = "crrmmLssJnngpCnt", default)]
    pub lost_subscribers: u32,
    /// 업종코드명
    #[serde(rename = "vldtVlKrnNm", default)]
    pub industry_name: String,
    /// 법정동 주소 시군구 읍면동 코드
    #[serde(rename = "ldongAddrMgplDgCd", default)]
    pub sido_code: String,
    #[serde(rename = "ldongAddrMgplSgguCd", default)]
    pub sigungu_code: String,
    #[serde(rename = "ldongAddrMgplSgguEmdCd", default)]
    pub emd_code: String,
    /// 데이터 기준일
    #[serde(rename = "dataCrtYm", default)]
    pub data_year_month: String,
}

impl NpsClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: ApiClient::new(NPS_BASE_URL, api_key),
        }
    }

    /// 시도별 사업장 목록 조회
    pub async fn fetch_by_region(
        &self,
        sido_code: &str,
        sigungu_code: Option<&str>,
    ) -> anyhow::Result<Vec<NpsWorkplace>> {
        info!("Fetching NPS workplaces for sido={}", sido_code);

        let mut params = vec![("ldong_addr_mgpl_dg_cd".to_string(), sido_code.to_string())];
        if let Some(sg) = sigungu_code {
            params.push(("ldong_addr_mgpl_sggu_cd".to_string(), sg.to_string()));
        }

        let base_params: Vec<(&str, String)> = params
            .iter()
            .map(|(k, v)| (k.as_str(), v.clone()))
            .collect();

        self.client
            .fetch_all_pages(
                "/getDetailInfoSearch",
                &base_params,
                100,
                |resp: NpsResponse| {
                    let total = resp
                        .response
                        .body
                        .as_ref()
                        .map(|b| b.total_count)
                        .unwrap_or(0);
                    let items = resp
                        .response
                        .body
                        .and_then(|b| b.items)
                        .map(|i| i.item)
                        .unwrap_or_default();
                    (items, total)
                },
            )
            .await
    }
}
