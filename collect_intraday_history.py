"""
장중 등락률 히스토리 수집 스크립트

사용법:
  python collect_intraday_history.py              # 전체 수집
  python collect_intraday_history.py --test       # 테스트 (3종목, 콘솔 출력만)
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

from modules.kis_client import KISClient
from modules.intraday_history import collect_stock_intraday

ROOT_DIR = Path(__file__).parent
LATEST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"
OUTPUT_PATH = ROOT_DIR / "frontend" / "public" / "data" / "intraday-history.json"

MAX_DAYS = 10  # 최대 보관 일수


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_all_codes(data: dict) -> list[dict]:
    """latest.json에서 모든 종목코드+이름 추출 (중복 제거)."""
    seen = {}
    sections = ["rising", "falling", "volume", "trading_value"]
    for section in sections:
        section_data = data.get(section, {})
        for market in ["kospi", "kosdaq"]:
            for stock in section_data.get(market, []):
                code = stock.get("code", "")
                if code and code not in seen:
                    seen[code] = stock.get("name", code)

    for section in ["fluctuation", "fluctuation_direct"]:
        section_data = data.get(section, {})
        for key in ["kospi_up", "kospi_down", "kosdaq_up", "kosdaq_down"]:
            for stock in section_data.get(key, []):
                code = stock.get("code", "")
                if code and code not in seen:
                    seen[code] = stock.get("name", code)

    return [{"code": c, "name": n} for c, n in seen.items()]


def main():
    test_mode = "--test" in sys.argv

    print("[장중 히스토리 수집] 시작")

    # 1. 종목 추출
    latest = load_json(LATEST_PATH)
    if not latest:
        print("  latest.json이 없습니다.")
        sys.exit(1)

    all_stocks = extract_all_codes(latest)
    print(f"  종목 수: {len(all_stocks)}개")

    if test_mode:
        all_stocks = all_stocks[:3]
        print(f"  테스트 모드: {len(all_stocks)}종목만 수집")

    # 2. 기존 데이터 로드
    existing = load_json(OUTPUT_PATH)
    existing_stocks = existing.get("stocks", {})

    # 3. 병렬 수집
    client = KISClient()
    today_data: dict[str, dict] = {}
    start_time = time.time()

    def _collect(stock: dict) -> tuple[str, dict | None]:
        code = stock["code"]
        return code, collect_stock_intraday(client, code)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_collect, s): s for s in all_stocks}
        done = 0
        for future in as_completed(futures):
            done += 1
            stock = futures[future]
            try:
                code, result = future.result()
                if result:
                    today_data[code] = result
                    if done % 20 == 0 or done == len(all_stocks):
                        print(f"  진행: {done}/{len(all_stocks)} ({time.time() - start_time:.1f}초)")
            except Exception as e:
                print(f"  [오류] {stock['name']}({stock['code']}): {e}")

    elapsed = time.time() - start_time
    print(f"  수집 완료: {len(today_data)}/{len(all_stocks)}종목 ({elapsed:.1f}초)")

    # 4. 기존 데이터에 오늘 데이터 추가/갱신, 10일 초과분 제거
    merged_stocks: dict[str, list] = {}

    # 수집된 종목들 처리
    all_codes = set(today_data.keys()) | set(existing_stocks.keys())
    today_str = datetime.now().strftime("%Y-%m-%d")

    for code in all_codes:
        days = list(existing_stocks.get(code, []))

        if code in today_data:
            # 오늘 날짜 기존 데이터 제거 후 추가
            days = [d for d in days if d.get("date") != today_str]
            days.append(today_data[code])

        # 최신순 정렬 후 MAX_DAYS개만 보관
        days.sort(key=lambda d: d.get("date", ""), reverse=True)
        days = days[:MAX_DAYS]

        if days:
            merged_stocks[code] = days

    # 5. 저장
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    output = {
        "updated_at": now_str,
        "stocks": merged_stocks,
    }

    if test_mode:
        print(json.dumps(output, ensure_ascii=False, indent=2)[:3000])
        print("  [테스트] 파일 저장하지 않음")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
        print(f"  저장: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
