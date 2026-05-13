"""
매물대(Volume Profile) 계산 모듈

가격대별 거래량 분포를 계산하여 지지/저항 구간 및 POC를 도출합니다.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from modules.utils import KST
from typing import Any, Dict, List, Optional

from modules.kis_client import KISClient

logger = logging.getLogger(__name__)


def calc_volume_profile(
    candles: List[Dict[str, Any]],
    num_bins: int = 20,
) -> Optional[Dict[str, Any]]:
    """캔들 데이터에서 매물대(가격대별 거래량) 계산.

    Args:
        candles: [{"high": int, "low": int, "close": int, "volume": int}, ...]
        num_bins: 가격대 구간 수

    Returns:
        {
            "price_low": int, "price_high": int, "bin_size": int,
            "bins": [{"price": int, "volume": int}, ...],
            "poc_price": int, "poc_volume": int,
            "candle_count": int,
        }
        or None if insufficient data.
    """
    if not candles:
        return None

    # 전체 가격 범위
    all_highs = [c["high"] for c in candles if c["high"] > 0]
    all_lows = [c["low"] for c in candles if c["low"] > 0]
    if not all_highs or not all_lows:
        return None

    price_low = min(all_lows)
    price_high = max(all_highs)
    if price_high <= price_low:
        return None

    bin_size = max((price_high - price_low) // num_bins, 1)
    # bin 가격 = 각 구간의 중앙값
    bins: Dict[int, int] = {}
    for i in range(num_bins):
        mid = price_low + bin_size * i + bin_size // 2
        bins[mid] = 0

    # 각 캔들의 거래량을 해당 가격대에 분배
    for c in candles:
        vol = c.get("volume", 0)
        if vol <= 0:
            continue
        h = c["high"]
        lo = c["low"]
        # 캔들이 걸치는 bin들에 균등 분배
        touched = []
        for mid_price in bins:
            bin_low = mid_price - bin_size // 2
            bin_high = mid_price + bin_size // 2
            if lo <= bin_high and h >= bin_low:
                touched.append(mid_price)
        if touched:
            share = vol // len(touched)
            for mid_price in touched:
                bins[mid_price] += share

    # POC (Point of Control) = 거래량 최대 가격대
    poc_price = max(bins, key=bins.get)
    poc_volume = bins[poc_price]

    sorted_bins = [{"price": p, "volume": v} for p, v in sorted(bins.items())]

    return {
        "price_low": price_low,
        "price_high": price_high,
        "bin_size": bin_size,
        "bins": sorted_bins,
        "poc_price": poc_price,
        "poc_volume": poc_volume,
        "candle_count": len(candles),
    }


def fetch_daily_candles(
    client: KISClient,
    code: str,
    start_date: str,
    end_date: str,
) -> List[Dict[str, Any]]:
    """일봉 데이터 수집 (100건/회 페이지네이션).

    Returns:
        [{"date": "20260101", "high": int, "low": int, "close": int, "volume": int}, ...]
    """
    candles = []
    cur_end = end_date

    for _ in range(5):  # 최대 5회 (≈500일)
        result = client.get_stock_daily_price(
            code, start_date=start_date, end_date=cur_end
        )
        if result.get("rt_cd") != "0":
            break

        output2 = result.get("output2", [])
        if not output2:
            break

        for item in output2:
            candles.append({
                "date": item.get("stck_bsop_date", ""),
                "high": int(item.get("stck_hgpr", 0)),
                "low": int(item.get("stck_lwpr", 0)),
                "close": int(item.get("stck_clpr", 0)),
                "volume": int(item.get("acml_vol", 0)),
            })

        if len(output2) < 100:
            break

        # 다음 페이지: 마지막 날짜 - 1일
        oldest = output2[-1].get("stck_bsop_date", "")
        if not oldest or oldest <= start_date:
            break
        try:
            oldest_dt = datetime.strptime(oldest, "%Y%m%d")
            cur_end = (oldest_dt - timedelta(days=1)).strftime("%Y%m%d")
        except ValueError:
            break

        time.sleep(0.05)

    return candles


def fetch_minute_candles(
    client: KISClient,
    code: str,
) -> List[Dict[str, Any]]:
    """당일 분봉 데이터 수집 (30건/회 페이지네이션, 15:30→09:00 역순).

    collect_paper_trading.py의 분봉 탐색 패턴과 동일.

    Returns:
        [{"time": "153000", "high": int, "low": int, "close": int, "volume": int}, ...]
    """
    path = "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice"
    tr_id = "FHKST03010200"
    candles = []
    # 현재 시각 이후의 가짜 캔들 방지: 커서를 현재 KST 시각으로 설정 (최대 15:30, 동시호가 포함)
    now_hhmm = datetime.now(KST).strftime("%H%M00")
    cursor = min(now_hhmm, "153000")
    # KIS API가 미래 시간대 플레이스홀더 캔들을 반환하므로, 현재 시각 이후 캔들 제거용
    cutoff_time = cursor

    for _ in range(15):  # 최대 15회 (09:00까지)
        params = {
            "FID_ETC_CLS_CODE": "",
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": code,
            "FID_INPUT_HOUR_1": cursor,
            "FID_PW_DATA_INCU_YN": "Y",
        }

        result = client.request("GET", path, tr_id, params=params)
        if result.get("rt_cd") != "0":
            break

        output2 = result.get("output2", [])
        if not output2:
            break

        for item in output2:
            t = item.get("stck_cntg_hour", "")
            if not t or t > cutoff_time:
                continue
            candles.append({
                "time": t,
                "high": int(item.get("stck_hgpr", 0)),
                "low": int(item.get("stck_lwpr", 0)),
                "close": int(item.get("stck_prpr", 0)),
                "volume": int(item.get("cntg_vol", 0)),
                "acml_tr_pbmn": int(item.get("acml_tr_pbmn", 0)),
            })

        last_time = output2[-1].get("stck_cntg_hour", "")
        if not last_time or last_time <= "090000":
            break
        cursor = last_time

        time.sleep(0.05)

    return candles


def _filter_candles_by_date(
    candles: List[Dict[str, Any]],
    start_date: str,
) -> List[Dict[str, Any]]:
    """start_date 이후 캔들만 필터링."""
    return [c for c in candles if c.get("date", "") >= start_date]


def collect_full(
    client: KISClient,
    code: str,
    intraday_days: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    """전 기간(1y/6m/3m/1m/1w) 일봉 + 당일 분봉 → 6기간 매물대 계산.

    1년치 일봉을 1회 수집 후 기간별 필터링.
    1w/1m 기간은 intraday_days(30분봉)가 있으면 우선 사용하여 정밀도 향상.
    """
    now = datetime.now(KST)
    end_date = now.strftime("%Y%m%d")
    start_1y = (now - timedelta(days=365)).strftime("%Y%m%d")

    # 일봉 1회 수집
    daily = fetch_daily_candles(client, code, start_1y, end_date)

    # intraday 30분봉을 캔들 형태로 변환
    intraday_candles: List[Dict[str, Any]] = []
    if intraday_days:
        for day in intraday_days:
            for iv in day.get("intervals_30m", []):
                if iv.get("volume", 0) > 0 and iv.get("high", 0) > 0:
                    intraday_candles.append({
                        "date": day["date"].replace("-", ""),
                        "high": iv["high"],
                        "low": iv["low"],
                        "close": iv["close"],
                        "volume": iv["volume"],
                    })

    # 기간별 필터
    periods = {
        "1y": start_1y,
        "6m": (now - timedelta(days=182)).strftime("%Y%m%d"),
        "3m": (now - timedelta(days=91)).strftime("%Y%m%d"),
        "1m": (now - timedelta(days=30)).strftime("%Y%m%d"),
        "1w": (now - timedelta(days=10)).strftime("%Y%m%d"),
    }

    result = {}
    for period, start in periods.items():
        # 1w/1m: 30분봉 데이터가 충분하면 우선 사용
        if period in ("1w", "1m") and intraday_candles:
            intraday_filtered = [c for c in intraday_candles if c["date"] >= start]
            if len(intraday_filtered) >= 10:  # 최소 10봉 이상이면 사용
                vp = calc_volume_profile(intraday_filtered)
                if vp:
                    result[period] = vp
                    continue
        # fallback: 일봉
        filtered = _filter_candles_by_date(daily, start)
        vp = calc_volume_profile(filtered)
        if vp:
            result[period] = vp

    # 당일 분봉
    minute = fetch_minute_candles(client, code)
    if minute:
        vp = calc_volume_profile(minute)
        if vp:
            result["today"] = vp

    return result


def collect_intraday(
    client: KISClient,
    code: str,
) -> Dict[str, Any]:
    """장중 모드: 당일 분봉만 수집 → {"today": {...}}."""
    minute = fetch_minute_candles(client, code)
    if not minute:
        return {}
    vp = calc_volume_profile(minute)
    if not vp:
        return {}
    return {"today": vp}
