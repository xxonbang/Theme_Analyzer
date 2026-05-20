"""5/19 진단 재검증: UN vs J 일별 시세 stale 범위 (2026-05-20 ad-hoc).

목적: stock-history를 UN으로 마이그레이션 시 stale 범위 파악.
- 모든 종목에 대해 J/UN 양쪽 호출 → 첫 거래일 비교
- stale 기준: J 첫 거래일과 UN 첫 거래일의 차이 > 7 캘린더일

실행: python scripts/diag_un_vs_j_20260520.py [sample_size]
"""
import sys
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from modules.kis_client import KISClient

KST = "Asia/Seoul"
STOCK_HISTORY = ROOT / "frontend" / "public" / "data" / "stock-history.json"


def _parse_date(s: str) -> datetime | None:
    """YYYYMMDD 또는 YYYY-MM-DD → datetime."""
    if not s:
        return None
    s = s.replace("-", "")
    try:
        return datetime.strptime(s, "%Y%m%d")
    except ValueError:
        return None


def _latest_date(output) -> str | None:
    """KIS 응답 output 리스트에서 가장 최신 stck_bsop_date."""
    if not output:
        return None
    if isinstance(output, list):
        dates = [o.get("stck_bsop_date") for o in output if o.get("stck_bsop_date")]
        if not dates:
            return None
        return max(dates)
    return None


def probe_one(client: KISClient, code: str) -> dict:
    """한 종목에 대해 UN/J 양쪽 호출, 결과 비교."""
    result = {
        "code": code,
        "j_latest": None, "un_latest": None,
        "j_count": 0, "un_count": 0,
        "j_err": None, "un_err": None,
    }
    try:
        r = client.get_stock_daily_ohlcv(code, market_div="J")
        if r.get("rt_cd") == "0":
            out = r.get("output") or []
            result["j_count"] = len(out) if isinstance(out, list) else 0
            result["j_latest"] = _latest_date(out)
        else:
            result["j_err"] = r.get("msg1", "?")
    except Exception as e:
        result["j_err"] = str(e)[:80]
    try:
        r = client.get_stock_daily_ohlcv(code, market_div="UN")
        if r.get("rt_cd") == "0":
            out = r.get("output") or []
            result["un_count"] = len(out) if isinstance(out, list) else 0
            result["un_latest"] = _latest_date(out)
        else:
            result["un_err"] = r.get("msg1", "?")
    except Exception as e:
        result["un_err"] = str(e)[:80]
    return result


def main():
    history = json.loads(STOCK_HISTORY.read_text())
    codes = sorted(history.keys())
    sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else len(codes)
    if sample_size < len(codes):
        # 결정적 샘플: 균등 간격
        step = max(len(codes) // sample_size, 1)
        codes = codes[::step][:sample_size]

    print(f"[diag] {len(codes)} 종목 양쪽 호출 시작")
    today = datetime.now()
    cutoff = today - timedelta(days=7)
    cutoff_str = cutoff.strftime("%Y%m%d")

    client = KISClient()
    results = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(probe_one, client, c): c for c in codes}
        done = 0
        for f in as_completed(futures):
            r = f.result()
            results.append(r)
            done += 1
            if done % 20 == 0:
                print(f"  진행 {done}/{len(codes)}")

    # 분류
    both_ok = []          # J fresh + UN fresh
    un_stale = []         # J fresh + UN stale (UN에 데이터 있긴 함)
    un_empty = []         # J fresh + UN 빈 응답 (NXT 미상장 추정)
    j_stale = []          # 매우 드문 케이스 (UN fresh + J stale)
    both_stale = []
    err = []              # J 자체 실패

    for r in results:
        if r["j_err"]:
            err.append(r)
            continue
        if r["j_count"] == 0:
            err.append(r)
            continue
        j_d = _parse_date(r["j_latest"])
        if not j_d:
            err.append(r)
            continue
        j_fresh = j_d >= cutoff

        # UN 응답이 빈 리스트면 별도 분류
        if r["un_count"] == 0:
            if j_fresh:
                un_empty.append(r)
            else:
                both_stale.append(r)
            continue

        un_d = _parse_date(r["un_latest"])
        if not un_d:
            err.append(r)
            continue
        un_fresh = un_d >= cutoff
        if j_fresh and un_fresh:
            both_ok.append(r)
        elif j_fresh and not un_fresh:
            un_stale.append(r)
        elif un_fresh and not j_fresh:
            j_stale.append(r)
        else:
            both_stale.append(r)

    print()
    print("=" * 60)
    print(f"진단 결과 (cutoff={cutoff_str}, 즉 7일 이내가 fresh)")
    print("=" * 60)
    print(f"  양쪽 fresh:                  {len(both_ok)}")
    print(f"  🔴 J fresh + UN stale:        {len(un_stale)}  (UN에 옛 데이터 잔존)")
    print(f"  🔴 J fresh + UN 빈 응답:      {len(un_empty)}  (NXT 미상장 추정)")
    print(f"  J stale + UN fresh:           {len(j_stale)}")
    print(f"  양쪽 stale/빈:                {len(both_stale)}")
    print(f"  에러(J 자체 실패):            {len(err)}")
    print()
    risk = len(un_stale) + len(un_empty)
    pct = risk / len(codes) * 100 if codes else 0
    print(f"  ▶ UN 마이그레이션 위험 종목: {risk}/{len(codes)} ({pct:.1f}%) — J 폴백 필요")
    print()
    if un_stale:
        print("[UN stale 종목 (옛 데이터 잔존)]")
        for r in un_stale[:20]:
            print(f"  {r['code']}: J={r['j_latest']} UN={r['un_latest']}")
        if len(un_stale) > 20:
            print(f"  ...외 {len(un_stale) - 20}건")
        print()
    if un_empty:
        print("[UN 빈 응답 종목 (NXT 미상장)]")
        for r in un_empty[:20]:
            print(f"  {r['code']}: J={r['j_latest']} UN=∅")
        if len(un_empty) > 20:
            print(f"  ...외 {len(un_empty) - 20}건")
        print()
    if err:
        print("[에러 종목]")
        for r in err[:10]:
            print(f"  {r['code']}: j_err={r['j_err']} j_count={r['j_count']}")

    # JSON 출력
    out_path = ROOT / "docs" / "research" / f"2026-05-20-un-stale-diag.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "total": len(codes),
        "both_ok": len(both_ok),
        "un_stale_count": len(un_stale),
        "un_stale_codes": [r["code"] for r in un_stale],
        "un_empty_count": len(un_empty),
        "un_empty_codes": [r["code"] for r in un_empty],
        "j_stale_count": len(j_stale),
        "both_stale_count": len(both_stale),
        "err_count": len(err),
        "details": results,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[saved] {out_path}")


if __name__ == "__main__":
    main()
