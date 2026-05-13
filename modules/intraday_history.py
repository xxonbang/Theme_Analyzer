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

    # 분봉별 거래대금 산정: acml_tr_pbmn(누적 거래대금) 차분
    # 첫 분봉은 acml 자체가 그 분봉의 거래대금 (09:00 이전 0부터의 누적)
    prev_acml = 0
    for c in sorted_candles:
        cur_acml = c.get("acml_tr_pbmn", 0)
        c["trading_value"] = max(0, cur_acml - prev_acml) if prev_acml > 0 else cur_acml
        prev_acml = cur_acml

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

    # 15:30 동시호가 포함 (close 값은 collect_intraday_history.py에서 종가로 보정)
    boundaries.append("153000")

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
        trading_value = sum(c.get("trading_value", 0) for c in group)
        change_rate = round((close - base_price) / base_price * 100, 2) if base_price else 0

        results.append({
            "time": f"{boundary[:2]}:{boundary[2:4]}",
            "close": close,
            "high": high,
            "low": low,
            "change_rate": change_rate,
            "volume": volume,
            "trading_value": trading_value,
        })

        prev_boundary = boundary

    return results


def collect_stock_intraday_from_cache(
    client: KISClient,
    code: str,
    candles: List[Dict[str, Any]],
) -> Dict[str, Any] | None:
    """캐시된 분봉 데이터로 장중 데이터 생성 (fetch_minute_candles 호출 생략)."""
    if not candles:
        return None

    sorted_candles = sorted(candles, key=lambda c: c["time"])
    open_price = sorted_candles[0]["close"] if sorted_candles else 0

    prev_close = 0
    close_price = 0
    try:
        daily = client.get_stock_daily_ohlcv(code)
        if daily.get("rt_cd") == "0":
            output = daily.get("output", [])
            if output:
                today_data = output[0]
                close_price = int(today_data.get("stck_clpr", 0))
                prdy_vrss = int(today_data.get("prdy_vrss", 0))
                if close_price and prdy_vrss != 0:
                    prev_close = close_price - prdy_vrss
                elif len(output) >= 2:
                    prev_close = int(output[1].get("stck_clpr", 0))
    except Exception as e:
        print(f"  ⚠ {code} 전일종가/확정종가 조회 실패 (시가 기준 등락률로 대체): {e}")

    intervals_30m = aggregate_minute_candles(candles, 30, prev_close=prev_close)
    intervals_60m = aggregate_minute_candles(candles, 60, prev_close=prev_close)

    if not intervals_30m:
        return None

    if close_price and prev_close:
        for intervals in (intervals_30m, intervals_60m):
            if intervals and intervals[-1]["time"] == "15:30":
                intervals[-1]["close"] = close_price
                intervals[-1]["change_rate"] = round(
                    (close_price - prev_close) / prev_close * 100, 2
                )
                # 동시호가(15:20~15:30) 단일가매매 시간대의 stck_lwpr/stck_hgpr/acml_tr_pbmn은
                # 호가창 노이즈를 포함(특히 상한가 부근에서 stck_lwpr가 전일종가 근처 비정상값,
                # acml_tr_pbmn은 정상의 10배 이상 폭증 케이스 다수). close × volume로 통일.
                intervals[-1]["high"] = close_price
                intervals[-1]["low"] = close_price
                intervals[-1]["trading_value"] = close_price * intervals[-1].get("volume", 0)

    from datetime import datetime
    from modules.utils import KST
    today = datetime.now(KST).strftime("%Y-%m-%d")

    return {
        "date": today,
        "open": open_price,
        "prev_close": prev_close,
        "intervals_30m": intervals_30m,
        "intervals_60m": intervals_60m,
    }


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

    # 전일 종가 + 당일 확정 종가 조회 (inquire-daily-price)
    prev_close = 0
    close_price = 0
    try:
        daily = client.get_stock_daily_ohlcv(code)
        if daily.get("rt_cd") == "0":
            output = daily.get("output", [])
            if output:
                today_data = output[0]
                close_price = int(today_data.get("stck_clpr", 0))
                prdy_vrss = int(today_data.get("prdy_vrss", 0))
                if close_price and prdy_vrss != 0:
                    prev_close = close_price - prdy_vrss
                elif len(output) >= 2:
                    prev_close = int(output[1].get("stck_clpr", 0))
    except Exception as e:
        print(f"  ⚠ {code} 전일종가/확정종가 조회 실패 (시가 기준 등락률로 대체): {e}")

    intervals_30m = aggregate_minute_candles(candles, 30, prev_close=prev_close)
    intervals_60m = aggregate_minute_candles(candles, 60, prev_close=prev_close)

    if not intervals_30m:
        return None

    # 15:30 캔들의 close를 확정 종가로 보정
    if close_price and prev_close:
        for intervals in (intervals_30m, intervals_60m):
            if intervals and intervals[-1]["time"] == "15:30":
                intervals[-1]["close"] = close_price
                intervals[-1]["change_rate"] = round(
                    (close_price - prev_close) / prev_close * 100, 2
                )
                # 동시호가(15:20~15:30) 단일가매매 시간대의 stck_lwpr/stck_hgpr/acml_tr_pbmn은
                # 호가창 노이즈를 포함(특히 상한가 부근에서 stck_lwpr가 전일종가 근처 비정상값,
                # acml_tr_pbmn은 정상의 10배 이상 폭증 케이스 다수). close × volume로 통일.
                intervals[-1]["high"] = close_price
                intervals[-1]["low"] = close_price
                intervals[-1]["trading_value"] = close_price * intervals[-1].get("volume", 0)

    from datetime import datetime
    from modules.utils import KST
    today = datetime.now(KST).strftime("%Y-%m-%d")

    return {
        "date": today,
        "open": open_price,
        "prev_close": prev_close,
        "intervals_30m": intervals_30m,
        "intervals_60m": intervals_60m,
    }
