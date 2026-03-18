"""DART 전자공시 API 클라이언트

최근 공시 목록 조회 및 관련 종목 매핑 기능을 제공합니다.
DART_API_KEY 환경변수가 필요합니다.
"""
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from modules.utils import KST


class DartClient:
    """DART OpenAPI 클라이언트"""

    BASE_URL = "https://opendart.fss.or.kr/api"

    def __init__(self):
        self.api_key = os.environ.get("DART_API_KEY", "")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_recent_disclosures(
        self,
        bgn_de: Optional[str] = None,
        end_de: Optional[str] = None,
        page_count: int = 20,
    ) -> List[Dict]:
        """최근 공시 목록 조회

        Args:
            bgn_de: 시작일 (YYYYMMDD), 기본 오늘
            end_de: 종료일 (YYYYMMDD), 기본 오늘
            page_count: 페이지당 건수

        Returns:
            공시 목록 리스트
        """
        if not self.is_available():
            return []

        now = datetime.now(KST)
        if bgn_de is None:
            bgn_de = now.strftime("%Y%m%d")
        if end_de is None:
            end_de = now.strftime("%Y%m%d")

        params = {
            "crtfc_key": self.api_key,
            "bgn_de": bgn_de,
            "end_de": end_de,
            "page_count": page_count,
            "sort": "date",
            "sort_mth": "desc",
        }

        try:
            resp = requests.get(
                f"{self.BASE_URL}/list.json", params=params, timeout=10
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "000":
                return []

            return data.get("list", [])
        except Exception as e:
            print(f"[DART] 공시 조회 실패: {e}")
            return []

    def map_stock_codes(
        self, disclosures: List[Dict], stock_code_map: Dict[str, str]
    ) -> List[Dict]:
        """공시 목록에서 관련 종목 매핑

        Args:
            disclosures: DART 공시 목록
            stock_code_map: {종목코드: 종목명} 매핑

        Returns:
            종목코드가 매핑된 공시 목록
        """
        result = []
        # DART corp_code → stock_code 매핑은 별도 API 필요
        # 여기서는 corp_name 기반 매핑 (간단 버전)
        name_to_code = {v: k for k, v in stock_code_map.items()}

        for d in disclosures:
            corp_name = d.get("corp_name", "")
            stock_code = d.get("stock_code", "")
            matched_code = stock_code if stock_code else name_to_code.get(corp_name)
            entry = {
                "corp_name": corp_name,
                "report_nm": d.get("report_nm", ""),
                "rcept_dt": d.get("rcept_dt", ""),
                "stock_code": matched_code,
                "rcept_no": d.get("rcept_no", ""),
            }
            result.append(entry)

        return result
