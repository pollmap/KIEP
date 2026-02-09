# KIEP - Korea Industrial Ecosystem Platform

> 흩어진 6개 공공데이터 사일로를 사업자등록번호 하나로 꿰어, 시군구 단위 산업 생태계 건강도를 지도 위에 시각화하는 플랫폼

## Architecture

```
[React SPA + MapLibre] → [Axum API (Rust)] → [PostgreSQL + PostGIS]
                                   ↑
                          [ETL Pipeline (Rust)]
                                   ↑
                    [data.go.kr: NPS, NTS, FSC, PPS, KICOX]
```

## Project Structure

```
kiep/
├── crates/
│   ├── kiep-core/    # Shared types, config, errors
│   ├── kiep-etl/     # Data collection & processing
│   ├── kiep-api/     # REST API server (axum)
│   └── kiep-cli/     # CLI tool
├── web/              # Next.js frontend
├── sql/              # Database migrations
├── docker-compose.yml
└── Cargo.toml
```

## Quick Start

```bash
# 1. Start database
docker compose up -d

# 2. Initialize schema
cargo run -p kiep-cli -- init-db

# 3. Start API server
cargo run -p kiep-api

# 4. Start frontend
cd web && npm install && npm run dev
```

## Data Sources

| Source | Data | Update |
|--------|------|--------|
| NPS (국민연금) | 사업장 가입현황, 고용 | Monthly |
| NTS (국세청) | 사업자 상태 | On-demand |
| FSC (금융위) | 상장법인 재무 | Quarterly |
| PPS (조달청) | 나라장터 계약 | Daily |
| KICOX (산단공) | 산업단지 통계 | Quarterly |
