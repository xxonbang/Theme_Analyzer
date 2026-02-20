"""
유망 테마 예측 — 메인 실행 스크립트

장 개장 전(7:30 AM) 실행하여 전일 데이터 기반으로 유망 테마를 예측합니다.
GitHub Actions cron 또는 수동 실행으로 트리거됩니다.

Usage:
    python forecast_main.py           # 전체 실행
    python forecast_main.py --test    # 테스트 (Supabase 저장 건너뜀)
"""
import json
import sys
from pathlib import Path

from config.settings import *  # noqa: F401,F403 — 환경변수 로드
from modules.theme_forecast import (
    load_theme_history,
    generate_forecast,
    save_forecast_to_supabase,
    export_forecast_json,
)

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "frontend" / "public" / "data"


def main():
    test_mode = "--test" in sys.argv
    if test_mode:
        print("🧪 테스트 모드 (Supabase 저장 건너뜀)")

    print("=" * 50)
    print("📊 유망 테마 예측 시작")
    print("=" * 50)

    # Step 1: 전일 latest.json 로드
    print("\n[1/4] 전일 데이터 로드...")
    latest_path = DATA_DIR / "latest.json"
    if not latest_path.exists():
        print("  ✗ latest.json 파일이 없습니다")
        sys.exit(1)

    with open(latest_path, "r", encoding="utf-8") as f:
        latest_data = json.load(f)

    timestamp = latest_data.get("timestamp", "N/A")
    theme_count = len(latest_data.get("theme_analysis", {}).get("themes", []))
    print(f"  ✓ 전일 데이터 로드 완료 (수집일: {timestamp}, 테마 {theme_count}개)")

    # Step 2: 테마 히스토리 로드
    print("\n[2/4] 테마 히스토리 로드...")
    history_dir = DATA_DIR / "history"
    theme_history = load_theme_history(history_dir, days=7)
    print(f"  ✓ 최근 {len(theme_history)}일분 테마 히스토리 로드")

    for entry in theme_history:
        theme_names = [t.get("theme_name", "") for t in entry.get("themes", [])]
        print(f"    - {entry['date']}: {', '.join(theme_names)}")

    # Step 3: Gemini 유망 테마 예측
    print("\n[3/4] Gemini 유망 테마 예측...")
    forecast = generate_forecast(latest_data, theme_history)

    if not forecast:
        print("  ✗ 예측 실패")
        sys.exit(1)

    today_count = len(forecast.get("today", []))
    short_count = len(forecast.get("short_term", []))
    long_count = len(forecast.get("long_term", []))
    print(f"  ✓ 예측 완료: 오늘 {today_count}개, 단기 {short_count}개, 장기 {long_count}개")

    # 예측 결과 콘솔 출력
    print("\n  --- 오늘의 유망 테마 ---")
    for t in forecast.get("today", []):
        leaders = ", ".join(s.get("name", "") for s in t.get("leader_stocks", []))
        print(f"  [{t.get('confidence', '')}] {t.get('theme_name', '')} — {t.get('catalyst', '')}")
        print(f"    대장주: {leaders}")

    print("\n  --- 단기 유망 테마 (7일 이내) ---")
    for t in forecast.get("short_term", []):
        leaders = ", ".join(s.get("name", "") for s in t.get("leader_stocks", []))
        print(f"  [{t.get('confidence', '')}] {t.get('theme_name', '')} ({t.get('target_period', '')}) — {t.get('catalyst', '')}")
        print(f"    대장주: {leaders}")

    print("\n  --- 장기 유망 테마 (1개월 이내) ---")
    for t in forecast.get("long_term", []):
        leaders = ", ".join(s.get("name", "") for s in t.get("leader_stocks", []))
        print(f"  [{t.get('confidence', '')}] {t.get('theme_name', '')} ({t.get('target_period', '')}) — {t.get('catalyst', '')}")
        print(f"    대장주: {leaders}")

    # Step 4: 저장
    print("\n[4/4] 결과 저장...")

    # JSON export (항상)
    export_forecast_json(forecast)

    # Supabase 저장 (테스트 모드가 아닐 때만)
    if not test_mode:
        save_forecast_to_supabase(forecast)
    else:
        print("  ⏭ Supabase 저장 건너뜀 (테스트 모드)")

    print("\n" + "=" * 50)
    print("✅ 유망 테마 예측 완료")
    print("=" * 50)


if __name__ == "__main__":
    main()
