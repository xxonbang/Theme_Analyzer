"""업종별 시세 수집 모듈

KOSPI/KOSDAQ 주요 업종의 당일 등락률을 수집하여
테마-섹터 상관관계 분석에 활용합니다.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Dict, List, Any

from modules.utils import KST

# KOSPI 업종 코드 (업종 기간별 시세 API용)
KOSPI_SECTORS = {
    "0005": "음식료품",
    "0006": "섬유의복",
    "0008": "화학",
    "0009": "의약품",
    "0011": "철강금속",
    "0012": "기계",
    "0013": "전기전자",
    "0014": "의료정밀",
    "0015": "운수장비",
    "0016": "유통업",
    "0017": "전기가스업",
    "0018": "건설업",
    "0019": "운수창고업",
    "0020": "통신업",
    "0021": "금융업",
    "0026": "서비스업",
    "0027": "제조업",
}

KOSDAQ_SECTORS = {
    "1028": "IT종합",
    "1034": "기타서비스",
}


def _fetch_sector(client, code: str, name: str, market: str) -> Dict[str, Any] | None:
    """단일 업종 당일 시세 조회"""
    try:
        today = datetime.now(KST).strftime("%Y%m%d")
        start = (datetime.now(KST) - timedelta(days=10)).strftime("%Y%m%d")
        resp = client.get_index_daily_price(code, start_date=start, end_date=today)
        if resp.get("rt_cd") != "0":
            return None

        items = resp.get("output2", [])
        if len(items) < 2:
            return None

        # output2[0] = 최신일, output2[1] = 전일
        current = float(items[0].get("bstp_nmix_prpr", 0))
        prev_close = float(items[1].get("bstp_nmix_prpr", 0))

        if prev_close == 0:
            return None

        change = current - prev_close
        change_rate = round(change / prev_close * 100, 2)

        return {
            "code": code,
            "name": name,
            "market": market,
            "current": round(current, 2),
            "change": round(change, 2),
            "change_rate": change_rate,
        }
    except Exception:
        return None


def collect_sector_performance(client) -> Dict[str, Any]:
    """전 업종 당일 등락률 병렬 수집

    Returns:
        {"sectors": [...], "collected_at": "2026-03-20 15:30:00"}
    """
    tasks = []
    for code, name in KOSPI_SECTORS.items():
        tasks.append((code, name, "kospi"))
    for code, name in KOSDAQ_SECTORS.items():
        tasks.append((code, name, "kosdaq"))

    sectors = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_fetch_sector, client, code, name, market): (code, name)
            for code, name, market in tasks
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                sectors.append(result)

    # 등락률 내림차순 정렬
    sectors.sort(key=lambda x: x["change_rate"], reverse=True)

    return {
        "sectors": sectors,
        "collected_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
    }
