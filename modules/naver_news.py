"""
네이버 검색 API를 활용한 종목별 뉴스 수집 모듈
- Rate limit 대응 (429 에러 시 재시도)
"""
import requests
import re
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from html import unescape

from config.settings import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET


class NaverNewsAPI:
    """네이버 검색 API를 통한 뉴스 수집"""

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        request_delay: float = 0.1,
        max_retries: int = 3,
    ):
        """
        Args:
            client_id: 네이버 API 클라이언트 ID
            client_secret: 네이버 API 클라이언트 시크릿
            request_delay: 요청 간 딜레이 (초)
            max_retries: 최대 재시도 횟수
        """
        self.client_id = client_id or NAVER_CLIENT_ID
        self.client_secret = client_secret or NAVER_CLIENT_SECRET
        self.api_url = "https://openapi.naver.com/v1/search/news.json"
        self.request_delay = request_delay
        self.max_retries = max_retries
        self._last_request_time = 0

    def _wait_for_rate_limit(self):
        """Rate limit 대응을 위한 딜레이"""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        self._last_request_time = time.time()

    def _clean_html(self, text: str) -> str:
        """HTML 태그 및 특수문자 제거"""
        if not text:
            return ""
        # HTML 엔티티 디코딩
        text = unescape(text)
        # HTML 태그 제거
        text = re.sub(r'<[^>]+>', '', text)
        # 연속 공백 제거
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _parse_date(self, date_str: str) -> str:
        """날짜 문자열 파싱 (예: "Mon, 31 Jan 2026 10:30:00 +0900" -> "01-31 10:30")"""
        try:
            dt = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %z")
            return dt.strftime("%m-%d %H:%M")
        except:
            return date_str[:16] if date_str else ""

    def search_news(
        self,
        query: str,
        display: int = 3,
        sort: str = "date",
    ) -> List[Dict[str, Any]]:
        """뉴스 검색 (Rate limit 대응 포함)

        Args:
            query: 검색어 (종목명)
            display: 검색 결과 개수 (최대 100)
            sort: 정렬 방식 (date: 최신순, sim: 정확도순)

        Returns:
            뉴스 리스트 [{"title": ..., "link": ..., "description": ..., "pubDate": ...}, ...]
        """
        if not self.client_id or not self.client_secret:
            print("[WARN] 네이버 API 설정이 없습니다.")
            return []

        headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret,
        }

        params = {
            "query": query,
            "display": display,
            "start": 1,
            "sort": sort,
        }

        # 재시도 로직 (exponential backoff)
        for attempt in range(self.max_retries):
            try:
                # Rate limit 대응 딜레이
                self._wait_for_rate_limit()

                response = requests.get(
                    self.api_url,
                    headers=headers,
                    params=params,
                    timeout=10,
                )

                # 성공
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])

                    # 결과 정리
                    news_list = []
                    for item in items:
                        news_list.append({
                            "title": self._clean_html(item.get("title", "")),
                            "link": item.get("link", ""),
                            "description": self._clean_html(item.get("description", "")),
                            "pubDate": self._parse_date(item.get("pubDate", "")),
                            "originallink": item.get("originallink", ""),
                        })

                    return news_list

                # Rate limit (429) - 재시도
                elif response.status_code == 429:
                    wait_time = (2 ** attempt) * 0.5  # 0.5초, 1초, 2초
                    if attempt < self.max_retries - 1:
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"[WARN] Rate limit 초과 ({query}): 최대 재시도 횟수 도달")
                        return []

                # 기타 에러
                else:
                    print(f"[ERROR] 네이버 API 오류: {response.status_code} ({query})")
                    return []

            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    time.sleep(1)
                    continue
                print(f"[ERROR] 요청 타임아웃 ({query})")
                return []

            except Exception as e:
                print(f"[ERROR] 뉴스 검색 실패 ({query}): {e}")
                return []

        return []

    def get_stock_news(
        self,
        stock_name: str,
        count: int = 3,
    ) -> List[Dict[str, Any]]:
        """종목명으로 뉴스 검색

        Args:
            stock_name: 종목명 (예: "삼성전자")
            count: 뉴스 개수

        Returns:
            뉴스 리스트
        """
        # 종목명 + "주식" 키워드 추가하여 관련성 높이기
        return self.search_news(f"{stock_name} 주식", display=count, sort="date")

    def get_multiple_stocks_news(
        self,
        stocks: List[Dict[str, Any]],
        news_count: int = 3,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """여러 종목의 뉴스 일괄 수집

        Args:
            stocks: 종목 리스트 [{"code": ..., "name": ...}, ...]
            news_count: 종목당 뉴스 개수

        Returns:
            {종목코드: {"name": 종목명, "news": [뉴스리스트]}, ...}
        """
        result = {}
        total = len(stocks)

        for idx, stock in enumerate(stocks, 1):
            code = stock.get("code", "")
            name = stock.get("name", "")

            if not name:
                continue

            news = self.get_stock_news(name, count=news_count)
            result[code] = {
                "name": name,
                "news": news,
            }

            # 진행 상황 표시 (10개마다)
            if idx % 10 == 0:
                print(f"    뉴스 수집 중... ({idx}/{total})")

        return result
