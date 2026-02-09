# KIEP Analytics MCP Server

Claude Desktop용 산업 생태계 분석 MCP 서버

## Tools

| Tool | Description |
|------|-------------|
| `get_region_health` | 시군구 산업 건강도 조회 |
| `compare_regions` | 지역 간 비교 분석 |
| `find_industry_cluster` | 산업 클러스터 탐색 |
| `get_company_360` | 기업 360도 프로필 |
| `predict_complex_risk` | 산업단지 리스크 예측 |

## Setup

```bash
cd mcp/kiep-analytics
pip install -e .
```

## Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kiep-analytics": {
      "command": "python",
      "args": ["-m", "server"],
      "cwd": "/path/to/KIEP/mcp/kiep-analytics",
      "env": {
        "KIEP_API_URL": "http://localhost:3100"
      }
    }
  }
}
```
