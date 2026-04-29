#!/usr/bin/env bash
# PostToolUse (Edit|Write) — modules/, *.py 수정 후 ruff lint 자동 실행 (async).
# 결과는 stdout 출력만, exit 0 — 차단 없음 (참고용).

if ! command -v jq >/dev/null 2>&1; then exit 0; fi

FILE=$(jq -r '.tool_input.file_path // ""')

# theme_analysis 의 Python 작업 영역
case "$FILE" in
  */theme_analysis/modules/*.py|*/theme_analysis/scripts/*.py|*/theme_analysis/*.py)
    cd /Users/sonbyeongcheol/DEV/theme_analysis 2>/dev/null || exit 0
    REL="${FILE#*/theme_analysis/}"
    if command -v ruff >/dev/null 2>&1; then
      ruff check "$REL" 2>&1 | head -20
    elif [ -x ~/.pyenv/versions/3.11.10/bin/ruff ]; then
      ~/.pyenv/versions/3.11.10/bin/ruff check "$REL" 2>&1 | head -20
    fi
    ;;
esac
exit 0
