"""
한국수출입은행 환율 API 클라이언트
- 실시간 환율 정보 조회
- 주요 통화(USD, JPY, EUR, CNY) 환율 제공
"""
import time
import urllib3
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from modules.utils import KST

# 주요 통화 코드
MAJOR_CURRENCIES = ["USD", "JPY(100)", "EUR", "CNH"]


class ExchangeRateAPI:
    """한국수출입은행 환율 API 클라이언트"""

    def __init__(self, api_key: str = None):
        """
        Args:
            api_key: 한국수출입은행 API 인증키
        """
        self.api_key = api_key or "iiUCA5fWpK1ni8A3BR5JrWk7obCuk5ka"
        self.api_url = "https://www.koreaexim.go.kr/site/program/financial/exchangeJSON"

    def get_exchange_rates(self, search_date: str = None) -> Dict[str, Any]:
        """환율 정보 조회

        Args:
            search_date: 조회일자 (yyyyMMdd), None이면 당일

        Returns:
            {
                "timestamp": "2026-02-03 11:30:00",
                "rates": [
                    {"currency": "USD", "rate": 1450.50, "change": -5.20, ...},
                    ...
                ]
            }
        """
        # 조회일자 설정
        if not search_date:
            now = datetime.now(KST)
            search_date = now.strftime("%Y%m%d")

        params = {
            "authkey": self.api_key,
            "searchdate": search_date,
            "data": "AP01",  # 환율
        }

        try:
            # Session 사용 (WAF 쿠키 검증 통과를 위해 필수)
            # verify=False: GitHub Actions에서 koreaexim SSL 인증서 검증 실패 대응
            session = requests.Session()
            session.verify = False
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (compatible; ExchangeRateBot/1.0)"
            })

            data = None
            last_err = None
            for attempt in range(3):
                try:
                    response = session.get(self.api_url, params=params, timeout=10)
                    response.raise_for_status()
                    data = response.json()
                    break
                except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                    last_err = e
                    print(f"[환율] 연결 재시도 ({attempt + 1}/3): {e}")
                    time.sleep(2 * (attempt + 1))

            if data is None and last_err:
                raise last_err

            if not data:
                # 데이터가 없으면 최대 7일 전까지 조회 시도 (주말/공휴일 대응)
                base_date = datetime.strptime(search_date, "%Y%m%d")
                for days_back in range(1, 8):
                    prev_date = (base_date - timedelta(days=days_back)).strftime("%Y%m%d")
                    params["searchdate"] = prev_date
                    response = session.get(self.api_url, params=params, timeout=10)
                    response.raise_for_status()
                    data = response.json()
                    if data:
                        search_date = prev_date
                        break

            # 주요 통화만 필터링
            rates = []
            for item in data:
                cur_unit = item.get("cur_unit", "")
                if cur_unit in MAJOR_CURRENCIES:
                    # 숫자 파싱 (쉼표 제거)
                    deal_bas_r = self._parse_number(item.get("deal_bas_r", "0"))
                    ttb = self._parse_number(item.get("ttb", "0"))
                    tts = self._parse_number(item.get("tts", "0"))

                    rates.append({
                        "currency": cur_unit.replace("(100)", "").replace("CNH", "CNY"),  # JPY(100)->JPY, CNH->CNY
                        "currency_name": item.get("cur_nm", ""),
                        "rate": deal_bas_r,  # 매매기준율
                        "ttb": ttb,  # 송금 받을 때 (전신환매입률)
                        "tts": tts,  # 송금 보낼 때 (전신환매도율)
                        "is_100": "(100)" in cur_unit,  # 100단위 여부 (JPY)
                    })

            # 통화 순서 정렬 (USD, JPY, EUR, CNY)
            currency_order = {"USD": 0, "JPY": 1, "EUR": 2, "CNY": 3}
            rates.sort(key=lambda x: currency_order.get(x["currency"], 99))

            # 전일 대비 변동 계산
            self._add_change(rates, search_date, session)

            return {
                "timestamp": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
                "search_date": search_date,
                "rates": rates,
            }

        except requests.exceptions.RequestException as e:
            print(f"[환율] API 요청 실패: {e}")
            return {"timestamp": "", "search_date": "", "rates": []}
        except Exception as e:
            print(f"[환율] 데이터 처리 실패: {e}")
            return {"timestamp": "", "search_date": "", "rates": []}

    def _add_change(self, rates: list, search_date: str, session) -> None:
        """전일 환율 대비 변동폭/변동률 추가"""
        try:
            base_date = datetime.strptime(search_date, "%Y%m%d")
            prev_data = None
            for days_back in range(1, 8):
                prev_date = (base_date - timedelta(days=days_back)).strftime("%Y%m%d")
                params = {
                    "authkey": self.api_key,
                    "searchdate": prev_date,
                    "data": "AP01",
                }
                resp = session.get(self.api_url, params=params, timeout=10)
                if resp.ok and resp.json():
                    prev_data = resp.json()
                    break

            if not prev_data:
                return

            # 전일 환율 맵 생성
            prev_map = {}
            for item in prev_data:
                cur_unit = item.get("cur_unit", "")
                if cur_unit in MAJOR_CURRENCIES:
                    key = cur_unit.replace("(100)", "").replace("CNH", "CNY")
                    prev_map[key] = self._parse_number(item.get("deal_bas_r", "0"))

            for rate in rates:
                prev_rate = prev_map.get(rate["currency"])
                if prev_rate and prev_rate > 0:
                    rate["change"] = round(rate["rate"] - prev_rate, 2)
                    rate["change_rate"] = round((rate["rate"] - prev_rate) / prev_rate * 100, 2)
        except Exception as e:
            print(f"[환율] 전일 대비 변동 계산 실패: {e}")

    def _parse_number(self, value: str) -> float:
        """숫자 문자열 파싱 (쉼표 제거)"""
        if not value:
            return 0.0
        try:
            return float(value.replace(",", ""))
        except ValueError:
            return 0.0

    def format_for_telegram(self, exchange_data: Dict[str, Any]) -> str:
        """텔레그램 메시지용 포맷팅

        Args:
            exchange_data: get_exchange_rates() 반환값

        Returns:
            포맷팅된 문자열
        """
        if not exchange_data.get("rates"):
            return ""

        lines = ["💱 <b>실시간 환율</b>"]

        for rate in exchange_data["rates"]:
            currency = rate["currency"]
            value = rate["rate"]
            is_100 = rate["is_100"]

            # 통화별 이모지
            emoji = {
                "USD": "🇺🇸",
                "JPY": "🇯🇵",
                "EUR": "🇪🇺",
                "CNY": "🇨🇳",
            }.get(currency, "💵")

            # 100엔 단위 표시
            unit = "(100)" if is_100 else ""
            lines.append(f"{emoji} {currency}{unit}: {value:,.2f}원")

        return "\n".join(lines)


if __name__ == "__main__":
    # 테스트
    api = ExchangeRateAPI()
    data = api.get_exchange_rates()
    print(f"조회 시간: {data['timestamp']}")
    print(f"기준일: {data['search_date']}")
    print()
    for rate in data["rates"]:
        unit = "(100)" if rate["is_100"] else ""
        print(f"{rate['currency']}{unit} ({rate['currency_name']}): {rate['rate']:,.2f}원")
    print()
    print("텔레그램 메시지:")
    print(api.format_for_telegram(data))
