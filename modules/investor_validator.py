"""KIS vs pykrx 투자자 수급 데이터 교차검증 모듈

두 소스의 외국인/기관 순매수를 비교하여 불일치를 감지한다.
로깅 전용 — 데이터 덮어쓰기는 하지 않는다.
"""

from typing import Dict, List, Tuple


def cross_validate(
    kis_data: Dict[str, Dict],
    pykrx_data: Dict[str, Dict],
    threshold_pct: float = 20.0,
) -> Dict[str, any]:
    """KIS vs pykrx 데이터 교차검증

    Args:
        kis_data: KIS investor_data {code: {foreign_net, institution_net, ...}}
        pykrx_data: pykrx investor_data {code: {foreign_net, institution_net, ...}}
        threshold_pct: 불일치 판정 기준 (%)

    Returns:
        {"total": int, "matched": int, "mismatched": int,
         "mismatches": [{code, name, field, kis_val, pykrx_val, diff_pct}, ...]}
    """
    common_codes = set(kis_data.keys()) & set(pykrx_data.keys())
    mismatches: List[Dict] = []
    matched = 0

    for code in common_codes:
        kis = kis_data[code]
        pkx = pykrx_data[code]
        stock_mismatch = False

        for field, kis_key, pkx_key in [
            ("외국인", "foreign_net", "foreign_net"),
            ("기관", "institution_net", "institution_net"),
        ]:
            kis_val = kis.get(kis_key, 0) or 0
            pkx_val = pkx.get(pkx_key, 0) or 0

            # 둘 다 0이면 일치
            if kis_val == 0 and pkx_val == 0:
                continue

            base = max(abs(kis_val), abs(pkx_val))
            diff_pct = abs(kis_val - pkx_val) / base * 100 if base > 0 else 0

            if diff_pct > threshold_pct:
                stock_mismatch = True
                mismatches.append({
                    "code": code,
                    "name": kis.get("name", ""),
                    "field": field,
                    "kis_val": kis_val,
                    "pykrx_val": pkx_val,
                    "diff_pct": round(diff_pct, 1),
                })

        if not stock_mismatch:
            matched += 1

    return {
        "total": len(common_codes),
        "matched": matched,
        "mismatched": len(common_codes) - matched,
        "mismatches": mismatches,
    }


def print_validation_report(result: Dict) -> None:
    """교차검증 결과를 콘솔에 출력"""
    total = result["total"]
    matched = result["matched"]
    mismatched = result["mismatched"]

    print(f"\n[교차검증] KIS vs pykrx: {total}개 종목 비교")
    print(f"  일치: {matched}개, 불일치: {mismatched}개")

    if result["mismatches"]:
        print(f"  불일치 상세 (상위 10건):")
        for m in sorted(result["mismatches"], key=lambda x: x["diff_pct"], reverse=True)[:10]:
            print(f"    {m['name']}({m['code']}) {m['field']}: "
                  f"KIS={m['kis_val']:,} vs pykrx={m['pykrx_val']:,} (차이 {m['diff_pct']}%)")
