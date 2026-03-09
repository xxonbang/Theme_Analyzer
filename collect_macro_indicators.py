"""
거시지표(Macro Indicators) 수집 스크립트

수집 항목:
  - NQ=F (나스닥100 선물) — yfinance
  - KODEX200 (069500) — KIS 국내
  - MU, SOXX, EWY, KORU — KIS 해외

사용법:
  python collect_macro_indicators.py          # 수집 + 저장
  python collect_macro_indicators.py --test   # 콘솔 출력만
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path

from modules.kis_client import KISClient

ROOT_DIR = Path(__file__).parent
OUTPUT_PATH = ROOT_DIR / "frontend" / "public" / "data" / "macro-indicators.json"

# 해외 종목 목록: (symbol, exchange, name)
OVERSEAS_ITEMS = [
    ("MU", "NAS", "마이크론"),
    ("SOXX", "NAS", "SOXX"),
    ("EWY", "AMS", "EWY"),
    ("KORU", "AMS", "KORU"),
]


def collect_nq_futures() -> dict | None:
    """yfinance로 NQ=F 현재가/등락 수집."""
    try:
        import yfinance as yf

        ticker = yf.Ticker("NQ=F")
        info = ticker.fast_info
        price = info.last_price
        prev = info.previous_close
        if price is None or prev is None:
            return None
        change = round(price - prev, 2)
        change_pct = round(change / prev * 100, 2) if prev else 0
        return {
            "symbol": "NQ=F",
            "name": "나스닥100 선물",
            "price": round(price, 2),
            "change": change,
            "change_pct": change_pct,
            "source": "yfinance",
        }
    except Exception as e:
        print(f"  [오류] NQ=F: {e}")
        return None


def collect_domestic(client: KISClient, code: str, name: str) -> dict | None:
    """KIS 국내 현재가 API로 수집."""
    try:
        resp = client.get_stock_price(code)
        if resp.get("rt_cd") != "0":
            print(f"  [오류] {name}({code}): {resp.get('msg1', '')}")
            return None
        out = resp.get("output", {})
        price = int(out.get("stck_prpr", 0))
        change = int(out.get("prdy_vrss", 0))
        change_pct = float(out.get("prdy_ctrt", 0))
        return {
            "symbol": code,
            "name": name,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "source": "kis_domestic",
        }
    except Exception as e:
        print(f"  [오류] {name}({code}): {e}")
        return None


def collect_overseas(client: KISClient, code: str, exchange: str, name: str) -> dict | None:
    """KIS 해외주식 현재가 API (HHDFS00000300)."""
    try:
        path = "/uapi/overseas-price/v1/quotations/price"
        tr_id = "HHDFS00000300"
        params = {"AUTH": "", "EXCD": exchange, "SYMB": code}
        resp = client.request("GET", path, tr_id, params=params)
        if resp.get("rt_cd") != "0":
            print(f"  [오류] {name}({code}): {resp.get('msg1', '')}")
            return None
        out = resp.get("output", {})
        price = float(out.get("last", 0))
        change = float(out.get("diff", 0))
        change_pct = float(out.get("rate", 0))
        # KIS diff는 절대값일 수 있음 → rate 부호에 맞춤
        if change_pct < 0 and change > 0:
            change = -change
        elif change_pct > 0 and change < 0:
            change = -change
        return {
            "symbol": code,
            "name": name,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "source": "kis_overseas",
        }
    except Exception as e:
        print(f"  [오류] {name}({code}): {e}")
        return None


def main():
    test_mode = "--test" in sys.argv
    print("[거시지표 수집]")

    indicators = []

    # 1. NQ=F (yfinance)
    print("  NQ=F (나스닥100 선물)...")
    nq = collect_nq_futures()
    if nq:
        indicators.append(nq)
        print(f"    → {nq['price']} ({nq['change']:+.2f}, {nq['change_pct']:+.2f}%)")

    # 2. KIS 클라이언트
    client = KISClient()

    # 3. KODEX200 (국내)
    print("  069500 (KODEX200)...")
    kodex = collect_domestic(client, "069500", "KODEX200 선물")
    if kodex:
        indicators.append(kodex)
        print(f"    → {kodex['price']} ({kodex['change']:+}, {kodex['change_pct']:+.2f}%)")

    # 4. 해외 종목
    for code, exchange, name in OVERSEAS_ITEMS:
        print(f"  {code} ({name})...")
        item = collect_overseas(client, code, exchange, name)
        if item:
            indicators.append(item)
            print(f"    → {item['price']} ({item['change']:+.2f}, {item['change_pct']:+.2f}%)")
        time.sleep(0.3)

    print(f"  수집 완료: {len(indicators)}/6")

    output = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "indicators": indicators,
    }

    if test_mode:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        print("  [테스트] 파일 저장하지 않음")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
        print(f"  저장: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
