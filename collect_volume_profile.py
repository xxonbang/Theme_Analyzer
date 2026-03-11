"""
매물대(Volume Profile) 수집 스크립트

사용법:
  python collect_volume_profile.py              # 전 기간 수집 (장마감 후)
  python collect_volume_profile.py --intraday   # 당일 분봉만 (장중)
  python collect_volume_profile.py --test       # 테스트 (콘솔 출력만)
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

from modules.kis_client import KISClient
from modules.volume_profile import collect_full, collect_intraday

ROOT_DIR = Path(__file__).parent
LATEST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"
OUTPUT_PATH = ROOT_DIR / "frontend" / "public" / "data" / "volume-profile.json"


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
    intraday_mode = "--intraday" in sys.argv
    test_mode = "--test" in sys.argv
    mode_label = "장중(당일)" if intraday_mode else "전 기간"

    print(f"[매물대 수집] 모드: {mode_label}")

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

    # 장중 모드: criteria 점수 상위 종목으로 제한 (API 호출량 절감)
    INTRADAY_MAX = 80
    if intraday_mode and not test_mode and len(all_stocks) > INTRADAY_MAX:
        criteria_data = latest.get("criteria_data", {})
        scored = []
        for s in all_stocks:
            cd = criteria_data.get(s["code"], {})
            score = sum(1 for k, v in cd.items() if isinstance(v, dict) and v.get("met") and not v.get("warning"))
            scored.append((score, s))
        scored.sort(key=lambda x: x[0], reverse=True)
        all_stocks = [s for _, s in scored[:INTRADAY_MAX]]
        print(f"  장중 모드: criteria 상위 {INTRADAY_MAX}종목만 수집")

    # 2. 기존 데이터 로드 (장중 모드: 장기 데이터 보존)
    existing = load_json(OUTPUT_PATH) if intraday_mode else {}

    # 3. 병렬 수집
    client = KISClient()
    profiles = {}
    start_time = time.time()

    def _collect(stock: dict) -> tuple[str, dict]:
        code = stock["code"]
        if intraday_mode:
            return code, collect_intraday(client, code)
        else:
            return code, collect_full(client, code)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_collect, s): s for s in all_stocks}
        done = 0
        for future in as_completed(futures):
            done += 1
            stock = futures[future]
            try:
                code, vp = future.result()
                if vp:
                    profiles[code] = vp
                    if done % 20 == 0 or done == len(all_stocks):
                        print(f"  진행: {done}/{len(all_stocks)} ({time.time() - start_time:.1f}초)")
            except Exception as e:
                print(f"  [오류] {stock['name']}({stock['code']}): {e}")

    elapsed = time.time() - start_time
    print(f"  수집 완료: {len(profiles)}/{len(all_stocks)}종목 ({elapsed:.1f}초)")

    # 4. 장중 모드: 기존 장기 데이터 보존, today만 덮어쓰기
    if intraday_mode and existing.get("profiles"):
        merged = existing["profiles"]
        for code, vp in profiles.items():
            if code in merged:
                merged[code]["today"] = vp.get("today")
            else:
                merged[code] = vp
        profiles = merged

    # 5. 저장
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    output = {
        "updated_at": now_str,
        "mode": "intraday" if intraday_mode else "full",
        "profiles": profiles,
    }

    if test_mode:
        print(json.dumps(output, ensure_ascii=False, indent=2)[:2000])
        print("  [테스트] 파일 저장하지 않음")
    else:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)
        print(f"  저장: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
