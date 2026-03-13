"""
장중 등락률 히스토리 모듈

1분봉 데이터를 30분/1시간 단위로 집계하여
시간대별 등락률을 산출합니다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from modules.kis_client import KISClient
from modules.volume_profile import fetch_minute_candles

logger = logging.getLogger(__name__)


def aggregate_minute_candles(
    candles: List[Dict[str, Any]],
    interval_min: int = 30,
    **kwargs: Any,
) -> List[Dict[str, Any]]:
    """1분봉 리스트 -> interval_min 단위 집계.

    Args:
        candles: fetch_minute_candles() 반환값 (시간 역순, "153000" 형식)
        interval_min: 30 또는 60

    Returns:
        시간순 리스트:
        [{"time": "09:30", "close": 70500, "high": 71000, "low": 69800,
          "change_rate": 0.71, "volume": 500000}, ...]
    """
    if not candles:
        return []

    # 시간순 정렬 (오래된 것 먼저)
    sorted_candles = sorted(candles, key=lambda c: c["time"])

    # 구간 경계 생성 (09:00 ~ 15:00, 시간외 거래 제외)
    boundaries = []
    hour, minute = 9, 0
    while True:
        minute += interval_min
        if minute >= 60:
            hour += minute // 60
            minute = minute % 60
        if hour > 15 or (hour == 15 and minute > 0):
            break
        boundaries.append(f"{hour:02d}{minute:02d}00")

    # 15:00은 항상 포함 (정규장 마감)
    if not boundaries or boundaries[-1] != "150000":
        boundaries.append("150000")

    # base_price: 전일 종가 또는 시가 fallback
    base_price = kwargs.get("prev_close", 0) or (sorted_candles[0]["close"] if sorted_candles else 0)

    results = []
    prev_boundary = "090000"

    for boundary in boundaries:
        # 해당 구간의 캔들 필터 (prev_boundary < time <= boundary)
        group = [c for c in sorted_candles if prev_boundary < c["time"] <= boundary]
        if not group:
            prev_boundary = boundary
            continue

        close = group[-1]["close"]
        high = max(c["high"] for c in group)
        low = min(c["low"] for c in group)
        volume = sum(c["volume"] for c in group)
        change_rate = round((close - base_price) / base_price * 100, 2) if base_price else 0

        results.append({
            "time": f"{boundary[:2]}:{boundary[2:4]}",
            "close": close,
            "high": high,
            "low": low,
            "change_rate": change_rate,
            "volume": volume,
        })

        prev_boundary = boundary

    return results


def collect_stock_intraday(
    client: KISClient,
    code: str,
) -> Dict[str, Any] | None:
    """종목 1개의 당일 장중 데이터 수집.

    Returns:
        {"date": "2026-03-09", "open": 70000,
         "intervals_30m": [...], "intervals_60m": [...]}
        or None if no data.
    """
    candles = fetch_minute_candles(client, code)
    if not candles:
        return None

    # 시간순 정렬 후 첫 캔들 = 시가
    sorted_candles = sorted(candles, key=lambda c: c["time"])
    open_price = sorted_candles[0]["close"] if sorted_candles else 0

    # 전일 종가 조회 (등락률 기준)
    prev_close = 0
    try:
        price_data = client.get_stock_price(code)
        if price_data.get("rt_cd") == "0":
            output = price_data.get("output", {})
            current = int(output.get("stck_prpr", 0))
            change = int(output.get("prdy_vrss", 0))
            if current and change is not None:
                prev_close = current - change
    except Exception:
        pass

    intervals_30m = aggregate_minute_candles(candles, 30, prev_close=prev_close)
    intervals_60m = aggregate_minute_candles(candles, 60, prev_close=prev_close)

    if not intervals_30m:
        return None

    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")

    return {
        "date": today,
        "open": open_price,
        "prev_close": prev_close,
        "intervals_30m": intervals_30m,
        "intervals_60m": intervals_60m,
    }
