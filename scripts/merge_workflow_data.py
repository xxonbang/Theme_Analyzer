"""워크플로우 간 latest.json 데이터 병합 유틸리티

git reset --hard 후 백업 복원 시, 원격에 있던 다른 워크플로우의 데이터를 보존한다.

Usage:
    python scripts/merge_workflow_data.py save-investor   # daily-theme-analysis용: 원격의 investor 필드 저장
    python scripts/merge_workflow_data.py merge-investor  # daily-theme-analysis용: 저장된 investor 필드 병합
    python scripts/merge_workflow_data.py save-main       # collect-investor-data용: 원격의 main 필드 저장
    python scripts/merge_workflow_data.py merge-main      # collect-investor-data용: 저장된 main 필드 병합
"""
import json
import os
import sys

LATEST_PATH = "frontend/public/data/latest.json"
INVESTOR_CACHE = "/tmp/remote_investor.json"
MAIN_CACHE = "/tmp/remote_main.json"

INVESTOR_KEYS = ["investor_intraday", "investor_data", "investor_estimated", "investor_updated_at"]
MAIN_KEYS = ["timestamp", "exchange", "theme_analysis", "kospi_index", "kosdaq_index", "news"]


def save_fields(keys, cache_path):
    if not os.path.exists(LATEST_PATH):
        return
    with open(LATEST_PATH) as f:
        remote = json.load(f)
    preserved = {k: remote[k] for k in keys if k in remote}
    if preserved:
        with open(cache_path, "w") as f:
            json.dump(preserved, f, ensure_ascii=False)


def merge_investor():
    if not os.path.exists(INVESTOR_CACHE):
        return
    with open(INVESTOR_CACHE) as f:
        remote = json.load(f)
    with open(LATEST_PATH) as f:
        data = json.load(f)

    changed = False

    # investor_intraday: round 기준 합집합 병합
    ri = remote.get("investor_intraday", {})
    li = data.get("investor_intraday", {})
    if ri.get("date") and ri.get("date") == li.get("date"):
        remote_snaps = {s["round"]: s for s in ri.get("snapshots", []) if "round" in s}
        local_snaps = {s["round"]: s for s in li.get("snapshots", []) if "round" in s}
        merged = {**remote_snaps, **local_snaps}  # 로컬 우선, 원격으로 빈 round 보충
        if len(merged) > len(local_snaps):
            data["investor_intraday"]["snapshots"] = sorted(merged.values(), key=lambda s: s["round"])
            changed = True
    elif ri.get("snapshots") and not li.get("snapshots"):
        data["investor_intraday"] = ri
        changed = True

    # investor_data: 원격이 더 최신이면 사용
    ru = remote.get("investor_updated_at", "")
    lu = data.get("investor_updated_at", "")
    if ru and ru > lu:
        for key in ["investor_data", "investor_estimated", "investor_updated_at"]:
            if key in remote:
                data[key] = remote[key]
        changed = True

    if changed:
        with open(LATEST_PATH, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def merge_main():
    if not os.path.exists(MAIN_CACHE):
        return
    with open(MAIN_CACHE) as f:
        remote = json.load(f)
    with open(LATEST_PATH) as f:
        data = json.load(f)

    rt = remote.get("timestamp", "")
    lt = data.get("timestamp", "")
    if rt and rt > lt:
        for key in MAIN_KEYS:
            if key in remote:
                data[key] = remote[key]
        with open(LATEST_PATH, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "save-investor":
        save_fields(INVESTOR_KEYS, INVESTOR_CACHE)
    elif cmd == "merge-investor":
        merge_investor()
    elif cmd == "save-main":
        save_fields(MAIN_KEYS, MAIN_CACHE)
    elif cmd == "merge-main":
        merge_main()
