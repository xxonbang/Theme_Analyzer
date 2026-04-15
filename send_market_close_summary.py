"""
장 마감 후 시장 요약 텔레그램 전송
- 거래대금 상승/하락 TOP10 (KOSPI + KOSDAQ)
- 거래량 상승/하락 TOP10 (KOSPI + KOSDAQ)

사용법:
  python send_market_close_summary.py         # 전송
  python send_market_close_summary.py --test  # 콘솔 출력만
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from modules.telegram import TelegramSender
from modules.utils import KST

ROOT_DIR = Path(__file__).parent
LATEST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"

WEEKDAY_KOR = ["월", "화", "수", "목", "금", "토", "일"]


def load_latest() -> dict:
    if not LATEST_PATH.exists():
        print("[ERROR] latest.json이 없습니다.")
        sys.exit(1)
    with open(LATEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def split_by_direction(stocks: list[dict], up: bool, top_n: int = 10) -> list[dict]:
    """metric 순 정렬된 종목 리스트에서 상승/하락 필터링 후 TOP N 반환 (순위 부여).

    Args:
        stocks: trading_value 또는 volume 배열 (metric 순 정렬됨)
        up: True면 change_rate > 0, False면 < 0
        top_n: 반환할 개수
    """
    filtered = []
    for s in stocks:
        rate = s.get("change_rate", 0) or 0
        if up and rate > 0:
            filtered.append(s)
        elif not up and rate < 0:
            filtered.append(s)
        if len(filtered) >= top_n:
            break
    return filtered


def main():
    test_mode = "--test" in sys.argv

    data = load_latest()
    now = datetime.now(KST)
    date_str = f"{now.strftime('%Y-%m-%d')} ({WEEKDAY_KOR[now.weekday()]})"

    bot = TelegramSender()

    # 4개 메시지 구성: (title, metric_key, metric_label, up, section_data)
    configs = [
        ("📈 [장 마감] 거래대금 상승 TOP10", "trading_value", "거래대금", True, data.get("trading_value", {})),
        ("📉 [장 마감] 거래대금 하락 TOP10", "trading_value", "거래대금", False, data.get("trading_value", {})),
        ("📈 [장 마감] 거래량 상승 TOP10", "volume", "거래량", True, data.get("volume", {})),
        ("📉 [장 마감] 거래량 하락 TOP10", "volume", "거래량", False, data.get("volume", {})),
    ]

    for title, metric_key, metric_label, up, section in configs:
        kospi = split_by_direction(section.get("kospi", []), up)
        kosdaq = split_by_direction(section.get("kosdaq", []), up)

        message = bot.format_market_close_top(
            kospi=kospi,
            kosdaq=kosdaq,
            title=title,
            metric_key=metric_key,
            metric_label=metric_label,
            date_str=date_str,
        )

        if test_mode:
            print(message)
            print("\n" + "=" * 60 + "\n")
        else:
            ok = bot.send_message(message)
            print(f"  {'✓' if ok else '✗'} {title}")


if __name__ == "__main__":
    main()
