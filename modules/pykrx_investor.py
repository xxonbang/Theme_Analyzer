"""pykrx 기반 투자자별 매매동향 일괄 수집 모듈

장후(18:00 이후) KRX 확정 데이터를 종목별로 일괄 수집한다.
KIS API 대비 투자자 세분화(연기금/금융투자/보험/투신/사모 등) 제공.
"""

from typing import Dict, List, Optional
from datetime import datetime


def _get_kst_now() -> datetime:
    """KST 현재 시각"""
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Asia/Seoul"))


def is_pykrx_available() -> bool:
    """pykrx 데이터 가용 여부 (18:00 이후)"""
    now = _get_kst_now()
    return now.hour >= 18


def get_investor_data_bulk(date: str, stock_codes: List[str]) -> Dict[str, Dict]:
    """pykrx로 종목별 투자자 매매동향 일괄 수집

    Args:
        date: 조회일 (YYYYMMDD)
        stock_codes: 종목코드 리스트

    Returns:
        {code: {foreign_net, institution_net, individual_net,
                pension_net, financial_inv_net, insurance_net,
                trust_net, private_net, bank_net}, ...}
    """
    from pykrx import stock

    result = {}
    failed = 0

    for code in stock_codes:
        try:
            df = stock.get_market_trading_value_by_date(date, date, code, detail=True)
            if df.empty:
                continue

            row = df.iloc[0]

            result[code] = {
                "foreign_net": int(row.get("외국인합계", 0)),
                "institution_net": int(row.get("기관합계", 0)),
                "individual_net": int(row.get("개인", 0)),
                "pension_net": int(row.get("연기금", 0)),
                "financial_inv_net": int(row.get("금융투자", 0)),
                "insurance_net": int(row.get("보험", 0)),
                "trust_net": int(row.get("투신", 0)),
                "private_net": int(row.get("사모", 0)),
                "bank_net": int(row.get("은행", 0)),
            }

        except Exception:
            failed += 1
            continue

    if failed > 0:
        print(f"  pykrx: {len(result)}개 성공, {failed}개 실패")
    else:
        print(f"  pykrx: {len(result)}개 수집 완료")

    return result


def extract_detail(pykrx_entry: Dict) -> Optional[Dict]:
    """pykrx 데이터에서 세분화 detail dict 추출"""
    detail_keys = {
        "pension_net", "financial_inv_net", "insurance_net",
        "trust_net", "private_net", "bank_net",
    }
    detail = {k: pykrx_entry[k] for k in detail_keys if k in pykrx_entry}
    # 모두 0이면 None
    if all(v == 0 for v in detail.values()):
        return None
    return detail
