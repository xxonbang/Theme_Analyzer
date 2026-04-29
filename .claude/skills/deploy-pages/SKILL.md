---
name: deploy-pages
description: theme_analysis frontend을 GitHub Pages로 배포. frontend/** 변경 후 또는 사용자가 "배포해줘" "Pages 갱신" 요청 시 사용. deploy-pages.yml workflow_dispatch 트리거 + 진행 모니터링.
allowed-tools: Bash(gh workflow run*), Bash(gh run list*), Bash(gh run view*), Bash(gh run watch*)
---

# theme_analysis GitHub Pages 배포

## 사전 점검

1. 로컬 frontend 빌드 통과 확인 (필수):
   ```bash
   cd frontend && npm run build
   ```
   에러 시 배포 중단.

2. 커밋·푸시 완료 확인:
   ```bash
   git status --short
   git log origin/main..HEAD --oneline
   ```
   미푸시 커밋 있으면 먼저 push.

## 실행

```bash
# 모드 선택: data-only (기본, 데이터 변경만) | full (Gemini + Telegram 포함)
gh workflow run deploy-pages.yml -f mode=data-only

# 트리거 직후 run id 확인
sleep 5
gh run list --workflow=deploy-pages.yml --limit 1
```

## 모니터링

```bash
# 진행 watch
RUN_ID=$(gh run list --workflow=deploy-pages.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN_ID --exit-status
```

## 사후 확인

- `https://xxonbang.github.io/theme-analyzer/` 접속하여 실제 배포 반영 확인 (CDN cache 5~10분 가능)
- 실패 시 `gh run view $RUN_ID --log-failed` 로 원인 파악

## 알려진 이슈

- **`group: pages` concurrency**: 9개 워크플로가 같은 그룹 → 데이터 수집 워크플로가 진행 중이면 deploy 지연
- **first-time deploy**: GitHub Settings > Pages 에서 source 가 "GitHub Actions" 인지 확인
- **빌드 실패**: 가장 흔한 원인은 `tsc --noEmit` 타입 에러 또는 누락된 환경변수 (vite 빌드 시 `VITE_*` env)

## 배제 사항

- workflow disable/delete 절대 금지 (block-destructive 훅 차단)
- secret 변경은 `gh secret set` 으로 (delete 금지)
- mode=full 은 Gemini API 호출 비용 발생 — 의도적일 때만
