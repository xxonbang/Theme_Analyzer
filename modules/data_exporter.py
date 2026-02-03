"""
프론트엔드용 JSON 데이터 내보내기 모듈
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Any

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))

# 프로젝트 루트 경로
ROOT_DIR = Path(__file__).parent.parent


def export_for_frontend(
    rising_stocks: Dict[str, List[Dict[str, Any]]],
    falling_stocks: Dict[str, List[Dict[str, Any]]],
    history_data: Dict[str, Dict[str, Any]],
    news_data: Dict[str, Dict[str, Any]],
    exchange_data: Dict[str, Any] = None,
    output_dir: str = "frontend/public/data",
) -> str:
    """프론트엔드용 JSON 데이터 내보내기

    Args:
        rising_stocks: 상승 종목 {"kospi": [...], "kosdaq": [...]}
        falling_stocks: 하락 종목 {"kospi": [...], "kosdaq": [...]}
        history_data: 3일간 등락률 데이터
        news_data: 뉴스 데이터
        exchange_data: 환율 데이터
        output_dir: 출력 디렉토리

    Returns:
        저장된 파일 경로
    """
    output_path = ROOT_DIR / output_dir
    output_path.mkdir(parents=True, exist_ok=True)

    # 데이터 구조화
    data = {
        "timestamp": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "exchange": exchange_data or {},
        "rising": {
            "kospi": rising_stocks.get("kospi", []),
            "kosdaq": rising_stocks.get("kosdaq", []),
        },
        "falling": {
            "kospi": falling_stocks.get("kospi", []),
            "kosdaq": falling_stocks.get("kosdaq", []),
        },
        "history": history_data,
        "news": news_data,
    }

    # JSON 파일 저장
    file_path = output_path / "latest.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return str(file_path)
