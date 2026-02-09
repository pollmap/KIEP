use serde::{Deserialize, Serialize};
use tracing::info;

use super::common::ApiClient;

const NTS_BASE_URL: &str = "https://apis.data.go.kr/1160100/service/GetBmanInfoService";

/// NTS 사업자 상태 조회 클라이언트
pub struct NtsClient {
    client: ApiClient,
}

#[derive(Debug, Deserialize)]
pub struct NtsResponse {
    pub response: NtsResponseBody,
}

#[derive(Debug, Deserialize)]
pub struct NtsResponseBody {
    pub header: NtsHeader,
    pub body: Option<NtsBody>,
}

#[derive(Debug, Deserialize)]
pub struct NtsHeader {
    #[serde(rename = "resultCode")]
    pub result_code: String,
}

#[derive(Debug, Deserialize)]
pub struct NtsBody {
    pub items: Option<NtsItems>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
}

#[derive(Debug, Deserialize)]
pub struct NtsItems {
    pub item: Vec<NtsBizInfo>,
}

/// 사업자 등록 상태 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NtsBizInfo {
    /// 사업자등록번호
    #[serde(rename = "bno", default)]
    pub biz_no: String,
    /// 상호명
    #[serde(rename = "bnm", default)]
    pub biz_name: String,
    /// 대표자명
    #[serde(rename = "pnm", default)]
    pub ceo_name: String,
    /// 사업자상태 (계속/휴업/폐업)
    #[serde(rename = "bstt", default)]
    pub status: String,
    /// 과세유형
    #[serde(rename = "tpbz", default)]
    pub tax_type: String,
}

impl NtsClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: ApiClient::new(NTS_BASE_URL, api_key),
        }
    }

    /// 사업자 상태 조회 (단건)
    pub async fn check_status(&self, biz_no: &str) -> anyhow::Result<Option<NtsBizInfo>> {
        info!("Checking NTS status for biz_no={}", biz_no);

        let params = [("bno", biz_no), ("numOfRows", "1"), ("type", "json")];

        let resp: NtsResponse = self.client.get_json("/getBmanInfo", &params).await?;

        Ok(resp
            .response
            .body
            .and_then(|b| b.items)
            .and_then(|i| i.item.into_iter().next()))
    }
}
