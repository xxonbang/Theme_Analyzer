"""
KOSPI/KOSDAQ 전종목 마스터 데이터 생성 (pykrx 기반)

KRX 상장종목 전체를 pykrx로 수집하여 stock-master.json을 생성합니다.
KIS API 의존성 없음 — 매주 cron에서 안정적으로 2,000개 이상 재현.

출력: frontend/public/data/stock-master.json
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))

OUTPUT_PATH = (
    Path(__file__).parent.parent / "frontend" / "public" / "data" / "stock-master.json"
)


# ---------------------------------------------------------------------------
# 순수 함수 — 테스트 가능한 단위
# ---------------------------------------------------------------------------

def is_spac(name: str) -> bool:
    """종목명에 스팩(SPAC) 키워드가 포함되면 True"""
    n = name.upper()
    return "스팩" in n or "SPAC" in n


def normalize_market(market_eng: str) -> Optional[str]:
    """KRX marketEngName → 출력 market 문자열.
    KONEX는 None 반환 (제외 대상).
    KOSDAQ GLOBAL → KOSDAQ 으로 통합.
    """
    if market_eng in ("KOSPI",):
        return "KOSPI"
    if market_eng in ("KOSDAQ", "KOSDAQ GLOBAL"):
        return "KOSDAQ"
    return None  # KONEX 등


def build_stock_list(df: pd.DataFrame) -> list[dict]:
    """상장종목 DataFrame을 받아 필터링·정규화된 종목 리스트 반환.

    필터:
    - KONEX 제외 (normalize_market이 None)
    - 스팩 제외
    코드 오름차순 정렬.
    """
    result = []
    for _, row in df.iterrows():
        market = normalize_market(row["marketEngName"])
        if market is None:
            continue
        name = row["codeName"]
        if is_spac(name):
            continue
        result.append({
            "code": row["short_code"],
            "name": name,
            "market": market,
        })
    result.sort(key=lambda x: x["code"])
    return result


# ---------------------------------------------------------------------------
# 데이터 수집 (pykrx)
# ---------------------------------------------------------------------------

def fetch_listed_stocks() -> pd.DataFrame:
    """KRX 상장종목 전체 DataFrame 반환.
    ETF/ETN은 별도 API이므로 이 API에서 자동 제외됨.
    """
    from pykrx.website.krx.market.core import 상장종목검색  # lazy import

    df = 상장종목검색().fetch("ALL")
    if df.empty:
        raise RuntimeError("KRX 상장종목 조회 결과가 비어 있습니다. 네트워크 또는 KRX 점검 여부를 확인하세요.")
    return df


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------

def main() -> None:
    from modules.utils import KST

    print("[StockMaster] pykrx로 KRX 전종목 수집 시작")
    df = fetch_listed_stocks()
    print(f"  KRX 원시 데이터: {len(df)}행")

    stocks = build_stock_list(df)
    kospi_cnt = sum(1 for s in stocks if s["market"] == "KOSPI")
    kosdaq_cnt = sum(1 for s in stocks if s["market"] == "KOSDAQ")
    print(f"  필터링 후: {len(stocks)}종목 (KOSPI {kospi_cnt} + KOSDAQ {kosdaq_cnt})")

    today = datetime.now(KST).strftime("%Y%m%d")
    output = {
        "updated_at": today,
        "count": len(stocks),
        "stocks": stocks,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[StockMaster] 완료: {len(stocks)}종목, {size_kb:.1f}KB → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
