"""
거시지표(Macro Indicators) 수집 스크립트

수집 항목:
  - NQ=F (나스닥100 선물) — yfinance
  - KOSPI200 선물 (근월물) — KIS 국내선물
  - MU, SOXX, EWY, KORU — KIS 해외
  - ^VIX (변동성지수) — yfinance
  - Fear & Greed Index — CNN
  - USD, JPY, EUR, CNY 환율 — 다중 소스

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

import requests

from modules.kis_client import KISClient
from modules.exchange_rate import get_quick_exchange_rates
from modules.utils import KST

ROOT_DIR = Path(__file__).parent
OUTPUT_PATH = ROOT_DIR / "frontend" / "public" / "data" / "macro-indicators.json"
HISTORY_PATH = ROOT_DIR / "frontend" / "public" / "data" / "indicator-history.json"

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


def collect_vix() -> dict | None:
    """yfinance로 VIX 현재가/등락 수집."""
    try:
        import yfinance as yf

        ticker = yf.Ticker("^VIX")
        info = ticker.fast_info
        price = info.last_price
        prev = info.previous_close
        if price is None or prev is None:
            return None
        change = round(price - prev, 2)
        change_pct = round(change / prev * 100, 2) if prev else 0
        return {
            "symbol": "^VIX",
            "name": "VIX",
            "price": round(price, 2),
            "change": change,
            "change_pct": change_pct,
            "source": "yfinance",
        }
    except Exception as e:
        print(f"  [오류] VIX: {e}")
        return None


def collect_fear_greed() -> dict | None:
    """CNN Fear & Greed Index 수집."""
    try:
        url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "*/*",
        }
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
        fg = resp.json().get("fear_and_greed", {})
        score = fg.get("score")
        rating = fg.get("rating", "")
        prev = fg.get("previous_close")
        if score is None:
            return None
        change = round(score - prev, 2) if prev else 0
        change_pct = round(change / prev * 100, 2) if prev and prev != 0 else 0
        return {
            "symbol": "FNG",
            "name": f"F&G ({rating})",
            "price": round(score, 1),
            "change": change,
            "change_pct": change_pct,
            "source": "cnn",
        }
    except Exception as e:
        print(f"  [오류] Fear & Greed: {e}")
        return None


def get_kospi200_futures_code() -> str:
    """현재 근월물 종목코드 계산 (분기월: 3,6,9,12)"""
    now = datetime.now(KST)
    month_codes = {3: "H", 6: "M", 9: "U", 12: "Z"}
    quarter_months = [3, 6, 9, 12]
    year_2d = now.strftime("%y")
    for qm in quarter_months:
        if now.month <= qm:
            return f"101{month_codes[qm]}{year_2d}"
    # 12월 지나면 다음해 3월물
    return f"101H{int(year_2d) + 1:02d}"


def collect_kospi200_futures(client: KISClient) -> dict | None:
    """KIS 국내선물 API로 KOSPI200 선물 현재가 수집.

    1순위: 호가 API (장중 실시간)
    2순위: 현재가 API output3 (장외 시 KOSPI200 지수)
    """
    code = get_kospi200_futures_code()
    try:
        # 1순위: 호가 API (장중)
        path = "/uapi/domestic-futureoption/v1/quotations/inquire-asking-price"
        tr_id = "FHMIF10010000"
        params = {"FID_COND_MRKT_DIV_CODE": "F", "FID_INPUT_ISCD": code}
        resp = client.request("GET", path, tr_id, params=params)
        if resp.get("rt_cd") == "0":
            out = resp.get("output1", {})
            price = float(out.get("futs_prpr", 0))
            if price > 0:
                change = float(out.get("futs_prdy_vrss", 0))
                prev = price - change
                change_pct = round(change / prev * 100, 2) if prev else 0
                return {
                    "symbol": "KOSPI200F",
                    "name": f"코스피200 F {code}",
                    "price": price,
                    "change": change,
                    "change_pct": change_pct,
                    "source": "kis_futures",
                }
    except Exception as e:
        print(f"  [참고] 호가 API 실패, fallback 시도: {e}")

    try:
        # 2순위: 현재가 API output3 (KOSPI200 지수)
        path = "/uapi/domestic-futureoption/v1/quotations/inquire-price"
        tr_id = "FHMIF10000000"
        params = {"FID_COND_MRKT_DIV_CODE": "F", "FID_INPUT_ISCD": code}
        resp = client.request("GET", path, tr_id, params=params)
        if resp.get("rt_cd") == "0":
            out3 = resp.get("output3", {})
            price = float(out3.get("bstp_nmix_prpr", 0))
            if price > 0:
                change = float(out3.get("bstp_nmix_prdy_vrss", 0))
                change_pct = float(out3.get("bstp_nmix_prdy_ctrt", 0))
                return {
                    "symbol": "KOSPI200F",
                    "name": "코스피200 (지수)",
                    "price": price,
                    "change": change,
                    "change_pct": change_pct,
                    "source": "kis_futures",
                }
    except Exception as e:
        print(f"  [오류] KOSPI200F: {e}")

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

    # 3. KOSPI200 선물
    print("  KOSPI200 선물...")
    futures = collect_kospi200_futures(client)
    if futures:
        indicators.append(futures)
        print(f"    → {futures['price']} ({futures['change']:+.2f}, {futures['change_pct']:+.2f}%)")

    # 4. 해외 종목
    for code, exchange, name in OVERSEAS_ITEMS:
        print(f"  {code} ({name})...")
        item = collect_overseas(client, code, exchange, name)
        if item:
            indicators.append(item)
            print(f"    → {item['price']} ({item['change']:+.2f}, {item['change_pct']:+.2f}%)")
        time.sleep(0.3)

    # 5. VIX (yfinance)
    print("  ^VIX (변동성지수)...")
    vix = collect_vix()
    if vix:
        indicators.append(vix)
        print(f"    → {vix['price']} ({vix['change']:+.2f}, {vix['change_pct']:+.2f}%)")

    # 6. Fear & Greed (CNN)
    print("  Fear & Greed Index...")
    fng = collect_fear_greed()
    if fng:
        indicators.append(fng)
        print(f"    → {fng['price']} ({fng['name']})")

    # 7. 환율 (다중 소스)
    print("  환율 수집...")
    exchange = get_quick_exchange_rates()
    if exchange:
        print(f"    → 소스: {exchange['source']}, {len(exchange['rates'])}개 통화")
    else:
        print("    → 환율 수집 실패")

    print(f"  수집 완료: {len(indicators)}/8")

    output = {
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "indicators": indicators,
        "exchange": exchange,
    }

    if test_mode:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        print("  [테스트] 파일 저장하지 않음")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
        print(f"  저장: {OUTPUT_PATH}")
        update_indicator_history(indicators)


def update_indicator_history(indicators: list[dict]):
    """indicator-history.json에 오늘의 스냅샷을 추가 (30일 롤링)."""
    today = datetime.now(KST).strftime("%Y-%m-%d")

    # 기존 히스토리 로드
    history: dict = {"updated_at": "", "macro": {}, "exchange": {}}
    if HISTORY_PATH.exists():
        try:
            with open(HISTORY_PATH, encoding="utf-8") as f:
                history = json.load(f)
        except (json.JSONDecodeError, KeyError):
            pass

    # macro: 수집된 지표 저장
    macro = history.setdefault("macro", {})
    for item in indicators:
        sym = item["symbol"]
        entries = macro.setdefault(sym, [])
        # 같은 날짜 덮어쓰기
        entries = [e for e in entries if e["date"] != today]
        entries.append({"date": today, "price": item["price"], "change_pct": item["change_pct"]})
        entries.sort(key=lambda e: e["date"])
        macro[sym] = entries[-30:]

    # exchange: latest.json에서 환율 로드
    latest_path = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"
    if latest_path.exists():
        try:
            with open(latest_path, encoding="utf-8") as f:
                latest = json.load(f)
            rates = latest.get("exchange", {}).get("rates", [])
            ex = history.setdefault("exchange", {})
            for r in rates:
                cur = r["currency"]
                entries = ex.setdefault(cur, [])
                entries = [e for e in entries if e["date"] != today]
                entries.append({
                    "date": today,
                    "rate": r["rate"],
                    "change": r.get("change"),
                    "change_rate": r.get("change_rate"),
                })
                entries.sort(key=lambda e: e["date"])
                ex[cur] = entries[-30:]
        except (json.JSONDecodeError, KeyError):
            pass

    history["updated_at"] = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")

    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False)
    print(f"  히스토리 저장: {HISTORY_PATH}")


if __name__ == "__main__":
    main()
