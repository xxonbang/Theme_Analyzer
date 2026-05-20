"""ad-hoc: stock-history.json 전체 UN 우선 + J 폴백 backfill (2026-05-20).

사용자 의도(KRX+NXT 전체 시장 데이터 반영)로 전환 후 즉시 갱신.
NXT 미상장 종목은 자동으로 J 폴백되어 stale 없이 채워짐.
"""
import sys
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from modules.kis_client import KISClient
from modules.stock_history import StockHistoryAPI

HISTORY = ROOT / "frontend" / "public" / "data" / "stock-history.json"


def main():
    existing = json.loads(HISTORY.read_text())
    codes = sorted(existing.keys())
    targets = []
    for c in codes:
        v = existing.get(c)
        name = v.get("name") if isinstance(v, dict) else None
        targets.append({"code": c, "name": name})
    print(f"[backfill] {len(targets)} 종목 UN 우선 + J 폴백 호출")

    client = KISClient()
    api = StockHistoryAPI(client)
    result = api.get_multiple_stocks_history(targets, days=60)
    print(f"[backfill] {len(result)} 종목 응답 수신")

    updated = 0
    for code, r in result.items():
        if not r.get("changes"):
            continue
        # 기존 entry 보존하며 갱신
        if code in existing and isinstance(existing[code], dict):
            existing[code]["changes"] = r["changes"]
            existing[code]["total_change_rate"] = r.get("total_change_rate", 0)
            if "raw_daily_prices" in r:
                existing[code]["raw_daily_prices"] = r["raw_daily_prices"]
        else:
            existing[code] = r
        updated += 1
    print(f"[backfill] {updated} 종목 갱신")

    HISTORY.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[saved] {HISTORY}")


if __name__ == "__main__":
    main()
