"""
외국인 저가 매집 신호 백테스트 — 데이터 수집 + 분석

KIS API investor_trade_by_stock_daily로 종목별 일별 투자자 매매동향 수집 후
외국인 저가 매집 신호의 D+1/D+2/D+3 수익률 및 초과수익률 분석

사용법:
    python backtest_investor_signal.py collect   # 데이터 수집
    python backtest_investor_signal.py analyze   # 분석 실행
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from modules.kis_client import KISClient

# === 설정 ===
DATA_DIR = Path("data/investor_backtest")
DATA_DIR.mkdir(parents=True, exist_ok=True)
COLLECTED_FILE = DATA_DIR / "collected_data.json"
PROGRESS_FILE = DATA_DIR / "progress.json"

API_PATH = "/uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily"
TR_ID = "FHPTJ04160001"

TARGET_DAYS = 500  # 목표 거래일 수
PAGES_PER_STOCK = (TARGET_DAYS + 29) // 30  # 30일/페이지 → 17페이지


def get_stock_codes():
    """stock-history.json에서 종목 코드 목록 추출"""
    with open("frontend/public/data/stock-history.json") as f:
        data = json.load(f)
    return sorted(data.keys())


def load_progress():
    """수집 진행 상태 로드"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed_codes": [], "partial": {}}


def save_progress(progress):
    """수집 진행 상태 저장"""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False)


def load_collected():
    """기존 수집 데이터 로드"""
    if COLLECTED_FILE.exists():
        with open(COLLECTED_FILE) as f:
            return json.load(f)
    return {}


def save_collected(data):
    """수집 데이터 저장"""
    with open(COLLECTED_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False)


def fetch_stock_investor_data(client, code, ref_date="20260402", max_pages=PAGES_PER_STOCK):
    """
    단일 종목의 투자자매매동향 일별 데이터 수집

    날짜 기반 역순 수집: ref_date에서 시작하여 과거로 이동
    """
    all_rows = []
    current_ref = ref_date
    seen_dates = set()

    for page in range(max_pages):
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": code,
            "FID_INPUT_DATE_1": current_ref,
            "FID_ORG_ADJ_PRC": "",
            "FID_ETC_CLS_CODE": "",
        }

        # 재시도 로직 (rate limit + connection 오류 대응)
        result = None
        for attempt in range(5):
            try:
                result = client.request("GET", API_PATH, tr_id=TR_ID, params=params)
                break
            except Exception as e:
                err_msg = str(e)
                if any(k in err_msg for k in ["초당", "거래건수", "Connection", "Remote", "Timeout", "timeout"]):
                    wait = 2.0 * (attempt + 1)
                    time.sleep(wait)
                    continue
                raise

        if not result or result.get("rt_cd") != "0":
            msg = result.get("msg1", "unknown") if result else "None"
            print(f"    page {page}: API 오류 - {msg}")
            break

        rows = result.get("output2", [])
        if not rows:
            break

        # 중복 제거
        new_rows = []
        for r in rows:
            d = r["stck_bsop_date"]
            if d not in seen_dates:
                seen_dates.add(d)
                new_rows.append(r)

        all_rows.extend(new_rows)

        if len(new_rows) == 0:
            break

        # 목표 도달 확인
        if len(seen_dates) >= TARGET_DAYS:
            break

        # 다음 페이지: 마지막 날짜 하루 전
        last_date = rows[-1]["stck_bsop_date"]
        dt = datetime.strptime(last_date, "%Y%m%d") - timedelta(days=1)
        current_ref = dt.strftime("%Y%m%d")

        time.sleep(0.12)  # rate limit — 여유 있게 (약 8 req/s)

    return all_rows


def collect_data():
    """전체 데이터 수집"""
    client = KISClient()
    codes = get_stock_codes()
    progress = load_progress()
    collected = load_collected()

    completed = set(progress.get("completed_codes", []))
    remaining = [c for c in codes if c not in completed]

    print(f"수집 대상: {len(codes)}종목, 완료: {len(completed)}, 남은: {len(remaining)}")
    print(f"종목당 목표: {TARGET_DAYS}거래일, 최대 {PAGES_PER_STOCK}페이지")
    print()

    for i, code in enumerate(remaining):
        print(f"[{len(completed)+1}/{len(codes)}] {code} 수집 중...", end="", flush=True)

        try:
            rows = fetch_stock_investor_data(client, code)

            # 핵심 필드만 추출하여 저장 (용량 절감)
            slim_rows = []
            for r in rows:
                try:
                    close = int(r["stck_clpr"]) if r["stck_clpr"] else 0
                    rate = float(r["prdy_ctrt"]) if r["prdy_ctrt"] else 0.0
                    frgn = int(r["frgn_ntby_qty"]) if r["frgn_ntby_qty"] else 0
                    orgn = int(r["orgn_ntby_qty"]) if r["orgn_ntby_qty"] else 0
                    prsn = int(r["prsn_ntby_qty"]) if r["prsn_ntby_qty"] else 0
                    vol = int(r["acml_vol"]) if r["acml_vol"] else 0
                except (ValueError, TypeError):
                    continue  # 파싱 불가 행 건너뜀
                if close == 0:
                    continue  # 종가 없는 행 건너뜀
                slim_rows.append({
                    "date": r["stck_bsop_date"],
                    "close": close,
                    "rate": rate,
                    "frgn": frgn,
                    "orgn": orgn,
                    "prsn": prsn,
                    "vol": vol,
                })

            collected[code] = slim_rows
            completed.add(code)

            dates = [r["date"] for r in slim_rows]
            print(f" {len(slim_rows)}일 ({dates[-1]}~{dates[0]})")

            # 10종목마다 중간 저장
            if (len(completed)) % 10 == 0:
                progress["completed_codes"] = list(completed)
                save_progress(progress)
                save_collected(collected)
                print(f"  ── 중간 저장 ({len(completed)}종목 완료) ──")

        except Exception as e:
            print(f" 오류: {e}")
            # 오류 발생 시 즉시 저장
            progress["completed_codes"] = list(completed)
            save_progress(progress)
            save_collected(collected)
            raise

    # 최종 저장
    progress["completed_codes"] = list(completed)
    save_progress(progress)
    save_collected(collected)

    print(f"\n수집 완료: {len(collected)}종목")
    total_rows = sum(len(v) for v in collected.values())
    print(f"총 데이터: {total_rows:,}행")


def analyze_data():
    """백테스트 분석"""
    collected = load_collected()
    if not collected:
        print("수집 데이터가 없습니다. 먼저 collect를 실행하세요.")
        return

    print(f"분석 대상: {len(collected)}종목")
    total_rows = sum(len(v) for v in collected.values())
    print(f"총 데이터: {total_rows:,}행")

    # === 1. 거래일 목록 구축 ===
    all_dates = set()
    for code, rows in collected.items():
        for r in rows:
            all_dates.add(r["date"])
    trade_dates = sorted(all_dates)
    print(f"거래일: {len(trade_dates)}일 ({trade_dates[0]} ~ {trade_dates[-1]})")

    # === 2. 종목별 날짜 인덱스 구축 ===
    # code -> { date: { close, rate, frgn, orgn, prsn } }
    db = {}
    for code, rows in collected.items():
        db[code] = {}
        for r in rows:
            db[code][r["date"]] = r

    # === 3. KOSPI 지수 수익률 (API에서 별도 수집 필요 — 대안으로 전체 평균 사용) ===
    # 지수 데이터는 history JSON에서 로드
    from glob import glob
    index_db = {}
    for fp in sorted(glob("frontend/public/data/history/*.json")):
        fname = os.path.basename(fp).replace(".json", "")
        date_part = fname.split("_")[0].replace("-", "")
        with open(fp) as f:
            d = json.load(f)
        kd = d.get("kosdaq_index", {})
        ki = d.get("kospi_index", {})
        index_db[date_part] = {
            "kosdaq": kd.get("current") if isinstance(kd, dict) else None,
            "kospi": ki.get("current") if isinstance(ki, dict) else None,
        }

    # 지수 일별 변동률
    idx_dates = sorted(index_db.keys())
    index_returns = {}
    for i in range(1, len(idx_dates)):
        prev_d, curr_d = idx_dates[i - 1], idx_dates[i]
        prev, curr = index_db[prev_d], index_db[curr_d]
        for mkt in ["kosdaq", "kospi"]:
            if prev[mkt] and curr[mkt] and prev[mkt] > 0:
                r = (curr[mkt] - prev[mkt]) / prev[mkt] * 100
                # 보정: ±15% 초과 또는 동일값(복사) → None
                if abs(r) > 15 or prev[mkt] == curr[mkt]:
                    r = None
                else:
                    r = round(r, 2)
            else:
                r = None
            index_returns.setdefault(curr_d, {})[mkt] = r

    # === 4. 신호 탐색 ===
    signals = []
    for date in trade_dates:
        for code, date_map in db.items():
            if date not in date_map:
                continue
            row = date_map[date]
            frgn = row["frgn"]
            rate = row["rate"]

            # 외국인 저가 매집 조건: 외국인 순매수 > 0 AND 등락률 < 0
            if frgn > 0 and rate < 0:
                signals.append({
                    "date": date,
                    "code": code,
                    "frgn": frgn,
                    "rate": rate,
                    "close": row["close"],
                })

    print(f"\n외국인 순매수 & 하락 종목-일: {len(signals):,}건")

    # === 5. 30만주 이상 필터 ===
    signals_30 = [s for s in signals if s["frgn"] >= 300000]
    print(f"30만주 이상: {len(signals_30):,}건")

    # === 6. D+1/D+2/D+3 수익률 계산 ===
    def get_next_td(date, n=1):
        idx = None
        for i, d in enumerate(trade_dates):
            if d == date:
                idx = i
                break
        if idx is None:
            return None
        target = idx + n
        return trade_dates[target] if target < len(trade_dates) else None

    def calc_ret(code, d0, dn):
        if not d0 or not dn:
            return None
        r0 = db.get(code, {}).get(d0)
        rn = db.get(code, {}).get(dn)
        if r0 and rn and r0["close"] > 0:
            return round((rn["close"] - r0["close"]) / r0["close"] * 100, 2)
        return None

    def get_idx_ret(date):
        ir = index_returns.get(date, {})
        r = ir.get("kosdaq")
        if r is None:
            r = ir.get("kospi")
        return r

    results = []
    for sig in signals_30:
        d0 = sig["date"]
        d1 = get_next_td(d0, 1)
        d2 = get_next_td(d0, 2)
        d3 = get_next_td(d0, 3)

        r1 = calc_ret(sig["code"], d0, d1)
        r2 = calc_ret(sig["code"], d0, d2)
        r3 = calc_ret(sig["code"], d0, d3)

        ir1 = get_idx_ret(d1) if d1 else None
        ex1 = round(r1 - ir1, 2) if r1 is not None and ir1 is not None else None

        results.append({
            **sig,
            "d1": d1, "d2": d2, "d3": d3,
            "r1": r1, "r2": r2, "r3": r3,
            "ir1": ir1, "ex1": ex1,
        })

    # === 7. 통계 출력 ===
    def stats(label, data, key, indent="  "):
        vals = [r[key] for r in data if r[key] is not None]
        if not vals:
            return f"{indent}{label:>16}: 데이터 없음"
        avg = sum(vals) / len(vals)
        srt = sorted(vals)
        med = srt[len(srt) // 2]
        pos = sum(1 for v in vals if v > 0)
        neg = sum(1 for v in vals if v <= 0)
        avg_gain = sum(v for v in vals if v > 0) / max(pos, 1)
        avg_loss = abs(sum(v for v in vals if v <= 0) / max(neg, 1))
        plr = f"{avg_gain / avg_loss:.2f}" if avg_loss > 0 else "∞"
        return (
            f"{indent}{label:>16}: {len(vals):>5}건 | "
            f"평균{avg:>+7.2f}% | 중앙값{med:>+7.2f}% | "
            f"승률 {pos}/{len(vals)}={pos / len(vals) * 100:>5.1f}% | "
            f"손익비 {plr} | [{min(vals):>+.1f}%~{max(vals):>+.1f}%]"
        )

    print(f"\n{'=' * 120}")
    print(f"외국인 저가 매집 신호 백테스트 결과")
    print(f"기간: {trade_dates[0]} ~ {trade_dates[-1]} ({len(trade_dates)}거래일)")
    print(f"종목: {len(collected)}개 | 신호(30만주+): {len(results):,}건")
    print(f"{'=' * 120}")

    print("\n[ 1. 전체 통계 (30만주 이상) ]")
    print(stats("D+1 수익률", results, "r1"))
    print(stats("D+2 누적", results, "r2"))
    print(stats("D+3 누적", results, "r3"))
    print(stats("D+1 초과수익", results, "ex1"))

    # 하락폭 구간별
    print("\n[ 2. 당일 하락폭 구간별 ]")
    for label, lo, hi in [("0~-5%", -5, 0), ("-5~-10%", -10, -5), ("-10~-15%", -15, -10), ("-15%이하", -100, -15)]:
        sub = [r for r in results if lo <= r["rate"] < hi]
        if not sub:
            continue
        print(f"\n  ▸ {label} ({len(sub)}건)")
        print(stats("D+1", sub, "r1", "    "))
        print(stats("D+2 누적", sub, "r2", "    "))
        print(stats("D+3 누적", sub, "r3", "    "))
        print(stats("D+1 초과", sub, "ex1", "    "))

    # 순매수 규모별
    print("\n[ 3. 외국인 순매수 규모별 ]")
    for label, lo, hi in [("30만~50만주", 300000, 500000), ("50만~100만주", 500000, 1000000), ("100만주+", 1000000, float("inf"))]:
        sub = [r for r in results if lo <= r["frgn"] < hi]
        if not sub:
            continue
        print(f"\n  ▸ {label} ({len(sub)}건)")
        print(stats("D+1", sub, "r1", "    "))
        print(stats("D+2 누적", sub, "r2", "    "))
        print(stats("D+3 누적", sub, "r3", "    "))
        print(stats("D+1 초과", sub, "ex1", "    "))

    # 복합 조건
    print("\n[ 4. 복합 조건 ]")
    for label, cond in [
        ("전체 30만주+", lambda r: True),
        ("50만주+ & -5%이하", lambda r: r["frgn"] >= 500000 and r["rate"] <= -5),
        ("50만주+ & -10%이하", lambda r: r["frgn"] >= 500000 and r["rate"] <= -10),
        ("100만주+ & -5%이하", lambda r: r["frgn"] >= 1000000 and r["rate"] <= -5),
        ("100만주+ & -10%이하", lambda r: r["frgn"] >= 1000000 and r["rate"] <= -10),
    ]:
        sub = [r for r in results if cond(r)]
        if not sub:
            continue
        print(f"\n  ▸ {label} ({len(sub)}건)")
        print(stats("D+1", sub, "r1", "    "))
        print(stats("D+2 누적", sub, "r2", "    "))
        print(stats("D+3 누적", sub, "r3", "    "))
        print(stats("D+1 초과", sub, "ex1", "    "))

    # 결과 저장
    result_file = DATA_DIR / "backtest_results.json"
    with open(result_file, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n결과 저장: {result_file}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python backtest_investor_signal.py [collect|analyze]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "collect":
        collect_data()
    elif cmd == "analyze":
        analyze_data()
    else:
        print(f"알 수 없는 명령: {cmd}")
        sys.exit(1)
