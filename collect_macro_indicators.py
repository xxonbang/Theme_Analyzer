"""
거시지표(Macro Indicators) 수집 스크립트

수집 항목:
  - NQ=F (나스닥100 선물) — yfinance
  - KOSPI200 지수 — yfinance (^KS200)
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


GLOBAL_INDICES = [
    ("^DJI", "다우존스"),
    ("^GSPC", "S&P500"),
    ("^IXIC", "나스닥종합"),
    ("^STOXX50E", "유로스톡스50"),
    ("000001.SS", "상하이종합"),
    ("^N225", "니케이225"),
]


def collect_global_indices() -> list[dict]:
    """yfinance로 글로벌 주요 지수 수집."""
    results = []
    try:
        import yfinance as yf
        for symbol, name in GLOBAL_INDICES:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                price = info.last_price
                prev = info.previous_close
                if price is None or prev is None:
                    continue
                change = round(price - prev, 2)
                change_pct = round(change / prev * 100, 2) if prev else 0
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "price": round(price, 2),
                    "change": change,
                    "change_pct": change_pct,
                    "source": "yfinance",
                    "category": "global_index",
                })
            except Exception as e:
                print(f"    [오류] {name}({symbol}): {e}")
    except ImportError:
        print("    [오류] yfinance 미설치")
    return results


def collect_kospi200_index() -> dict | None:
    """yfinance로 KOSPI200 지수 현재가/등락 수집."""
    try:
        import yfinance as yf

        ticker = yf.Ticker("^KS200")
        info = ticker.fast_info
        price = info.last_price
        prev = info.previous_close
        if price is None or prev is None:
            return None
        change = round(price - prev, 2)
        change_pct = round(change / prev * 100, 2) if prev else 0
        return {
            "symbol": "KOSPI200",
            "name": "코스피200",
            "price": round(price, 2),
            "change": change,
            "change_pct": change_pct,
            "source": "yfinance",
        }
    except Exception as e:
        print(f"  [오류] KOSPI200: {e}")
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


ESIGNAL_ITEMS = [
    {"file": "sparkline_day", "key": "day", "name": "코스피200 주간선물", "symbol": "K200F_DAY"},
    {"file": "sparkline_ngt", "key": "ngt", "name": "코스피200 야간선물", "symbol": "K200F_NGT"},
    {"file": "sparkline_spx", "key": "spx", "name": "S&P500 선물", "symbol": "SPX_F"},
    # 나스닥 선물은 yfinance(NQ=F)에서 수집 — 중복 제거
    # {"file": "sparkline_nasdaq", "key": "nasdaq", "name": "나스닥 선물", "symbol": "NQ_F"},
    {"file": "sparkline_oil", "key": "oil", "name": "원유 선물", "symbol": "OIL_F"},
    {"file": "sparkline_gold", "key": "gold", "name": "금 선물", "symbol": "GOLD_F"},
]

ESIGNAL_HEADERS = {
    "Referer": "https://esignal.co.kr/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}


def collect_esignal_futures() -> list[dict]:
    """esignal.co.kr에서 주요 선물 데이터 수집."""
    import re

    results = []
    for item in ESIGNAL_ITEMS:
        try:
            url = f"https://esignal.co.kr/data/{item['file']}.js"
            resp = requests.get(url, headers=ESIGNAL_HEADERS, timeout=10)
            if resp.status_code != 200:
                print(f"    [오류] {item['name']}: HTTP {resp.status_code}")
                continue

            text = resp.text

            # sl_close_xxx = '809.25 (-16.55)' 파싱
            close_match = re.search(
                rf"sl_close_{item['key']}\s*=\s*'([^']+)'", text
            )
            if not close_match:
                continue

            close_str = close_match.group(1)  # e.g. "809.25 (-16.55)"
            # 콤마 제거 후 파싱
            clean = close_str.replace(",", "")
            price_match = re.match(r"([\d.]+)\s*\(([+-]?[\d.]+)\)", clean)
            if not price_match:
                continue

            price = float(price_match.group(1))
            change = float(price_match.group(2))
            prev = price - change
            change_pct = round(change / prev * 100, 2) if prev else 0

            # 상승/하락 상태
            bg_match = re.search(rf"sl_bg_{item['key']}\s*=\s*'([^']+)'", text)
            status = ""
            if bg_match:
                bg = bg_match.group(1)
                status = "up" if bg == "bk-bg-danger" else ("down" if bg == "bk-bg-primary" else "flat")

            results.append({
                "symbol": item["symbol"],
                "name": item["name"],
                "price": price,
                "change": change,
                "change_pct": change_pct,
                "status": status,
                "source": "esignal",
            })
        except Exception as e:
            print(f"    [오류] {item['name']}: {e}")

    return results


def collect_market_investor_trend(client: KISClient, days: int = 20) -> list[dict] | None:
    """코스피/코스닥 시장 전체 투자자별 순매수 일별 데이터 수집.

    Returns:
        [{"date": "2026-03-13", "kospi": {...}, "kosdaq": {...}}, ...]
        각 시장: {index, change_pct, foreign, individual, institution} (금액 백만원)
    """
    markets = {
        "kospi": {"iscd": "0001", "iscd1": "KSP", "iscd2": "0001"},
        "kosdaq": {"iscd": "1001", "iscd1": "KSQ", "iscd2": "1001"},
    }

    all_data: dict[str, dict] = {}  # date -> {kospi: ..., kosdaq: ...}

    for market_name, params in markets.items():
        try:
            resp = client.request(
                "GET",
                "/uapi/domestic-stock/v1/quotations/inquire-investor-daily-by-market",
                "FHPTJ04040000",
                params={
                    "FID_COND_MRKT_DIV_CODE": "U",
                    "FID_INPUT_ISCD": params["iscd"],
                    "FID_INPUT_DATE_1": datetime.now(KST).strftime("%Y%m%d"),
                    "FID_INPUT_ISCD_1": params["iscd1"],
                    "FID_INPUT_DATE_2": datetime.now(KST).strftime("%Y%m%d"),
                    "FID_INPUT_ISCD_2": params["iscd2"],
                },
            )
            if resp.get("rt_cd") != "0":
                print(f"  [오류] {market_name} 수급: {resp.get('msg1', '')}")
                continue

            for item in resp.get("output", [])[:days]:
                date_raw = item.get("stck_bsop_date", "")
                if not date_raw:
                    continue
                date_str = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
                entry = all_data.setdefault(date_str, {})
                entry[market_name] = {
                    "index": float(item.get("bstp_nmix_prpr", 0)),
                    "change_pct": float(item.get("bstp_nmix_prdy_ctrt", 0)),
                    "foreign": int(item.get("frgn_ntby_tr_pbmn", 0)),
                    "individual": int(item.get("prsn_ntby_tr_pbmn", 0)),
                    "institution": int(item.get("orgn_ntby_tr_pbmn", 0)),
                }
            time.sleep(0.3)
        except Exception as e:
            print(f"  [오류] {market_name} 수급: {e}")

    if not all_data:
        return None

    result = []
    for date_str in sorted(all_data.keys()):
        entry = all_data[date_str]
        if "kospi" in entry and "kosdaq" in entry:
            result.append({"date": date_str, **entry})

    return result if result else None


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

    # 3. KOSPI200 지수 (yfinance)
    print("  KOSPI200 지수...")
    k200 = collect_kospi200_index()
    if k200:
        indicators.append(k200)
        print(f"    → {k200['price']} ({k200['change']:+.2f}, {k200['change_pct']:+.2f}%)")

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

    # 7. 글로벌 지수 (yfinance)
    print("  글로벌 지수...")
    global_indices = collect_global_indices()
    if global_indices:
        indicators.extend(global_indices)
        for gi in global_indices:
            print(f"    → {gi['name']}: {gi['price']} ({gi['change']:+.2f}, {gi['change_pct']:+.2f}%)")
    else:
        print("    → 글로벌 지수 수집 실패")

    # 8. 환율 (다중 소스)
    print("  환율 수집...")
    exchange = get_quick_exchange_rates()
    if exchange:
        print(f"    → 소스: {exchange['source']}, {len(exchange['rates'])}개 통화")
    else:
        print("    → 환율 수집 실패")

    # 9. 주요 선물 (esignal.co.kr)
    print("  주요 선물 (esignal)...")
    esignal_futures = collect_esignal_futures()
    if esignal_futures:
        print(f"    → {len(esignal_futures)}개 종목 수집 완료")
        for f in esignal_futures:
            print(f"      {f['name']}: {f['price']} ({f['change']:+.2f}, {f['change_pct']:+.2f}%)")
    else:
        print("    → 선물 수집 실패")

    # 10. 시장별 투자자 수급 (KIS)
    print("  시장별 투자자 수급...")
    investor_trend = collect_market_investor_trend(client)
    if investor_trend:
        print(f"    → {len(investor_trend)}일분 수집 완료")
    else:
        print("    → 수급 수집 실패")

    print(f"  수집 완료: {len(indicators)}/8")

    output = {
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "indicators": indicators,
        "exchange": exchange,
        "investor_trend": investor_trend,
        "futures": esignal_futures if esignal_futures else None,
    }

    # 기존 데이터에서 수집 실패한 지표 보존
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, encoding="utf-8") as f:
                existing = json.load(f)
            new_symbols = {i["symbol"] for i in indicators}
            for old in existing.get("indicators", []):
                if old["symbol"] not in new_symbols:
                    indicators.append(old)
                    print(f"  [보존] {old['symbol']} (신규 수집 실패 → 기존값 유지)")
            output["indicators"] = indicators
        except Exception:
            pass

    if test_mode:
        print(json.dumps(output, ensure_ascii=False, indent=2))
        print("  [테스트] 파일 저장하지 않음")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
        print(f"  저장: {OUTPUT_PATH}")
        update_indicator_history(indicators, esignal_futures, investor_trend)


def update_indicator_history(indicators: list[dict], futures: list[dict] | None = None, investor_trend: list[dict] | None = None):
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

    # futures: 선물 히스토리 저장
    if futures:
        fut_hist = history.setdefault("futures", {})
        for item in futures:
            sym = item["symbol"]
            entries = fut_hist.setdefault(sym, [])
            entries = [e for e in entries if e["date"] != today]
            entries.append({"date": today, "price": item["price"], "change_pct": item["change_pct"]})
            entries.sort(key=lambda e: e["date"])
            fut_hist[sym] = entries[-30:]

    # investor_trend: 투자자 수급 히스토리 저장 (같은 날짜는 최신 데이터로 덮어쓰기)
    if investor_trend:
        inv_hist = history.setdefault("investor_trend", [])
        update_dates = {day["date"] for day in investor_trend}
        inv_hist = [e for e in inv_hist if e["date"] not in update_dates]
        inv_hist.extend(investor_trend)
        inv_hist.sort(key=lambda e: e["date"])
        history["investor_trend"] = inv_hist[-30:]

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
