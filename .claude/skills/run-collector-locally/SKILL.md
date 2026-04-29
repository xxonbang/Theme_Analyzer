---
name: run-collector-locally
description: 데이터 수집 스크립트(main.py / collect_*.py / forecast_main.py)를 로컬에서 실행하여 워크플로 변경 검증. cron 변경 전 미리 동작 확인 시 사용.
allowed-tools: Bash(python*), Bash(PYENV_VERSION=*), Bash(jq*), Read
---

# 수집 스크립트 로컬 실행

GitHub Actions cron 변경 전, 로컬에서 동일 스크립트를 실행하여 회귀 없음을 사전 검증.

## 사전 점검

```bash
# Python 환경
PYENV_VERSION=3.11.10 python --version
# 의존성
pip list | head -20
# .env 존재 (KIS 키 등)
ls -la .env 2>&1 | head -3
```

`.env` 없으면 환경변수 부족 — KIS_APP_KEY 등 필요.

## 주요 스크립트별 실행

### main.py — daily-theme-analysis 본체
```bash
PYENV_VERSION=3.11.10 python main.py
# 실행 시간: 5~15분 (200종목 fundamental + criteria 평가)
# 산출: frontend/public/data/latest.json
```

### collect_investor_data.py — 투자자 데이터
```bash
PYENV_VERSION=3.11.10 python collect_investor_data.py
# 실행 시간: 1~3분
# 산출: frontend/public/data/investor-intraday.json
```

### collect_intraday_history.py — 30분봉 히스토리
```bash
PYENV_VERSION=3.11.10 python collect_intraday_history.py
# 실행 시간: 5~10분
# 산출: frontend/public/data/intraday-history.json
```

### collect_paper_trading.py — 모의투자
```bash
PYENV_VERSION=3.11.10 python collect_paper_trading.py
# 실행 시간: 1~2분
# 산출: frontend/public/data/paper-trading/{date}.json
```

### forecast_main.py — Gemini 일일 전망
```bash
PYENV_VERSION=3.11.10 python forecast_main.py
# 실행 시간: 30초~2분 (Gemini API 호출)
# 비용 발생: GEMINI_API_KEY 사용 — 의도적일 때만
```

### collect_macro_indicators.py — 거시지표
```bash
PYENV_VERSION=3.11.10 python collect_macro_indicators.py
# 실행 시간: 30초~1분
# 산출: frontend/public/data/macro-indicators.json
```

## 검증 패턴

1. 실행 전 산출 파일 timestamp 기록
   ```bash
   stat -f %Sm frontend/public/data/latest.json
   ```
2. 실행
3. timestamp 변화 + 새 데이터 확인
   ```bash
   jq '.timestamp' frontend/public/data/latest.json
   ```
4. 실패 시 logs/ 또는 stdout 으로 원인 추적

## 주의

- **실 KIS API 호출**: 토큰 1일 2회 한도 영향. 워크플로 실패 직후 로컬 재실행 시 한도 소진 가능
- **실 Telegram 알림 발송**: 환경변수 `TELEGRAM_NOTIFY=false` 로 끄거나 코드 분기 확인
- **로컬 산출 → git commit 금지**: cron이 자동 commit 하므로 수동 commit 시 충돌

## 권장 워크플로

워크플로 cron 변경 PR 전:
1. 로컬에서 동일 스크립트 실행 → 산출 파일 정상
2. PR 생성 → ci.yml 통과
3. 머지 후 `gh workflow run` 으로 1회 수동 트리거 (cron 첫 트리거 대신 수동 검증)
4. 정상 작동 확인 후 cron이 알아서 도는지 다음 주기 모니터링
