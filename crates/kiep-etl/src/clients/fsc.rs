use serde::{Deserialize, Serialize};
use tracing::info;

use super::common::ApiClient;

const FSC_BASE_URL: &str = "https://apis.data.go.kr/1160100/service/GetFinaStatInfoService_V2";

/// FSC 금감원 재무제표 클라이언트
pub struct FscClient {
    client: ApiClient,
}

#[derive(Debug, Deserialize)]
pub struct FscResponse {
    pub response: FscResponseBody,
}

#[derive(Debug, Deserialize)]
pub struct FscResponseBody {
    pub header: FscHeader,
    pub body: Option<FscBody>,
}

#[derive(Debug, Deserialize)]
pub struct FscHeader {
    #[serde(rename = "resultCode")]
    pub result_code: String,
}

#[derive(Debug, Deserialize)]
pub struct FscBody {
    pub items: Option<FscItems>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
}

#[derive(Debug, Deserialize)]
pub struct FscItems {
    pub item: Vec<FscFinancial>,
}

/// 재무제표 항목
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FscFinancial {
    /// 법인등록번호
    #[serde(rename = "crno", default)]
    pub corp_no: String,
    /// 회사명
    #[serde(rename = "corpNm", default)]
    pub corp_name: String,
    /// 결산기준일
    #[serde(rename = "fnlttSinglAcntDt", default)]
    pub account_date: String,
    /// 계정과목명
    #[serde(rename = "fnlttSinglAcntNm", default)]
    pub account_name: String,
    /// 당기금액
    #[serde(rename = "thstrm_amount", default)]
    pub current_amount: Option<String>,
    /// 전기금액
    #[serde(rename = "frmtrm_amount", default)]
    pub previous_amount: Option<String>,
}

impl FscClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: ApiClient::new(FSC_BASE_URL, api_key),
        }
    }

    /// 법인등록번호로 재무제표 조회
    pub async fn fetch_financials(
        &self,
        corp_no: &str,
        fiscal_year: &str,
    ) -> anyhow::Result<Vec<FscFinancial>> {
        info!("Fetching FSC financials for corp_no={} year={}", corp_no, fiscal_year);

        let params = vec![
            ("crno", corp_no.to_string()),
            ("bizYear", fiscal_year.to_string()),
        ];
        let base_params: Vec<(&str, String)> = params
            .iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();

        self.client
            .fetch_all_pages(
                "/getFinaStatInfoService_V2",
                &base_params,
                100,
                |resp: FscResponse| {
                    let total = resp.response.body.as_ref().map(|b| b.total_count).unwrap_or(0);
                    let items = resp.response.body
                        .and_then(|b| b.items)
                        .map(|i| i.item)
                        .unwrap_or_default();
                    (items, total)
                },
            )
            .await
    }
}
