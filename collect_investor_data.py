"""
수급 + 랭킹 데이터 경량 수집 스크립트

장중/장외 수급(외국인·기관·개인 순매수) 데이터와
거래량/거래대금/등락률 랭킹을 수집하여
latest.json을 갱신하고, 대장주 수급 정보를 텔레그램으로 전송합니다.

신규 진입 종목에 대해서는 history/criteria/member 데이터도 보충합니다.

Usage:
    python collect_investor_data.py          # 전체 실행
    python collect_investor_data.py --test   # 테스트 (텔레그램 미발송, 파일 미저장)
"""
import json
import sys
from datetime import datetime
from pathlib import Path

from config.settings import *  # noqa: F401,F403 — 환경변수 로드
from modules.kis_client import KISClient
from modules.kis_rank import KISRankAPI
from modules.telegram import TelegramSender
from modules.utils import KST

ROOT_DIR = Path(__file__).parent
LATEST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "latest.json"
FORECAST_PATH = ROOT_DIR / "frontend" / "public" / "data" / "theme-forecast.json"


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_all_codes(data: dict) -> list[dict]:
    """latest.json에서 모든 종목코드+이름 추출 (중복 제거)"""
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


def extract_leader_codes(forecast: dict) -> set[str]:
    """theme-forecast.json에서 대장주 코드 추출"""
    codes = set()
    for category in ["today", "short_term", "long_term"]:
        for theme in forecast.get(category, []):
            for stock in theme.get("leader_stocks", []):
                code = stock.get("code", "")
                if code:
                    codes.add(code)
    return codes


def extract_top20_stocks(data: dict) -> list[dict]:
    """latest.json에서 거래대금 TOP20 종목 추출 (KOSPI+KOSDAQ 합산 후 거래대금 순 정렬)"""
    stocks = []
    tv_data = data.get("trading_value", {})
    for market in ["kospi", "kosdaq"]:
        for stock in tv_data.get(market, []):
            stocks.append(stock)
    stocks.sort(key=lambda x: x.get("trading_value", 0), reverse=True)
    return stocks[:20]


def build_leader_info(forecast: dict) -> dict[str, dict]:
    """대장주 코드 → {name, theme} 매핑"""
    info = {}
    for category in ["today", "short_term", "long_term"]:
        for theme in forecast.get(category, []):
            theme_name = theme.get("theme_name", "")
            for stock in theme.get("leader_stocks", []):
                code = stock.get("code", "")
                if code and code not in info:
                    info[code] = {"name": stock.get("name", code), "theme": theme_name}
    return info


def main():
    test_mode = "--test" in sys.argv
    now = datetime.now(KST)

    if test_mode:
        print("--- 테스트 모드 (텔레그램 미발송, 파일 미저장) ---")

    print(f"[수급 수집] {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # 1. latest.json에서 전체 종목 추출
    latest = load_json(LATEST_PATH)
    if not latest:
        print("  latest.json이 없습니다.")
        sys.exit(1)

    all_stocks = extract_all_codes(latest)
    print(f"  전체 종목: {len(all_stocks)}개")

    # 2. theme-forecast.json에서 대장주 추출
    forecast = load_json(FORECAST_PATH)
    leader_codes = extract_leader_codes(forecast)
    leader_info = build_leader_info(forecast)

    # 대장주 중 all_stocks에 없는 종목 추가
    existing_codes = {s["code"] for s in all_stocks}
    for code in leader_codes:
        if code not in existing_codes:
            name = leader_info.get(code, {}).get("name", code)
            all_stocks.append({"code": code, "name": name})

    print(f"  대장주: {len(leader_codes)}개 (수급 수집 대상 총 {len(all_stocks)}개)")

    # 3. KIS API로 수급 데이터 + 거래량/거래대금 수집
    print("\n[수급 데이터 수집]")
    rank_api = KISRankAPI()
    investor_data, is_estimated = rank_api.get_investor_data_auto(all_stocks)
    label = "추정" if is_estimated else "확정"
    print(f"  {len(investor_data)}개 종목 수급 수집 완료 ({label})")

    # 3-1. 거래량/거래대금/등락률 실시간 갱신
    print("\n[거래량/거래대금/등락률 수집]")
    volume_data = {}
    trading_value_data = {}
    fluctuation_data = {}
    fluctuation_direct_data = {}
    try:
        volume_data = rank_api.get_top30_by_volume(exclude_etf=True)
        print(f"  거래량: KOSPI {len(volume_data.get('kospi', []))}개, KOSDAQ {len(volume_data.get('kosdaq', []))}개")
    except Exception as e:
        print(f"  ⚠ 거래량 수집 실패: {e}")
    try:
        trading_value_data = rank_api.get_top30_by_trading_value(exclude_etf=True)
        print(f"  거래대금: KOSPI {len(trading_value_data.get('kospi', []))}개, KOSDAQ {len(trading_value_data.get('kosdaq', []))}개")
    except Exception as e:
        print(f"  ⚠ 거래대금 수집 실패: {e}")
    try:
        fluctuation_data = rank_api.get_top30_by_fluctuation(exclude_etf=True)
        up = len(fluctuation_data.get('kospi_up', [])) + len(fluctuation_data.get('kosdaq_up', []))
        down = len(fluctuation_data.get('kospi_down', [])) + len(fluctuation_data.get('kosdaq_down', []))
        print(f"  등락률: 상승 {up}개, 하락 {down}개")
    except Exception as e:
        print(f"  ⚠ 등락률 수집 실패: {e}")
    try:
        fluctuation_direct_data = rank_api.get_top_fluctuation_direct(exclude_etf=True)
        up = len(fluctuation_direct_data.get('kospi_up', [])) + len(fluctuation_direct_data.get('kosdaq_up', []))
        down = len(fluctuation_direct_data.get('kospi_down', [])) + len(fluctuation_direct_data.get('kosdaq_down', []))
        print(f"  등락률(전용): 상승 {up}개, 하락 {down}개")
    except Exception as e:
        print(f"  ⚠ 등락률(전용) 수집 실패: {e}")

    # 4. 수집 성공 검증 — 대상의 절반 이상 수집되어야 유효
    min_required = max(1, len(all_stocks) // 2)
    if len(investor_data) < min_required:
        print(f"\n  수집 실패: {len(investor_data)}/{len(all_stocks)}개 ({min_required}개 이상 필요)")
        print("  latest.json 갱신 및 텔레그램 전송을 건너뜁니다.")
        sys.exit(1)

    # 4-1. pykrx 교차검증 + 세분화 (장후 18:00 이후, 확정 데이터일 때만)
    if not is_estimated:
        try:
            from modules.pykrx_investor import is_pykrx_available, get_investor_data_bulk, extract_detail
            from modules.investor_validator import cross_validate, print_validation_report

            if is_pykrx_available():
                print("\n[pykrx 교차검증]")
                today_str = now.strftime("%Y%m%d")
                stock_codes = [s["code"] for s in all_stocks if s["code"] in investor_data]
                pykrx_data = get_investor_data_bulk(today_str, stock_codes)

                if pykrx_data:
                    # 교차검증
                    validation = cross_validate(investor_data, pykrx_data)
                    print_validation_report(validation)

                    # 세분화 데이터 병합 (detail 필드)
                    merged_count = 0
                    for code, pkx in pykrx_data.items():
                        if code in investor_data:
                            detail = extract_detail(pkx)
                            if detail:
                                investor_data[code]["detail"] = detail
                                merged_count += 1
                    print(f"  세분화 데이터 병합: {merged_count}개 종목")
                else:
                    print("  pykrx 데이터 수집 결과 없음")
            else:
                print("\n[pykrx] 18:00 이전 — 교차검증 건너뜀")
        except ImportError:
            print("\n[pykrx] 모듈 미설치 — 교차검증 건너뜀 (pip install pykrx)")
        except Exception as e:
            print(f"\n[pykrx] 교차검증 실패 (KIS 데이터로 계속): {e}")

    # 5. latest.json 갱신
    if not test_mode:
        # 기존 investor_data의 program_net 보존 (main.py에서 병합한 값)
        old_investor = latest.get("investor_data", {})
        for code, new_inv in investor_data.items():
            pgtr = old_investor.get(code, {}).get("program_net")
            if pgtr is not None:
                new_inv["program_net"] = pgtr
        latest["investor_data"] = investor_data
        latest["investor_estimated"] = is_estimated
        latest["investor_updated_at"] = now.strftime("%Y-%m-%d %H:%M:%S")

        # 거래량/거래대금/등락률 갱신 (메타 필드 제거)
        meta_keys = {"collected_at", "category", "exclude_etf"}
        if volume_data:
            latest["volume"] = {k: v for k, v in volume_data.items() if k not in meta_keys}
        if trading_value_data:
            latest["trading_value"] = {k: v for k, v in trading_value_data.items() if k not in meta_keys}
        if fluctuation_data:
            latest["fluctuation"] = {k: v for k, v in fluctuation_data.items() if k not in meta_keys}
        if fluctuation_direct_data:
            latest["fluctuation_direct"] = {k: v for k, v in fluctuation_direct_data.items() if k not in meta_keys}

        # 신규 진입 종목 데이터 보충 (history + criteria + member)
        # 랭킹 갱신으로 새로 나타난 종목은 history 등이 없으므로 보충
        existing_history = latest.get("history") or {}
        new_codes = set()
        for section_key in ["volume", "trading_value"]:
            for market in ["kospi", "kosdaq"]:
                for stock in latest.get(section_key, {}).get(market, []):
                    code = stock.get("code", "")
                    if code and code not in existing_history:
                        new_codes.add(code)
        for section_key in ["fluctuation", "fluctuation_direct"]:
            for key in ["kospi_up", "kospi_down", "kosdaq_up", "kosdaq_down"]:
                for stock in latest.get(section_key, {}).get(key, []):
                    code = stock.get("code", "")
                    if code and code not in existing_history:
                        new_codes.add(code)

        if new_codes:
            print(f"\n[신규 종목 데이터 보충] {len(new_codes)}개")
            try:
                from modules.stock_history import StockHistoryAPI
                history_api = StockHistoryAPI(rank_api.client)
                new_history = history_api.get_multiple_stocks_history(
                    [{"code": c} for c in new_codes], days=3
                )
                for code, hist in new_history.items():
                    existing_history[code] = hist
                latest["history"] = existing_history
                print(f"  ✓ history: {len(new_history)}개 종목")

                # criteria 평가 (history 기반)
                from modules.stock_criteria import evaluate_all_stocks
                existing_criteria = latest.get("criteria_data") or {}
                new_stock_map = {}
                for section_key in ["volume", "trading_value"]:
                    for market in ["kospi", "kosdaq"]:
                        for stock in latest.get(section_key, {}).get(market, []):
                            code = stock.get("code", "")
                            if code in new_codes and code not in new_stock_map:
                                new_stock_map[code] = stock
                for section_key in ["fluctuation", "fluctuation_direct"]:
                    for key in ["kospi_up", "kospi_down", "kosdaq_up", "kosdaq_down"]:
                        for stock in latest.get(section_key, {}).get(key, []):
                            code = stock.get("code", "")
                            if code in new_codes and code not in new_stock_map:
                                new_stock_map[code] = stock
                new_criteria = evaluate_all_stocks(
                    all_stocks=list(new_stock_map.values()),
                    history_data=existing_history,
                    investor_data=investor_data,
                    trading_value_data=latest.get("trading_value", {}),
                )
                existing_criteria.update(new_criteria)
                latest["criteria_data"] = existing_criteria
                print(f"  ✓ criteria: {len(new_criteria)}개 종목")

                # member(거래원) 수집 — 대장주 or 거래대금 TOP20인 신규 종목만
                member_target = set(leader_codes)
                for s in extract_top20_stocks(latest):
                    c = s.get("code", "")
                    if c:
                        member_target.add(c)
                member_new = new_codes & member_target
                if member_new:
                    existing_member = latest.get("member_data") or {}
                    new_member = rank_api.get_member_data(
                        [{"code": c, "name": new_stock_map.get(c, {}).get("name", c)} for c in member_new]
                    )
                    existing_member.update(new_member)
                    latest["member_data"] = existing_member
                    print(f"  ✓ member: {len(new_member)}개 종목")
            except Exception as e:
                print(f"  ⚠ 신규 종목 데이터 보충 실패 (기존 데이터로 계속): {e}")

        with open(LATEST_PATH, "w", encoding="utf-8") as f:
            json.dump(latest, f, ensure_ascii=False, indent=2)
        print(f"\n  latest.json 갱신 완료")
    else:
        print(f"\n  [테스트] latest.json 갱신 건너뜀")

    # 6. 대장주 수급 텔레그램 전송
    member_data = latest.get("member_data") or {}
    leader_investor = {}
    for code in leader_codes:
        if code in investor_data:
            leader_investor[code] = investor_data[code]

    print(f"\n[텔레그램] 대장주 수급 {len(leader_investor)}개 종목")

    telegram = TelegramSender()

    if not leader_investor:
        print("  수급 데이터 있는 대장주 없음 — 전송 건너뜀")
    else:
        msg = telegram.format_investor_data(leader_investor, leader_info, is_estimated, member_data)
        if test_mode:
            print(f"\n--- 텔레그램 메시지 미리보기 (대장주) ---\n{msg}\n---")
        else:
            ok = telegram.send_message(msg)
            print(f"  전송 {'성공' if ok else '실패'}")

    # 7. 거래대금 TOP20 수급 텔레그램 전송
    top20_stocks = extract_top20_stocks(latest)
    # 대장주와 중복되는 종목 제외
    top20_stocks = [s for s in top20_stocks if s.get("code", "") not in leader_codes]
    top20_with_data = [s for s in top20_stocks if s.get("code", "") in investor_data]

    print(f"\n[텔레그램] 거래대금 TOP20 수급 {len(top20_with_data)}개 종목 (대장주 제외)")

    if top20_with_data:
        top20_msg = telegram.format_top20_investor_data(investor_data, top20_with_data, is_estimated, member_data)

        if test_mode:
            print(f"\n--- 텔레그램 메시지 미리보기 (거래대금 TOP20) ---\n{top20_msg}\n---")
        else:
            ok2 = telegram.send_message(top20_msg)
            print(f"  전송 {'성공' if ok2 else '실패'}")

    print("\n수급 수집 완료")


if __name__ == "__main__":
    main()
