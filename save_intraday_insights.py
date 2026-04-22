"""
장중 시장 동향 스냅샷 저장
- 매일 장 마감(15:40) 시 collect-paper-trading 워크플로우에서 실행
- 테마 모멘텀, 급변 TOP5, 수급 신호를 날짜별로 저장

사용법:
  python save_intraday_insights.py          # 저장
  python save_intraday_insights.py --test   # 콘솔 출력만
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from modules.utils import KST

ROOT_DIR = Path(__file__).parent
LATEST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"
INTRADAY_HISTORY_PATH = ROOT_DIR / "frontend" / "public" / "data" / "intraday-history.json"
INVESTOR_INTRADAY_PATH = ROOT_DIR / "frontend" / "public" / "data" / "investor-intraday.json"
OUTPUT_PATH = ROOT_DIR / "frontend" / "public" / "data" / "intraday-insights-history.json"

MAX_DAYS = 30  # 최대 30일 보관


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_snapshot() -> dict | None:
    """현재 데이터에서 장중 동향 스냅샷 생성."""
    latest = load_json(LATEST_PATH)
    ih = load_json(INTRADAY_HISTORY_PATH)
    ii = load_json(INVESTOR_INTRADAY_PATH)

    today = datetime.now(KST).strftime("%Y-%m-%d")

    # 1. 테마 모멘텀
    themes = latest.get("theme_analysis", {}).get("themes", [])
    stocks_ih = ih.get("stocks", {})
    theme_momentum = []
    for theme in themes:
        rates = []
        stock_details = []
        for stock in theme.get("leader_stocks", []):
            code = stock.get("code", "")
            days = stocks_ih.get(code, [])
            day = next((d for d in days if d["date"] == today), None)
            if not day or not day.get("intervals_30m"):
                continue
            latest_iv = day["intervals_30m"][-1]
            rate = latest_iv.get("change_rate", 0)
            rates.append(rate)
            stock_details.append({"code": code, "name": stock.get("name", ""), "rate": rate})
        if rates:
            avg = round(sum(rates) / len(rates), 2)
            theme_momentum.append({"name": theme.get("theme_name", ""), "avg_rate": avg, "stocks": stock_details})

    # 2. 급변 TOP5
    movers = []
    for code, days in stocks_ih.items():
        day = next((d for d in days if d["date"] == today), None)
        if not day or not day.get("intervals_30m") or len(day["intervals_30m"]) < 2:
            continue
        intervals = day["intervals_30m"]
        latest_iv = intervals[-1]
        prev_iv = intervals[-2]
        delta = latest_iv["change_rate"] - prev_iv["change_rate"]
        name = ""
        # latest.json에서 이름 찾기
        for section in ["rising", "falling", "volume", "trading_value"]:
            for mkt in ["kospi", "kosdaq"]:
                for s in latest.get(section, {}).get(mkt, []):
                    if s.get("code") == code:
                        name = s.get("name", "")
                        break
                if name:
                    break
            if name:
                break
        if not name:
            continue
        movers.append({"code": code, "name": name, "rate": latest_iv["change_rate"], "delta": round(delta, 2)})
    movers.sort(key=lambda x: x["delta"], reverse=True)
    gainers = movers[:5]
    losers = movers[-5:][::-1]

    # 3. 수급 신호
    signals = []
    snapshots = ii.get("snapshots", [])
    if snapshots and ii.get("date") == today:
        last_snap = snapshots[-1]
        for code, entry in last_snap.get("data", {}).items():
            f = entry.get("f", 0)
            i_val = entry.get("i", 0)
            pg = entry.get("pg", 0)
            rate = entry.get("cr")
            if rate is None:
                days = stocks_ih.get(code, [])
                day = next((d for d in days if d["date"] == today), None)
                if day and day.get("intervals_30m"):
                    rate = day["intervals_30m"][-1].get("change_rate")
            if rate is None:
                continue

            name = ""
            for section in ["rising", "falling", "volume", "trading_value"]:
                for mkt in ["kospi", "kosdaq"]:
                    for s in latest.get(section, {}).get(mkt, []):
                        if s.get("code") == code:
                            name = s.get("name", "")
                            break
                    if name:
                        break
                if name:
                    break
            if not name:
                continue

            label = None
            if f > 300000 and rate < 0:
                label = "외국인 대량 저가 매집" if f >= 500000 and rate <= -5 else "외국인 저가 매집"
            elif f < -300000 and rate > 0:
                label = "외국인 차익 실현"
            elif i_val > 200000 and rate < -1:
                label = "기관 저가 매집"
            if label:
                signals.append({"code": code, "name": name, "label": label, "rate": round(rate, 2), "f": f, "i": i_val, "pg": pg})

    signals.sort(key=lambda x: max(abs(x["f"]), abs(x["i"])), reverse=True)

    if not theme_momentum and not gainers and not signals:
        return None

    return {
        "date": today,
        "updated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M"),
        "theme_momentum": theme_momentum,
        "movers": {"gainers": gainers, "losers": losers},
        "signals": signals[:15],
    }


def main():
    test_mode = "--test" in sys.argv
    snapshot = build_snapshot()

    if not snapshot:
        print("[장중 동향] 스냅샷 데이터 없음")
        return

    print(f"[장중 동향] {snapshot['date']} 스냅샷")
    print(f"  테마: {len(snapshot['theme_momentum'])}개")
    print(f"  급등: {len(snapshot['movers']['gainers'])}개, 급락: {len(snapshot['movers']['losers'])}개")
    print(f"  신호: {len(snapshot['signals'])}개")

    if test_mode:
        print(json.dumps(snapshot, ensure_ascii=False, indent=2)[:2000])
        return

    # 기존 히스토리 로드
    history = load_json(OUTPUT_PATH)
    if not isinstance(history, dict) or "snapshots" not in history:
        history = {"snapshots": []}

    # 같은 날짜 덮어쓰기
    history["snapshots"] = [s for s in history["snapshots"] if s.get("date") != snapshot["date"]]
    history["snapshots"].append(snapshot)

    # 최대 보관일수
    history["snapshots"] = sorted(history["snapshots"], key=lambda s: s["date"])[-MAX_DAYS:]
    history["updated_at"] = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False)
    print(f"  저장: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
