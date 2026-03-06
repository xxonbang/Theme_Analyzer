"""
장중 수급 더미 데이터를 latest.json에 주입하는 테스트 스크립트.
사용 후 되돌리려면: python inject_dummy_intraday.py --remove
"""
import json
import random
import sys
from pathlib import Path

LATEST_PATH = Path(__file__).parent / "frontend" / "public" / "data" / "latest.json"

def main():
    with open(LATEST_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "--remove" in sys.argv:
        if "investor_intraday" in data:
            del data["investor_intraday"]
            with open(LATEST_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("investor_intraday 제거 완료")
        else:
            print("investor_intraday 없음 — 이미 깨끗한 상태")
        return

    # 전체 종목 코드 가져오기
    codes = list(data.get("investor_data", {}).keys())
    if not codes:
        print("investor_data에 종목이 없습니다.")
        return

    # 5차까지의 장중 스냅샷 생성
    schedule = [
        {"time": "09:35", "round": 1},
        {"time": "10:05", "round": 2},
        {"time": "11:35", "round": 3},
        {"time": "13:25", "round": 4},
        {"time": "14:35", "round": 5},
    ]

    snapshots = []
    for s in schedule:
        snapshot_data = {}
        for code in codes:
            # 라운드가 진행될수록 값이 변화하는 패턴
            base_f = random.randint(-200000, 200000)
            base_i = random.randint(-150000, 150000)
            # 외국인: 점점 매수세 전환 패턴
            f = base_f + s["round"] * random.randint(10000, 50000)
            i = base_i - s["round"] * random.randint(5000, 30000)
            p = -(f + i)  # 개인은 대체로 반대
            snapshot_data[code] = {"f": f, "i": i, "p": p}

        snapshots.append({
            "time": s["time"],
            "round": s["round"],
            "is_estimated": True,
            "data": snapshot_data,
        })

    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")

    data["investor_intraday"] = {
        "date": today,
        "snapshots": snapshots,
    }

    with open(LATEST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"더미 investor_intraday 주입 완료")
    print(f"  날짜: {today}")
    print(f"  스냅샷: {len(snapshots)}회 (1차~5차)")
    print(f"  종목: {len(codes)}개")
    print(f"\n되돌리기: python inject_dummy_intraday.py --remove")


if __name__ == "__main__":
    main()
