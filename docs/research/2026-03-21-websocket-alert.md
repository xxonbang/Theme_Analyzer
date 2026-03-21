# GCP e2-micro 하이브리드 분석 및 WebSocket 알림 데몬 설계

> 조사일: 2026-03-21

---

## 1. GCP e2-micro 하이브리드 동작 방식

### 하이브리드 구조

```
┌─ GCP e2-micro (US 리전, 상시, 무료) ─────────────┐
│                                                     │
│  [WebSocket 데몬]                                   │
│   └─ KIS WebSocket(ws://) 상시 연결                 │
│   └─ 대장주 15종목 체결가(H0STCNT0) 수신            │
│   └─ 급등/급락 감지 → Telegram 즉시 알림            │
│                                                     │
│  [경량 스케줄러] (APScheduler)                       │
│   └─ investor-intraday 수집 (7회/일)               │
│   └─ intraday-history 수집 (13회/일)               │
│   └─ Firestore에 JSON 직접 저장                     │
│                                                     │
└─────────────────────────────────────────────────────┘
         +
┌─ GitHub Actions (유지) ─────────────────────────────┐
│                                                      │
│  daily-theme-analysis (2회) ← Gemini AI, 메모리 대량 │
│  theme-forecast (1회) + intraday (5회) ← Gemini AI   │
│  refresh-data (1회) ← 전체 데이터 재수집              │
│  collect-macro (2회) ← 해외 지표                     │
│  collect-paper-trading (1회) ← 모의투자 성과          │
│  backtest (1회) ← 예측 검증                          │
│                                                      │
│  → git commit/push → deploy-pages (유지)             │
└──────────────────────────────────────────────────────┘
```

### e2-micro 실행 가능 범위 (1GB RAM)

| 모듈 | RAM 사용량 | 비고 |
|------|-----------|------|
| KIS WebSocket 데몬 | ~50MB | 체결가 수신 + 알림 |
| collect_investor_data | ~200MB | 수급 수집 (7회/일) |
| collect_intraday_history | ~150MB | 분봉 등락률 (13회/일) |
| **합계** | **~400~500MB** | 1GB 내 가능, 여유 ~500MB |

### GitHub Actions 유지 대상 (무거운 작업)

| 워크플로우 | 이유 |
|-----------|------|
| daily-theme-analysis | Gemini AI + 전체 분석, ~800MB+ RAM 필요 |
| theme-forecast / intraday | Gemini AI 호출 |
| refresh-data | 전체 종목 재수집 |
| collect-macro | 해외 지표 수집 |
| collect-paper-trading | 모의투자 성과 |
| backtest | 예측 검증 |

---

## 2. Side-Effect 분석

### 발생하는 side-effect

| 문제 | 심각도 | 설명 |
|------|--------|------|
| **`latest.json` 이중 쓰기** | **높음** | investor 데이터는 e2-micro에서, theme analysis 데이터는 GA에서 → 동일 파일 양쪽에서 갱신. 현재의 `merge_workflow_data.py` 경합 문제가 GA↔GCP 간 크로스 시스템 경합으로 변질 |
| **데이터 정합성** | **높음** | e2-micro(Firestore)와 GA(git)에 데이터가 분산 → 프론트엔드가 2곳에서 읽어야 함. 어느 쪽이 최신인지 판단 로직 필요 |
| **토큰 경합** | **중간** | e2-micro와 GA가 동시에 KIS 토큰 사용 → 토큰 재발급 시 한쪽이 무효화될 수 있음 (1일 1회 발급 제한) |
| **US 리전 레이턴시** | **중간** | KIS 서버(한국) ↔ US e2-micro 간 ~150ms. 200종목 × 150ms = 30초 추가 지연 |
| **`merge_workflow_data.py` 유지+확장 필요** | **중간** | GA 워크플로우가 여전히 커밋하므로 merge 로직 삭제 불가. GCP 데이터와의 병합 로직 추가 필요 |
| **프론트엔드 이중 데이터소스** | **중간** | 일부 GitHub Pages JSON, 일부 Firestore → 훅 대폭 수정 필요 |
| **모니터링 복잡도** | **낮음** | 장애 시 GA 문제인지 GCP 문제인지 파악 어려움 |

### 핵심: git push 경합이 해소되지 않음

```
현재:     GA 워크플로우 A ←경합→ GA 워크플로우 B  (같은 시스템 내)
하이브리드: GA 워크플로우 ←경합→ GCP e2-micro     (다른 시스템 간, 더 복잡)
```

---

## 3. 이득 분석

### 이득이 되는 것

| 항목 | 이득 | 정량화 |
|------|------|--------|
| **실시간 알림** | KIS WebSocket으로 급등/급락 즉시 감지 → Telegram | 현재 30분 지연 → 즉시 |
| **콜드 스타트 감소** | 20회/일(investor 7 + intraday 13) pip install 제거 | ~40분/일 절감 |
| **cron 의존 감소** | 20회 분의 외부 cron 의존 제거 | 외부 장애 영향 축소 |

### 이득이 안 되는 것

| 항목 | 이유 |
|------|------|
| **git push 경합 해소** | GA가 여전히 커밋하므로 경합 잔존. 크로스 시스템 경합은 오히려 더 복잡 |
| **deploy-pages 감소** | GA 커밋 계속 발생 → 트리거 횟수 변화 미미 (33회 → ~20회) |
| **아키텍처 단순화** | 한 시스템 → 두 시스템 관리. 모니터링·배포·디버깅 복잡도 증가 |
| **프론트엔드 개선** | 이중 데이터소스가 오히려 복잡 |

### 투입 대비 효과

```
[투입] ~8~9일 작업
- GCP 셋업 + 네트워크: ~1일
- WebSocket 데몬 개발: ~2일
- 토큰 공유 재설계: ~1일
- 수집 코드 GCP 적응: ~1일
- Firestore + 프론트엔드 수정: ~2일
- 크로스 시스템 정합성 로직: ~1일
- 모니터링/장애 대응: ~1일

[효과] 실시간 알림 + 콜드스타트 40분/일 절감
[부작용] 아키텍처 복잡도 대폭 증가
```

---

## 4. 최종 판단: 하이브리드 비권장

e2-micro 하이브리드는 **핵심 문제(git push 경합)가 해소되지 않고 오히려 악화**되므로 비권장.

### 대안 비교

| 방안 | 작업량 | 효과 | side-effect |
|------|--------|------|-------------|
| **A. 현행 유지** | 0일 | - | 없음 |
| **B. WebSocket 알림 데몬만** (e2-micro) | ~2일 | 급등/급락 즉시 알림 | 거의 없음 (기존 코드 변경 불필요) |
| **C. 전체 이관** (e2-small $9/월) | ~8일 | 모든 문제 해소 | 대규모 변경이지만 정합성 보장 |

**B안(WebSocket 알림 데몬만)이 최적** — 기존 프로그램 변경 없이 독립적으로 동작.

---

## 5. B안 상세 설계: WebSocket 알림 데몬

### 종목 선별 기준

KIS WebSocket 최대 40개 구독 제한 (종목×데이터타입 조합).
체결가만 수신 시 최대 40종목, 체결가+호가 시 최대 20종목.

### 선별 방식 3가지

#### A. 자동 — 테마 대장주

```
매일 09:05 Daily Theme Analysis 완료 후
  → latest.json에서 테마별 leader_code 추출 (~10~15종목)
  → e2-micro가 latest.json을 읽어서 구독 목록 자동 갱신
  → KIS WebSocket 재구독
```

#### B. 자동 — 모의투자 보유 종목

```
매일 09:05 이후
  → paper-trading 보유 종목 (~10~15종목) 자동 구독
  → 실시간 손익 추적 + 급등/급락 알림
```

#### C. 수동 — Telegram 커맨드 또는 설정 파일

```
/watch 005930        → 삼성전자 구독 추가
/unwatch 005930      → 구독 해제
/watchlist           → 현재 구독 목록 확인
```

### 권장 슬롯 배분

| 슬롯 | 종목 수 | 선별 기준 | 갱신 시점 |
|------|---------|----------|----------|
| 지수 | 2 | KOSPI, KOSDAQ | 고정 |
| 테마 대장주 | 10~15 | `latest.json` leader_code | 09:05 분석 후 자동 |
| 모의투자 보유 | 5~10 | paper-trading 매수 종목 | 09:05 후 자동 |
| 수동 지정 | 5~10 | Telegram /watch 또는 설정 파일 | 즉시 |
| **합계** | **~30~35** | | 40 한도 내 여유 |

### 알림 기준

| 이벤트 | 기준 | 설명 |
|--------|------|------|
| 급등 | 전일 종가 대비 +5% 돌파 | 상한가 접근 감지 |
| 급락 | 전일 종가 대비 -3% 하회 | 손절 라인 감지 |
| 거래량 폭증 | 직전 5분 평균 대비 3배 | 세력 유입 가능성 |
| 수급 반전 | 외국인/기관 순매수→순매도 | 호가 데이터 기반 |
| 목표가 도달 | 수동 설정 가격 | 개별 종목 관리 |

### 아키텍처

```
┌─ GCP e2-micro (상시, 독립 운영) ─────────────────┐
│                                                     │
│  [WebSocket 데몬]                                   │
│   ├─ KIS WebSocket(ws://) 상시 연결                 │
│   ├─ 30초 PINGPONG 유지                             │
│   ├─ 구독 종목 체결가(H0STCNT0) 수신               │
│   ├─ 급등/급락/거래량 폭증 감지                     │
│   └─ Telegram Bot API로 즉시 알림                   │
│                                                     │
│  [종목 갱신 스케줄러]                               │
│   ├─ 09:10 GitHub Pages latest.json 폴링           │
│   ├─ leader_code + paper-trading 종목 추출          │
│   └─ WebSocket 구독 목록 자동 갱신                  │
│                                                     │
│  [Telegram Bot] (선택)                              │
│   ├─ /watch, /unwatch, /watchlist 커맨드            │
│   └─ 수동 종목 관리                                 │
│                                                     │
└─────────────────────────────────────────────────────┘

기존 GitHub Actions 파이프라인: 변경 없음
기존 프론트엔드: 변경 없음
기존 Python 모듈: 변경 없음
```

**핵심 특징: 기존 시스템과 완전 독립. side-effect 제로.**

---

## 6. 보완 사항 (stock_toolkit 프로젝트 GCP 연구 참고)

> 참고: `/Users/sonbyeongcheol/DEV/stock_toolkit/docs/research/2026-03-21-gcp-migration.md`

### 6-1. ~~무료 리전: asia-east1(대만) 사용 가능~~ → ❌ 오류 정정

stock_toolkit 연구에서 "asia-east1(대만)도 무료"라고 기술했으나, **GCP 공식 문서 재확인 결과 이는 사실이 아님.**

> "1 non-preemptible e2-micro VM instance per month in one of the following US regions:
> Oregon: us-west1, Iowa: us-central1, South Carolina: us-east1"
> — [GCP Free Cloud Features](https://docs.cloud.google.com/free/docs/free-cloud-features)

**e2-micro 무료 리전은 US 3곳뿐:**

| 리전 | KIS 서버(한국)와 레이턴시 | 무료 여부 |
|------|-------------------------|----------|
| us-west1 (오리건) | ~130ms | ✅ 무료 |
| us-central1 (아이오와) | ~150ms | ✅ 무료 |
| us-east1 (사우스캐롤라이나) | ~170ms | ✅ 무료 |
| asia-east1 (대만) | ~30ms | **❌ 유료** |
| asia-northeast3 (서울) | ~5ms | ❌ 유료 |

**영향:**
- B안의 KIS 레이턴시는 ~130~150ms (US 리전 기준)
- WebSocket 체결가 수신에는 ~150ms 지연이라도 알림 용도로는 충분 (초 단위 감지가 목표)
- REST API 호출(latest.json 폴링 등)에도 실질적 문제 없음

**결론: e2-micro는 us-west1(오리건)에 배치 (레이턴시 최소인 US 리전). ~130ms 지연은 알림 데몬 용도에 실용적으로 문제없음.**

### 6-2. Firestore 비용 — 무료 한도 초과 거의 확실

기존 연구에서 Firestore를 "무료(50K읽기/20K쓰기/일)"로 간단히 언급했으나, 실제 체결가를 Firestore에 기록하면 무료 한도를 대폭 초과함.

| 시나리오 | 일일 쓰기 건수 | 무료 한도(20K/일) 대비 | 월 추가 비용 (Blaze) |
|---------|--------------|----------------------|---------------------|
| 건건이 쓰기 | ~120,000건 (40종목 × 3,000체결) | **6배 초과** | ~$4.72/월 |
| 10초 배치 | ~86,400건 | 4.3배 초과 | ~$2.50/월 |
| 30초 배치 | ~28,800건 | 1.4배 초과 | ~$0.90/월 |

추가로 프론트엔드 `onSnapshot` 리스너 사용 시 문서 변경마다 읽기 1건으로 카운트됨.

**결론: B안(알림 데몬만)에서는 Firestore를 사용하지 않으므로 해당 없음. 향후 전체 이관 시 Firestore 대신 인메모리 캐시 + SSE 방식을 권장.**

### 6-3. 인메모리 캐시 + SSE 방식 — Firestore 대안

stock_toolkit 연구에서 제안한 아키텍처:

```
KIS WebSocket 체결가 수신
  → e2-micro 인메모리 캐시 (최신 N건)
  → SSE(Server-Sent Events) 서버로 프론트엔드 직접 전달
  → 조건 충족 시 Telegram 알림
```

**장점:**
- Firestore 비용 $0 (DB 자체를 사용하지 않음)
- 프론트엔드가 EventSource로 연결하면 실시간 갱신
- e2-micro 메모리 내에서 완결

**단점:**
- e2-micro 재시작 시 캐시 소멸 (체결 히스토리 유실)
- 프론트엔드가 e2-micro에 직접 연결해야 함 (CORS, IP 관리)

**B안에서의 적용:**
- 현재 B안은 Telegram 알림만이므로 SSE는 불필요
- 향후 대시보드 실시간 위젯 추가 시 이 방식이 최적

### 6-4. e2-micro CPU 제한 — 버스트 한계

| 항목 | 스펙 |
|------|------|
| 기본 CPU | 0.25 vCPU |
| 버스트 | 가능 (일시적으로 1 vCPU까지) |
| 지속 사용 | **제한됨** — 장시간 100% 사용 시 쓰로틀링 |

B안(WebSocket 데몬)은 대부분 I/O 대기 상태(WebSocket 수신 대기)이므로 CPU 사용량이 극히 낮아 문제없음. 다만 전체 이관(하이브리드) 시 분석 모듈 실행은 CPU 병목 가능.

### 6-5. 네트워크 이그레스 상세

| 트래픽 유형 | 방향 | 과금 | B안 영향 |
|------------|------|------|---------|
| KIS WebSocket 수신 | 인그레스 | **무료** | 없음 |
| KIS REST API 응답 | 인그레스 | **무료** | 없음 |
| Telegram 알림 발송 | 이그레스 | 1GB/월 무료 | 알림 텍스트는 극소량, 충분 |
| GitHub Pages JSON 폴링 | 이그레스 | 1GB/월 무료 | latest.json ~1MB × 1회/일 = 무시 |
| **Firestore 쓰기** | Google 내부 | **무료** | B안에서 미사용 |

**결론: B안에서 이그레스 1GB/월 한도 초과 가능성 없음.**

---

## 7. 보완 반영 후 B안 최종 사양

| 항목 | 기존 | 보완 후 |
|------|------|---------|
| **리전** | US (레이턴시 ~150ms) | **us-west1 오리건 (레이턴시 ~130ms)** ※asia-east1은 유료로 확인 |
| 데이터 저장 | Firestore 언급 | **인메모리 캐시 (Firestore 미사용, 비용 $0)** |
| CPU 제약 | 미언급 | 0.25 vCPU, WebSocket I/O 대기 중심이라 문제없음 |
| 이그레스 | 미분석 | 1GB/월 내 충분 |
| **월 비용** | $0 | **$0 (확정)** |

### 보완된 B안 아키텍처

```
┌─ GCP e2-micro (us-west1 오리건, 상시, 무료) ─────┐
│                                                     │
│  [WebSocket 데몬]                                   │
│   ├─ KIS WebSocket(ws://) 상시 연결                 │
│   ├─ 30초 PINGPONG 유지                             │
│   ├─ 구독 종목 체결가(H0STCNT0) 수신               │
│   ├─ 인메모리 캐시 (최신 체결가 + 전일종가)         │
│   ├─ 급등/급락/거래량 폭증 감지                     │
│   └─ Telegram Bot API로 즉시 알림 (~130ms 지연)    │
│                                                     │
│  [종목 갱신 스케줄러]                               │
│   ├─ 09:10 GitHub Pages latest.json 폴링           │
│   ├─ leader_code + paper-trading 종목 추출          │
│   └─ WebSocket 구독 목록 자동 갱신                  │
│                                                     │
│  [Telegram Bot] (선택)                              │
│   ├─ /watch, /unwatch, /watchlist 커맨드            │
│   └─ 수동 종목 관리                                 │
│                                                     │
└─────────────────────────────────────────────────────┘

기존 GitHub Actions: 변경 없음
기존 프론트엔드: 변경 없음
기존 Python 모듈: 변경 없음
비용: $0/월
레이턴시: ~130ms (알림 용도에 실질적 문제 없음)
```

---

## 8. stock_toolkit 알림 기능과의 중복 검토

### 8-1. stock_toolkit 알림 현황

stock_toolkit 프로젝트는 이미 **24종의 알림 모듈**을 보유하고 있으며, 동일한 GCP e2-micro WebSocket 데몬을 계획 중임.

| 카테고리 | 수량 | 주요 알림 |
|---------|------|----------|
| 시장 시그널 | 7 | Cross Signal, Anomaly(5종), Sentiment, Premarket |
| 종목 특화 | 8 | Surge, Smart Money, Short Squeeze, VP Divergence, Gap, Orderbook, Program, Insider |
| 포트폴리오/리스크 | 2 | Risk Monitor, Theme Lifecycle |
| 수급/섹터 | 3 | Supply Cluster, Sector Flow, Theme Propagation |
| 분석 | 4 | News Impact, Event Calendar, Valuation, Consensus Drift |

### 8-2. 중복 항목 대조

| theme_analysis B안 | stock_toolkit 현재 | stock_toolkit GCP 계획 | **중복 판정** |
|---|---|---|---|
| **급등 감지** (+5%) | Surge Alert (≥+15% & 거래량≥200%) | WebSocket 급등 (≥+5%) | **❌ 완전 중복** |
| **급락 감지** (-3%) | — | — | ✅ 고유 |
| **거래량 폭증** (5분 3배) | Anomaly: Volume Spike (20일 5배) | — | ⚠️ 유사 (기준 다름) |
| **수급 반전** (외국인/기관) | Supply Cluster (9개 레짐) + Program Tracker | WebSocket Flow Reversal | **❌ 완전 중복** |
| **목표가 도달** | Exit Optimizer (ATR 기반 TP/SL) | — | ⚠️ 유사 |

**5개 중 2개 완전 중복, 2개 유사 → 고유 기능은 급락 감지(-3%) 1개뿐.**

### 8-3. KIS WebSocket 연결 충돌 문제

두 프로젝트가 **동일한 KIS APP_KEY/SECRET**을 공유하고 있으며, KIS WebSocket은 동일 키로 동시 연결 시 이전 연결이 끊어질 수 있음.

| 항목 | theme_analysis B안 | stock_toolkit GCP 계획 |
|------|-------------------|----------------------|
| WebSocket 구독 한도 | 40개 | 40개 |
| 구독 배분 | 대장주 15 + 모의투자 10 + 지수 2 + 수동 13 | 보유종목 10 + 시그널 15 + 호가 10 + 여유 5 |
| KIS APP_KEY | **동일** | **동일** |
| WebSocket 접속키 | `/oauth2/Approval` 발급 | `/oauth2/Approval` 발급 |

**각각 데몬을 운영하면 서로 연결을 끊는 충돌이 발생.**

### 8-4. 최종 판단: theme_analysis 단독 B안 비권장

| 방향 | 설명 | 권장도 |
|------|------|--------|
| **A. theme_analysis B안 취소** | stock_toolkit GCP 데몬이 두 프로젝트 알림을 통합 담당 | **◎ 권장** |
| **B. 통합 데몬 1개 구축** | 두 프로젝트가 공유하는 단일 WebSocket 데몬 | ◎ 권장 (A와 동치) |
| **C. theme_analysis 고유 알림만** | 급락(-3%) 1개만 유지, 나머지 stock_toolkit 위임 | △ 과잉 인프라 |
| **D. 양쪽 각각 데몬 운영** | — | ✕ WebSocket 충돌 + 알림 중복 |

**결론:**
- theme_analysis에서 독립적으로 WebSocket 알림 데몬을 만들 이유가 없음
- stock_toolkit이 이미 **더 정교한 알림 로직(24종)**을 보유하고, **같은 GCP e2-micro 계획**을 진행 중
- WebSocket 데몬은 **stock_toolkit 측에서 1개만 운영**하고, theme_analysis의 대장주/모의투자 종목도 해당 데몬의 구독 목록에 포함시키는 것이 합리적
- theme_analysis는 현행 GitHub Actions 파이프라인을 유지하고, 실시간 알림은 stock_toolkit에 위임

### 8-5. 향후 통합 데몬 구성 시 theme_analysis 기여 항목

theme_analysis가 stock_toolkit 통합 데몬에 제공할 수 있는 고유 데이터:

| 데이터 | 출처 | 활용 |
|--------|------|------|
| 테마 대장주 목록 | `latest.json` leader_code | WebSocket 구독 대상 자동 선별 |
| 모의투자 보유 종목 | `paper-trading/*.json` | 실시간 손익 추적 |
| 테마별 등락률 추이 | `intraday-history.json` | 테마 단위 급등/급락 감지 |
| 업종별 시세 | `sector_performance` 모듈 | 섹터 회전 감지 |

→ theme_analysis는 **데이터 제공자**, stock_toolkit은 **알림 실행자** 역할로 분담.
