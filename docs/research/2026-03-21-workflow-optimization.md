# 워크플로우 스케줄 최적화 연구

> 조사일: 2026-03-21
> 목적: git push 경합으로 인한 성능/안정성 문제 해소를 위한 스케줄 재배치

---

## 1. 현재 스케줄 및 경합 현황

### 1-1. 현재 타임라인 (KST, 평일)

```
07:00  Macro Premarket ─────── [~5분]
07:30  Theme Forecast ──────── [~10분]
09:05  Daily Theme Analysis 1차 ──────────────── [~20분]
09:10  Macro Futures ───────── [~5분]
09:15  Intraday History ────── [~5분] (이후 30분 간격, 13회)
09:28  Daily Theme Analysis 2차 ──────────────── [~20분]
09:30  Theme Forecast Intraday 1회 ──────── [~15분]
09:31  Collect Investor 1회 ──────────── [~10분]
09:45  Intraday History ────── [~5분]
10:01  Collect Investor 2회 ──────────── [~10분]
10:15  Intraday History ────── [~5분]
10:30  Theme Forecast Intraday 2회 ──────── [~15분]
10:45  Intraday History ────── [~5분]
11:15  Intraday History ────── [~5분]
11:30  ★ Refresh Stock Data ──────────────────────────── [~40분] ★
11:30  Theme Forecast Intraday 3회 ──────── [~15분]
11:31  Collect Investor 3회 ──────────── [~10분]
11:45  Intraday History ────── [~5분]
12:15  Intraday History ────── [~5분]
12:45  Intraday History ────── [~5분]
13:15  Intraday History ────── [~5분]
13:21  Collect Investor 4회 ──────────── [~10분]
13:30  Theme Forecast Intraday 4회 ──────── [~15분]
13:45  Intraday History ────── [~5분]
14:15  Intraday History ────── [~5분]
14:30  Theme Forecast Intraday 5회 ──────── [~15분]
14:31  Collect Investor 5회 ──────────── [~10분]
14:45  Intraday History ────── [~5분]
15:15  Intraday History (마지막) ── [~5분]
15:40  Paper Trading ──────────── [~10분]
15:45  Collect Investor 6회 ──────────── [~10분]
18:00  Backtest ────────────── [~5분] (읽기 전용)
18:05  Collect Investor 7회 ──────────── [~10분]
```

### 1-2. 경합 파일별 위험도

| 파일 | 쓰기 워크플로우 수 | 위험도 | merge 로직 |
|------|-------------------|--------|-----------|
| **latest.json** | 3개 (Daily, Refresh, Investor) | **극고** | merge_workflow_data.py |
| **intraday-history.json** | 3개 (Intraday, Refresh, Paper Trading) | **고** | 없음 (덮어쓰기) |
| **volume-profile.json** | 3개 (Refresh, Paper Trading, Forecast Intraday) | **고** | 없음 |
| **macro-indicators.json** | 4개 (Premarket, Futures, Refresh, Investor) | **중** | 없음 |
| **indicator-history.json** | 4개 (Premarket, Futures, Refresh, Investor) | **중** | 없음 |
| **theme-forecast.json** | 2개 (Forecast, Forecast Intraday) | **낮** | 없음 |

### 1-3. 최대 경합 구간 (현재)

| 시간대 | 동시 실행 가능 워크플로우 | 경합 파일 | 위험도 |
|--------|------------------------|----------|--------|
| **09:28~09:31** | Daily 2차 + Investor 1회 | latest.json | 높음 |
| **09:30~09:45** | Forecast Intraday + Investor + Intraday | volume-profile, latest | 높음 |
| **11:30~12:10** | **Refresh + Investor 3회 + Forecast Intraday 3회 + Intraday** | **latest, intraday-history, volume-profile, macro** | **극고** |
| **14:30~14:45** | Forecast Intraday 5회 + Investor 5회 + Intraday | volume-profile, latest | 높음 |
| **15:15~15:45** | Intraday(마지막) + Paper Trading + Investor 6회 | intraday-history, volume-profile, latest | 높음 |

**11:30 구간이 가장 심각** — 최대 4개 워크플로우 동시 실행 + 6개 파일 경합.

---

## 2. 경합 발생 메커니즘

### 2-1. 왜 경합이 발생하는가

```
Workflow A: git fetch → reset --hard → 데이터 복원 → merge → commit → push ✅
Workflow B: git fetch → reset --hard → 데이터 복원 → merge → commit → push ❌ (A가 먼저 push)
  → 재시도: git fetch → reset --hard (A의 push 반영) → 복원 → merge → push
  → 문제: B가 복원한 데이터가 A의 최신 데이터를 덮어쓸 수 있음
```

### 2-2. merge_workflow_data.py의 한계

- **latest.json만 보호** — 다른 파일(intraday-history, volume-profile, macro 등)은 merge 없이 덮어쓰기
- **타임스탬프 동일 시 불확정** — 동시 실행 시 어느 쪽이 보존될지 보장 없음
- **latest.json 내 일부 필드만 보호** — investor_data, investor_estimated, investor_updated_at + timestamp, theme_analysis, kospi_index 등

### 2-3. 실제 장애 사례 패턴

```
1. Refresh(40분) 실행 중 → Investor(10분) push 먼저 완료
   → Refresh push 실패 → 재시도 시 Investor 데이터 위에 Refresh 덮어쓰기
   → merge-investor로 investor 필드는 보존되나,
     Investor가 함께 갱신한 macro/indicator 데이터는 Refresh의 데이터로 대체

2. Intraday History(5분) 실행 중 → Refresh 내부 collect_intraday_history도 실행
   → 동일 파일 2곳에서 동시 생성
   → git push 경합 → 한쪽 데이터만 반영
```

---

## 3. 스케줄 최적화 방안

### 원칙

1. **같은 파일을 쓰는 워크플로우는 시간을 분리**한다
2. **Refresh(40분)는 다른 모든 워크플로우와 겹치지 않도록** 격리한다
3. **기존 텔레그램 알림(5종) 기능은 변경 없이 유지**한다
4. **데이터 갱신 빈도/품질은 유지하면서** 경합만 제거한다

### 3-1. 핵심 변경: Refresh 시간 이동

**현재**: 11:30 (장중 한복판, 모든 워크플로우와 충돌)
**변경**: **12:30** (점심시간, Investor/Intraday 사이 공백)

```
현재 11:30 구간:
  11:15 Intraday
  11:30 ★ Refresh (40분) + Forecast Intraday + Investor ← 4개 동시!
  11:31 Investor
  11:45 Intraday

변경 후 12:30 구간:
  12:15 Intraday → 12:20으로 이동 (12:25 완료)
  12:30 ★ Refresh (40분, ~13:10 완료)
  12:45 Intraday → 13:15으로 이동 (Refresh 완료 후)
  13:21 Investor ← Refresh 완료 후 안전
```

### 3-2. Collect Investor 시간 조정

**원칙**: Daily Theme Analysis, Refresh와 **최소 10분 간격** 확보

| 현재 | 변경 | 이유 |
|------|------|------|
| 09:31 | **09:35** | Daily 2차(09:28) 완료 예상(09:48)과 겹침 → 그대로 유지하되 5분 여유 |
| 10:01 | 10:01 | 변경 없음 (안전) |
| 11:31 | **13:15** | Refresh(12:30~13:10)와 완전 분리 |
| 13:21 | **13:25** | 위 13:15 이동으로 소폭 조정 |
| 14:31 | 14:35 | Forecast Intraday 5회(14:30)와 5분 분리 |
| 15:45 | 15:50 | Paper Trading(15:40) 완료 후 |
| 18:05 | 18:05 | 변경 없음 |

### 3-3. Intraday History 간격 조정 (Refresh 구간)

Refresh가 내부에서 `collect_intraday_history.py`를 실행하므로, Refresh 실행 중에는 외부 Intraday History를 **건너뛰기**.

| 현재 | 변경 | 이유 |
|------|------|------|
| 12:15 | **12:20** | Refresh(12:30) 시작 전 완료 보장 |
| 12:45 | **건너뛰기** | Refresh 내부에서 수집됨 |
| 13:15 | **13:15** | Refresh(~13:10) 완료 직후 |

### 3-4. Forecast Intraday 11:30 이동

| 현재 | 변경 | 이유 |
|------|------|------|
| 11:30 | **11:30** (유지) | Refresh가 12:30으로 이동했으므로 충돌 해소 |

---

## 4. 최적화 후 타임라인

```
07:00  Macro Premarket ─────── [~5분]
07:30  Theme Forecast ──────── [~10분]

── 장 개시 ──────────────────────────────────────────

09:05  Daily Theme Analysis 1차 ──────────────── [~20분]
09:10  Macro Futures ───────── [~5분]
09:15  Intraday History ────── [~5분]
09:28  Daily Theme Analysis 2차 ──────────────── [~20분]
09:30  Theme Forecast Intraday 1회 ──────── [~15분]
09:35  Collect Investor 1회 ──────────── [~10분]    ← 09:31→09:35 (+4분)
09:45  Intraday History ────── [~5분]
10:01  Collect Investor 2회 ──────────── [~10분]
10:15  Intraday History ────── [~5분]
10:30  Theme Forecast Intraday 2회 ──────── [~15분]
10:45  Intraday History ────── [~5분]
11:15  Intraday History ────── [~5분]
11:30  Theme Forecast Intraday 3회 ──────── [~15분]  ← 충돌 해소 (Refresh 이동)
11:45  Intraday History ────── [~5분]

── 점심 (Refresh 전용 구간) ─────────────────────────

12:20  Intraday History ────── [~5분]                 ← 12:15→12:20 (Refresh 전 완료)
       (12:25 완료 예상)
12:30  ★ Refresh Stock Data ──────────────────── [~40분] ★  ← 11:30→12:30 (격리)
       (내부에서 intraday + volume + macro 수집)
       (12:45 Intraday History 건너뛰기 — Refresh 내부에서 수집)

── Refresh 완료 후 재개 ─────────────────────────────

13:15  Intraday History ────── [~5분]                 ← Refresh 완료 확인 후
13:15  Collect Investor 3회 ──────────── [~10분]      ← 11:31→13:15 (Refresh 후)
13:25  Collect Investor 4회 ──────────── [~10분]      ← 13:21→13:25 (3회 완료 후) ※실제로는 3회 제거, 4회를 13:25로
13:30  Theme Forecast Intraday 4회 ──────── [~15분]
13:45  Intraday History ────── [~5분]
14:15  Intraday History ────── [~5분]
14:30  Theme Forecast Intraday 5회 ──────── [~15분]
14:35  Collect Investor 5회 ──────────── [~10분]      ← 14:31→14:35
14:45  Intraday History ────── [~5분]
15:15  Intraday History (마지막) ── [~5분]

── 장 마감 ──────────────────────────────────────────

15:40  Paper Trading ──────────── [~10분]
15:50  Collect Investor 6회 ──────────── [~10분]      ← 15:45→15:50
18:00  Backtest ────────────── [~5분] (읽기 전용)
18:05  Collect Investor 7회 ──────────── [~10분]
```

### 변경 요약

| 워크플로우 | 현재 | 변경 후 | 변경 사유 |
|-----------|------|---------|----------|
| **Refresh Stock Data** | 11:30 | **12:30** | 핵심: 모든 경합의 원인. 점심시간 격리 |
| Collect Investor 1회 | 09:31 | **09:35** | Daily 2차와 간격 확보 |
| Collect Investor 3회 | 11:31 | **13:15** | Refresh 완료 후로 이동 |
| Collect Investor 4회 | 13:21 | **13:25** | 3회 이동에 따른 조정 |
| Collect Investor 5회 | 14:31 | **14:35** | Forecast Intraday 5회와 간격 |
| Collect Investor 6회 | 15:45 | **15:50** | Paper Trading 완료 후 |
| Intraday History 12:15 | 12:15 | **12:20** | Refresh 시작 전 완료 보장 |
| Intraday History 12:45 | 12:45 | **건너뛰기** | Refresh 내부에서 수집 (중복 제거) |

---

## 5. 경합 해소 검증

### 5-1. latest.json 경합

| 시간대 | 현재 | 최적화 후 |
|--------|------|----------|
| 09:28~09:31 | Daily 2차 + Investor 1회 동시 | Daily 2차(~09:48) + Investor 1회(09:35) → **여전히 겹침 가능** |
| 11:30~12:10 | Refresh + Investor 동시 | Refresh(12:30) + Investor(13:15) → **해소** |
| 전체 | 3개 동시 가능 | **최대 2개** |

**09:28~09:48 구간**: Daily 2차와 Investor 1회가 여전히 겹칠 수 있으나, merge_workflow_data.py가 이를 처리하며 **11:30 대비 경합 규모가 작음** (2개 vs 4개). 완전 해소하려면 Investor 1회를 09:50으로 이동 가능하나, 수급 데이터 지연이 발생.

### 5-2. intraday-history.json 경합

| 시간대 | 현재 | 최적화 후 |
|--------|------|----------|
| 11:30~12:30 | Refresh + Intraday 동시 | Refresh(12:30) + Intraday(12:20 완료) → **해소** |
| 12:45 | Refresh 내부 + 외부 Intraday 동시 | 12:45 건너뛰기 → **해소** |
| 15:15~15:40 | Intraday + Paper Trading | Intraday(15:15~15:20) + Paper(15:40) → **20분 간격, 해소** |

### 5-3. volume-profile.json 경합

| 시간대 | 현재 | 최적화 후 |
|--------|------|----------|
| 11:30 | Refresh + Forecast Intraday 동시 | Forecast(11:30) 완료(11:45) + Refresh(12:30) → **해소** |

### 5-4. macro-indicators.json 경합

| 시간대 | 현재 | 최적화 후 |
|--------|------|----------|
| 11:30~12:10 | Refresh + Investor 동시 | Refresh(12:30) + Investor(13:15) → **해소** |

### 5-5. 경합 해소 종합

| 파일 | 현재 최대 동시 쓰기 | 최적화 후 | 개선 |
|------|-------------------|----------|------|
| latest.json | 3개 | **2개** | △ (09:28 구간 잔존) |
| intraday-history.json | 3개 | **1개** | ◎ |
| volume-profile.json | 3개 | **1개** | ◎ |
| macro-indicators.json | 3개 | **1개** | ◎ |
| indicator-history.json | 3개 | **1개** | ◎ |

---

## 6. 추가 개선안 (선택사항)

### 6-1. Refresh 내부 중복 수집 제거

현재 Refresh는 내부에서 4개 스크립트를 순차 실행:
1. `main.py --test --skip-ai` (전체 데이터)
2. `collect_volume_profile.py --intraday`
3. `collect_intraday_history.py`
4. `collect_macro_indicators.py`

이 중 **2~4번은 독립 워크플로우가 이미 동일 작업을 수행**. Refresh에서 제거하면:
- 실행 시간 40분 → **~15분** 단축
- 경합 파일 8개 → **4개**로 감소 (latest.json, history/, stock-history.json, history-index.json만 쓰기)

**트레이드오프**: Refresh의 목적이 "장중 한 번 전체 동기화"이므로, 독립 워크플로우의 실행이 보장된다면 제거 가능. 실행 보장이 안 되면(외부 cron 장애) 데이터 누락 위험.

### 6-2. Collect Investor 횟수 조정

현재 7회/일 → 실제 수급 데이터 변동이 의미 있는 시점만 유지:

| 시점 | 의미 | 유지 여부 |
|------|------|----------|
| 09:35 | 장 초반 외국인/기관 동향 | ✅ 유지 |
| 10:01 | 장 개시 30분 후 수급 확정 | ✅ 유지 |
| ~~11:31~~ 13:15 | 점심 전 수급 | ✅ 유지 (시간 변경) |
| 13:25 | 오후 장 수급 | ⚠️ 13:15와 10분 차 → **삭제 가능** |
| 14:35 | 마감 1시간 전 | ✅ 유지 |
| 15:50 | 장 마감 직후 최종 수급 | ✅ 유지 |
| 18:05 | 확정 수급 데이터 | ✅ 유지 |

→ 13:25 삭제 시 **7회 → 6회** (경합 1회 감소, 실질적 데이터 손실 미미)

### 6-3. Intraday History 30분 → 45분 간격

현재 13회 × 30분 간격 → 9회 × 45분 간격으로 변경 시:
- 일일 워크플로우 실행 횟수: 66회 → **62회** (-4회)
- git push 경합 기회 4회 감소
- 데이터 해상도: 30분 → 45분 (장중 등락 추적 정밀도 약간 하락)

**트레이드오프**: 현재 프론트엔드에서 30분 단위 차트를 그리는 경우 깨질 수 있음. 확인 필요.

---

## 7. 변경 적용 시 side-effect

### 영향 없음 (안전)
- **텔레그램 알림 5종**: 워크플로우 내부 로직, 스케줄 변경과 무관
- **프론트엔드**: 데이터 파일명/구조 변경 없음
- **Python 분석 모듈**: 변경 없음
- **merge_workflow_data.py**: 변경 없음
- **deploy-pages**: workflow_run 트리거이므로 시간 무관

### 영향 있음 (확인 필요)
- **외부 cron-job 서비스 설정 변경**: 11개 워크플로우의 cron 시간 수정 필요
- **Intraday History 12:45 건너뛰기**: cron-job에서 해당 시간 제거
- **Collect Investor 11:31→13:15**: 11:31~13:15 구간에 수급 데이터 공백 (~1시간 45분)
- **Refresh 12:30 시작**: 데이터 동기화가 1시간 늦어짐 (11:30→12:30)

### 수급 데이터 공백 평가

| 구간 | 현재 | 최적화 후 | 공백 |
|------|------|----------|------|
| 10:01 → 11:31 | 90분 | — | — |
| 10:01 → 13:15 | — | **195분** | +105분 증가 |

11:31 Investor를 완전히 삭제하는 게 아니라 13:15로 이동하는 것이므로, **점심시간 수급 공백이 발생**. 이를 완화하려면:
- Investor 11:31을 12:00으로 이동 (Refresh 12:30 시작 전 완료)
- 또는 11:31을 유지하되 Refresh를 12:40으로 더 늦춤

**대안: Investor 3회를 12:00으로 설정**

```
10:01  Investor 2회 ──── [~10분, 10:11 완료]
12:00  Investor 3회 ──── [~10분, 12:10 완료]    ← 11:31→12:00
12:30  Refresh ──────── [~40분, 13:10 완료]      ← 12:00 Investor 완료 후
13:25  Investor 4회 ──── [~10분]                  ← Refresh 완료 후
```

이 경우 수급 공백: 10:11→12:00 = **109분** (현재 90분 대비 19분 증가, 허용 범위).

---

## 8. 최종 권장 스케줄

```
07:00  Macro Premarket
07:30  Theme Forecast

09:05  Daily Theme Analysis 1차
09:10  Macro Futures
09:15  Intraday History
09:28  Daily Theme Analysis 2차
09:30  Theme Forecast Intraday 1회
09:35  Collect Investor 1회          ← +4분
09:45  Intraday History
10:01  Collect Investor 2회
10:15  Intraday History
10:30  Theme Forecast Intraday 2회
10:45  Intraday History
11:15  Intraday History
11:30  Theme Forecast Intraday 3회
11:45  Intraday History
12:00  Collect Investor 3회          ← 11:31→12:00
12:20  Intraday History              ← 12:15→12:20
12:30  ★ Refresh Stock Data ★        ← 11:30→12:30 (핵심 변경)
       (12:45 Intraday 건너뛰기)
13:15  Intraday History
13:25  Collect Investor 4회          ← 13:21→13:25
13:30  Theme Forecast Intraday 4회
13:45  Intraday History
14:15  Intraday History
14:30  Theme Forecast Intraday 5회
14:35  Collect Investor 5회          ← 14:31→14:35
14:45  Intraday History
15:15  Intraday History (마지막)

15:40  Paper Trading
15:50  Collect Investor 6회          ← 15:45→15:50
18:00  Backtest
18:05  Collect Investor 7회
```

### 변경 요약표

| # | 워크플로우 | 현재 | 변경 | 변경량 |
|---|-----------|------|------|--------|
| 1 | **Refresh Stock Data** | 11:30 | **12:30** | **+60분** |
| 2 | Collect Investor 1회 | 09:31 | 09:35 | +4분 |
| 3 | Collect Investor 3회 | 11:31 | **12:00** | **+29분** |
| 4 | Collect Investor 4회 | 13:21 | 13:25 | +4분 |
| 5 | Collect Investor 5회 | 14:31 | 14:35 | +4분 |
| 6 | Collect Investor 6회 | 15:45 | 15:50 | +5분 |
| 7 | Intraday History | 12:15 | 12:20 | +5분 |
| 8 | Intraday History 12:45 | 12:45 | **삭제** | 중복 제거 |

**총 변경: cron 시간 7건 수정 + 1건 삭제 (외부 cron-job 서비스에서)**
**코드 변경: 0건** (워크플로우 yml, Python 코드 모두 변경 없음)

---

## 9. 기대 효과

| 지표 | 현재 | 최적화 후 | 개선 |
|------|------|----------|------|
| 11:30 동시 실행 | 최대 4개 | **1개** (Refresh만) | ◎ |
| latest.json 최대 동시 쓰기 | 3개 | **2개** | △ |
| intraday-history.json 동시 쓰기 | 3개 | **1개** | ◎ |
| volume-profile.json 동시 쓰기 | 3개 | **1개** | ◎ |
| 일일 Intraday 실행 | 13회 | **12회** | 1회 감소 |
| git push 실패 확률 | 높음 (11:30) | **대폭 감소** | ◎ |
| merge_workflow_data.py 의존도 | 높음 | **낮음** (09:28 구간만) | ◎ |
| 텔레그램 알림 | 5종 유지 | **5종 유지** | 변경 없음 |
| 코드 변경 | — | **0건** | 안전 |
