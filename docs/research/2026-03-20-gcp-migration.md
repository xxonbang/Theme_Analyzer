# GitHub Actions → GCP 이관 연구

> 조사일: 2026-03-20
> 참고: signal-pulse 프로젝트 GCP 이관 검토 내용

---

## 1. 현재 아키텍처 현황

### 규모

| 항목 | 수치 |
|------|------|
| 워크플로우 | 12개 |
| 일일 실행 횟수 | ~66회 (deploy-pages 포함) |
| 일일 최대 실행 시간 | ~905분 (15시간) |
| 외부 API | 8종 (KIS, Gemini, Telegram, Naver, Supabase, Finnhub, Gmail, yfinance) |
| 생성 JSON 파일 | 15+ 종류 |
| 스케줄링 | 외부 cron-job 서비스 + workflow_dispatch |

### 시간대별 파이프라인 (평일)

```
07:00  Macro Premarket (해외 거시지표)
07:30  Theme Forecast (장전 테마 예측)
09:05  Daily Theme Analysis 1차 (전체 분석 + AI 리포트)
09:10  Macro Futures (KOSPI200 + 선물)
09:15~ Intraday History (30분 간격, 13회)
09:28  Daily Theme Analysis 2차
09:30  Theme Forecast Intraday (5회/일)
09:31~ Collect Investor Data (7회/일)
11:30  Refresh Stock Data (전체 데이터 재수집)
15:40  Paper Trading (모의투자 성과)
18:00  Backtest (예측 검증)
18:05  Investor Data 최종
```

### 현재 아키텍처의 고질적 문제

#### A. git push 경합 (가장 심각)
- 11:30에 3~4개 워크플로우가 동시 실행 → `latest.json` 동시 쓰기 충돌
- `merge_workflow_data.py`로 save/merge 패턴 구현, push 실패 시 3회 retry
- `git reset --hard origin/main` 후 데이터 복원 → 복잡하고 취약

#### B. 콜드 스타트 반복
- 매 실행마다: pip install → KIS 토큰 로드 → API 호출 → git commit/push
- `collect-intraday-history`는 하루 13회 × 동일한 초기화 반복
- `collect-investor-data`는 7회 반복

#### C. 실시간성 불가
- 최소 갱신 주기: 30분 (intraday-history)
- WebSocket 사용 불가 (워크플로우는 일시적 프로세스)
- 급등/급락 실시간 감지 불가능

#### D. 외부 cron 의존
- 11개 워크플로우가 외부 cron-job 서비스에 의존 (workflow_dispatch)
- cron 서비스 장애 시 전체 파이프라인 중단
- GitHub 내장 cron은 `theme-forecast-intraday` 1개만 사용 (정확도 낮아서)

#### E. GitHub Actions 분 소비
- 월 ~905분×22일 = ~19,910분 (무료 2,000분 한참 초과)
- Public repo라서 무료지만, Private 전환 시 즉시 유료화

---

## 2. GCP 이관 시 해소되는 문제

### 문제별 해소 여부

| 현재 문제 | GCP 이관 시 | 해소 방식 |
|-----------|------------|-----------|
| git push 경합 | **완전 해소** | JSON 파일 → DB/메모리 직접 쓰기, git 불필요 |
| 콜드 스타트 반복 | **완전 해소** | 상시 프로세스, KIS 클라이언트/토큰 메모리 유지 |
| 실시간성 불가 | **해소** | KIS WebSocket으로 실시간 체결/호가 수신 |
| 외부 cron 의존 | **해소** | Cloud Scheduler 또는 내부 APScheduler |
| Actions 분 소비 | **해소** | GCP 무료 티어 또는 고정 VM 비용 |
| deploy-pages 과다 | **해소** | SSE/WebSocket으로 프론트엔드 실시간 갱신 |

### 추가 이점

| 이점 | 설명 |
|------|------|
| **KIS WebSocket 실시간** | 체결가(H0STCNT0), 호가(H0STASP0) 실시간 수신 (최대 40종목) |
| **실시간 알림** | 급등/수급 반전 감지 → 즉시 Telegram 알림 (현재 30분~1시간 지연) |
| **프론트엔드 실시간** | Firestore 실시간 리스너 또는 SSE로 대시보드 자동 갱신 |
| **분석 지연 제거** | 장중 분석 결과 즉시 반영 (현재: 수집→커밋→deploy→반영 ~5분 지연) |
| **리소스 효율** | 1개 프로세스가 메모리에 모든 상태 유지 (현재: 66회 프로세스 생성/소멸) |
| **Strategy Builder 운영** | 동일 서버에서 자동매매 시스템 운영 가능 |

---

## 3. KIS WebSocket 사양 (기존 연구 참고)

| 항목 | 내용 |
|------|------|
| 프로토콜 | `ws://` (TLS 아님) |
| 실시간 체결가 | TR: `H0STCNT0` (국내주식) |
| 실시간 호가 | TR: `H0STASP0` (10호가) |
| 체결통보 | TR: `H0STCNI0` (주문 체결 알림) |
| 최대 구독 | 40개 (종목×데이터타입 조합) |
| 연결 유지 | 30초 간격 PINGPONG 필수 |
| 인증 | WebSocket 접속키 별도 발급 필요 (`/oauth2/Approval`) |

### 현재 프로젝트 활용 시나리오

현재 테마 대장주 ~10~15종목의 실시간 데이터를 수신한다고 가정:
- 대장주 15종목 × (체결가 + 호가) = 30 구독 (40 제한 내)
- 코스피/코스닥 지수 2종목 추가 = 32 구독

**실시간으로 가능해지는 것:**
- 대장주 급등/급락 즉시 감지 → Telegram 알림
- 외국인/기관 순매수 추이 실시간 추적 (호가 데이터 활용)
- 프론트엔드 실시간 가격 갱신
- 모의투자 실시간 손익 추적

---

## 4. 아키텍처 옵션 비교

### Option A: 하이브리드 (e2-micro + Cloud Functions) — 무료 우선

```
┌─────────────────────────────────────────────────────────────┐
│  GCP Compute Engine e2-micro (상시, 무료)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ KIS WebSocket │  │ APScheduler  │  │ 데이터 수집 모듈  │   │
│  │ 수신기        │  │ (cron 대체)  │  │ (현재 Python 코드)│   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │              │
│         └─────────────────┼────────────────────┘              │
│                           ▼                                   │
│                    ┌──────────────┐                           │
│                    │  Firestore   │ ← 실시간 DB              │
│                    └──────┬───────┘                           │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ Frontend │ │ Telegram │ │ Cloud Func.  │
        │ (Firestore│ │  Bot     │ │ (Gemini AI)  │
        │  listener)│ │          │ │              │
        └──────────┘ └──────────┘ └──────────────┘
```

| 항목 | 비용 |
|------|------|
| e2-micro (상시) | 무료 (us-central1/us-west1/us-east1) |
| Firestore | 무료 (1GB + 50K읽기/20K쓰기/일) |
| Cloud Scheduler | 무료 (3개 job) |
| Cloud Functions | 무료 (2M 호출/월) |
| **총 월비용** | **$0 (무료 티어 내)** |

**장점:**
- 완전 무료 운영 가능
- WebSocket 실시간 지원
- git push 경합 완전 해소

**단점:**
- e2-micro 1GB RAM → 전체 분석 모듈 동시 실행 시 빡빡
- 미국 리전 → KIS 서버 (한국) 간 ~150ms 레이턴시
- Gemini AI 호출은 Cloud Functions로 분리 필요 (메모리 제약)

### Option B: e2-small 단일 서버 — 실용적 균형

```
┌─────────────────────────────────────────────────────────────┐
│  GCP Compute Engine e2-small (상시, asia-northeast3 서울)    │
│  2 vCPU, 2GB RAM                                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ KIS WebSocket │  │ APScheduler  │  │ 전체 분석 모듈    │   │
│  │ 수신기        │  │ (cron 대체)  │  │ (main.py 등)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ FastAPI 서버  │  │ Telegram Bot │  │ Gemini AI 호출   │   │
│  │ (API + SSE)  │  │              │  │                   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
    ┌──────────┐
    │ Frontend │  ← SSE/WebSocket으로 실시간 갱신
    │ (Vercel  │     또는 같은 서버에서 정적 호스팅
    │  무료)   │
    └──────────┘
```

| 항목 | 비용 (24/7) | 비용 (장시간만 143h/월) |
|------|------------|----------------------|
| e2-small (서울) | ~$15/월 | ~$3/월 |
| SSD 30GB | ~$6/월 | ~$6/월 |
| **총 월비용** | **~$21/월** | **~$9/월** |

**장점:**
- 서울 리전 → KIS 레이턴시 최소
- 2GB RAM → 전체 분석 모듈 + WebSocket 동시 운영 가능
- 단일 서버로 관리 단순
- Strategy Builder도 같은 서버에서 운영 가능

**단점:**
- 무료 아님 (월 $9~21)
- 서버 관리 필요 (모니터링, 재시작 등)

### Option C: 장시간만 운영 (Instance Schedule) — 최소 비용

Option B와 동일하되, **Instance Schedule**로 평일 06:50~18:30만 자동 시작/종료.

| 항목 | 비용 |
|------|------|
| e2-small (서울, 143h/월) | ~$3/월 |
| SSD 30GB | ~$6/월 |
| **총 월비용** | **~$9/월** |

장 전(07:00) 분석부터 장 후(18:05) 최종 수집까지 커버.

---

## 5. 이관 시 변경 사항 매핑

### 현재 → GCP 대응

| 현재 (GitHub Actions) | GCP 이관 후 |
|----------------------|-------------|
| 12개 워크플로우 YML | 1개 Python 프로세스 (APScheduler) |
| 외부 cron-job 서비스 | APScheduler 또는 Cloud Scheduler |
| `latest.json` git 커밋 | Firestore 또는 메모리 + API 서빙 |
| `merge_workflow_data.py` | **삭제** (경합 자체가 없음) |
| KIS REST API 폴링 (30분) | KIS WebSocket 실시간 + REST 병행 |
| GitHub Pages 정적 배포 | SSE/WebSocket 실시간 갱신 또는 Vercel |
| deploy-pages (~33회/일) | **불필요** (실시간 갱신) |
| pip install 매회 반복 | 1회 설치, 상시 실행 |
| KIS 토큰 캐시 파일 공유 | 메모리에 상시 유지 |
| `.kis_token_cache.json` | 불필요 (메모리) |
| Supabase (토큰 공유용) | 직접 메모리 관리 (Supabase는 다른 용도로 유지) |

### 보존해야 할 것

| 항목 | 이유 |
|------|------|
| Python 분석 모듈 전체 | 핵심 로직, 그대로 재사용 |
| Gemini AI 연동 | API 호출 방식 동일 |
| Telegram 알림 | 동일 |
| Supabase 연동 | 데이터 저장용으로 유지 |
| 프론트엔드 React 코드 | 데이터 소스만 변경 (JSON 파일 → API/Firestore) |

---

## 6. 이관 단계별 로드맵

### Phase 1: 기반 구축 (1~2일)
- GCP Compute Engine 인스턴스 생성 (e2-small, 서울)
- Python 환경 + 프로젝트 코드 배포
- APScheduler로 기존 cron 스케줄 재현
- **검증**: 기존과 동일한 분석 결과 생성 확인

### Phase 2: 데이터 서빙 전환 (2~3일)
- FastAPI 서버 추가 (JSON API + SSE 엔드포인트)
- 프론트엔드를 JSON 파일 → API 호출로 전환
- Vercel 또는 Cloud Run에 프론트엔드 배포
- **검증**: 대시보드 정상 동작 확인

### Phase 3: WebSocket 실시간 (2~3일)
- KIS WebSocket 접속키 발급 및 연결 구현
- 대장주 실시간 체결가/호가 수신
- 실시간 알림 로직 (급등/수급 반전 감지)
- 프론트엔드 실시간 갱신 (SSE)
- **검증**: 장중 실시간 데이터 흐름 확인

### Phase 4: GitHub Actions 제거 (1일)
- 모든 워크플로우 비활성화
- 외부 cron-job 서비스 해제
- GitHub Pages → 새 프론트엔드 호스팅으로 DNS 전환

---

## 7. 리스크 및 주의사항

| 리스크 | 대응 |
|--------|------|
| 서버 다운 시 전체 파이프라인 중단 | Cloud Monitoring + 자동 재시작 스크립트 |
| e2-micro 메모리 부족 (Option A) | Option B(e2-small)로 업그레이드 |
| KIS WebSocket 연결 끊김 | 자동 재연결 로직 + PINGPONG 30초 |
| 미국 리전 레이턴시 (Option A) | 서울 리전 사용 (Option B/C) |
| 프론트엔드 호스팅 변경 | Vercel 무료 티어 또는 Cloud Run 무료 |
| 이관 중 서비스 중단 | Phase별 점진 이관, GitHub Actions 병행 운영 |

---

## 8. 최종 판단

### 이관 가치: **높음**

현재 아키텍처의 가장 큰 문제인 **git push 경합**과 **실시간성 부재**가 GCP 이관으로 완전히 해소됩니다.

| 비교 | GitHub Actions (현재) | GCP (이관 후) |
|------|----------------------|---------------|
| 데이터 갱신 주기 | 30분 | **실시간** (WebSocket) |
| git 경합 | 발생 (merge_workflow 필요) | **없음** |
| 콜드 스타트 | 매회 ~1분 | **없음** |
| 일일 프로세스 생성 | ~66회 | **1회** (상시) |
| 일일 deploy-pages | ~33회 | **0회** (실시간 갱신) |
| 월 비용 | $0 (public repo) | $0~21 |
| 관리 복잡도 | 12 YML + 외부 cron | 1 Python 프로세스 |
| 실시간 알림 | 불가 | **가능** |
| Strategy Builder | 불가 | **가능** |

### 권장 옵션: **Option C (e2-small + Instance Schedule, 월 ~$9)**

- 서울 리전으로 KIS 레이턴시 최소화
- 2GB RAM으로 전체 모듈 + WebSocket 동시 운영
- 장 시간만 운영하여 비용 최소화
- 이후 필요 시 24/7로 전환 가능 ($21/월)

---

## 9. 완전 무료($0/월) 운영 방안 조사 (2026-03-21 추가)

### 후보 플랫폼 비교

| 플랫폼 | 무료 스펙 | 리전 | RAM | 상시 운영 | 적합성 |
|--------|----------|------|-----|----------|--------|
| **GCP e2-micro** | Always Free | US only | 1GB | O | △ (메모리 부족) |
| **Oracle Cloud A1 Flex** | Always Free | 서울 가능 | 24GB | O | △ (안정성 문제) |
| **Raspberry Pi 4** | 자가 호스팅 | 국내 | 4GB | O | **◎ (최적)** |
| Fly.io | 무료 티어 종료 | - | - | X | X |
| Render | 무료 시 15분 sleep | US | 512MB | X | X |
| Railway | 월 $5 크레딧 | US | 512MB | △ | X |
| AWS Free Tier | 12개월 한정 | 서울 가능 | 1GB | △ | X |

### Option D: Raspberry Pi 4 자가 호스팅 — 최저 비용

| 항목 | 비용 |
|------|------|
| Raspberry Pi 4 (4GB) | ~₩70,000 (1회 구매) |
| 전기료 | ~₩200~500/월 (~5W) |
| **월 운영비** | **~₩500/월 (≈$0.4)** |

**장점:**
- 국내 네트워크 → KIS API 레이턴시 최소 (~5ms)
- 4GB RAM → 전체 분석 모듈 + WebSocket 동시 운영 가능
- KIS WebSocket(`ws://`) 상시 연결 가능
- 완전한 관리 권한, 종속성 없음

**단점:**
- 초기 셋업 필요 (OS, 네트워크, 포트포워딩)
- 가정 네트워크 불안정 시 서비스 중단
- 프론트엔드 외부 접근 시 DDNS + 공유기 설정 필요
- 하드웨어 장애 시 자체 대응

### Option E: GCP e2-micro 하이브리드 — 무료 클라우드

**핵심 아이디어**: e2-micro(1GB)에서 가벼운 작업만 실행, 무거운 분석은 GitHub Actions 유지

```
┌──────────────────────────────────────┐
│  GCP e2-micro (상시, US 리전, 무료)    │
│                                       │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ KIS WebSocket │  │ APScheduler  │  │
│  │ 수신 + 알림   │  │ (경량 cron)  │  │
│  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ 경량 수집     │  │ Firestore    │  │
│  │ (investor 등) │  │ 저장         │  │
│  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────┘
         +
┌──────────────────────────────────────┐
│  GitHub Actions (유지)                │
│  - 대규모 분석 (Gemini AI 호출)       │
│  - Daily Theme Analysis              │
│  - Paper Trading                     │
└──────────────────────────────────────┘
```

**무료 범위 내 운영 가능 항목:**
- e2-micro: 월 720시간 무료 (상시 운영)
- Firestore: 1GB 저장 + 50K 읽기/20K 쓰기/일
- Cloud Scheduler: 3개 job 무료
- 이그레스: 1GB/월 무료

**한계:**
- 1GB RAM → Gemini AI 호출 + 전체 분석 불가 (메모리 초과)
- US 리전 → KIS 레이턴시 ~150ms (WebSocket은 문제없으나 REST API 지연)
- 하이브리드라 git push 경합 문제가 일부 잔존

### Option F: Oracle Cloud A1 Flex — 고스펙 무료 (불안정)

| 항목 | 비용 |
|------|------|
| A1 Flex (4 OCPU, 24GB RAM) | Always Free |
| Block Storage 200GB | Always Free |
| **월 운영비** | **$0** |

**장점:**
- 24GB RAM → 모든 모듈 + Strategy Builder까지 가능
- 서울 리전 가능 → KIS 레이턴시 최소
- ARM 기반이지만 Python은 호환 문제 없음

**단점 (치명적):**
- 서울 리전 용량 부족으로 인스턴스 생성 실패 빈번
- 계정 돌연 종료 사례 다수 보고
- Always Free → 유료 전환 유도 가능성
- SLA 보장 없음 → 운영 환경으로 부적합

### 무료 방안 최종 권장

| 순위 | 옵션 | 월 비용 | 안정성 | KIS 레이턴시 | 추천 사유 |
|------|------|---------|--------|-------------|----------|
| **1** | **Raspberry Pi 4** | ~₩500 | 높음 | 최소(~5ms) | 실질 무료, 국내 네트워크, 충분한 RAM |
| **2** | **GCP e2-micro 하이브리드** | $0 | 높음 | ~150ms | 완전 무료, 단 일부 GA 유지 필요 |
| **3** | Oracle A1 Flex | $0 | **낮음** | 최소 | 스펙 최고지만 안정성 리스크 |

**실용적 결론:**
- 초기 투자 ~₩70,000 가능 시 → **Raspberry Pi 4** (가장 현실적)
- 완전 $0 고집 시 → **GCP e2-micro 하이브리드** (WebSocket + 알림만 이관, 나머지 GA 유지)
- Oracle Cloud는 보조/테스트 용도로만 권장
