# KIS API 활용 개선/강화 포인트 연구

> 조사일: 2026-03-20
> 조사 대상: [open-trading-api GitHub](https://github.com/koreainvestment/open-trading-api), KIS MCP 서비스

---

## 1. 현재 프로젝트 KIS API 활용 현황 요약

### 사용 중인 API (19개 엔드포인트)

| TR ID | 기능 | 호출 위치 |
|-------|------|-----------|
| FHKST01010100 | 주식현재가 시세 | `kis_client.get_stock_price()` |
| FHKST01010200 | 호가/예상체결 | `kis_client.get_asking_price()` |
| FHKST01010300 | 체결 현황 | `kis_client.get_ccnl()` |
| FHKST01010400 | 일별 시세 (30일) | `kis_client.get_stock_daily_ohlcv()` |
| FHKST01010600 | 거래원 TOP5 | `kis_rank.get_member_data()` |
| FHKST01010700 | 외인/기관 가집계 | `kis_client.get_foreign_institution_total()` |
| FHKST01010900 | 투자자별 순매수 확정 | `kis_client.get_stock_investor()` |
| HHPTJ04160200 | 외인/기관 추정 가집계 | `kis_client.get_investor_trend_estimate()` |
| FHKST03010100 | 기간별 시세 일봉 (100건/회) | `kis_client.get_stock_daily_price()` |
| FHKST03010200 | 분봉 데이터 (30건/회) | `volume_profile.fetch_minute_candles()` |
| FHKUP03500100 | 업종 지수 시세 | `kis_client.get_index_daily_price()` |
| FHKST66430300 | 재무비율 | `kis_client.get_financial_ratio()` |
| FHPST01710000 | 거래량/거래대금 순위 | `kis_rank._fetch_volume_rank_raw()` |
| FHPST01700000 | 등락률 순위 | `kis_rank._fetch_fluctuation_rank_raw()` |
| HHPPG046600C1 | 프로그램매매 투자자동향 | `kis_client.get_investor_program_trade_today()` |
| FHPST04830000 | 공매도 일별추이 | `kis_client.get_daily_short_sale()` |
| HHDFS00000300 | 해외주식 현재가 | `collect_macro_indicators.collect_overseas()` |
| HHDFC55010000 | 해외 선물/옵션 현재가 | 테스트용 |
| FHMIF10000000 | 국내 선물/옵션 현재가 | 테스트용 |

### 아키텍처 특징
- **동기 HTTP** (`requests`) + `ThreadPoolExecutor(10)` 병렬화
- **Rate Limiter**: `threading.Lock` 기반 초당 20건
- **토큰 관리**: Supabase DB ↔ 로컬 파일 이중 캐시, GitHub Actions와 토큰 공유
- **분봉 캐시 공유**: volume_profile → `.candle_cache.json` → intraday_history 재사용
- **실행 환경**: GitHub Actions 스케줄 워크플로우 (자동화 파이프라인)

---

## 2. KIS 공식 제공 신규 도구 분석

### 2-1. KIS Code Assistant MCP

| 항목 | 내용 |
|------|------|
| 목적 | 334개 API를 자연어로 검색, 샘플코드 자동 생성 |
| 실행 | `uv run server.py --stdio` (로컬) 또는 Docker |
| 연동 | Claude Desktop, Cursor IDE |
| 핵심 기능 | `kis_detailed_code`(정확 검색), `kis_easy_code`(자연어 검색) |

**평가**: 개발 시 API 탐색/코드 생성에 유용. 런타임 파이프라인과는 무관.

### 2-2. KIS Trading MCP

| 항목 | 내용 |
|------|------|
| 목적 | 166개 API를 MCP 프로토콜로 직접 호출 (시세 조회 + 주문 실행) |
| 카테고리 | 국내주식 74개, 해외주식 34개, 국내선물옵션 20개, 해외선물옵션 19개, 국내채권 14개, ETF 2개, ELW 1개 |
| 실행 | `server.py` + Docker, `.env.live`로 인증 |
| 연동 | Claude Desktop, Cursor IDE (MCP 프로토콜) |

**평가**: LLM 대화형 거래에 적합. 자동화 파이프라인에는 부적합 (아래 상세 분석).

### 2-3. Strategy Builder + Backtester (신규)

| 항목 | 내용 |
|------|------|
| Strategy Builder | 비주얼 UI로 매매 전략 설계, 80개 기술지표, 10개 프리셋 |
| Backtester | Docker 기반 QuantConnect Lean 엔진, HTML 리포트 |
| 공유 포맷 | `.kis.yaml`로 전략 설계 → 백테스트 import |

**평가**: 모의투자(paper trading) 전략 고도화에 활용 가능.

### 2-4. examples_llm (LLM용 샘플코드)

| 항목 | 내용 |
|------|------|
| 구조 | API별 개별 폴더, 단일 기능 파일 (`함수명.py` + `chk_함수명.py`) |
| 인증 | `kis_auth.py` 공통 모듈, YAML 기반 설정 (`kis_devlp.yaml`) |
| 범위 | auth, domestic_stock, overseas_stock, domestic_bond, 선물옵션, ELW, ETF |

**평가**: 개별 API 호출 패턴 참고용. 현 프로젝트와 직접 호환되지 않음.

---

## 3. MCP 전면교체 가능성 분석

### 결론: **현 시점에서 MCP 전면교체는 부적합**

| 비교 항목 | 현재 (REST API 직접 호출) | MCP 방식 |
|-----------|--------------------------|----------|
| 실행 환경 | GitHub Actions (headless) | Claude Desktop / Cursor (대화형) |
| 자동화 | cron 스케줄 완전 자동화 | 사용자 대화 필요 |
| 병렬처리 | ThreadPoolExecutor(10) 제어 | MCP 프로토콜 순차 처리 |
| Rate Limiting | 자체 Lock 기반 초당 20건 | MCP 서버 내부 (커스텀 불가) |
| 토큰 관리 | Supabase 공유, force refresh | MCP 서버 내부 관리 |
| 에러 처리 | 401/500 자동 재시도, 3단계 fallback | MCP 서버 내부 (커스텀 어려움) |
| 캐싱 | 분봉 캐시 공유, 토큰 DB 캐시 | 없음 |
| 데이터 가공 | pandas 기반 후처리 자유 | JSON 응답 그대로 |

### 핵심 이유

1. **이 프로젝트는 자동화 파이프라인**이며, MCP는 대화형 LLM 인터페이스용
2. GitHub Actions에서 MCP 서버를 띄우고 MCP 클라이언트로 호출하는 것은 불필요한 복잡성 추가
3. 현재 구현이 이미 rate limiting, 토큰 공유, 캐싱, 병렬처리, fallback 등 고도로 최적화됨
4. MCP는 166개 API를 제공하지만, 현 프로젝트는 19개만 사용하며 각각 정교하게 튜닝됨

---

## 4. 실질적 개선/강화 포인트

### 4-1. 즉시 적용 가능 (높은 ROI)

#### A. WebSocket 실시간 데이터 도입 (장중 수집 고도화)

현재 `collect_investor_data.py`가 30분 간격으로 REST 폴링 → WebSocket 구독으로 전환 시:
- **실시간 체결가/호가** 수신 가능
- API 호출 횟수 대폭 감소 (REST 30분 폴링 → WebSocket 1회 연결)
- KIS open-trading-api에 WebSocket 예시 코드 제공 (`*_ws.py` 파일들)

**적용 범위**: 장중 수급 모니터링, 실시간 체결 추적
**제한**: GitHub Actions에서는 장시간 WebSocket 유지 어려움 → 별도 서버 또는 Cloud Run 필요
**판단**: 현재 GitHub Actions 기반 아키텍처에서는 비용 대비 효과가 낮음. 향후 별도 서버 운영 시 검토.

#### B. 신규 API 엔드포인트 추가 활용

KIS Trading MCP가 166개 API를 제공하며, 현 프로젝트에서 미사용 중인 유용한 API:

| API | 기능 | 활용 가능성 |
|-----|------|------------|
| 국내주식 업종별 시세 | 업종(섹터) 등락률 | 테마-섹터 상관관계 분석 |
| 해외주식 조건검색 | 해외 종목 필터링 | 글로벌 테마 연동 |
| ETF NAV 추이 | ETF 괴리율 | 테마 ETF 모니터링 |
| 국내채권 시세 | 금리 동향 | 매크로 지표 보강 |

**판단**: 업종별 시세 API는 테마 분석과 직접 연관. 도입 가치 있음.

#### C. open-trading-api 코드 패턴 참고

현재 프로젝트와 KIS 공식 예제의 차이점에서 개선 힌트:

| 항목 | 현재 | 공식 예제 | 개선 여부 |
|------|------|-----------|-----------|
| 인증 설정 | Supabase + 환경변수 | YAML 파일 | 현재 방식이 더 우수 (CI/CD 친화적) |
| HTTP 라이브러리 | `requests` (동기) | `requests` (동기) | 동일 |
| 에러 처리 | 3단계 fallback | 단순 예외 | 현재 방식이 더 우수 |
| 병렬처리 | ThreadPoolExecutor | 없음 | 현재 방식이 더 우수 |

**판단**: 현재 프로젝트의 구현이 공식 예제보다 더 성숙함. 코드 패턴 차원에서 가져올 것은 없음.

### 4-2. 중기 검토 (선택적)

#### D. Code Assistant MCP를 개발 보조로 활용

- 런타임이 아닌 **개발 시점**에서 API 탐색/코드 생성 도구로 활용
- Claude Desktop 또는 Cursor에 MCP 서버 연결하여 새 API 추가 시 활용
- 334개 API 메타데이터 검색이 가능하므로, 신규 API 발굴에 유용

**판단**: 개발 생산성 도구로 도입 가치 있음. 런타임에는 영향 없음.

#### E. Strategy Builder + Backtester 활용

- 현재 `collect_paper_trading.py`의 모의투자 로직을 고도화
- 80개 기술지표 + QuantConnect 백테스팅으로 전략 검증
- `.kis.yaml` 포맷으로 전략 표준화

**판단**: 모의투자 기능 고도화 시 검토. 현재 테마 분석 핵심 기능과는 별개.

### 4-3. 불필요 (현재 불적합)

#### F. Trading MCP로 런타임 교체
- 위 3번 섹션에서 분석한 대로 부적합
- 대화형 도구이며 자동화 파이프라인과 맞지 않음

#### G. asyncio/aiohttp 비동기 전환
- 현재 ThreadPoolExecutor + rate limiter 조합이 충분히 효율적
- KIS API 자체가 초당 20건 제한이므로 비동기의 장점이 제한적
- 전면 리팩토링 대비 성능 향상폭이 미미

---

## 5. 최종 권장사항

| 우선순위 | 항목 | 효과 | 난이도 |
|----------|------|------|--------|
| 1 | 업종별 시세 API 추가 | 테마-섹터 분석 강화 | 낮음 |
| 2 | Code Assistant MCP 개발 도구 도입 | API 탐색 생산성 향상 | 낮음 |
| 3 | Strategy Builder 검토 | 모의투자 고도화 | 중간 |
| - | MCP 런타임 전면교체 | 부적합 | - |
| - | WebSocket 전환 | 별도 인프라 필요 | 높음 |
| - | asyncio 전환 | 효과 미미 | 높음 |

**핵심 결론**: 현재 REST API 기반 아키텍처가 이 프로젝트의 자동화 파이프라인에 최적화되어 있으며, MCP 전면교체는 오히려 역행. KIS MCP는 **개발 보조 도구**로만 활용하고, 런타임은 현재 방식을 유지하되 **업종별 시세 등 신규 API 추가**로 분석력을 강화하는 것이 가장 효과적.
