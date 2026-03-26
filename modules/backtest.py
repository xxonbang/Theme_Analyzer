"""예측 백테스팅 모듈

Supabase의 theme_predictions에서 active 예측을 조회하고,
실제 주가 수익률을 비교하여 적중 여부를 판정합니다.
"""
import json
from datetime import datetime, timedelta
from typing import Dict, List

from modules.utils import KST
from modules.market_hours import KRX_HOLIDAYS_2026


def get_active_predictions(client) -> List[Dict]:
    """Supabase에서 status='active' 예측 조회"""
    response = client.table("theme_predictions").select("*").eq(
        "status", "active"
    ).execute()
    return response.data or []


def _date_to_kis(date_str: str) -> str:
    """YYYY-MM-DD → YYYYMMDD 변환"""
    return date_str.replace("-", "")


def fetch_stock_returns(kis_client, codes: List[str], start: str, end: str) -> Dict:
    """KIS API로 한국 주식 기간 수익률 조회

    Args:
        kis_client: KISClient 인스턴스
        codes: 종목코드 리스트 (예: ["005930", "000660"])
        start: 시작일 YYYY-MM-DD
        end: 종료일 YYYY-MM-DD

    Returns:
        {code: return_pct} 딕셔너리
    """
    returns = {}
    missing_codes = []

    for code in codes:
        try:
            result = kis_client.get_stock_daily_price(
                code, start_date=_date_to_kis(start), end_date=_date_to_kis(end)
            )
            if result.get("rt_cd") != "0":
                missing_codes.append(code)
                continue

            output2 = result.get("output2", [])
            if len(output2) < 2:
                missing_codes.append(code)
                continue

            # output2는 최신순 정렬 → 마지막 항목이 가장 오래된 날
            last_price = int(output2[0].get("stck_clpr", 0))
            first_price = int(output2[-1].get("stck_clpr", 0))
            if first_price > 0:
                returns[code] = round(((last_price - first_price) / first_price) * 100, 2)
            else:
                missing_codes.append(code)
        except Exception:
            missing_codes.append(code)

    if missing_codes:
        print(f"  ⚠ 데이터 미확보 종목 ({len(missing_codes)}건): {', '.join(missing_codes)}")

    return returns


def fetch_index_return(kis_client, start: str, end: str) -> float:
    """KIS API로 KOSPI 지수 기간 수익률 조회"""
    try:
        result = kis_client.get_index_daily_price(
            "0001", start_date=_date_to_kis(start), end_date=_date_to_kis(end)
        )
        if result.get("rt_cd") != "0":
            return 0.0

        output2 = result.get("output2", [])
        if len(output2) < 2:
            return 0.0

        # output2는 최신순 정렬
        last_val = float(output2[0].get("bstp_nmix_prpr", 0))
        first_val = float(output2[-1].get("bstp_nmix_prpr", 0))
        if first_val > 0:
            return round(((last_val - first_val) / first_val) * 100, 2)
    except Exception:
        pass
    return 0.0


def fetch_daily_returns(kis_client, codes: List[str], target_date: str) -> Dict:
    """KIS API로 특정 일자의 일간 수익률 조회 (전일 종가 대비 당일 종가)

    today 카테고리 전용.

    Args:
        kis_client: KISClient 인스턴스
        codes: 종목코드 리스트 (예: ["005930"])
        target_date: 대상일 YYYY-MM-DD

    Returns:
        {code: return_pct} 딕셔너리
    """
    dt = datetime.strptime(target_date, "%Y-%m-%d")
    start = (dt - timedelta(days=10)).strftime("%Y%m%d")
    end = _date_to_kis(target_date)

    returns = {}
    missing_codes = []
    for code in codes:
        try:
            result = kis_client.get_stock_daily_price(
                code, start_date=start, end_date=end
            )
            if result.get("rt_cd") != "0":
                missing_codes.append(code)
                continue

            output2 = result.get("output2", [])
            if len(output2) < 2:
                missing_codes.append(code)
                continue

            # output2는 최신순 정렬 → target_date 행 찾기
            target_idx = None
            for i, row in enumerate(output2):
                if row.get("stck_bsop_date") == end:
                    target_idx = i
                    break

            if target_idx is None or target_idx + 1 >= len(output2):
                missing_codes.append(code)
                continue

            cur_price = int(output2[target_idx].get("stck_clpr", 0))
            prev_price = int(output2[target_idx + 1].get("stck_clpr", 0))
            if prev_price > 0:
                returns[code] = round(((cur_price - prev_price) / prev_price) * 100, 2)
            else:
                missing_codes.append(code)
        except Exception:
            missing_codes.append(code)

    if missing_codes:
        print(f"  ⚠ 일간수익률 미확보 ({target_date}, {len(missing_codes)}건): {', '.join(missing_codes)}")

    return returns


def fetch_daily_index_return(kis_client, target_date: str) -> float:
    """KIS API로 특정 일자의 KOSPI 일간 수익률 (전일 종가 대비 당일 종가)"""
    dt = datetime.strptime(target_date, "%Y-%m-%d")
    start = (dt - timedelta(days=10)).strftime("%Y%m%d")
    end = _date_to_kis(target_date)

    try:
        result = kis_client.get_index_daily_price(
            "0001", start_date=start, end_date=end
        )
        if result.get("rt_cd") != "0":
            return 0.0

        output2 = result.get("output2", [])
        if len(output2) < 2:
            return 0.0

        # output2는 최신순 정렬 → target_date 행 찾기
        target_idx = None
        for i, row in enumerate(output2):
            if row.get("stck_bsop_date") == end:
                target_idx = i
                break

        if target_idx is None or target_idx + 1 >= len(output2):
            print(f"  ⚠ KOSPI 지수 {target_date} 데이터 미존재")
            return 0.0

        cur_val = float(output2[target_idx].get("bstp_nmix_prpr", 0))
        prev_val = float(output2[target_idx + 1].get("bstp_nmix_prpr", 0))
        if prev_val > 0:
            return round(((cur_val - prev_val) / prev_val) * 100, 2)
    except Exception:
        pass
    return 0.0


def evaluate_prediction(prediction: Dict, returns: Dict, index_return: float, *, force: bool = False) -> str:
    """단일 예측 평가

    hit 기준: 수익률 확인 가능한 대장주 중 과반수가 절대 수익률 +2% 이상
    (1개만 확인 가능한 경우 해당 종목 기준 판정)

    Args:
        force: True이면 시간 제한 무시 (재평가용)
    """
    category = prediction.get("category", "today")
    prediction_date = prediction.get("prediction_date", "")

    if not prediction_date:
        return "active"

    if not force:
        pred_date = datetime.strptime(prediction_date, "%Y-%m-%d")
        now = datetime.now(KST).replace(tzinfo=None)

        # 카테고리별 평가 시점 판정
        if category == "today":
            # today: 당일 18:00(장 마감 후) 이후 즉시 평가 가능
            market_close = pred_date.replace(hour=18, minute=0, second=0)
            if now < market_close:
                return "active"
        else:
            # short_term/long_term: 영업일 기준 경과일 계산 (주말 + 공휴일 제외)
            days_elapsed = 0
            d = pred_date + timedelta(days=1)
            while d <= now:
                if d.weekday() < 5 and d.strftime("%Y-%m-%d") not in KRX_HOLIDAYS_2026:
                    days_elapsed += 1
                d += timedelta(days=1)

            max_days = {"short_term": 7, "long_term": 30}.get(category, 7)
            if days_elapsed < max_days:
                return "active"

    # 대장주 수익률 확인
    leader_stocks = prediction.get("leader_stocks", "[]")
    if isinstance(leader_stocks, str):
        try:
            leader_stocks = json.loads(leader_stocks)
        except json.JSONDecodeError:
            leader_stocks = []

    stock_codes = [s.get("code", "") for s in leader_stocks if s.get("code")]
    if not stock_codes:
        return "expired"

    # 수익률 데이터가 있는 종목만 평가
    evaluated = []
    for code in stock_codes:
        stock_return = returns.get(code)
        if stock_return is not None:
            evaluated.append(stock_return >= 2.0)

    # 평가 가능 종목이 없으면 expired
    if not evaluated:
        return "expired"

    # 과반수가 절대 수익률 +2% 이상이면 hit
    hit_count = sum(1 for is_hit in evaluated if is_hit)
    threshold = max(1, (len(evaluated) + 1) // 2)  # 과반수 (1개면 1, 2개면 1, 3개면 2)
    if hit_count >= threshold:
        return "hit"

    return "missed"


def update_prediction_status(client, pred_id: int, status: str, performance: Dict):
    """Supabase status + actual_performance 업데이트"""
    update_data = {
        "status": status,
        "evaluated_at": datetime.now(KST).isoformat(),
        "actual_performance": json.dumps(performance, ensure_ascii=False),
    }
    client.table("theme_predictions").update(update_data).eq("id", pred_id).execute()


def calculate_accuracy_report(client) -> Dict:
    """신뢰도별/카테고리별 적중률 집계"""
    response = client.table("theme_predictions").select("*").in_(
        "status", ["hit", "missed"]
    ).execute()

    data = response.data or []
    if not data:
        return {"total": 0, "hit": 0, "accuracy": 0.0, "by_confidence": {}, "by_category": {}}

    total = len(data)
    hits = sum(1 for d in data if d.get("status") == "hit")

    by_confidence = {}
    by_category = {}

    for d in data:
        confidence = d.get("confidence", "N/A")
        category = d.get("category", "N/A")
        is_hit = d.get("status") == "hit"

        for group, key in [(by_confidence, confidence), (by_category, category)]:
            if key not in group:
                group[key] = {"total": 0, "hit": 0}
            group[key]["total"] += 1
            if is_hit:
                group[key]["hit"] += 1

    for group in [by_confidence, by_category]:
        for v in group.values():
            v["accuracy"] = round(v["hit"] / v["total"] * 100, 1) if v["total"] else 0.0

    return {
        "total": total,
        "hit": hits,
        "accuracy": round(hits / total * 100, 1) if total else 0.0,
        "by_confidence": by_confidence,
        "by_category": by_category,
    }


def calculate_theme_accuracy(client, limit: int = 30) -> Dict:
    """테마별 적중률 + priority별 적중률 집계 (최근 limit건)

    Returns:
        {
            "by_theme": {"AI/반도체": {"total": 5, "hit": 3, "accuracy": 60.0}, ...},
            "by_priority": {1: {"total": 10, "hit": 7, "accuracy": 70.0}, ...},
            "recent_failures": [{"theme": "2차전지", "missed": 3, "total": 5}, ...]
        }
    """
    response = client.table("theme_predictions").select(
        "theme_name, status, leader_stocks"
    ).in_(
        "status", ["hit", "missed"]
    ).order("prediction_date", desc=True).limit(limit).execute()

    data = response.data or []
    if not data:
        return {"by_theme": {}, "by_priority": {}, "recent_failures": []}

    by_theme: Dict[str, Dict] = {}
    by_priority: Dict[int, Dict] = {1: {"total": 0, "hit": 0}, 2: {"total": 0, "hit": 0}, 3: {"total": 0, "hit": 0}}

    for d in data:
        theme = d.get("theme_name", "N/A")
        is_hit = d.get("status") == "hit"

        # 테마별 집계
        if theme not in by_theme:
            by_theme[theme] = {"total": 0, "hit": 0, "missed": 0}
        by_theme[theme]["total"] += 1
        if is_hit:
            by_theme[theme]["hit"] += 1
        else:
            by_theme[theme]["missed"] += 1

        # priority별 집계 (leader_stocks JSON에서 추출)
        leader_stocks = d.get("leader_stocks", "[]")
        if isinstance(leader_stocks, str):
            try:
                leader_stocks = json.loads(leader_stocks)
            except (json.JSONDecodeError, TypeError):
                leader_stocks = []
        for stock in leader_stocks:
            p = stock.get("priority", 3)
            if p in by_priority:
                by_priority[p]["total"] += 1
                if is_hit:
                    by_priority[p]["hit"] += 1

    # 적중률 계산
    for v in by_theme.values():
        v["accuracy"] = round(v["hit"] / v["total"] * 100, 1) if v["total"] else 0.0
    for v in by_priority.values():
        v["accuracy"] = round(v["hit"] / v["total"] * 100, 1) if v["total"] else 0.0

    # 최근 실패 테마 (missed > hit인 테마, missed 내림차순)
    recent_failures = [
        {"theme": t, "missed": v["missed"], "total": v["total"], "accuracy": v["accuracy"]}
        for t, v in by_theme.items()
        if v["missed"] > v["hit"] and v["total"] >= 2
    ]
    recent_failures.sort(key=lambda x: x["missed"], reverse=True)

    return {
        "by_theme": by_theme,
        "by_priority": by_priority,
        "recent_failures": recent_failures[:5],
    }
