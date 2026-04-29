---
name: refresh-stock-master
description: 종목 마스터(stock-master.json) 갱신. 신규 상장·상장폐지·종목코드 변경 반영 필요 시 사용. update-stock-master.yml workflow_dispatch 트리거.
allowed-tools: Bash(gh workflow run*), Bash(gh run list*), Bash(gh run watch*), Bash(curl*), Bash(jq*)
---

# 종목 마스터 갱신

`frontend/public/data/stock-master.json` 을 KIS API에서 최신 KOSPI/KOSDAQ 종목 리스트로 갱신.

## 트리거

```bash
gh workflow run update-stock-master.yml
sleep 5
gh run list --workflow=update-stock-master.yml --limit 1
```

## 모니터링

```bash
RUN_ID=$(gh run list --workflow=update-stock-master.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch $RUN_ID --exit-status
```

## 사후 확인

```bash
# 원격 stock-master 갱신 확인
git pull --ff-only origin main
jq '.count, .updated_at' frontend/public/data/stock-master.json
```

Expected:
- count: 2700~2900 사이 (KOSPI ~900 + KOSDAQ ~1800)
- updated_at: 오늘 날짜

## 빈도 권장

- 주 1회 (월요일 새벽 권장)
- 이벤트 시 즉시: 상장 공시, 종목코드 변경 안내, 분석 누락 종목 발견

## 알려진 이슈

- KIS 토큰 1일 2회 한도 — 다른 워크플로 실패 후 재실행 시 한도 소진 가능
- 신규 상장 종목은 KIS 응답 반영까지 1~2일 지연 가능 (KIS 측 데이터 확보 시점)
