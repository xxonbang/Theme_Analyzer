"""
수급 데이터 경량 수집 스크립트

장중/장외 수급(외국인·기관·개인 순매수) 데이터를 수집하여
latest.json을 갱신하고, 대장주 수급 정보를 텔레그램으로 전송합니다.

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
    now = datetime.now()

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

    # 3. KIS API로 수급 데이터 수집
    print("\n[수급 데이터 수집]")
    rank_api = KISRankAPI()
    investor_data, is_estimated = rank_api.get_investor_data_auto(all_stocks)
    label = "추정" if is_estimated else "확정"
    print(f"  {len(investor_data)}개 종목 수급 수집 완료 ({label})")

    # 4. 수집 성공 검증 — 대상의 절반 이상 수집되어야 유효
    min_required = max(1, len(all_stocks) // 2)
    if len(investor_data) < min_required:
        print(f"\n  수집 실패: {len(investor_data)}/{len(all_stocks)}개 ({min_required}개 이상 필요)")
        print("  latest.json 갱신 및 텔레그램 전송을 건너뜁니다.")
        sys.exit(1)

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
