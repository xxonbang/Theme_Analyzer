"""
예측 백테스팅 — 메인 실행 스크립트

Supabase의 active 예측을 조회하고, 실제 주가와 비교하여 적중 여부를 판정합니다.

Usage:
    python backtest_main.py                          # active 예측 평가
    python backtest_main.py --test                   # 테스트 모드 (DB 업데이트 건너뜀)
    python backtest_main.py --reevaluate 2026-02-26  # 특정 날짜 재평가 (hit/missed → 재계산)
"""
import json
import sys
from datetime import datetime, timedelta

from config.settings import *  # noqa: F401,F403 — 환경변수 로드
from modules.backtest import (
    get_active_predictions,
    fetch_stock_returns,
    fetch_index_return,
    fetch_daily_returns,
    fetch_daily_index_return,
    evaluate_prediction,
    update_prediction_status,
    calculate_accuracy_report,
)
from modules.utils import KST


def get_reevaluate_date() -> str:
    """--reevaluate YYYY-MM-DD 인자 파싱"""
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--reevaluate" and i + 1 < len(args):
            return args[i + 1]
    return ""


def get_predictions_for_reevaluate(client, target_date: str):
    """특정 날짜의 hit/missed 예측을 조회하여 재평가 대상으로 반환"""
    response = client.table("theme_predictions").select("*").eq(
        "prediction_date", target_date
    ).in_(
        "status", ["hit", "missed"]
    ).execute()
    return response.data or []


def main():
    test_mode = "--test" in sys.argv
    reevaluate_date = get_reevaluate_date()

    if test_mode:
        print("🧪 테스트 모드 (Supabase 업데이트 건너뜀)")

    print("=" * 50)
    if reevaluate_date:
        print(f"📊 예측 재평가 시작 ({reevaluate_date})")
    else:
        print("📊 예측 백테스팅 시작")
    print("=" * 50)

    # Supabase 연결
    try:
        from modules.supabase_client import get_supabase_manager
        manager = get_supabase_manager()
        client = manager._get_client()
        if not client:
            print("  ✗ Supabase 연결 불가")
            sys.exit(1)
    except Exception as e:
        print(f"  ✗ Supabase 초기화 실패: {e}")
        sys.exit(1)

    # KIS API 연결
    try:
        from modules.kis_client import KISClient
        kis_client = KISClient()
    except Exception as e:
        print(f"  ✗ KIS API 초기화 실패: {e}")
        sys.exit(1)

    # Step 1: 예측 조회
    print("\n[1/4] 예측 조회...")
    if reevaluate_date:
        predictions = get_predictions_for_reevaluate(client, reevaluate_date)
        print(f"  ✓ {len(predictions)}건의 재평가 대상 조회 ({reevaluate_date})")
    else:
        predictions = get_active_predictions(client)
        print(f"  ✓ {len(predictions)}건의 active 예측 조회")

    if not predictions:
        print("  평가할 예측이 없습니다")
        print("\n✅ 백테스팅 완료")
        return

    # Step 2: (prediction_date, category) 그룹별 종목코드 수집 + 수익률 조회
    print("\n[2/4] 주식 수익률 조회...")

    # 달력일 매핑: 영업일 → 달력일
    category_cal_days = {"short_term": 12, "long_term": 45}

    # (pred_date, category) 그룹별 종목코드 수집
    pred_groups = {}  # key: (pred_date_str, category) -> set of codes
    for pred in predictions:
        category = pred.get("category", "today")
        pred_date = pred.get("prediction_date", "")
        if not pred_date:
            continue

        key = (pred_date, category)
        if key not in pred_groups:
            pred_groups[key] = set()

        leader_stocks = pred.get("leader_stocks", "[]")
        if isinstance(leader_stocks, str):
            try:
                leader_stocks = json.loads(leader_stocks)
            except json.JSONDecodeError:
                leader_stocks = []
        for s in leader_stocks:
            code = s.get("code", "")
            if code:
                pred_groups[key].add(code)

    # 그룹별 수익률 + 지수 수익률 조회
    returns_by_group = {}   # key: (pred_date_str, category) -> {code: return_pct}
    index_by_group = {}     # key: (pred_date_str, category) -> float
    for (pred_date, category), codes in pred_groups.items():
        if category == "today":
            returns_by_group[(pred_date, category)] = fetch_daily_returns(kis_client, list(codes), pred_date)
            index_by_group[(pred_date, category)] = fetch_daily_index_return(kis_client, pred_date)
        else:
            cal_days = category_cal_days.get(category, 12)
            dt = datetime.strptime(pred_date, "%Y-%m-%d")
            end = (dt + timedelta(days=cal_days)).strftime("%Y-%m-%d")
            returns_by_group[(pred_date, category)] = fetch_stock_returns(kis_client, list(codes), pred_date, end)
            index_by_group[(pred_date, category)] = fetch_index_return(kis_client, pred_date, end)

    all_codes = set()
    for codes in pred_groups.values():
        all_codes |= codes
    print(f"  ✓ 그룹별 수익률 조회 완료 ({len(pred_groups)}개 그룹, 종목 {len(all_codes)}개)")
    for (pd, cat), rets in returns_by_group.items():
        idx = index_by_group[(pd, cat)]
        expected_codes = pred_groups[(pd, cat)]
        fetched_codes = set(rets.keys())
        missing = expected_codes - fetched_codes
        print(f"    - {pd}/{cat}: KOSPI {idx:+.2f}%, 종목 {len(rets)}/{len(expected_codes)}개")
        if missing:
            print(f"      ⚠ 수익률 미확보: {', '.join(sorted(missing))}")

    # Step 3: 예측 평가
    print("\n[3/4] 예측 평가...")
    results = {"hit": 0, "missed": 0, "expired": 0, "active": 0}

    for pred in predictions:
        category = pred.get("category", "today")
        pred_date = pred.get("prediction_date", "")
        key = (pred_date, category)
        returns = returns_by_group.get(key, {})
        index_return = index_by_group.get(key, 0.0)

        status = evaluate_prediction(pred, returns, index_return, force=bool(reevaluate_date))
        results[status] += 1

        theme_name = pred.get("theme_name", "N/A")

        if status in ("hit", "missed", "expired"):
            # 수익률 정보 수집 (로깅 및 저장 공용)
            leader_stocks = pred.get("leader_stocks", "[]")
            if isinstance(leader_stocks, str):
                try:
                    leader_stocks = json.loads(leader_stocks)
                except json.JSONDecodeError:
                    leader_stocks = []
            perf = {}
            perf_details = []
            for s in leader_stocks:
                code = s.get("code", "")
                name = s.get("name", code)
                if code and code in returns:
                    perf[code] = returns[code]
                    perf_details.append(f"{name}({code})={returns[code]:+.2f}%")
                elif code:
                    perf_details.append(f"{name}({code})=N/A")
            perf["index_return"] = index_return

            print(f"  [{status.upper()}] {theme_name} ({category}) — {', '.join(perf_details)}")

            if not test_mode:
                update_prediction_status(client, pred["id"], status, perf)

    print(f"\n  결과: hit={results['hit']}, missed={results['missed']}, "
          f"expired={results['expired']}, active={results['active']}")

    # Step 4: 정확도 리포트
    print("\n[4/4] 정확도 리포트...")
    if not test_mode:
        report = calculate_accuracy_report(client)
        print(f"  전체: {report['hit']}/{report['total']} ({report['accuracy']}%)")
        for conf, data in report.get("by_confidence", {}).items():
            print(f"  신뢰도 {conf}: {data['hit']}/{data['total']} ({data['accuracy']}%)")
        for cat, data in report.get("by_category", {}).items():
            print(f"  카테고리 {cat}: {data['hit']}/{data['total']} ({data['accuracy']}%)")
    else:
        print("  ⏭ 정확도 리포트 건너뜀 (테스트 모드)")

    print("\n" + "=" * 50)
    print("✅ 예측 백테스팅 완료")
    print("=" * 50)


if __name__ == "__main__":
    main()
