#!/usr/bin/env bash
# PreToolUse hook (Bash) — theme_analysis 특화 파괴적·고위험 명령 차단.
# exit 2 만이 block (exit 1은 block 안 됨 — 공식 문서 주의).
#
# 차단 대상:
#   - 파일 시스템 파괴 (rm -rf)
#   - git 이력 파괴 (force push, hard reset, branch -D, clean -f, filter-branch)
#   - GitHub Actions cron 죽이기 (gh workflow disable/delete) — 13개 cron 보호
#   - GitHub secret 삭제 (gh secret delete) — KIS·Telegram·Supabase 보호
#   - Supabase Edge Function 삭제 (supabase functions delete) — kis-proxy 보호
#   - sudo (시스템 변경)
#   - --no-verify (pre-commit hook 우회)
#   - 환경변수 평문 export 의심 (SERVICE_KEY=, ANON_KEY=, APP_SECRET=, BOT_TOKEN=)

set -e

if ! command -v jq >/dev/null 2>&1; then
  exit 0  # jq 없으면 패스 (로컬 환경 차이)
fi

CMD=$(jq -r '.tool_input.command // ""')

# 인용 부분 (쌍따옴표·홑따옴표·heredoc body) 제거 후 검사 — false positive 방지
# 예: git commit -m "...rm -rf 금지..." 의 메시지 부분은 검사에서 제외
# multi-line 처리: 줄바꿈을 \1(SOH)로 임시 치환 후 sed 처리 후 복원
CMD_CHECK=$(printf '%s' "$CMD" \
  | tr '\n' '\1' \
  | sed -e 's/"[^"]*"//g' \
  | sed -e "s/'[^']*'//g" \
  | sed -E 's/<<-?[A-Za-z_]+\x01[^\x01]*\x01[A-Za-z_]+/HEREDOC/g' \
  | tr '\1' '\n')

case "$CMD_CHECK" in
  *"rm -rf "*|*"rm -fr "*|*"rm --recursive --force"*|*"rm -r -f "*|*"rm -f -r "*)
    echo "BLOCKED: rm -rf 류 명령 금지 (필요 시 개별 파일 명시 또는 git rm 사용)" >&2; exit 2 ;;
  *"git push --force"*|*"git push -f "*|*"git push -f origin"*|*"git push --force-with-lease"*)
    echo "BLOCKED: force push 금지 (main 공유 저장소 보호)" >&2; exit 2 ;;
  *"git reset --hard"*)
    echo "BLOCKED: git reset --hard 금지 (작업 손실 위험; git stash 또는 selective reset 사용)" >&2; exit 2 ;;
  *"git clean -f"*|*"git clean -df"*|*"git clean -fd"*)
    echo "BLOCKED: git clean -f 금지 (untracked 파일 영구 삭제 위험)" >&2; exit 2 ;;
  *"git branch -D "*|*"git branch --delete --force"*)
    echo "BLOCKED: git branch -D 금지 (병합 안 된 브랜치 강제 삭제)" >&2; exit 2 ;;
  *"git filter-branch"*|*"git filter-repo"*)
    echo "BLOCKED: 이력 재작성 금지 (백업 후 전용 세션에서 진행)" >&2; exit 2 ;;
  *"git commit --no-verify"*|*"git commit -n "*|*"git commit -nm "*)
    echo "BLOCKED: pre-commit hook 우회 금지 (hook 실패 시 원인 수정 후 재커밋)" >&2; exit 2 ;;
  *"gh workflow disable"*|*"gh workflow delete"*)
    echo "BLOCKED: GitHub Actions workflow 비활성화/삭제 금지 (13개 cron 운영 중)" >&2; exit 2 ;;
  *"gh secret delete"*|*"gh secret remove"*)
    echo "BLOCKED: gh secret delete 금지 (KIS·Telegram·Supabase 등 prod secret 보호)" >&2; exit 2 ;;
  *"gh repo delete"*)
    echo "BLOCKED: GitHub 저장소 삭제 금지" >&2; exit 2 ;;
  *"supabase functions delete"*|*"supabase functions remove"*)
    echo "BLOCKED: Supabase Edge Function 삭제 금지 (kis-proxy prod)" >&2; exit 2 ;;
  *"supabase projects delete"*)
    echo "BLOCKED: Supabase 프로젝트 삭제 금지" >&2; exit 2 ;;
  "sudo "*)
    echo "BLOCKED: sudo 명령 금지 (theme_analysis 작업은 사용자 권한 내)" >&2; exit 2 ;;
esac

# 환경변수 평문 export 경고 (차단 아님 — 의도적 사용 가능)
case "$CMD" in
  *"SERVICE_KEY=ey"*|*"ANON_KEY=ey"*|*"APP_SECRET="*|*"BOT_TOKEN="*|*"KIS_APP_SECRET="*)
    echo "NOTICE: 명령에 토큰/키 평문 포함 — 셸 history·로그 노출 주의" >&2 ;;
esac

exit 0
