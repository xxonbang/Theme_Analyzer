#!/usr/bin/env bash
# SessionStart — theme_analysis 현황 brief 출력.
cd /Users/sonbyeongcheol/DEV/theme_analysis 2>/dev/null || exit 0

echo "=== theme_analysis brief ==="
echo "[HEAD] $(git log -1 --oneline 2>/dev/null)"
echo "[branch] $(git branch --show-current 2>/dev/null)"

# 원격 대비 상태
AHEAD_BEHIND=$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)
if [ -n "$AHEAD_BEHIND" ]; then
  BEHIND=$(echo "$AHEAD_BEHIND" | awk '{print $1}')
  AHEAD=$(echo "$AHEAD_BEHIND" | awk '{print $2}')
  echo "[origin/main] behind=$BEHIND ahead=$AHEAD"
fi

echo "[uncommitted]"
git status --short 2>/dev/null | head -8

echo "[task history — 최근 5건]"
grep -E '^### \[' docs/task_history.md 2>/dev/null | head -5

# 활성 GitHub Actions cron 수
WF_COUNT=$(ls .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
echo "[workflows] ${WF_COUNT}개 활성 (운영 중 — disable/delete 금지)"

echo "============================="
exit 0
