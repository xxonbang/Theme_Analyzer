---
name: pr-checklist
description: theme_analysis PR 머지 전 체크리스트 텍스트 삽입
---

## Pre-merge checklist (theme_analysis)

### 코드 품질
- [ ] Python: `ruff check modules/ scripts/` 통과 (또는 NIT 수준만 잔존)
- [ ] Frontend: `cd frontend && npm run lint && npm run build` 통과
- [ ] 신규 함수에 단위 테스트 동반 (modules/ 변경 시)
- [ ] `test-runner-analyzer` agent 로 회귀 테스트 통과

### 변경 의도 추적
- [ ] `docs/task_history.md` 갱신 (카테고리 + 날짜·시각 KST + 변경 파일 + 1~2줄 요약)
- [ ] 커밋 메시지에 변경 의도 1줄 포함 + Co-Authored-By
- [ ] `spec-reviewer` agent 로 의도-구현 정합성 ✅
- [ ] `code-reviewer` agent 로 품질 ✅ (또는 NIT만)

### 보안
- [ ] `git diff --cached | grep -iE 'KEY|SECRET|TOKEN|PASSWORD'` 결과 비어있음
- [ ] `.env`, `.kis_token_cache.json` 변경 없음
- [ ] HTML sanitize: 정규식 (`replace(/<[^>]*>/g, '')`) 신규 사용 없음 (DOMPurify 권장)
- [ ] localStorage 에 admin 평문 저장 신규 없음

### 운영 영향
- [ ] `.github/workflows/*.yml` 변경 시 `workflow-ops` agent 검토 → 영향 평가 첨부
- [ ] cron 변경 시 KST→UTC 변환 정확성 확인
- [ ] secret 의존성 추가/제거 명시
- [ ] `concurrency.group` 변경 시 다른 워크플로 영향 평가

### 배포 흐름
- [ ] frontend/** 변경 → push 시 `deploy-pages.yml` 자동 트리거
- [ ] 데이터 수집 변경 → 다음 cron 주기에 자동 반영, 즉시 검증 필요 시 `gh workflow run`
- [ ] Gemini 비용 발생 변경 → `mode=full` 호출 빈도 영향 명시

### 절대 금기 확인
- [ ] `gh workflow disable/delete` 사용 없음
- [ ] `gh secret delete` 사용 없음
- [ ] `git push --force` 사용 없음 (block-destructive 훅 차단됨)
- [ ] `--no-verify` pre-commit 우회 없음

### 사후 검증
- [ ] PR 머지 후 첫 cron 트리거 또는 수동 `workflow run` 으로 1회 정상 실행 확인
- [ ] `gh run list --workflow=<name>` 으로 status SUCCESS 확인
- [ ] 실패 시 `gh run view --log-failed` 즉시 분석
