#!/usr/bin/env bash
# PostToolUse (Edit|Write) — frontend/src 수정 후 tsc --noEmit 타입체크 자동 (async).
# 결과는 stdout 출력만, exit 0 — 차단 없음.

if ! command -v jq >/dev/null 2>&1; then exit 0; fi

FILE=$(jq -r '.tool_input.file_path // ""')

case "$FILE" in
  */theme_analysis/frontend/src/*)
    cd /Users/sonbyeongcheol/DEV/theme_analysis/frontend 2>/dev/null || exit 0
    if [ -d node_modules ]; then
      npx tsc --noEmit 2>&1 | head -20
    fi
    ;;
esac
exit 0
