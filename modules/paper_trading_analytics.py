"""모의투자 누적 성과 분석 모듈

paper-trading 일별 데이터를 읽어 누적 수익률, 승률,
테마별/시장별 성과 등 분석 지표를 산출합니다.
"""
import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from modules.utils import KST

ROOT_DIR = Path(__file__).parent.parent
PAPER_TRADING_DIR = ROOT_DIR / "frontend" / "public" / "data" / "paper-trading"
DATA_DIR = ROOT_DIR / "frontend" / "public" / "data"


def _load_all_daily_files() -> List[Dict[str, Any]]:
    """전체 일별 paper-trading JSON 로드 (날짜순 정렬)"""
    if not PAPER_TRADING_DIR.exists():
        return []

    files = sorted(PAPER_TRADING_DIR.glob("*.json"))
    data = []
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fp:
                d = json.load(fp)
            if d.get("stocks") and d.get("summary"):
                data.append(d)
        except (json.JSONDecodeError, KeyError):
            continue
    return data


def generate_analytics() -> Dict[str, Any]:
    """전체 분석 지표 산출"""
    daily_data = _load_all_daily_files()
    if not daily_data:
        return {}

    # === 일별 수익률 시계열 ===
    daily_returns = []  # {"date": ..., "profit_rate": ..., "stock_count": ...}
    for d in daily_data:
        daily_returns.append({
            "date": d["trade_date"],
            "profit_rate": d["summary"]["total_profit_rate"],
            "high_profit_rate": d["summary"].get("high_total_profit_rate", 0),
            "stock_count": d["summary"]["total_stocks"],
        })

    rates = [r["profit_rate"] for r in daily_returns]
    high_rates = [r["high_profit_rate"] for r in daily_returns]
    total_days = len(rates)

    # === 핵심 지표 ===
    # 누적 수익률 (복리)
    cumulative = 1.0
    cumulative_high = 1.0
    peak = 1.0
    max_drawdown = 0.0
    cumulative_series = []

    for r in daily_returns:
        cumulative *= (1 + r["profit_rate"] / 100)
        cumulative_high *= (1 + r["high_profit_rate"] / 100)
        if cumulative > peak:
            peak = cumulative
        dd = (peak - cumulative) / peak * 100
        if dd > max_drawdown:
            max_drawdown = dd
        cumulative_series.append({
            "date": r["date"],
            "cumulative_return": round((cumulative - 1) * 100, 2),
        })

    cumulative_return = round((cumulative - 1) * 100, 2)
    cumulative_high_return = round((cumulative_high - 1) * 100, 2)

    # 승률
    win_days = sum(1 for r in rates if r > 0)
    loss_days = sum(1 for r in rates if r < 0)
    flat_days = total_days - win_days - loss_days
    win_rate = round(win_days / total_days * 100, 1) if total_days > 0 else 0

    # 평균 수익/손실
    avg_return = round(sum(rates) / total_days, 2) if total_days > 0 else 0
    avg_win = round(sum(r for r in rates if r > 0) / win_days, 2) if win_days > 0 else 0
    avg_loss = round(sum(r for r in rates if r < 0) / loss_days, 2) if loss_days > 0 else 0

    # 손익비 (avg_win / |avg_loss|)
    profit_loss_ratio = round(avg_win / abs(avg_loss), 2) if avg_loss != 0 else 0

    # 연속 승/패 기록
    max_win_streak = 0
    max_loss_streak = 0
    cur_win = 0
    cur_loss = 0
    for r in rates:
        if r > 0:
            cur_win += 1
            cur_loss = 0
        elif r < 0:
            cur_loss += 1
            cur_win = 0
        else:
            cur_win = 0
            cur_loss = 0
        max_win_streak = max(max_win_streak, cur_win)
        max_loss_streak = max(max_loss_streak, cur_loss)

    # 변동성 (일간 수익률 표준편차)
    if total_days >= 2:
        mean = sum(rates) / total_days
        variance = sum((r - mean) ** 2 for r in rates) / (total_days - 1)
        volatility = round(math.sqrt(variance), 2)
    else:
        volatility = 0

    # 샤프비율 근사 (무위험수익률 = 연 3.5% → 일 0.014%)
    risk_free_daily = 0.014
    if volatility > 0:
        sharpe = round((avg_return - risk_free_daily) / volatility, 2)
    else:
        sharpe = 0

    # === 테마별 성과 ===
    theme_stats = defaultdict(lambda: {"count": 0, "win": 0, "total_return": 0.0, "returns": []})
    market_stats = defaultdict(lambda: {"count": 0, "win": 0, "total_return": 0.0})

    for d in daily_data:
        for stock in d.get("stocks", []):
            theme = stock.get("theme", "기타")
            market = stock.get("market", "N/A")
            pr = stock.get("profit_rate", 0)

            theme_stats[theme]["count"] += 1
            theme_stats[theme]["total_return"] += pr
            theme_stats[theme]["returns"].append(pr)
            if pr > 0:
                theme_stats[theme]["win"] += 1

            market_stats[market]["count"] += 1
            market_stats[market]["total_return"] += pr
            if pr > 0:
                market_stats[market]["win"] += 1

    # 테마별 정리 (거래 횟수 5회 이상만)
    theme_performance = []
    for theme, st in theme_stats.items():
        if st["count"] < 3:
            continue
        avg = round(st["total_return"] / st["count"], 2)
        wr = round(st["win"] / st["count"] * 100, 1)
        theme_performance.append({
            "theme": theme,
            "count": st["count"],
            "win_rate": wr,
            "avg_return": avg,
            "total_return": round(st["total_return"], 2),
        })
    theme_performance.sort(key=lambda x: x["avg_return"], reverse=True)

    # 시장별 정리
    market_performance = []
    for market, st in market_stats.items():
        avg = round(st["total_return"] / st["count"], 2)
        wr = round(st["win"] / st["count"] * 100, 1)
        market_performance.append({
            "market": market,
            "count": st["count"],
            "win_rate": wr,
            "avg_return": avg,
        })
    market_performance.sort(key=lambda x: x["avg_return"], reverse=True)

    # === 최근 5일 vs 전체 비교 ===
    recent_5 = rates[-5:] if len(rates) >= 5 else rates
    recent_5_avg = round(sum(recent_5) / len(recent_5), 2) if recent_5 else 0
    recent_5_win = sum(1 for r in recent_5 if r > 0)
    recent_5_win_rate = round(recent_5_win / len(recent_5) * 100, 1) if recent_5 else 0

    result = {
        "generated_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "period": {
            "start": daily_returns[0]["date"],
            "end": daily_returns[-1]["date"],
            "trading_days": total_days,
        },
        "overall": {
            "cumulative_return": cumulative_return,
            "cumulative_high_return": cumulative_high_return,
            "avg_daily_return": avg_return,
            "volatility": volatility,
            "sharpe_ratio": sharpe,
            "max_drawdown": round(max_drawdown, 2),
            "win_rate": win_rate,
            "win_days": win_days,
            "loss_days": loss_days,
            "flat_days": flat_days,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "profit_loss_ratio": profit_loss_ratio,
            "max_win_streak": max_win_streak,
            "max_loss_streak": max_loss_streak,
            "best_day": {"date": daily_returns[rates.index(max(rates))]["date"], "return": max(rates)},
            "worst_day": {"date": daily_returns[rates.index(min(rates))]["date"], "return": min(rates)},
        },
        "recent_5d": {
            "avg_return": recent_5_avg,
            "win_rate": recent_5_win_rate,
        },
        "theme_performance": theme_performance,
        "market_performance": market_performance,
        "cumulative_series": cumulative_series,
    }

    return result


def save_analytics() -> str:
    """분석 결과를 JSON 파일로 저장"""
    analytics = generate_analytics()
    if not analytics:
        print("[분석] paper-trading 데이터가 없습니다.")
        return ""

    output_path = DATA_DIR / "paper-trading-analytics.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(analytics, f, ensure_ascii=False, indent=2)

    # 요약 출력
    o = analytics["overall"]
    p = analytics["period"]
    print(f"\n[모의투자 성과 분석] {p['start']} ~ {p['end']} ({p['trading_days']}일)")
    print(f"  누적 수익률: {o['cumulative_return']:+.2f}%")
    print(f"  최고가 기준: {o['cumulative_high_return']:+.2f}%")
    print(f"  승률: {o['win_rate']}% ({o['win_days']}승 {o['loss_days']}패)")
    print(f"  평균 수익: {o['avg_daily_return']:+.2f}%/일")
    print(f"  손익비: {o['profit_loss_ratio']} (평균 수익 {o['avg_win']:+.2f}% / 평균 손실 {o['avg_loss']:.2f}%)")
    print(f"  최대 낙폭(MDD): {o['max_drawdown']:.2f}%")
    print(f"  샤프비율: {o['sharpe_ratio']}")
    print(f"  변동성: {o['volatility']}%")
    print(f"  최대 연승: {o['max_win_streak']}일 / 최대 연패: {o['max_loss_streak']}일")
    print(f"  최고일: {o['best_day']['date']} ({o['best_day']['return']:+.2f}%)")
    print(f"  최악일: {o['worst_day']['date']} ({o['worst_day']['return']:+.2f}%)")

    # 테마 TOP3
    themes = analytics.get("theme_performance", [])
    if themes:
        print(f"\n  [테마별 성과 TOP3]")
        for t in themes[:3]:
            print(f"    {t['theme']}: 평균 {t['avg_return']:+.2f}% (승률 {t['win_rate']}%, {t['count']}건)")
        if len(themes) > 3:
            worst = themes[-1]
            print(f"    (최하위) {worst['theme']}: 평균 {worst['avg_return']:+.2f}% (승률 {worst['win_rate']}%, {worst['count']}건)")

    return str(output_path)
