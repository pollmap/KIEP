use serde::{Deserialize, Serialize};
use tracing::info;

use super::common::ApiClient;

const KICOX_BASE_URL: &str = "https://apis.data.go.kr/B553804/IndustrialComplexService";

/// KICOX 산업단지 클라이언트
pub struct KicoxClient {
    client: ApiClient,
}

#[derive(Debug, Deserialize)]
pub struct KicoxResponse {
    pub response: KicoxResponseBody,
}

#[derive(Debug, Deserialize)]
pub struct KicoxResponseBody {
    pub header: KicoxHeader,
    pub body: Option<KicoxBody>,
}

#[derive(Debug, Deserialize)]
pub struct KicoxHeader {
    #[serde(rename = "resultCode")]
    pub result_code: String,
}

#[derive(Debug, Deserialize)]
pub struct KicoxBody {
    pub items: Option<KicoxItems>,
    #[serde(rename = "totalCount")]
    pub total_count: u32,
}

#[derive(Debug, Deserialize)]
pub struct KicoxItems {
    pub item: Vec<KicoxComplex>,
}

/// 산업단지 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KicoxComplex {
    /// 단지코드
    #[serde(rename = "cmplxCd", default)]
    pub complex_code: String,
    /// 단지명
    #[serde(rename = "cmplxNm", default)]
    pub name: String,
    /// 단지유형
    #[serde(rename = "cmplxTpCd", default)]
    pub complex_type: String,
    /// 시도명
    #[serde(rename = "ctpvNm", default)]
    pub province: String,
    /// 시군구명
    #[serde(rename = "sggNm", default)]
    pub sigungu: String,
    /// 지정면적(천㎡)
    #[serde(rename = "dsgAr", default)]
    pub designated_area: Option<f64>,
    /// 산업용지면적(천㎡)
    #[serde(rename = "idstAr", default)]
    pub industrial_area: Option<f64>,
    /// 입주업체수
    #[serde(rename = "mvnFrmCnt", default)]
    pub tenant_count: Option<u32>,
    /// 가동업체수
    #[serde(rename = "oprtFrmCnt", default)]
    pub operating_count: Option<u32>,
    /// 분양률(%)
    #[serde(rename = "lttotRt", default)]
    pub occupancy_rate: Option<f64>,
    /// 생산액(백만원)
    #[serde(rename = "prdcAmt", default)]
    pub production: Option<i64>,
    /// 수출액(천불)
    #[serde(rename = "xprtAmt", default)]
    pub export_amount: Option<i64>,
    /// 고용인원
    #[serde(rename = "emplCnt", default)]
    pub employment: Option<u32>,
}

impl KicoxClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: ApiClient::new(KICOX_BASE_URL, api_key),
        }
    }

    /// 전체 산업단지 목록 조회
    pub async fn fetch_all_complexes(&self) -> anyhow::Result<Vec<KicoxComplex>> {
        info!("Fetching all KICOX industrial complexes");

        let base_params: Vec<(&str, String)> = vec![];

        self.client
            .fetch_all_pages(
                "/getIndustrialComplexList",
                &base_params,
                100,
                |resp: KicoxResponse| {
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

    /// 시도별 산업단지 조회
    pub async fn fetch_by_province(&self, province: &str) -> anyhow::Result<Vec<KicoxComplex>> {
        info!("Fetching KICOX complexes for province={}", province);

        let base_params: Vec<(&str, String)> = vec![("ctpvNm", province.to_string())];

        self.client
            .fetch_all_pages(
                "/getIndustrialComplexList",
                &base_params,
                100,
                |resp: KicoxResponse| {
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
