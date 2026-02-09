use serde::{Deserialize, Serialize};
use tracing::info;

use super::common::ApiClient;

const PPS_BASE_URL: &str = "https://apis.data.go.kr/1230000/BidPublicInfoService04";

/// PPS 나라장터 조달 클라이언트
pub struct PpsClient {
    client: ApiClient,
}

#[derive(Debug, Deserialize)]
pub struct PpsResponse {
    pub response: PpsResponseBody,
}

#[derive(Debug, Deserialize)]
pub struct PpsResponseBody {
    pub header: PpsHeader,
    pub body: Option<PpsBody>,
}

#[derive(Debug, Deserialize)]
pub struct PpsHeader {
    #[serde(rename = "resultCode")]
    pub result_code: String,
}

#[derive(Debug, Deserialize)]
pub struct PpsBody {
    pub items: Option<Vec<PpsContract>>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
}

/// 나라장터 계약 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PpsContract {
    /// 입찰공고번호
    #[serde(rename = "bidNtceNo", default)]
    pub bid_no: String,
    /// 계약번호
    #[serde(rename = "cntrctNo", default)]
    pub contract_no: String,
    /// 공고명
    #[serde(rename = "bidNtceNm", default)]
    pub title: String,
    /// 계약업체 사업자번호
    #[serde(rename = "bizno", default)]
    pub biz_no: String,
    /// 계약업체명
    #[serde(rename = "prcbdrBizNm", default)]
    pub company_name: String,
    /// 계약금액
    #[serde(rename = "cntrctAmt", default)]
    pub amount: Option<String>,
    /// 계약일자
    #[serde(rename = "cntrctDate", default)]
    pub contract_date: String,
    /// 수요기관명
    #[serde(rename = "dmndInsttNm", default)]
    pub agency: String,
    /// 물품/공사/용역 구분
    #[serde(rename = "cntrctMthdNm", default)]
    pub contract_type: String,
}

impl PpsClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: ApiClient::new(PPS_BASE_URL, api_key),
        }
    }

    /// 날짜 범위로 계약 정보 조회
    pub async fn fetch_contracts(
        &self,
        from_date: &str,
        to_date: &str,
    ) -> anyhow::Result<Vec<PpsContract>> {
        info!("Fetching PPS contracts from {} to {}", from_date, to_date);

        let params = vec![
            ("inqryBgnDt", from_date.to_string()),
            ("inqryEndDt", to_date.to_string()),
        ];
        let base_params: Vec<(&str, String)> = params
            .iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();

        self.client
            .fetch_all_pages(
                "/getBidPblancListInfoCnstwkPPSSrch04",
                &base_params,
                100,
                |resp: PpsResponse| {
                    let total = resp.response.body.as_ref().map(|b| b.total_count).unwrap_or(0);
                    let items = resp.response.body
                        .and_then(|b| b.items)
                        .unwrap_or_default();
                    (items, total)
                },
            )
            .await
    }
}
