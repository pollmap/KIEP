"""
KIEP Industrial Ecosystem MCP Analytics Server

Provides 5 tools for Claude Desktop integration:
1. get_region_health - 시군구 산업 건강도 조회
2. compare_regions - 지역 간 비교 분석
3. find_industry_cluster - 산업 클러스터 탐색
4. get_company_360 - 기업 360도 프로필
5. predict_complex_risk - 산업단지 리스크 예측
"""

import os
import httpx
from fastmcp import FastMCP

API_BASE = os.getenv("KIEP_API_URL", "http://localhost:3100")

mcp = FastMCP(
    "KIEP Analytics",
    description="한국 산업 생태계 분석 도구 — 6개 공공데이터 통합 분석",
)

client = httpx.AsyncClient(base_url=API_BASE, timeout=30.0)


@mcp.tool()
async def get_region_health(
    region_code: str,
) -> dict:
    """시군구 산업 건강도를 조회합니다.

    Args:
        region_code: 법정동코드 5자리 (시군구). 예: "11010" (서울 종로구)

    Returns:
        건강도 점수, 구성 지표, 등급 정보
    """
    resp = await client.get(f"/api/regions/{region_code}")
    if resp.status_code == 404:
        return {"error": f"지역코드 {region_code}를 찾을 수 없습니다"}
    region = resp.json()

    health_resp = await client.get(f"/api/health/{region_code}")
    health = health_resp.json() if health_resp.status_code == 200 else {}

    score = region.get("health_score", 0)
    band = (
        "위험" if score < 40
        else "주의" if score < 55
        else "보통" if score < 70
        else "양호" if score < 85
        else "우수"
    )

    return {
        "region_code": region_code,
        "region_name": region.get("name", ""),
        "province": region.get("province", ""),
        "health_score": score,
        "health_band": band,
        "metrics": {
            "company_count": region.get("company_count", 0),
            "employee_count": region.get("employee_count", 0),
            "growth_rate": region.get("growth_rate", 0),
            "new_biz_rate": health.get("new_biz_rate", 0),
            "closure_rate": health.get("closure_rate", 0),
            "revenue_growth": health.get("revenue_growth", 0),
        },
    }


@mcp.tool()
async def compare_regions(
    region_codes: list[str],
) -> dict:
    """여러 시군구의 산업 지표를 비교합니다.

    Args:
        region_codes: 비교할 법정동코드 목록 (최대 5개). 예: ["11010", "11020", "41110"]

    Returns:
        각 지역의 지표와 순위 비교
    """
    if len(region_codes) > 5:
        return {"error": "최대 5개 지역까지 비교 가능합니다"}

    results = []
    for code in region_codes:
        resp = await client.get(f"/api/regions/{code}")
        if resp.status_code == 200:
            data = resp.json()
            results.append({
                "region_code": code,
                "name": data.get("name", ""),
                "health_score": data.get("health_score", 0),
                "company_count": data.get("company_count", 0),
                "employee_count": data.get("employee_count", 0),
                "growth_rate": data.get("growth_rate", 0),
            })

    if not results:
        return {"error": "유효한 지역을 찾을 수 없습니다"}

    # Rank by health score
    ranked = sorted(results, key=lambda r: r["health_score"], reverse=True)
    for i, r in enumerate(ranked):
        r["health_rank"] = i + 1

    metrics = ["health_score", "company_count", "employee_count", "growth_rate"]
    for metric in metrics:
        sorted_by = sorted(results, key=lambda r: r[metric], reverse=True)
        for i, r in enumerate(sorted_by):
            r[f"{metric}_rank"] = i + 1

    return {
        "comparison": ranked,
        "count": len(ranked),
        "best_health": ranked[0]["name"] if ranked else None,
    }


@mcp.tool()
async def find_industry_cluster(
    industry: str,
    min_companies: int = 10,
    top_n: int = 10,
) -> dict:
    """특정 산업의 집적지(클러스터)를 탐색합니다.

    Args:
        industry: 산업 키워드. 예: "반도체", "자동차", "바이오"
        min_companies: 최소 기업 수 기준 (기본 10)
        top_n: 상위 N개 지역 반환 (기본 10)

    Returns:
        해당 산업 집적도가 높은 지역 목록
    """
    resp = await client.get("/api/regions", params={"limit": 250})
    if resp.status_code != 200:
        return {"error": "지역 데이터를 불러올 수 없습니다"}

    regions = resp.json()
    clusters = []

    for region in regions:
        industries = region.get("top_industries", [])
        match = None
        for ind in industries:
            if industry in ind.get("name", ""):
                match = ind
                break

        if match and match.get("count", 0) >= min_companies:
            clusters.append({
                "region_code": region.get("code", ""),
                "region_name": region.get("name", ""),
                "province": region.get("province", ""),
                "industry_name": match.get("name", ""),
                "company_count": match.get("count", 0),
                "employee_count": region.get("employee_count", 0),
                "health_score": region.get("health_score", 0),
            })

    clusters.sort(key=lambda c: c["company_count"], reverse=True)
    top = clusters[:top_n]

    return {
        "industry": industry,
        "total_clusters": len(clusters),
        "top_clusters": top,
        "summary": f"'{industry}' 산업 클러스터 {len(clusters)}개 발견, 상위 {len(top)}개 표시",
    }


@mcp.tool()
async def get_company_360(
    biz_no: str,
) -> dict:
    """사업자등록번호로 기업 360도 프로필을 조회합니다.

    Args:
        biz_no: 사업자등록번호 10자리 (하이픈 없이). 예: "1234567890"

    Returns:
        NPS+NTS+FSC+PPS 통합 기업 프로필
    """
    clean_biz = biz_no.replace("-", "")
    if len(clean_biz) != 10:
        return {"error": "사업자등록번호는 10자리여야 합니다"}

    resp = await client.get(f"/api/companies/{clean_biz}")
    if resp.status_code == 404:
        return {"error": f"사업자등록번호 {clean_biz}에 해당하는 기업을 찾을 수 없습니다"}

    company = resp.json()

    return {
        "biz_no": clean_biz,
        "name": company.get("name", ""),
        "status": company.get("status", ""),
        "industry": company.get("industry_name", ""),
        "address": company.get("address", ""),
        "employment": {
            "current": company.get("employee_count", 0),
            "history": company.get("employment_history", []),
        },
        "financials": company.get("financials", []),
        "procurement": {
            "total_contracts": company.get("procurement_count", 0),
            "total_amount": company.get("procurement_amount", 0),
            "recent": company.get("recent_procurement", []),
        },
        "health_score": company.get("health_score", 0),
        "region_code": company.get("region_code", ""),
    }


@mcp.tool()
async def predict_complex_risk(
    complex_code: str = "",
    province: str = "",
) -> dict:
    """산업단지의 리스크를 분석합니다.

    Args:
        complex_code: 산업단지 코드 (선택). 예: "COMPLEX-0001"
        province: 시도명으로 필터 (선택). 예: "경기도"

    Returns:
        가동률, 분양률, 고용 추이 기반 리스크 분석
    """
    params = {}
    if province:
        params["province"] = province

    if complex_code:
        resp = await client.get(f"/api/complexes/{complex_code}")
        if resp.status_code == 404:
            return {"error": f"산업단지 {complex_code}를 찾을 수 없습니다"}
        complexes = [resp.json()]
    else:
        resp = await client.get("/api/complexes", params=params)
        if resp.status_code != 200:
            return {"error": "산업단지 데이터를 불러올 수 없습니다"}
        complexes = resp.json()

    risk_results = []
    for cx in complexes:
        tenant = cx.get("tenant_count", 0) or 1
        operating = cx.get("operating_count", 0)
        occupancy = cx.get("occupancy_rate", 0)
        employment = cx.get("employment", 0)

        op_rate = (operating / tenant) * 100 if tenant > 0 else 0

        # Risk scoring
        risk_score = 0
        factors = []

        if occupancy < 70:
            risk_score += 30
            factors.append(f"낮은 분양률 ({occupancy:.1f}%)")
        elif occupancy < 85:
            risk_score += 15
            factors.append(f"보통 분양률 ({occupancy:.1f}%)")

        if op_rate < 60:
            risk_score += 30
            factors.append(f"낮은 가동률 ({op_rate:.1f}%)")
        elif op_rate < 80:
            risk_score += 15
            factors.append(f"보통 가동률 ({op_rate:.1f}%)")

        if employment < 1000:
            risk_score += 20
            factors.append(f"소규모 고용 ({employment}명)")

        risk_level = (
            "높음" if risk_score >= 50
            else "보통" if risk_score >= 25
            else "낮음"
        )

        risk_results.append({
            "complex_code": cx.get("id", cx.get("complex_code", "")),
            "name": cx.get("name", ""),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "factors": factors,
            "metrics": {
                "occupancy_rate": occupancy,
                "operating_rate": round(op_rate, 1),
                "tenant_count": tenant,
                "employment": employment,
            },
        })

    risk_results.sort(key=lambda r: r["risk_score"], reverse=True)

    high_risk = [r for r in risk_results if r["risk_level"] == "높음"]
    return {
        "total_analyzed": len(risk_results),
        "high_risk_count": len(high_risk),
        "results": risk_results[:20],
        "summary": f"총 {len(risk_results)}개 단지 분석, {len(high_risk)}개 고위험",
    }


def main():
    mcp.run()


if __name__ == "__main__":
    main()
