"""
거래량 + 등락폭 교차 필터링 모듈
"""
from typing import Dict, List, Any


class StockFilter:
    """거래량과 등락률 데이터를 교차 필터링하여 상위 종목 추출"""

    def __init__(self):
        pass

    def _get_stock_codes(self, stocks: List[Dict[str, Any]]) -> set:
        """종목 리스트에서 코드 집합 추출"""
        return {stock["code"] for stock in stocks}

    def _filter_intersection(
        self,
        volume_stocks: List[Dict[str, Any]],
        fluctuation_stocks: List[Dict[str, Any]],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """거래량과 등락률 종목의 교집합 추출

        거래량 순위를 기준으로 정렬하되, 등락률 TOP30에도 포함된 종목만 선택

        Args:
            volume_stocks: 거래량 순위 종목 리스트
            fluctuation_stocks: 등락률 순위 종목 리스트
            limit: 최대 반환 개수

        Returns:
            교집합 종목 리스트 (거래량 순 정렬)
        """
        # 등락률 TOP30 종목 코드 집합
        fluctuation_codes = self._get_stock_codes(fluctuation_stocks)

        # 거래량 순위 기준으로 순회하며 교집합 추출
        result = []
        for stock in volume_stocks:
            if stock["code"] in fluctuation_codes:
                result.append(stock)
                if len(result) >= limit:
                    break

        # 순위 재계산
        for idx, stock in enumerate(result):
            stock["rank"] = idx + 1

        return result

    def filter_rising_stocks(
        self,
        volume_data: Dict[str, Any],
        fluctuation_data: Dict[str, Any],
        limit: int = 10,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """상승 종목 필터링: 거래량 TOP30 ∩ 상승률 TOP30

        Args:
            volume_data: get_top30_by_volume() 결과
            fluctuation_data: get_top30_by_fluctuation() 결과
            limit: 시장별 최대 종목 수

        Returns:
            {
                "kospi": [...],
                "kosdaq": [...]
            }
        """
        return {
            "kospi": self._filter_intersection(
                volume_data.get("kospi", []),
                fluctuation_data.get("kospi_up", []),
                limit,
            ),
            "kosdaq": self._filter_intersection(
                volume_data.get("kosdaq", []),
                fluctuation_data.get("kosdaq_up", []),
                limit,
            ),
        }

    def filter_falling_stocks(
        self,
        volume_data: Dict[str, Any],
        fluctuation_data: Dict[str, Any],
        limit: int = 10,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """하락 종목 필터링: 거래량 TOP30 ∩ 하락률 TOP30

        Args:
            volume_data: get_top30_by_volume() 결과
            fluctuation_data: get_top30_by_fluctuation() 결과
            limit: 시장별 최대 종목 수

        Returns:
            {
                "kospi": [...],
                "kosdaq": [...]
            }
        """
        return {
            "kospi": self._filter_intersection(
                volume_data.get("kospi", []),
                fluctuation_data.get("kospi_down", []),
                limit,
            ),
            "kosdaq": self._filter_intersection(
                volume_data.get("kosdaq", []),
                fluctuation_data.get("kosdaq_down", []),
                limit,
            ),
        }
