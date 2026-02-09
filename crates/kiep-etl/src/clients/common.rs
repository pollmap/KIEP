use reqwest::Client;
use serde::de::DeserializeOwned;
use std::time::Duration;
use tracing::{info, warn};

const MAX_RETRIES: u32 = 4;
const BASE_BACKOFF_MS: u64 = 2000;

/// 공통 API 클라이언트 (data.go.kr 등)
#[derive(Clone)]
pub struct ApiClient {
    http: Client,
    base_url: String,
    api_key: String,
}

impl ApiClient {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .gzip(true)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            http,
            base_url: base_url.to_string(),
            api_key: api_key.to_string(),
        }
    }

    /// GET 요청 with exponential backoff retry
    pub async fn get_json<T: DeserializeOwned>(
        &self,
        path: &str,
        params: &[(&str, &str)],
    ) -> anyhow::Result<T> {
        let url = format!("{}{}", self.base_url, path);

        let mut all_params: Vec<(&str, &str)> = vec![("serviceKey", &self.api_key)];
        all_params.extend_from_slice(params);

        let mut last_error = None;

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let delay = BASE_BACKOFF_MS * 2u64.pow(attempt - 1);
                warn!("Retry attempt {}/{} after {}ms", attempt, MAX_RETRIES, delay);
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }

            match self.http.get(&url).query(&all_params).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match resp.json::<T>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                last_error = Some(anyhow::anyhow!("JSON parse error: {}", e));
                            }
                        }
                    } else {
                        let status = resp.status();
                        let body = resp.text().await.unwrap_or_default();
                        last_error =
                            Some(anyhow::anyhow!("HTTP {} - {}", status, &body[..body.len().min(200)]));
                    }
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Request error: {}", e));
                }
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error")))
    }

    /// 페이징 처리된 전량 수집
    pub async fn fetch_all_pages<T, F, R>(
        &self,
        path: &str,
        base_params: &[(&str, String)],
        page_size: u32,
        extract_items: F,
    ) -> anyhow::Result<Vec<R>>
    where
        T: DeserializeOwned,
        F: Fn(T) -> (Vec<R>, u32), // (items, total_count)
        R: Send,
    {
        let mut all_items = Vec::new();
        let mut page = 1u32;
        let mut total_count = u32::MAX;

        while (page - 1) * page_size < total_count {
            let page_str = page.to_string();
            let size_str = page_size.to_string();

            let mut params: Vec<(&str, &str)> = base_params
                .iter()
                .map(|(k, v)| (*k, v.as_str()))
                .collect();
            params.push(("pageNo", &page_str));
            params.push(("numOfRows", &size_str));
            params.push(("type", "json"));

            let response: T = self.get_json(path, &params).await?;
            let (items, total) = extract_items(response);

            total_count = total;
            let count = items.len();
            all_items.extend(items);

            info!(
                "Page {}: fetched {} items (total: {})",
                page, count, total_count
            );

            if count == 0 {
                break;
            }
            page += 1;
        }

        Ok(all_items)
    }
}
