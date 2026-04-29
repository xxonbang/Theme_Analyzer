#!/bin/bash
# Stop hook: task_history.md 업데이트 여부 체크
# 코드 파일이 수정되었는데 task_history.md가 업데이트되지 않았으면 차단

PROJECT_DIR="/Users/sonbyeongcheol/DEV/theme_analysis"
TASK_HISTORY="$PROJECT_DIR/docs/task_history.md"
THRESHOLD=300  # 5분 (초)

NOW=$(date +%s)

# task_history.md가 없으면 패스
if [ ! -f "$TASK_HISTORY" ]; then
  exit 0
fi

# 최근 5분 이내에 수정된 코드 파일 찾기 (.tsx, .ts, .py, .yml, .css)
CODE_CHANGED=$(find "$PROJECT_DIR/frontend/src" "$PROJECT_DIR/modules" "$PROJECT_DIR/.github" \
  -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.py" -o -name "*.yml" -o -name "*.css" \) \
  -newer "$TASK_HISTORY" \
  2>/dev/null | head -1)

# 코드 파일 변경이 없으면 패스 (단순 대화/조사 등)
if [ -z "$CODE_CHANGED" ]; then
  exit 0
fi

# 코드 파일은 변경되었는데, task_history.md는 최근 5분 이내에 수정되지 않았으면 차단
TASK_MTIME=$(stat -f %m "$TASK_HISTORY")
DIFF=$((NOW - TASK_MTIME))

if [ "$DIFF" -gt "$THRESHOLD" ]; then
  echo "task_history.md가 업데이트되지 않았습니다. 방금 수행한 작업 내용을 docs/task_history.md에 기록해주세요. (코드 변경 감지: $(basename $CODE_CHANGED) 등)" >&2
  exit 2
fi

exit 0
