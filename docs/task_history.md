# Task History

작업 이력을 시간순(최신 상단)으로 기록합니다. (KST 기준)

---

## 2026-05-21

### [버그픽스] 공매도 수집 날짜 파라미터 today → yesterday 수정 (2026-05-21 13:38 KST)
- **변경 파일**: `main.py`, `tests/test_short_selling_date.py` (신규)
- **원인**: `get_daily_short_sale(code, today, today)` 호출 시 KIS가 당일 장 마감 전 공매도 집계 미확정 상태로 `ssts_vol_rlim=0.00` 반환 → `ratio > 0` 필터에 의해 173종목 전부 누락. D-1 기준으로 변경하면 확정 데이터 수신 가능함을 삼성전자(005930) API 직접 확인으로 검증.
- **수정 내용**: `today` → `yesterday` (D-1) 로 변경. ruff clean, 테스트 30 passed.

### [설정] GitHub Actions Node.js 20 → 24 deprecation 대응 — actions 버전 일괄 bump (2026-05-21 13:35 KST)
- **사용자 요청**: 2026-06-02 Node.js 24 강제 적용 전 13개 워크플로 전체 actions 버전 업그레이드
- **변경 파일**: `.github/workflows/*.yml` 전체 13개
- **변경 내용**:
  - `actions/checkout` v4 → v5 (Node 24 지원: v5.0.0)
  - `actions/setup-python` v5 → v6 (Node 24 지원: v6.0.0)
  - `actions/cache`, `cache/save`, `cache/restore` v4 → v5 (Node 24 지원: v5.0.0)
  - `actions/setup-node` v4 → v5 (Node 24 지원: v5.0.0) — deploy-pages.yml 1곳
  - `actions/configure-pages` v4 → v6 (Node 24 지원: v6.0.0) — deploy-pages.yml 1곳
  - `actions/upload-pages-artifact` v3 → v4 — composite action, Node 직접 미해당
  - `actions/deploy-pages` v4 → v5 (Node 24 지원: v5.0.0) — deploy-pages.yml 1곳
- **검증**: 13개 YAML 구문 python yaml.safe_load 전수 통과, cron/concurrency/dispatch 트리거 무변경
- **diff 통계**: 13 files changed, 47 insertions(+), 47 deletions(-) (버전 문자열 교체만)
- **커밋**: 상위 에이전트 검토 후 진행 예정

### [진단/버그픽스] 장중 진단 후속 조치 — 069500 price_at 매핑 + 환율 stale timestamp 처리 (2026-05-21 11:29 KST)
- **사용자 요청**: "현재 장중. 객관·보수적 관점으로 상태/성능/데이터수집/계산로직 면밀히 진단·검증" → "확인 및 조치 실시"
- **장중 진단 요약 (10:10 KST 기준)**:
  - 13개 cron 모두 정상 실행 (07:02~10:05). push 경합 자동 retry 동작 정상
  - 데이터 신선도: latest(10:02), macro(10:05), theme-forecast(10:03), volume-profile(10:05), intraday-history(09:50, 다음 10:15 예정)
  - 13-criteria 분포 합리적 (momentum_history 83.2%, golden_cross 35.8% 등). all_met=0/173 정상
  - golden_cross signal_count 분포 `{0:111, 1:37, 2:12, 3:9, 4:4}` 점진 감소 정상
- **확정 이슈 4건**:
  1. **069500 (KODEX 200) price_at 누락** — 어제 22:46 MARKET_CLOSE_MAP 작업의 미커버 종목 → **조치**
  2. **환율 timestamp 4/30 노출** — 한국수출입은행 API 외부 장애. 백엔드는 4/30 정적 데이터 보존(main.py:643), 프론트엔드는 KIS API로 rate/change overlay. 사용자 화면 라벨 "04/30 · 15:52 실시간"으로 모순 노출 → **조치**
  3. `short_selling`/`reverse_alignment` reason=None 173/173 — UI는 `met`만 보고 reason 미사용 → **조치 안 함** (Surgical 원칙)
  4. GitHub Actions Node 20 deprecation (2026-06-02부터 강제) — **별도 대응 필요**
- **수정**:
  - `collect_macro_indicators.py:62`: `MARKET_CLOSE_MAP`에 `"069500": ("Asia/Seoul", 15, 30)` 추가
  - `frontend/src/components/ExchangeRate.tsx:165-176`: KIS overlay 발생 시(`liveRates` 비어있지 않음) 4/30 timestamp 숨김 → "KIS 실시간"만 표시. KIS 실패 시에는 기존대로 정적 timestamp 노출(사용자가 stale 인지 가능)
- **검증**:
  - 069500 price_at = "2026-05-20 15:30" (현재 11:29 < 15:30 → 어제 마감 fallback 정상)
  - 기존 매핑 회귀 통과 (^DJI/N225/STOXX50E/KS11/KOSPI200/MU/NQ=F/FNG 모두 정상)
  - Python AST PASS · tsc PASS · build PASS (4.07s)
- **운영 영향**:
  - 069500: 다음 macro cron 실행 시 (예: 10:30 Theme Forecast Intraday 내 collect_intraday_volume_profile, 또는 다음 collect_macro_indicators 호출) `price_at: "2026-05-20 15:30"` 반영
  - 환율 UI: 다음 페이지 새로고침 시 KIS 보정 발생하면 "KIS 실시간" 표시, 백엔드 4/30 timestamp 숨김

---

## 2026-05-20

### [기능] 종목 링크 모바일에서 토스증권 앱 deep link로 자동 분기 (2026-05-20 23:14 KST)
- **사용자 요청**:
  1) 종목명 클릭 시 링크 팝업이 뜨는 경우 → '토스증권' 버튼 추가, 클릭 시 토스증권 앱 해당 종목 화면으로 이동
  2) 종목명 클릭 시 바로 네이버 증권 링크로 이동하는 경우 → 토스증권 앱으로 변경
  - 링크 구성 방법은 theme_lab 프로젝트 소스 참조
- **theme_lab 분석** (`StockDetailModal.tsx:224-260`):
  - AppsFlyer OneLink로 모바일은 토스 앱 강제 분기, 데스크탑은 web 새 탭
  - 흐름: nextLandingUrl → service.tossinvest.com → supertoss:// scheme → OneLink로 wrapping
  - 핵심 파라미터: `af_force_deeplink=true`, `af_dp=<supertoss URL>`, `af_web_dp=<contents URL>`
- **현재 상태 진단**:
  - 외부 링크 모음 팝업은 별도로 없음 — 모든 종목명 클릭이 직접 `<a>` 또는 `window.open`으로 이동
  - 모든 곳이 이미 `tossinvest.com/stocks/A{code}/order` URL 사용 중 (모바일에서 web으로 열려 앱 진입에 추가 클릭 필요)
  - PortfolioPage 라벨만 "네이버 증권"으로 잘못 표시
- **수정**:
  - `frontend/src/lib/toss-link.ts` (신규):
    - `buildTossDeepUrl(code)`: theme_lab과 동일한 OneLink URL 생성
    - `tossWebUrl(code)`: 데스크탑/web fallback URL
    - `handleTossLinkClick(code, e)`: `<a>` 태그용 — 모바일 시 preventDefault + deep link로 location.href
    - `openTossLink(code)`: `window.open` 패턴용 — 모바일/데스크탑 자동 분기
  - 8개 컴포넌트에 적용:
    - `StockCard.tsx`, `StockList.tsx` (3개 a 태그), `ThemeForecastPage.tsx`, `PredictionHistory.tsx`, `PaperTradingStockCard.tsx`, `IntradayInsights.tsx` (action popup): `<a>` 패턴에 `onClick={handleTossLinkClick}` 추가
    - `AIThemeAnalysis.tsx`: `window.open` → `openTossLink(code)` 교체
    - `PortfolioPage.tsx`: 라벨 "네이버 증권" → **"토스증권"** + `onClick` 추가
  - 검증: 컴포넌트 잔재 0건 (`tossinvest.com/stocks` grep — 헬퍼 파일만 남음)
- **사용자 경험**:
  - 모바일 (iOS/Android): 종목명 탭 → 토스 앱 설치 시 앱으로 바로 이동 (해당 종목 화면), 미설치 시 OneLink가 앱스토어로 안내
  - 데스크탑: 새 탭에서 web으로 진입 (기존 동작 유지)
- **검증**: tsc PASS · build PASS (3.35s)

### [정확도] 거시지표 카드별 시각 — cron 시각 → 실제 가격 시각(price_at) (2026-05-20 22:46 KST)
- **사용자 보고**: "각 지표명 우측 시각이 실제 수집 시각이 맞는지 검증"
- **🔴 발견된 문제**: 17개 지표 모두 동일한 시각(예: "18:10") 표시 — 실제로는 cron 실행 시각(`collected_at`)일 뿐, **개별 지표의 가격 시점과 무관**
  - 예: 다우존스 가격은 미국 마감(한국 05:00 KST) 데이터지만 화면엔 "18:10"
  - 코스피는 마감 15:30 KST 데이터지만 "18:10"
- **🔴 사용자 오해 가능**: 마치 18:10에 각 지표가 갱신된 것처럼 보임
- **수정** — 시장 마감 시각 정적 매핑으로 `price_at` 계산:
  - `collect_macro_indicators.py`:
    - `MARKET_CLOSE_MAP` 추가: 14개 심볼별 (timezone, hh, mm)
    - `_last_market_close_kst()` 헬퍼: 가장 최근 마감 시각 KST 반환 (주말 보정 포함)
    - 진행 중 상품(NQ=F, K200F_NGT, OIL_F, GOLD_F, SPX_F, FNG)은 매핑 제외 → `collected_at` 자동 fallback
    - 각 indicator/futures에 `price_at` 필드 추가
  - `frontend/src/hooks/useMacroIndicators.ts`: `MacroIndicator`/`FuturesItem`에 `price_at?: string` 추가
  - `frontend/src/components/MacroIndicators.tsx`:
    - `pickTimestamp()` 헬퍼: price_at 우선, 없으면 collected_at fallback
    - `title` 속성으로 hover 시 "가격 시각 (시장 마감)" 또는 "cron 수집 시각" 안내
    - 카드 2곳(접힌 상태/펼친 상태) 모두 적용
- **단위 테스트** (5/20 22:30 KST 기준):
  - `^DJI` → 2026-05-20 05:00 (미국 마감) ✅
  - `^N225` → 2026-05-20 15:00 (일본 마감) ✅
  - `^STOXX50E` → 2026-05-20 00:30 (어제 유럽 마감, 오늘 마감 아직 안 옴) ✅
  - `^KS11` → 2026-05-20 15:30 (한국 마감) ✅
  - `NQ=F` → None (진행 중 → collected_at fallback) ✅
- **데이터 적용 시점**: 다음 cron이 `collect_macro_indicators.py` 호출 시부터 `price_at` 필드 포함 (collect-investor-data / collect-macro-futures / collect-macro-premarket 등)
- **검증**: tsc PASS · build PASS (3.23s) · Python AST PASS · 헬퍼 단위 테스트 통과

### [문서/UI] 투자자 수급 단위 라벨 정정 — 백만원 → 만원 (2026-05-20 22:27 KST)
- **사용자 요청**: "투자자 수급 데이터 정확한지 검증"
- **검증 결과**:
  - 표시값(예: KOSPI 외국인 -293.1억) = KIS raw(-2,930,952) / 10,000으로 정확 변환
  - 시점 일관 (5/20 18:10:32 KST = 장 마감 후 최종)
  - Zero-sum 잔차: KOSPI -11.4억, KOSDAQ +0.6억 (KIS의 "기타 투자자" 미합산, 정상)
- **발견된 코드 결함**: 단위 라벨이 "백만원" / "백만"으로 잘못 표기 (실제는 "만원")
  - 검증 근거: raw -2,930,952가 백만원이면 -2.93조원인데 화면은 -293.1억 → 만원이 정답
- **변경 파일**:
  - `collect_macro_indicators.py:305-307` 주석 정정 ("백만원" → "만원" + KIS 단위 명시)
  - `frontend/src/components/MacroIndicators.tsx:255-260` `formatAmount` fallback 라벨 "백만" → "만" + 함수 위에 단위 가정 주석 추가
- **운영 영향**: 0 (fallback 분기는 abs < 1,000만원 케이스라 시장 일별 합계에서 거의 호출 안 됨)
- **검증**: tsc PASS · build PASS (3.17s) · Python AST PASS

### [UX] 가상계산기 수정 폼을 누적 리스트 항목 아래 인라인 펼침으로 (2026-05-20 22:04 KST)
- **사용자 보고**: "종목 수정 영역이 하단에 ui가 생성되어야지 화면 상단에 생성되고 있어. ui/ux 상 매우 어색"
- **이전 패턴(21:54)의 문제**: 누적 리스트(하단)에서 ✏️ 클릭 → 상단 폼이 채워지고 스크롤 → 사용자가 보던 위치에서 멀어짐
- **재설계** (`PaperCalcTab.tsx`):
  - 폼 입력 JSX를 `formInputsBlock` / `previewBlock` 변수로 추출 (양쪽 위치 재사용)
  - 상단 "종목 추가" 카드는 `editingItemId === null`일 때만 표시 (편집 모드 시 통째로 숨김)
  - 누적 리스트 항목 `<li>` 안에 편집 모드일 때 폼 펼침:
    - 항목 행은 그대로 유지 (종목명·가격·손익률)
    - 그 아래 `border-t border-primary/20`로 구분된 인라인 폼
    - 입력 grid + 비교 기준 토글 + preview + [취소 / 수정 저장] 버튼 grid
  - ✏️ 아이콘: 편집 중이면 다시 클릭 시 `resetForm()` (편집 취소)
  - 편집 진입 시 자동 스크롤 제거 (이제 폼이 현재 위치에 펼쳐지므로 불필요)
- **사용자 경험**: 수정 클릭 → 항목 위치 그대로 폼이 펼쳐짐 → 보던 곳에서 그대로 수정 → 취소/저장
- **검증**: tsc PASS · build PASS (3.38s)

### [기능/UI] 가상계산기 누적 리스트 수정 기능 + 항상 두 줄 표시 (2026-05-20 21:54 KST)
- **변경 파일**: `frontend/src/components/PaperCalcTab.tsx`
- **사용자 요청 1**: SK하이닉스처럼 항상 줄바꿈 (좁든 넓든)
  - `flex flex-wrap` → `space-y-0.5` + `<div>` 2개 → 강제 두 줄
- **사용자 요청 2**: 누적 리스트 종목 **수정 기능** 추가
  - state: `editingItemId: string | null`
  - `startEditItem(item)`: 항목 → 입력 폼 값 채움 + 편집 모드 진입 + 폼 위치로 smooth scroll
  - `addItem`: 편집 모드면 해당 id update (`targetPrice` 변경 시 explicit `delete next.targetPrice`), 아니면 신규 추가
  - `resetForm`: `setEditingItemId(null)` 포함 (취소 버튼 = resetForm)
  - 폼 UI:
    - 헤더 "종목 추가" → 편집 모드 시 "종목 수정" + 우측 "취소" 버튼
    - 편집 모드 시 border `primary/40` + ring `primary/20`로 강조
    - 추가 버튼 "누적 리스트에 추가" → 편집 시 "수정 저장"
  - 누적 리스트 항목:
    - ✏️ Pencil 아이콘 추가 (X 위)
    - 편집 중인 항목은 `bg-primary/5 ring-primary/20`로 강조
- **사용자 질문**: "목표가도 supabase에 저장되도록 구성된거 맞아?"
  - 답: 네, paper_calc_history.tabs가 jsonb 컬럼이라 PaperCalcItem 전체가 직렬화. `targetPrice` 필드도 자동 포함 (number 시 키-값 저장, undefined 시 키 누락 — JSON 표준)
- **검증**: tsc PASS · build PASS (2.93s)

### [UI] 좁은 화면 텍스트 단어 깨짐 2건 수정 (2026-05-20 21:49 KST)
- **사용자 보고 1**: InvestorChartPopup의 "일봉"/"장중" 탭 버튼 텍스트가 좁은 화면에서 1글자씩 세로로 깨짐
  - 원인: 부모 `flex items-center`에 wrap 없음 + 우측 범례가 공간 차지하면 좌측 탭 압축 + 버튼에 `whitespace-nowrap` 없어 텍스트가 글자 단위 wrap
  - 수정 (`InvestorChartPopup.tsx`):
    - 부모 컨테이너: `flex items-center` → `flex items-center gap-2 flex-wrap`
    - 탭 컨테이너: `shrink-0` 추가 (압축 차단)
    - 탭/범례 버튼: 모두 `whitespace-nowrap` 추가
    - 우측 범례: `justify-end` 추가 (wrap 후 정렬 일관)
- **사용자 보고 2**: PaperCalcTab 누적 리스트에서 "1,562,333원 × 12주 목표 1,900,000원"의 "원"이 다음 줄로 떨어짐
  - 원인: 텍스트 노드와 inline 표현이 섞여 있어 단어("원") 단위 wrap 발생
  - 수정 (`PaperCalcTab.tsx`):
    - 컨테이너: `flex flex-wrap gap-x-2` 적용 (chunk 단위 wrap)
    - 매수가/수량 chunk와 비교가 chunk를 각각 `whitespace-nowrap` span으로 묶음 → chunk 단위로 떨어지고 "원" 분리 안 됨
- **검증**: tsc PASS · build PASS (2.93s)

### [기능] 가상계산기 — 비교 기준 토글 (현재가 / 목표가) 추가 (2026-05-20 21:44 KST)
- **사용자 요청**: "현재는 가정 매수가만 입력 가능하고 그 기준 현재가와의 수익률 자동 계산. 목표 금액을 자동 fetch되는 '현재가' 또는 직접 입력하는 '목표가' 중 1개 선택 가능하게"
- **변경 파일**:
  - `frontend/src/lib/paper-calc-history.ts`: `PaperCalcItem.targetPrice?` 추가 (undefined = 현재가 기준)
  - `frontend/src/components/PaperCalcTab.tsx`:
    - state: `comparisonMode: "current" | "target"`, `targetPrice` 추가
    - 입력 폼: 매수가/수량 grid 아래에 **비교 기준 토글(segmented)** + 목표가 입력 필드(목표가 모드 시)
    - 현재가 모드: 자동 fetch된 가격을 read-only 박스로 표시 (UI 일관성)
    - preview 계산: 모드에 따라 `cur` 분기 (현재가 vs 목표가)
    - preview 라벨: 목표가 모드일 때 "목표 평가금액", "목표가 도달 시 수익률"로 변경
    - addItem: `targetPrice` 모드일 때만 저장 (undefined 분기)
    - summary/누적 리스트 계산: `it.targetPrice ?? livePrices[...].current_price`
    - 누적 리스트 항목: 목표가 항목은 amber "목표" 뱃지 + "목표 N원" 라벨 표시
- **저장 호환**: PaperCalcItem이 Supabase에 jsonb로 저장이라 새 필드 자동 호환 (기존 항목은 targetPrice=undefined → 현재가 기준 유지)
- **검증**: tsc PASS · build PASS (3.83s, PortfolioPage 77.14 → 79.52 kB)

### [개선] PTR refresh 4개 데이터 통합 + "✓ 갱신 완료" 피드백 (2026-05-20 14:13 KST)
- **사용자 보고**: "PTR 시각 동작은 OK인데 실제 refresh 되는지 확인이 어려움"
- **원인**: `onRefresh: refetch`가 useStockData만 갱신 → portfolio 페이지의 다른 데이터(vp/forecast/history)는 변화 없어 사용자가 새로고침 인지 어려움
- **수정**:
  - `App.tsx`: `handlePtrRefresh` 콜백 추가 — `Promise.all([refetch, refetchVP, refetchForecast, refetchHistory])` 4개 동시 호출
  - `useStockHistory`에서 `refetchHistory` 반환값 활용
  - `usePullToRefresh.ts`: `justCompleted` state 추가 — refresh 완료 후 1.2초 표시
  - `PullToRefreshIndicator.tsx`: 3가지 상태 표시
    - 끌어내리는 중: ↓ 화살표 (60px 넘으면 primary 색상)
    - 갱신 중: ⟳ 스피너 + "갱신 중…" 텍스트
    - **완료: ✓ 체크 + "갱신 완료" (emerald 색상) 1.2초 표시**
- **검증**: tsc PASS · build PASS (3.17s)

### [진단/회고] PortfolioPage 화면 안 보임 = 이전 PTR hook 부작용 (2026-05-20 13:55 KST)
- **사용자 보고**: "포트폴리오 화면 고장났어. 아예 안보여."
- **정적 분석 결과**: PortfolioPage.tsx의 currentVol 단순화 변경은 명백한 버그 없음
- **원인 가설 검증**: 13:46 작업(usePullToRefresh standalone 검사 추가) 배포 후 사용자 "포트폴리오 화면 보임" 확인
- **🔴 진짜 원인**:
  - 이전 `usePullToRefresh` hook은 standalone 검사 없이 모든 환경(desktop/일반 Safari/Chrome)에서 `document.touchmove`에 listener 등록
  - `dy > 0`일 때 무조건 `e.preventDefault()` 호출
  - 사용자 환경에서 PortfolioPage의 touch 인터랙션(스크롤/카드 확장 등)을 막아 화면 표시 차단
  - 13:46 standalone 검사 추가로 일반 환경에서 listener 자체 등록 안 됨 → 자동 해소
- **회고**: "PortfolioPage 코드를 의심"한 초기 가설이 빗나갔음. 추측으로 코드를 건드리지 않고 정적 분석으로 명백한 원인 없음을 확인 후 진단 정보 요청 — 올바른 접근. 이번 PTR fix가 우연히 두 문제를 동시에 해결.
- **교훈**: touch event를 document level에 등록하면서 preventDefault 호출 시, 활성 조건(여기선 standalone 모드)을 명확히 검사할 것. 광범위한 부작용 위험.

### [개선] usePullToRefresh iOS PWA standalone 모드 한정 활성 (2026-05-20 13:46 KST)
- **사용자 보고**: "iOS PWA 웹앱에서 pull-to-refresh 전혀 동작 안 함"
- **웹검색 진단** (magicbell, dev.to, heltweg 등):
  - iOS Safari standalone 모드(PWA)는 Safari UI 자체가 없어 **native pull-to-refresh가 원천 불가능**
  - `overscroll-behavior-y` CSS 속성은 iOS Safari가 미지원 (Chrome/Firefox만)
  - 즉 manifest의 `apple-mobile-web-app-capable: yes`(5/19 추가)로 standalone 활성 → native PTR 사라짐 → **커스텀 JS 구현 필수**
- **회고**: 5/19 작업 시 "overscroll-behavior contain으로 변경하면 동작" 가설은 iOS Safari 미지원이라 무효. 실제로 동일 5/19에 `usePullToRefresh` hook + `PullToRefreshIndicator` 추가되어 있었으나 standalone 검사 없어 동작 보장 안 됨
- **수정** (`frontend/src/hooks/usePullToRefresh.ts`):
  - `isIOSStandalone()` 헬퍼: `window.navigator.standalone === true` 검사
  - useEffect 시작에서 standalone 아니면 listener 자체 등록 안 함 — 일반 브라우저는 native PTR 유지
  - `dy > 10`에서만 `preventDefault` (작은 움직임은 일반 스크롤로 양보)
  - `touchcancel` 리스너 추가 (시스템 인터럽트 대응)
- **검증**: tsc PASS · build PASS (3.37s, PortfolioPage 77.14 kB)

### [방향전환] stock-history UN 우선 + J 폴백 — 사용자 의도(KRX+NXT 전체 시장) 반영 (2026-05-20 13:02 KST)
- **사용자 명시 의도**: "market_div='UN'으로 설정해야 내가 의도한 바와 같아. KRX+NXT 전체 시장 데이터를 반영하려고 하는게 맞아."
- **D 단계 진단 (`scripts/diag_un_vs_j_20260520.py`)**:
  - 231종목 전체 J vs UN 호출 비교 → `docs/research/2026-05-20-un-stale-diag.json`
  - 양쪽 fresh: 66 (28.6%)
  - 🔴 UN stale (옛 데이터 잔존): 42 (18.2%)
  - 🔴 UN 빈 응답 (NXT 미상장): 121 (52.4%)
  - **▶ UN 마이그레이션 위험 종목: 163/231 (70.6%)** — J 폴백 필수
- **A 단계 구현 — UN 우선 + J 폴백**:
  - `modules/stock_history.py`:
    - `_is_fresh` 헬퍼 + `_get_daily_price_with_fallback`, `_get_daily_ohlcv_with_fallback` 메서드 추가
    - 3 호출 지점 모두 폴백 헬퍼 사용 (메인 + 추가 조회 + _fetch_daily_volume)
    - 추가 조회는 메인과 동일한 market_div 사용 (단위 일관)
  - `modules/kis_client.py`: 두 메서드 docstring 정정 (UN 우선 + J 폴백 정책 안내)
- **결정적 진단 — `inquire-price` API는 NXT 미상장 종목도 UN으로 정상 응답**:
  - 008290/037460/031330 등 NXT 미상장 종목: UN과 J 응답 완전 동일 (price/vol/tv)
  - 005930/000660 등 NXT 활발: UN = J + NXT (정상 합산)
  - → kis-proxy의 J 별도 호출 불필요, `krx_volume` 필드 제거 가능
- **kis-proxy 단순화**:
  - `supabase/functions/kis-proxy/index.ts`: `fetchStockPrice`에서 J 별도 호출 + `krx_volume` 응답 필드 제거
  - `frontend/src/lib/kis-api.ts`: `KisStockPrice.krx_volume?` 타입 제거
  - 재배포 완료 (project fyklcplybyfrfryopzvx)
- **frontend currentVol 단순화**:
  - `PortfolioPage.tsx`: `live.krx_volume ?? live.volume` → `live.volume` 단독
  - `StockCard.tsx`: 동일하게 `livePrice.volume` 단독, 주석 갱신
- **즉시 backfill (`scripts/backfill_un_first_20260520.py`)**:
  - 231 종목 UN 우선 + J 폴백 일괄 호출 → 227 갱신, 4 timeout (기존 데이터 유지)
  - 검증:
    - SK하이닉스 5/19 거래량: J 4,575,855주 → **UN 7,805,248주** (+70%, NXT 분량 정확 반영)
    - 삼성전자 5/19 거래량: **UN 55,578,031주**
    - 대우건설(NXT 미상장): J 폴백 적용 → 5/20 6,845,181주 정상
    - 008290(NXT 미상장): J 폴백 → 117,540주 정상
- **검증**: tsc PASS · build PASS (2.42s) · Python AST PASS · krx_volume 잔재 0건 · kis-proxy 배포 PASS
- **🔄 회고 — 5/19 결정의 부분 정당성**:
  - 5/19 "UN→J 영구 복귀"는 stale 회피엔 옳았지만 사용자 의도(NXT 통합 반영)와 반대
  - 이번 폴백 패턴이 양자 모두 충족 (UN 통합 + stale 회피)

### [버그픽스/문서] 거래집중 bin_count=40 의도 반영 + kis_client 주석 cleanup (2026-05-20 12:26 KST)
- **변경 파일**:
  - `collect_volume_profile.py` (+3/-1, line 101): `calc_volume_profile(minute, num_bins=40)` 인자 추가
  - `modules/kis_client.py` (1줄): `get_stock_daily_price` market_div 주석 정정 (UN→J)
- **사용자 검증 요청 결과 — 4지표 정확성 면밀 검증 후 발견**:
  - SK하이닉스 MTS 캡쳐(11:24, UN) 기준 4지표(VWAP/RVOL/30일 순위/거래집중) 산식·단위·시점 일관성 모두 정확
  - 발견된 실제 버그: today 매물대 bin_count=20 (의도 40)
- **🔴 버그 원인 (5/18 22:14 작업 누락)**:
  - 5/18에 `modules/volume_profile.py`의 `collect_full`/`collect_intraday` 함수에 num_bins=40 추가
  - 그러나 cron 실행 경로인 `collect_volume_profile.py:101`은 그 함수들을 우회하고 `calc_volume_profile()`을 직접 호출
  - 직접 호출 시 num_bins 인자 미지정 → 기본값 20 적용 → 데이터에 bin_count=20 저장
  - cron 매핑 검증:
    - `refresh-data.yml` / `theme-forecast-intraday.yml` → `collect_volume_profile.py --intraday` (영향 받음)
    - `collect-paper-trading.yml` → 옵션 없음 모드(`collect_full` 경유, num_bins=40 적용) (영향 없음)
- **역산 검증**:
  - SK하이닉스 today: bin_size=3,400원, price_low=1,690,000, price_high=1,758,000
  - (1,758,000-1,690,000)/20 = 3,400 ✅ (현재 20 적용)
  - 의도 40이면 bin_size=1,700원이어야 함
- **수정 후 효과**:
  - 다음 cron(refresh-data 또는 theme-forecast-intraday)부터 today.bins[].length=40
  - 고가 종목(SK하이닉스 등) 가격대 정밀도 2배 향상 (예: 3,400원 → 1,700원 단위)
- **`kis_client.py:598` 주석 cleanup**:
  - 기존: "stock-history는 'UN'."
  - 실제(5/19 영구 복귀): `modules/stock_history.py`의 3개 호출 모두 `market_div="J"`
  - 수정: "stock-history는 'J'(KRX 단독, 5/19 영구 복귀)."
- **검증**: Python AST PASS (2개 파일)

### [설정/배포] gitignore 로컬 산출물 5종 추가 + kis-proxy 재배포 (2026-05-20 11:13 KST)
- **변경 파일**:
  - `.gitignore` (+7 — `.superpowers/`, `supabase/.temp/`, `data/`, `backtest_monthly_ma10.py`, `test_overseas_api.py`)
- **gitignore 결정 근거**:
  - `.superpowers/brainstorm/` — superpowers 도구 산출물
  - `supabase/.temp/` — supabase CLI 캐시 (project-ref 등)
  - `data/investor_backtest/` — 백테스트 데이터 (운영 데이터 `frontend/public/data/`와 별개)
  - `backtest_monthly_ma10.py` / `test_overseas_api.py` — 개인 실험 스크립트 (root level, modules/scripts 외)
- **kis-proxy 배포**:
  - `supabase functions deploy kis-proxy` 실행 → Deployed Functions on project fyklcplybyfrfryopzvx
  - 직전 커밋(`3cf131b6` UN→J 정리)의 cutoff 분기 + `_krx_error` 제거 반영
  - 검증: 사용자 측 frontend에서 응답 확인 가능 (krx_volume 정상, _krx_error 없음)

### [리팩토링] UN→J 복귀 후속 정리: cutoff 분기 + reminder workflow + 진단 필드 제거 (2026-05-20 10:44 KST)
- **변경 파일** (+13/-111):
  - `frontend/src/lib/market-metrics.ts` (RVOL_HISTORY_UN_CUTOFF_MS 상수 + 주석 제거)
  - `frontend/src/components/PortfolioPage.tsx` (import 정리 + currentVol 단일 경로)
  - `frontend/src/components/StockCard.tsx` (import 정리 + rvolVol 단일 경로 + 주석 갱신)
  - `supabase/functions/kis-proxy/index.ts` (cutoff 분기 + RVOL_HISTORY_UN_CUTOFF_MS 상수 + `_krx_error` 진단 필드 제거)
  - `.github/workflows/rvol-cleanup-reminder.yml` (git rm — 임시 워크플로 삭제)
- **배경**: 5/19 작업(stock-history UN→J 영구 복귀) 회고에서 명시한 후속 정리 항목.
- **단순화 결정**:
  - stock-history가 영구 J(KRX 단독)이므로 currentVol/rvolVol도 KRX 단독을 우선해야 단위 일관.
  - cutoff 분기는 5/31 이후 `live.volume`(UN)을 currentVol로 쓰는 분기였는데, 영구 J 상황에서는 잘못된 단위 → 분기 자체 제거.
  - 새 단일 경로: `krx_volume`(KRX 단독) 우선, 누락/0이면 `volume`(UN) fallback — 표시 끊김 회피 목적.
  - kis-proxy도 항상 J 호출하여 krx_volume 채움 (retry 1회 유지).
- **rvol-cleanup-reminder.yml 삭제 근거**:
  - 5/17 추가된 1회성 임시 워크플로(5/31 cron 1회 실행)
  - 본문: "stock-history UN 마이그레이션 완료 → 임시 코드 제거" 이슈 자동 생성 예정이었음
  - UN 마이그레이션 자체가 5/19에 reverse + 이번 작업에서 cutoff 분기 코드 소멸 → 이슈 생성해도 처리 대상 없음
  - 운영 13개 cron 보호 정신 외 — 임시 워크플로이므로 삭제 가능
- **`_krx_error` 진단 필드 제거 근거**:
  - 5/19 22:07 임시 추가 (J 호출 실패 시 응답에 에러 메시지 캡처)
  - 영구 J 복귀로 J 호출이 핵심 경로가 됨 → 진단 가설 변경, 임시 코드 정리
- **검증**: tsc PASS · build PASS (3.42s, PortfolioPage 77.18 kB, index 678 kB) · grep 잔재 0건
- **🔴 사용자 액션 필요**: `supabase functions deploy kis-proxy` 재배포 (frontend 빌드만으론 Edge Function 코드 미반영)

---

## 2026-05-19

### [버그픽스] stock-history UN 마이그레이션 결정 reverse + 101종목 즉시 복구 (2026-05-19 23:53 KST)
- **변경 파일**:
  - `modules/stock_history.py` (market_div="UN" → "J", 3곳)
  - `frontend/public/data/stock-history.json` (101종목 J로 갱신)
- **사용자 보고**: 대우건설 RVOL/30일 순위 미표시
- **🔴 진단 (KIS API 자체 이슈 확인)**:
  - 047040 일별 시세 J 호출 → 최신 2026-05-19 ✅
  - 047040 일별 시세 **UN 호출 → 최신 2026-02-11 (3개월 stale)** ❌
  - 005930 J/UN 모두 정상
  - 결론: **KIS API의 UN 시장구분 일별 시세가 NXT 미상장/거래 미미 종목에서 stale 데이터 반환**
- **5/17 결정 회고**: "stock-history UN 마이그레이션"이 잘못된 결정. UN endpoint가 모든 종목에 안전한 응답을 보장 안 함
- **수정**: stock_history.py 모든 호출을 J로 영구 복귀
- **즉시 backfill**:
  - 101 stale 종목 모두 J 호출 → 갱신 성공
  - 47040 changes[0] = 2026-05-19 close=27,050 (오늘 데이터)
  - 전체 stale: 101 → 0
- **추가 정리 권장 (별도)**:
  - `RVOL_HISTORY_UN_CUTOFF_MS` 분기 의미 변경됨 — stock-history가 영구 J이므로 cutoff 분기 자체가 무의미해짐
  - rvol-cleanup-reminder.yml의 5/31 cutoff 자동 해소 가설도 무효

### [버그픽스/PWA] iOS PWA pull-to-refresh 작동 불가 진단 + 수정 (2026-05-19 23:47 KST)
- **변경 파일**:
  - `frontend/src/index.css` (overscroll-behavior-y: none → contain)
  - `frontend/index.html` (apple PWA meta + manifest link 추가)
  - `frontend/public/manifest.webmanifest` (신규)
- **사용자 보고**: pull-to-refresh 기능 작동 안 함
- **진단 결과 3가지 원인**:
  1. **🔴 가장 큰**: `overscroll-behavior-y: none`이 iOS PWA에서 swipe 자체 차단
  2. PWA 메타 누락 (apple-mobile-web-app-capable 등) → iOS가 일반 웹뷰로 취급
  3. manifest.webmanifest 파일 자체 부재
- **수정**:
  - **A**: overscroll-behavior-y `none` → `contain` (페이지 끝 bounce는 막되 swipe 허용)
  - **B-1**: apple-mobile-web-app-capable/status-bar-style/title + mobile-web-app-capable 메타 추가
  - **B-2**: manifest.webmanifest 신규 (name, scope, display: standalone, icons 등)
- **검증**: tsc PASS · build PASS (3.27s) · dist에 manifest 정상 포함
- **사용자 시험 필요**: 홈 화면에서 앱 종료 후 재실행 → 페이지 최상단에서 손가락 아래로 60px+ 당김

### [UI] 모의투자 이력 시간선택 dropdown 디자인 개선 (2026-05-19 23:19 KST)
- **변경 파일**: `frontend/src/components/PaperTradingPage.tsx`
- **사용자 보고**: 매수 시각 select 박스의 OS 기본 ↕ 화살표가 어색
- **수정**:
  - `appearance-none`으로 OS 기본 화살표 제거
  - 커스텀 ChevronDown 아이콘 (absolute right-1.5)
  - 폰트 크기 통일 (text-[11px] sm:text-xs, font-medium)
  - 호버 효과 (bg-muted/60 → /80) + focus ring (primary/30)
  - rounded-md + 패딩 일관(pl-2.5 pr-7 py-1) + tabular-nums
  - 단일 시각 표시 span도 동일 스타일로 통일
- **검증**: tsc PASS · build PASS (3.44s)

### [진단] kis-proxy에 _krx_error 진단 필드 추가 (2026-05-19 22:07 KST)
- **변경 파일**: `supabase/functions/kis-proxy/index.ts` (+4/-1)
- **목적**: krx_volume 누락이 시간대별로 재발 → KIS API의 정확한 에러 메시지 캡처
- **추가**: J 호출 실패 시 응답에 `_krx_error: "<msg>"` 임시 필드 (성공 시 미포함)
- **재배포 완료**: 직후 검증 15/15 정상 (재배포 직후 일시 정상화는 일관된 패턴)
- **현재 평가**: 4지표 로직 자체는 정확. krx_volume 누락은 frontend UN fallback으로 표시 끊김 없음
  - 부풀림(대장주 RVOL 1.5~2배)은 5/31 cutoff에 자동 해소 (stock-history가 UN으로 차오르면서)
  - 진단 코드는 다음 누락 발생 시 자동으로 에러 캡처 → 영구 원인 파악
- **추가 작업 없음**: 지켜보기가 최선

### [버그픽스] kis-proxy 배포 누락 → krx_volume 필드명 불일치 해결 (2026-05-19 21:42 KST)
- **재검증 진단**: 5/18 작업 시 분석한 "rate limit retry 부족"은 부정확 — 모든 시나리오(단일/bulk/5초 대기)에서 일관 누락이라 rate limit 원인 기각
- **(A) 배포 코드 download + diff 진행**:
  - 배포된 코드 = 5/18 21:45 이전 옛 버전 (필드명 `volume_krx`, fetchPriceConcentration dead code 포함)
  - 로컬 코드 = 5/18 22:14 작업 결과 (필드명 `krx_volume`, fetchStockPriceMarket 리팩토링 + retry)
  - 차이 140줄
- **근본 원인**: 5/18 22:14 작업 이후 `supabase functions deploy kis-proxy` **누락**. 그 사이 작업들이 frontend만 변경이라 배포 영향 인지 못 함
- **조치**: 로컬 코드 그대로 재배포 (`fetchPriceConcentration` action은 frontend 사용처 없음 확인 후 안전)
- **재배포 후 검증**: 5종목 × 5회 반복 = 25회 모두 `krx_volume` 정상 응답 ✅
  - 005930 krx_volume = 30,767,569 (Python 직접 KIS 호출 결과와 정확히 일치)
- **자체 분석 평가**: 5/18 진단 시 "retry 강화 권장"이 부정확. 진짜 원인은 더 단순한 배포 누락이었음. 향후엔 supabase 배포 상태 download diff 우선 확인 필요

### [진단] 4지표 (VWAP/RVOL/30일 순위/거래 집중) 재검증 결과 (2026-05-19 21:30 KST)
- **검증 범위**: 5종목(005930, 000660, 006800, 047040, 000020) × 4지표 + kis-proxy 응답 안정성 5회 반복
- **✅ 정상 (5건)**:
  - VWAP: 5종목 모두 ±5% 합리적, 분자/분모 UN 일관성 확보
  - stale 감지: 047040(3개월 stale), 000020(history 없음) 정확히 인식 → RVOL/30일 순위 미표시
  - 30일 순위 평균 위치 정상 적용 (14.0, 15.0, 17.0)
  - 거래 집중 bin 정밀도 ↑ 효과 적용 (bin_size 145/437/2850, 40 bin)
  - D 등락률 재계산 + amber 안내 배너 정상
- **🔴 Critical 발견**: kis-proxy `krx_volume` 5회 모두 누락
  - 원인: `fetchStockPriceMarket` retry가 rate limit 분기만 처리 → 그 외 에러는 즉시 fail
  - 영향: cutoff 전인데도 frontend가 UN volume으로 fallback → 단위 일부 불일치 (UN tv vs J avg 가능)
  - frontend fallback 덕분에 RVOL 표시 자체는 정상 (null 아님)
- **🟡 진행 중**: stock-history staleness 32% (149종목 중 48종목만 최신)
  - main.py union 변경(`aefe858a`)은 다음 cron부터 자동 반영 예정
- **결론**: 4지표 로직 자체는 정확. kis-proxy retry 강화 권장 (별도 진행)

### [버그픽스/인프라] stock-history stale 감지 + 차트 안내 + 누락 종목 union 수집 (2026-05-19 20:30 KST)
- **변경 파일**:
  - `frontend/src/lib/market-metrics.ts` (isHistoryStale 헬퍼)
  - `frontend/src/components/PriceHistoryPopup.tsx` (stale 배너 + D 등락률 재계산)
  - `frontend/src/components/PortfolioPage.tsx` (history 타입 + stale 시 RVOL/30일 순위 미표시)
  - `frontend/src/components/StockCard.tsx` (stale 시 RVOL/30일 순위 미표시)
  - `main.py` (history 수집 대상에 기존 종목 union)
- **🔴 Critical 사용자 보고**: 대우건설 차트에서 D-1 7,380원 → D 29,300원인데 등락률 +2.81%로 표시 (정확히 계산하면 +297%)
- **원인 정확히 파악**:
  - PriceHistoryPopup이 D-1까지는 `stock-history.json.changes`, D는 `currentPrice/currentChangeRate` (latest.json)를 사용
  - 두 데이터 소스의 **날짜 검증 없음**
  - 047040 대우건설: changes[0].date = **2026-02-11** (3개월 stale), D = 5/15 (오늘) → 시점 격차 3개월
- **광범위 검증**: 152종목 중 stock-history changes[0].date 분포
  - 2026-05-18 (오늘): **37종목 (24%)만 최신**
  - 2026-02-11 stale: 16종목
  - 2025-12-30 stale: 8종목
  - 9개월 stale 종목까지 존재
  - **총 76%가 stale** — 광범위한 데이터 누락
- **근본 원인 (인프라)**: `main.py:405`에서 `all_stocks`(오늘 상위)만 history 수집 → 어제 상위였다가 빠진 종목은 옛 데이터 영구 잔존
- **수정 (UI 즉각)**:
  - **isHistoryStale**: changes[0].date와 현재 KST의 차이 > 7일이면 stale
  - **PriceHistoryPopup**: stale 시 상단 amber 배너 안내 + D 등락률을 `(currentPrice - changes[0].close) / changes[0].close × 100`로 재계산 (정직한 큰 값 표시)
  - **PortfolioPage/StockCard**: stale 시 recent20/historicalVols30을 빈 배열로 → RVOL/30일 순위 null → 미표시
- **수정 (인프라 근본)**:
  - `main.py [8/13]`에서 `all_stocks` + 기존 stock-history.json의 모든 코드를 union하여 수집 대상에 포함
  - 한 번 들어간 종목은 매 cron마다 갱신 → stale 영구화 방지
  - 다음 cron부터 자동 backfill
- **검증**: tsc PASS · build PASS (3.58s) · main.py AST PASS

## 2026-05-18

### [개선] 30일 순위 동률 평균 위치 + 거래 집중 bin 정밀도 ↑ (2026-05-18 22:14 KST)
- **변경 파일**:
  - `frontend/src/lib/market-metrics.ts` (calculateRank30)
  - `frontend/src/components/PortfolioPage.tsx` (rank30 표시)
  - `frontend/src/components/StockCard.tsx` (rank30 표시)
  - `modules/volume_profile.py` (today num_bins 20→40)
- **사용자 요청 두 가지 개선**:
  1. **30일 순위 동률 처리**: `indexOf` → 평균 위치(fractional rank)
     - 코드: `(firstIdx + lastIdx) / 2 + 1`
     - 통계 표준 방식 (average rank). 같은 거래량 그룹의 first/last 평균
     - UI: 정수면 "N위", 소수면 "N.N위" 표시
  2. **거래 집중 bin 정밀도 ↑**: 분봉 매물대 num_bins 20→40
     - `collect_full`의 today + `collect_intraday` 둘 다 적용
     - 일봉 매물대(1y/6m/3m/1m/1w)는 기존 20 유지
     - 효과: 다음 cron(매분 30분 간격)부터 더 정밀한 가격대 분포. 대장주(가격 범위 큼)에서 효과 큼
- **반영 시점**: frontend 즉시. backend는 다음 volume-profile cron(매 30분 간격) 갱신 시 자동 적용
- **검증**: tsc PASS · build PASS (3.69s) · Python AST PASS

### [UI] 포트폴리오 카드 매수/평가 정보 2줄 시멘틱 분리 (2026-05-18 21:54 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **사용자 보고**: compact info row 5개 항목 wrap 어색 (손익만 외톨이로 두 번째 줄)
- **수정**:
  - 매수 정보 행: `매수가 · 수량 · 투자금`
  - 평가 정보 행: `평가금 · +손익원 (+률%)` (손익률 inline 추가)
  - dot 구분자(`·`)로 항목 시각적 분리
  - 손익률을 손익 금액 옆 작은 텍스트로 결합 표시
- **검증**: tsc PASS · build PASS (3.40s)

### [UI] 포트폴리오 카드에 평가금 표시 추가 (2026-05-18 21:51 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (compact info row)
- **사용자 보고**: 평가금 정보 표시 필요
- **수정**:
  - 투자금 다음에 평가금 추가: `평가금 {evalAmount}원` (강조 색)
  - 좁은 화면에서 wrap 가능하도록 `flex flex-wrap gap-x-3 gap-y-0.5` 적용
- **표시 순서**: 매수가 / 수량 / 투자금 / **평가금** / 손익
- **데이터**: 기존 enrichedHoldings의 `evalAmount = currentPrice × quantity` 활용 (계산 추가 없음)
- **검증**: tsc PASS · build PASS (3.53s)

### [버그픽스/UI] StockCard VWAP 단위 섞임 수정 + 모달 dim 제거 (2026-05-18 21:45 KST)
- **변경 파일**:
  - `frontend/src/components/StockCard.tsx` (VWAP/RVOL volume 변수 분리)
  - `frontend/src/components/MetricsInfoModal.tsx` (backdrop dim 제거)
- **사용자 보고 (🔴 Critical)**: SK하이닉스 VWAP 3,014,811원 (현재가 1,840,000원 vs -38.97%) — 비정상치
- **원인 정확히 파악**:
  - 역추적: `trading_value(UN) / 3,014,811 = 6,481,608 = krx_volume(KRX)`
  - 즉 VWAP 계산에 **분자(UN tv) / 분모(KRX vol)** 단위 섞임
  - StockCard에서 effectiveVol 변수 하나로 VWAP과 RVOL 둘 다 처리 → VWAP은 UN 일관 필요, RVOL은 KRX 우선이라 충돌
  - PortfolioPage는 이미 분리됨(`live.volume`은 VWAP, `currentVol`은 RVOL) — StockCard만 버그
  - 직전 검증 누락: 검증 시점엔 stock.volume(J)/trading_value(J)로 단위 통일이라 정상이었음. lazy fetch 후 단위 섞임이 발생하는 코드 경로 미점검
- **수정**:
  - **VWAP용**: `vwapVol = livePrice?.volume ?? stock.volume` (UN 일관)
  - **VWAP용**: `vwapTv = livePrice?.trading_value ?? stock.trading_value` (UN 일관)
  - **RVOL/30일 순위용**: `rvolVol = livePrice ? (cutoff 분기 + krx_volume/volume fallback) : stock.volume`
  - RVOL_HISTORY_UN_CUTOFF_MS를 inline 대신 import로 정리
- **MetricsInfoModal dim 제거** (사용자 요청):
  - `bg-black/50 backdrop-blur-sm` 제거
  - `pointer-events-none` + 카드만 `pointer-events-auto`로 변경 → backdrop 시각 효과 제거, 카드는 정상 클릭
  - ESC 키 닫기 / X 버튼 닫기 유지
- **검증**:
  - SK하이닉스 시뮬레이션: 19.54조 / 10.77M = **1,814,144원** (정상치 1,820,000원 근처, +1.43%) ✅
  - tsc PASS · build PASS (3.41s)

### [버그픽스/개선] kis-proxy retry + StockCard lazy expand + 시장지표 위치 이동 (2026-05-18 21:37 KST)
- **변경 파일**:
  - `supabase/functions/kis-proxy/index.ts` (fetchStockPriceMarket retry 1회 + 250ms backoff)
  - `frontend/src/components/PortfolioPage.tsx` (krx_volume 0/null 시 live.volume fallback)
  - `frontend/src/components/StockCard.tsx` (lazy expand + searchKisStock 호출 + 위치 이동)
- **사용자 보고 (검증 후 발견)**:
  - kis-proxy 응답에 krx_volume 누락 재발 → RVOL/30일 순위 null
  - 메인 대시보드 StockCard가 latest.json (cron 시점, 5/15) 데이터라 PortfolioPage(kis-proxy 실시간)와 다른 값
- **개선 사항**:
  - **kis-proxy retry**: J 보조 호출 실패 시 250ms backoff 후 1회 재시도. rate limit/일시 실패 회피
  - **frontend fallback**: krx_volume 누락이어도 live.volume(UN)으로 fallback → RVOL/30일 순위가 null로 사라지지 않음
  - **StockCard lazy expand**: 기본 접힘. 펼침 시 그 시점에 `searchKisStock(code)` 1회 호출 → KIS API 호출 폭증 회피 (메인 대시보드 종목 수십~수백 곱하기 호출 폭증 위험 방지)
  - **위치 이동**: 거래 박스 다음 → 관련 뉴스 바로 위 (사용자 요청)
- **검증** (배포 후 3회 반복 호출):
  - 모든 종목·모든 회차에서 krx_volume 정상 반환 ✅
  - search action도 정상 (StockCard용 단일 호출 검증)
- **데이터 흐름 변경**:
  - StockCard live 데이터 = livePrice (kis-proxy fetch) 우선, 없으면 stock(latest.json) fallback
  - effectiveVol/effectiveTv/effectiveCur 변수로 분리
- **검증**: tsc PASS · build PASS (4.65s) · kis-proxy 배포 성공

## 2026-05-17

### [기능/리팩토링] StockCard에 VWAP/RVOL/30일 순위/거래 집중 적용 + 공통 모듈 추출 (2026-05-17 23:16 KST)
- **변경 파일**:
  - `frontend/src/lib/market-metrics.ts` (신규, +69) — VWAP/RVOL/Rank30/Concentration 계산 + getMarketElapsedRatio + cutoff 상수
  - `frontend/src/components/MetricsInfoModal.tsx` (신규, +138) — VwapHelp/RvolHelp/Rank30Help + 통합 모달 컴포넌트
  - `frontend/src/components/PortfolioPage.tsx` (리팩토링, 인라인 코드 제거 → 공통 모듈 사용)
  - `frontend/src/components/StockCard.tsx` (+90 — 계산 + UI + 모달)
  - `.github/workflows/rvol-cleanup-reminder.yml` (cleanup 대상에 main.py UN 마이그레이션 추가)
- **목적**: VWAP/RVOL/30일 순위/거래 집중 4개 지표를 메인 대시보드 StockCard에도 적용 (사용자 요청, 옵션 a)
- **공통화**: PortfolioPage·StockCard에서 동일 로직 사용. 향후 Help 텍스트 변경 시 한 곳만 수정
- **StockCard UI 위치**: 거래 박스 row 다음 + border-t로 구분
- **데이터 단위 주의**:
  - StockCard는 latest.json의 stock.volume (KRX 단독 J)
  - stock-history는 5/17부터 UN 수집 → 5/31 cutoff까지 혼재, 그 후 UN 정착
  - cutoff 후 stock.volume(J) vs avgVol(UN) 영구 불일치 가능 → main.py UN 마이그레이션이 cleanup reminder에 포함
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.13s, PortfolioPage 73KB → 76KB, index 663KB → 676KB)

### [UI] 30일 순위 옆 백분위(상위 N%) 표시 (2026-05-17 22:58 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **사용자 보고**: "8위"만 표시되면 상위 몇%인지 직관적 이해 어려움
- **수정**:
  - enrichedHoldings에 `rank30Total` 추가 (실제 비교 개수, 보통 30이지만 데이터 부족 시 변동)
  - UI: `{rank}위 (최고)` 또는 `{rank}위 (상위 N%)` 형태 — 1위는 "(최고)" 라벨, 나머지는 백분위
  - 예: 미래에셋증권 8위/30 → `8위 (상위 27%)`
- **검증**: tsc PASS · build PASS (4.87s)

### [UI] 포트폴리오 카드 매수정보 vs 시장지표 구분선 (2026-05-17 22:51 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (1줄)
- **사용자 보고**: VWAP 라인과 그 이전 라인 사이 시각적 구분 없어 가독성 떨어짐
- **수정**: Live VWAP/RVOL/30일 순위 행에 `mt-2 pt-2 border-t border-border/40` 추가
  - 매수 정보 그룹(매수가·수량·투자금·손익) ↔ 시장 지표 그룹(VWAP·RVOL·30일 순위·거래 집중) 분리
- **검증**: tsc PASS · build PASS (3.37s)

### [개선] IntradayInsights 섹션 명명 정정 (2026-05-17 22:49 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`
- **사용자 보고**: "장중 시장 동향" 타이틀인데 데이터는 마감 직후(15:46~15:48)에만 생성됨. 17개 히스토리 모두 영업일별 1회 마감 직후 → "장중"은 명백한 오류
- **검증**: `intraday-insights-history.json` 17 스냅샷 모두 다른 영업일, 모두 15:46~15:48 → 매 영업일 1회 마감 직후 수집 확정
- **변경**:
  - 메인: "장중 시장 동향" → **"오늘의 시장 동향"**
  - sub: "테마별 장중 등락률" → **"테마별 일간 등락률"** (2곳)
  - sub: "장중 모멘텀 급변 TOP5" → **"당일 모멘텀 급변 TOP5"** (2곳, 보조 설명 유지)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.94s)

### [기능/버그픽스] 30일 순위 + 거래 집중 지표 + 줄바꿈 + off-by-one (2026-05-17 22:41 KST)
- **변경 파일**:
  - `frontend/src/components/PortfolioPage.tsx` (30일 순위·거래 집중·Rank30Help·infoPopup 분기, off-by-one 수정)
  - `frontend/src/components/IntradayInsights.tsx` (헤더 flex-wrap + whitespace-nowrap)
- **신규 지표**:
  - **30일 순위**: `changes` 기반 자기 자신 30영업일 거래량 중 순위 (1=최고)
    - 데이터: 어제부터 29영업일 + 오늘 currentVol = 30 비교
    - 색상: 1위 진한 red+bold, ≤3위 red, ≤15위 기본, 그 외 muted
    - (?) 클릭 시 모달 — 등급(1위/상위10%/상위50%/상위90%) + RVOL 함정 검증 안내
  - **당일 거래 집중**: `volumeProfileData.profiles[code].today.bins` 기반 top 3 가격대 + 비중(%)
- **줄바꿈 오류 수정** (이미지 [Image #41] 보고):
  - IntradayInsights 헤더 "장중 시장 동향" / "기준" / "라이브" 등이 모바일 폭에서 글자 깨짐
  - 컨테이너에 `flex-wrap gap-y-1`, 텍스트·버튼에 `whitespace-nowrap shrink-0` 추가
- **off-by-one 수정 (검증 후 발견)**:
  - 30일 순위 계산에서 `changes.slice(0, 29)` → `slice(1, 30)`
  - 휴장일/마감 후 changes[0](=오늘)과 currentVol(=오늘) 중복 비교 문제 해소
  - RVOL의 `slice(1, 21)`과 일관성
- **검증 (재검증 후 결론)**:
  - 발견 1 (off-by-one) — 정확, 즉시 수정 ✅
  - 발견 2 (cron 시점 시스템 이슈) — 30종목 cross 분석 결과 시스템 차원 이상 없음, 005930 같은 대장주만 시간외 거래량 비중이 커서 두 KIS endpoint(`inquire-daily-itemchartprice` vs `inquire-price`)의 정의 차이로 두드러짐. **cutoff(2026-05-31) UN 마이그레이션 후 자동 해소**.
  - 발견 3 (거래 집중 분모) — 분봉 cntg_vol 합산 내 비중 계산, 의도된 동작
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.22s)

### [기능] 헤더 종목 검색에 최근검색 영역 추가 (2026-05-17 22:21 KST)
- **변경 파일**:
  - `frontend/src/lib/recent-search.ts` (신규, +32)
  - `frontend/src/App.tsx` (StockSearchPanel +60)
- **목적**: 사용자가 자주 보는 종목 빠른 재접근
- **저장 정책**:
  - localStorage 키 `recent-stock-searches` (디바이스별)
  - 최대 10개, 중복 제거, 최신 우선
  - 검색 결과에서 선택했을 때만 저장 (타이핑만으론 저장 안 함)
- **노출 조건**: 검색 input 비어있을 때만 표시 → 자동완성과 자연스럽게 전환
- **UI**:
  - 영역 헤더: 🕐 "최근검색" + "전체 지우기" 텍스트 버튼
  - 각 항목: 종목명 + 코드 + 등락률(한국 색상) + 개별 ✕
  - 마스터에 없는 종목(상폐 등): 회색 처리, 등락률 미표시
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.66s)

### [버그픽스] RVOL 휴장일 정책 일관성 + Edge Function 캐시 이슈 재배포 (2026-05-17 22:08 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (1줄)
- **사용자 보고 2건 연속**:
  1. "RVOL 값 왜 안보여?" — 휴장일(일요일) 차단으로 미표시
  2. "휴장일이라 안보이는거면 VWAP도 안보여야지" — 일관성 지적
- **정책 변경**: 휴장일에 `getMarketElapsedRatio()`가 null이 아닌 **1 반환** (= VWAP·현재가와 동일하게 직전 영업일 마감 데이터 기준)
  - KIS UN 시세가 휴장일에 직전 영업일 누적값을 반환하므로 자연스러움
  - 다른 지표(VWAP, 현재가, 등락률)와 정책 일치
- **재배포 이슈**: 사용자 새로고침 후에도 RVOL 미표시 → 진단 결과 Edge Function 응답에 `krx_volume` 누락 (옛 캐시된 응답으로 `volume_krx` 등 다른 키로 응답)
  - `supabase functions deploy kis-proxy` 재실행 → 즉시 정상화
  - 재배포 후 실측: 005930 krx_volume=38,075,487 · 000660 krx_volume=7,485,233
- **예상 표시값**: 005930 RVOL **1.37x** (amber) · 000660 RVOL **1.57x** (amber)
- **검증**: tsc PASS · build PASS (3.59s)

### [버그픽스/개선] RVOL 데이터 출처 일치성 정정 + 휴장일/off-by-one + 설명 팝업 + cleanup 자동화 (2026-05-17 21:57 KST)
- **변경 파일**:
  - `modules/kis_client.py` (+8 — market_div 파라미터 추가, J 기본 유지)
  - `modules/stock_history.py` (+3 — 3개 호출에 market_div="UN" 명시)
  - `supabase/functions/kis-proxy/index.ts` (+25 — cutoff 분기 + KRX 별도 호출 + krx_volume 응답)
  - `frontend/src/lib/kis-api.ts` (+1 — krx_volume?: number)
  - `frontend/src/components/PortfolioPage.tsx` (+90 — VWAP/RVOL 설명 팝업 + cutoff 분기 + 휴장일 + off-by-one)
  - `.github/workflows/rvol-cleanup-reminder.yml` (신규)
- **검증 (이번에 발견된 결정적 오류)**:
  - VWAP 로직 정상 ✅ (분자/분모 모두 UN, 005930 280,123원 검증)
  - **🔴 RVOL 데이터 출처 불일치**:
    - 평균: stock-history.json은 `inquire-daily-itemchartprice` (J=KRX 단독)
    - 현재: kis-proxy `inquire-price` (UN=KRX+NXT)
    - 005930 실측 UN/KRX = 1.91배 → RVOL이 약 1.91배 부풀림
- **정정 방향**: 옵션 2 (stock-history → UN) + 10일 대기 동안 옵션 1 (kis-proxy KRX 별도) + cutoff 자동 전환
  - **cutoff**: `2026-05-31T15:30:00+09:00` (영업일 +10일 안정 마진)
  - cutoff 이전: `live.krx_volume / (avgVol_J × elapsed)` (양쪽 모두 J)
  - cutoff 이후: `live.volume / (avgVol_UN × elapsed)` (양쪽 모두 UN, stock-history는 5/17부터 UN 수집)
  - kis-proxy도 동일 cutoff 분기 — 이후 J 별도 호출 자동 skip
- **부가 정정**:
  - **off-by-one**: `changes.slice(0, 20)` → `slice(1, 21)` (어제부터 20영업일, 오늘 미포함)
  - **휴장일**: `getMarketElapsedRatio()`에 주말(`getDay()===0||6`) 차단, RVOL 미표시
- **자동 cleanup**: `.github/workflows/rvol-cleanup-reminder.yml`
  - cron `0 0 31 5 *` — 2026-05-31 00:00 UTC 실행
  - cutoff 시각 + 중복 issue 없음 확인 후 cleanup issue 자동 생성
  - issue 본문: 제거 대상 4곳(kis-proxy 분기/krx_volume·kis-api 필드·PortfolioPage 분기·이 워크플로 자체) 명시
- **VWAP/RVOL 설명 팝업** (사용자 요청):
  - 라벨 옆 `(?)` HelpCircle 아이콘 추가
  - 중앙 모달 (rounded-2xl, max-w-md) — 모바일/데스크탑 동일
  - VWAP: 활용법(현재가>VWAP=강세, <VWAP=매수기회) + 계산식
  - RVOL: 기준값(1.0/1.2~2.0/≥2.0/<1.0) + 계산식
  - backdrop tap / X 버튼 / ESC 닫기
- **검증**:
  - `npx tsc --noEmit` PASS · `npm run build` PASS (6.49s)
  - Python AST PASS
  - `supabase functions deploy kis-proxy` 성공
  - 실측: 005930 krx_volume=38.07M (KRX 단독) · 000020 KRX 폴백 정상

### [기능] 포트폴리오 카드 VWAP / RVOL 실시간 표시 (2026-05-17 21:30 KST)
- **변경 파일**:
  - `supabase/functions/kis-proxy/index.ts` (+1)
  - `frontend/src/lib/kis-api.ts` (+1)
  - `frontend/src/App.tsx` (+1)
  - `frontend/src/components/PortfolioPage.tsx` (+49)
- **VWAP 계산**: `acml_tr_pbmn / acml_vol` (KIS inquire-price 응답, 추가 API 호출 없음)
  - kis-proxy 응답에 `trading_value` 필드 신규 추가 → 배포 (`supabase functions deploy kis-proxy`)
  - 배포 후 검증: 005930 VWAP 280,123원 / 현재가 273,500 vs VWAP -2.36% 정상 계산
- **RVOL 계산 (옵션 B 시간 보정)**:
  - `getMarketElapsedRatio()`: KST 09:00~15:30 경과 비율 (장 시작 전 null, 마감 후 1)
  - 20일 평균 거래량: `stock-history.json`의 `changes[0..19].volume` 평균
  - 공식: `live.volume / (avgVol × elapsed)` — 평균 대비 1.0 = 정상
- **카드 UI 변경 (Q2=a 두 줄 추가)**:
  - 기존 Compact info row(매수가/수량/투자금/손익) 아래 신규 행 추가
  - 형식: `VWAP 280,123원 (-2.36%)   RVOL 1.45x`
  - VWAP 차이 색상: 양수=red, 음수=blue (한국 증시 관습)
  - RVOL 색상: ≥2.0x red, ≥1.2x amber, 그 외 무색 (이상치 강조)
  - VWAP/RVOL 둘 다 없으면 행 자체 숨김 (조건부 렌더링)
- **App.tsx**: `<PortfolioPage history={mergedHistory} />` prop 추가 (기존 다른 컴포넌트와 동일 패턴)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.47s, PortfolioPage 73KB → 74KB)

---

## 2026-05-15

### [기능] 가상 계산기 stock_toolkit 동기화 + 시나리오 탭 UI (2026-05-15 18:00 KST)
- **변경 파일**:
  - `frontend/src/lib/paper-calc-history.ts` (신규, +56)
  - `frontend/src/components/PaperCalcTab.tsx` (+241/-27)
- **목적**: theme-analysis 가상 계산기를 stock_toolkit과 공유 Supabase 테이블(`paper_calc_history`)로 sync
- **데이터 모델 통일**:
  - 단일 `items: PaperCalcItem[]` → `state: { tabs: ScenarioTab[], activeTabId: string }`
  - stock_toolkit과 100% 동일 스키마 (`tabs[i].items` 첫 탭 매핑 → 전체 탭으로 확장)
- **API (paper-calc-history.ts)**:
  - `fetchPaperCalcState()`: `PaperCalcState | null` (null=미로그인, 빈 state=서버 row 없음)
  - `savePaperCalcState(state)`: upsert (`onConflict: user_id`), `updated_at` ISO 직접 전송
- **PaperCalcTab 변경**:
  - state 단일 객체로 변경, 활성 탭 items는 useMemo 파생값 → 기존 UI(입력 폼·종합·누적 리스트) 그대로
  - `updateActiveTabItems(updater)` 헬퍼로 setItems 호출들 통합
  - mount 시 fetchPaperCalcState → setState (Supabase가 진실 소스)
  - state 변경 시 localStorage 즉시 + 500ms debounce upsert
  - `hasFetchedRef`로 fetch 전 save 차단 (서버 덮어쓰기 방지)
  - legacy `paper-calc-items` localStorage 자동 마이그레이션 → `paper-calc-state`
- **시나리오 탭 뱃지 UI** (검색 input 하단):
  - 활성 뱃지: primary 배경, ✏️ 이름변경 + ✕ 삭제 인라인
  - 비활성 뱃지: muted, 종목 수 미리보기 (예: `시나리오 2 · 3`)
  - `+ 새 시나리오` 버튼: 자동명 "시나리오 N" 추가 + 즉시 활성화
  - 이름변경: 인라인 input (Enter/blur commit, Esc cancel)
  - 삭제: confirm 모달, 마지막 1개는 삭제 불가
  - 활성 뱃지의 종목 수는 누적 리스트와 중복이라 표시 제거 (사용자 피드백)
- **동기화 정책**:
  - 로그인+서버 데이터 → 서버가 진실 소스, localStorage 덮어쓰기
  - 미로그인 → localStorage만 동작 (silent fallback)
  - stock_toolkit이 추가한 다른 탭 보존 (upsert 시 전체 tabs 교체지만 fetch에서 전체를 가져와서 보존됨)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.26s, PortfolioPage 69KB → 73KB)

### [개선] kis-proxy 시세 시장구분 J → UN (KRX+NXT 통합) (2026-05-15 17:45 KST)
- **변경 파일**: `supabase/functions/kis-proxy/index.ts` (+1/-1)
- **사용자 보고**: 포트폴리오·가상 계산기 종목 현재가가 애프터마켓(시간외) 가격을 못 가져옴 → 17:22 KST 시점에 15:30 정규장 종가에서 멈춤
- **원인 진단**:
  - `fetchStockPrice`에서 `FID_COND_MRKT_DIV_CODE=J` (KRX 단독) 하드코딩
  - KRX `inquire-price` (FHKST01010100) `stck_prpr`는 정규장 마감 후 종가에서 멈춤
- **검증 (KIS 공식 docstring)**: `J:KRX, NX:NXT, UN:통합` 시장구분 코드 존재
- **실측 검증 — 005930 삼성전자 (17:36 KST)**:
  - J: 270,500 / -8.61% / 거래량 37.9M (정규장 종가에 멈춤)
  - NX: 272,500 / -7.94% / 거래량 30.8M (NXT 애프터마켓 실시간)
  - **UN: 272,500 / -7.94% / 거래량 68.8M** (NXT 가격 + KRX·NXT 거래량 합산)
- **실측 검증 — NXT 미상장 폴백 (4종목: 005935, 006910, 000020, 003580)**:
  - 모두 NX 응답 0 (미상장), UN 응답이 J와 100% 동일 → **자동 KRX 폴백 확인**
- **수정**: `index.ts:67` `FID_COND_MRKT_DIV_CODE=J` → `UN` (1글자)
- **배포**: `supabase functions deploy kis-proxy` 성공
- **배포 후 검증**:
  - 005930: 현재가 273,000 / -7.77% / 거래량 68.9M (17:36 대비 +500원 = NXT 실시간 거래 진행 중)
  - 000020: 현재가 6,070 / 0.66% (J와 동일 = 폴백 정상)
- **효과**:
  - 시간외 단일가(KRX 16:00~18:00) + NXT 프리마켓(08:00~09:00) + NXT 애프터마켓(15:30~20:00) 자동 반영
  - `fetchKisPrices` 사용 컴포넌트 자동 반영 (PortfolioPage·PaperCalcTab·StockCard 등) — frontend 코드 변경 없음
- **부수 영향**: NXT 상장 종목의 거래량 = KRX+NXT 합산 (의도된 변경, 통합 시장 활동 지표)

### [기능/UI] 가상 계산기 디자인 세련화 + 영속 키 단일화 (2026-05-15 16:56 KST)
- **변경 파일**: `frontend/src/components/PaperCalcTab.tsx` (+85/-95)
- **사용자 보고 2건**:
  1. 디자인 정렬·여백·간격 개선
  2. 누적 리스트 휘발 — 직접 삭제 전까진 영속되어야
- **휘발 원인**: `storageKey = paper-calc-${user?.id ?? "anon"}`. user 상태 변경 시 키 변경 → 새 키 빈 배열 → 휘발 보임.
- **수정**:
  - storageKey **단일화** (`paper-calc-items`, 디바이스 단위). useAuth 의존 제거.
  - `useState` lazy initializer (mount 즉시 load)
- **디자인**:
  - 미리보기: grid-cols-[auto_1fr] 정렬, 수익률만 border-t 분리 강조, text-[13px]
  - 종합 카드: 메인 KPI(수익률·손익) 큰 글씨 위쪽 + 보조(매수·평가) 아래
  - 누적 리스트: divide-y, font-semibold 종목명, 행 padding py-3
  - 카드 rounded-xl, header uppercase tracking-wider
- **검증**: tsc PASS · build PASS (3.59s)

### [버그픽스] PaperCalcTab iOS zoom 방지 + localStorage lazy init (2026-05-15 11:00 KST)
- **커밋**: `92832edb`
- **변경 파일**: `frontend/src/components/PaperCalcTab.tsx`
- **내용**: 3개 input(검색·매수가·수량)에 `sm:text-sm` 추가(iOS Safari 16px 미만 zoom 방지). `loadedRef`로 load 완료 전 save 차단(React 18 Strict Mode 이중 마운트 시 데이터 손실 방지). 10 insertions / 4 deletions.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.51s)

### [기능] PortfolioPage 가상 계산기(PaperCalcTab) 탭 추가 (2026-05-15 10:54 KST)
- **변경 파일**: `frontend/src/components/PaperCalcTab.tsx` (신규), `frontend/src/components/PortfolioPage.tsx`
- **내용**:
  - `PaperCalcTab.tsx` 신규 작성: 종목 검색(마스터 기반) → KIS 현재가 자동 fetch → 가정 매수가/수량 입력 → 미리보기 → 누적 리스트 추가
  - localStorage 저장/복구 (`paper-calc-{userId}` 키)
  - 종합 수익률 카드(가중평균), 현재가 새로고침, 행 삭제/전체 삭제
  - `PortfolioPage.tsx`: `activeTab` 상태 + "내 보유" / "가상 계산기" 탭 분기, `masterStocks` prop 전달
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.87s, PortfolioPage 67KB)

## 2026-05-14

### [개선] 거래원 데이터 수집 대상 TOP20 → TOP30 확장 (2026-05-14 22:43 KST)
- **변경 파일**: `collect_investor_data.py` (+13/-5)
- **사용자 보고**: 삼성물산(028260) 거래원 "데이터 수집 전" 표시
- **진단**:
  - `member_data` 52종목 중 028260 미포함
  - 028260 KOSPI 단독 trading_value rank 20위지만, KOSPI+KOSDAQ 합산 시 **23위**
  - 거래원 수집 컷오프(top20) 한미반도체 4326억 vs 028260 3602억 → 3등 차이로 cut off
- **수정**:
  - `extract_top20_stocks(data)` → `extract_top_stocks(data, n=20)` 매개변수화
  - 거래원 수집 부분: `extract_top_stocks(latest, 30)` — TOP30로 확장
  - 텔레그램 TOP20 알림은 기존 그대로 (하위 호환 alias `extract_top20_stocks` 유지)
- **영향**:
  - 거래원 수집 대상 24개 → 약 34개 (대장주 9 + TOP30, 중복 제외)
  - KIS API 호출 ~50% 증가 (~5초 추가, 30분 cron 안에 충분)
  - 028260 등 KOSPI 20위권 밖 종목도 거래원 표시 가능
- **검증**: Python AST PASS, top30에 028260 포함 확인. 30위 컷오프 한화솔루션(009830) 2671억.

## 2026-05-13

### [기능/UI] 종목명 링크 네이버 → 토스 이동 + 일별 표 좌우 여백 (2026-05-13 23:52 KST)
- **변경 파일**: `frontend/src/components/{StockCard,StockList,PortfolioPage,ThemeForecastPage,AIThemeAnalysis,PredictionHistory,PaperTradingStockCard,IntradayInsights,TradingChartPopup}.tsx` (9 파일)
- **사용자 보고**:
  1. 일별 탭 하단 표 좌우 여백 추가
  2. 종목명 클릭 → 네이버 링크 제거, 토스 (`tossinvest.com/stocks/A{code}/order`)로 변경
- **수정**:
  - 일별 탭 표: `space-y-0` → `space-y-0 mt-2 px-3`, pb-1.5 → pb-2 (장중 탭과 동일)
  - 네이버 URL `https://m.stock.naver.com/domestic/stock/${code}/total` → 토스 `https://www.tossinvest.com/stocks/A${code}/order` (sed 일괄)
  - 변수명 `naverUrl` → `tossUrl` 통일
  - 적용 컴포넌트 8개: StockCard, StockList, PortfolioPage(카드 안), ThemeForecastPage, AIThemeAnalysis, PredictionHistory, PaperTradingStockCard, IntradayInsights
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.42s)

### [UI] 일별 탭 거래량 막대·Y라벨 투명효과 제거 + 거래대금 라인 추가 투명 (2026-05-13 23:46 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+8/-9)
- **사용자 보고 2건**:
  1. 거래량 막대그래프 + 우측 Y라벨 투명효과 제거 (직전 단일 hue 디자인에서 거래량 옅게 처리한 게 남아있음)
  2. 거래대금 라인 투명효과 더 강화 (이전 0.6은 약했음)
- **수정**:
  - 거래량 막대 그라데이션 stopOpacity 0.32→**0.92**, 0.14→**0.5** (정상 강도로 복원)
  - 우측 Y라벨 opacity 0.4 → **0.75** (좌측과 동일 강도)
  - 우측 Y라벨 색상 tvColor → **volColor** (indigo, 막대 색과 매칭)
  - 우측 axisLabel '거래량' opacity 0.5 → **0.9**, fontWeight 500 → **600** (좌측과 동일)
  - 우측 axisLabel 색상 → **volColor** (indigo)
  - 거래대금 라인 strokeWidth 2 → **1.8**, opacity 0.6 → **0.4** (더 투명)
  - 거래대금 점 r 2.5 → **2**, opacity 0.65 → **0.45**
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.13s)

### [UI] 일별 탭 색상 미세조정 — 거래량 indigo + 거래대금 라인 투명효과 (2026-05-13 23:44 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+4/-6)
- **사용자 보고**: (1) 색상 알록달록 → (2) 무지성 무채색 X, 깊게 고민 → (3) 거래량 indigo 복원 + 거래대금 라인 투명
- **최종 색상 정책**:
  - 거래량 막대: `#6366f1` (indigo-500, 하단 표 거래량 컬럼 폰트색과 매칭)
  - 거래대금 라인 strokeWidth 2, **opacity 0.95 → 0.6** (투명효과)
  - 거래대금 점 opacity 0.95 → 0.65
- **이전 시도들 (참고)**:
  - 22:44: 거래량 막대 색을 slate-400로 무채색화 → 무지성 무채색이라 정보 위계 약화
  - 22:46: 단일 hue analogous palette (rose 명도 차) — 알록달록 회피했으나 사용자가 다시 indigo 원함
  - 최종: 거래량 indigo (표와 일관), 거래대금 라인 투명효과로 강조 자제
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.61s)
- **푸시**: `e3b0b614` → origin/main

### [UI] 일별 탭 디자인 — 단일 차트 (거래량 막대 + 거래대금 꺾은선) (2026-05-13 23:37 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+108/-44, legacy IIFE 제거 + 헬퍼 + 일별 차트 재작성)
- **사용자 요청**: 일별 탭 꺾은선 그래프를 장중 탭과 동일 디자인 → 그 후 정정: "누적 필요 X, 단일 차트, 거래량=막대, 거래대금=꺾은선"
- **수정**:
  - **renderMiniBarChart 헬퍼 함수 추출** (장중 탭 막대+누적 디자인 재사용 가능, 컴포넌트 내부 정의)
  - **장중 탭**: legacy IIFE/renderMini 제거 → `renderMiniBarChart(tvVals, ...)` + `renderMiniBarChart(volVals, ...)` 두 번 호출
  - **일별 탭**: 단일 차트 인라인. 거래량 막대(우측 Y축 indigo) + 거래대금 smooth bezier 꺾은선·area fill(좌측 Y축 rose). 가로/세로 그리드, 경계선 동일.
  - **unused 상수 정리**: `CHART_W`, `CHART_H`, `PAD`, `PLOT_W`, `PLOT_H`, `buildLine` 함수 제거 (legacy 일별 SVG 의존)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.76s)

### [UI] '누적' 텍스트 우측 상단 이동 + 수치 제거 (2026-05-13 23:28 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+5/-2)
- **사용자 요청**: '누적' text를 우측 Y축 라벨 위로 이동 + 수치 제거 (그래프에서 직접 확인)
- **수정**:
  - 기존: 좌측 axisLabel에 `"거래대금" + "누적 X.X조"` tspan 병기
  - 변경: 좌측에 `"거래대금"`만, **우측 상단에 `"누적"`만** 별도 text. 수치 제거 (우측 Y라벨로 직접 확인).
  - 우측 누적 라벨: x = W - BPAD.right + 4 (우측 Y라벨과 정렬), y = 14, textAnchor start, color tint, fontWeight 600
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.96s)

### [UI] preserveAspectRatio 제거 (텍스트 stretched 해소) + Y라벨 bold 제거 (2026-05-13 23:26 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+2/-3)
- **사용자 보고**: 텍스트가 위아래 눌린 것처럼 납작해 보임 + Y라벨 bold 제거 요청
- **원인 진단**: SVG에 `preserveAspectRatio="none"` 명시 → viewBox(340×150) 비율 무시하고 부모 폭에 가로 stretch → 폭이 viewBox 비율보다 늘어나 텍스트가 가로로 stretch (= 위아래 눌린 것처럼 보임)
- **수정**:
  - `preserveAspectRatio="none"` **제거** (디폴트 `xMidYMid meet` 사용 → viewBox 비율 유지)
  - `style={{ height: BH + 4 }}` 제거 (className `h-auto`에 맡김)
  - Y라벨 좌·우 모두 `fontWeight={600}` **제거** (디폴트 normal weight)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.35s)

### [UI] 좌·우 Y라벨 폰트 weight·opacity 통일 (2026-05-13 23:21 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+1/-1)
- **사용자 질문**: 좌·우 Y라벨 폰트가 달라 보임
- **답변·진단**: 폰트 자체는 동일 Pretendard (index.css:145). 차이는 fontWeight 600 vs 500 + opacity 0.7 vs 0.55. 두 차이가 결합되어 다른 폰트로 인식됨.
- **수정**: 우측 라벨 fontWeight 500 → 600, opacity 0.55 → 0.7 (좌측과 통일). 색상만 차이로 좌=막대(회색)·우=누적(rose/indigo) 구분.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.52s)

### [기능] 이중 Y축 (막대/누적) + 세로 그리드 (2026-05-13 23:18 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+11/-5)
- **사용자 보고**: 누적 라인 시작점이 막대와 다른 위치로 보임 — 막대(slot max)와 누적(cumMax) 스케일이 달라 발생. 옵션 C(이중 Y축) 채택.
- **수정**:
  - **이중 Y축**:
    - **좌측 (textAnchor end)**: 막대 스케일 (slot max=maxV 기준). 회색.
    - **우측 (textAnchor start)**: 누적 스케일 (cumMax 기준). color tint, opacity 0.55.
    - 두 스케일을 동시에 표시 → 막대·라인 각자 정확한 비율 인지
  - **BPAD.right 10 → 36** (우측 라벨 공간 확보)
  - **세로 그리드 추가**: 정시(":00") X 위치마다 vertical dashed line (가로 그리드와 동일 스타일: opacity 0.16, dasharray "2 3")
  - **우측 경계선 추가**: 좌·우 Y축 vertical line 둘 다
- **좌표 검증**: 좌측 Y라벨↔첫 막대 4px ✅, 우측 Y라벨↔마지막 막대 4px ✅. BPW 272px.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (5.13s)

### [검증/UI] 막대 값 정확도 검증 + Y라벨 가운데 정렬 + 그리드 명확화 (2026-05-13 23:14 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+2/-2)
- **사용자 의심**: 09:30 거래대금 1.6조인데 막대 높이가 "1.1조 라벨 부근"으로 보임 — 코드 버그?
- **검증 결과 (Python 직접 계산)**:
  - 09:30 trading_value = 1,593,070,323,500원 = 1.593조 (표 "1.6조" 일치)
  - maxV = 4.475조 (15:30 슬롯)
  - 비율 = **35.60%** (정확)
  - 막대 top y = 89.8, 1.1조 라벨 y = 100.0
  - **막대 top이 1.1조 라벨보다 10.2px 위** = 1.6조 > 1.1조 자연스러운 결과
  - **코드 정확. 버그 없음**
- **사용자 perception 오인 원인 (시각 디자인 문제)**:
  - Y라벨 텍스트 y=grid_y+3 → 라벨 baseline이 그리드 라인보다 아래
  - 그리드 라인 opacity 0.08 → 너무 옅어 사용자가 텍스트로만 위치 판단
- **수정**:
  - Y라벨: `dominantBaseline="middle"` + y=grid_y (텍스트 가운데가 그리드 라인 정확)
  - 그리드 라인: opacity 0.08 → **0.16**, strokeWidth 0.4 → 0.5 (가독성 ↑)
  - Y라벨 opacity 0.65 → 0.7
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.04s)

### [UI] Y라벨 외부 좌측 정렬 — 막대 겹침 완전 해소 (2026-05-13 23:09 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+5/-5)
- **사용자 보고**: Y라벨 위치·가독성 문제 ("trash 같다") — 첫 막대(09:30) 위에 라벨이 인라인되어 막대 색·그라데이션과 겹쳐 읽히지 않음
- **근본 원인**: Y라벨 textAnchor=start, x=BPAD.left+2 → 라벨이 차트 영역 안쪽 (막대 위)에 그려짐
- **수정**:
  - Y라벨 **textAnchor end** (외부 좌측 정렬), x=BPAD.left-4
  - 그리드 라인 가운데 정렬: y → y+3
  - BPAD.left 14 → **32** (Y라벨 외부 공간 확보)
  - axisLabel x = BPAD.left → **4** (차트 좌측 끝 시작, 라벨 영역 침범 X)
  - fontSize 8.5 → 9, opacity 0.55 → 0.65, fontWeight 500 → 600 (가독성 ↑)
- **좌표 검증**: Y라벨 우측 28, 첫 막대 좌측 32 → **4px 분리 ✅**. 라벨 좌측 6 (잘림 없음 ✅).
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.22s)

### [UI] 표 여백 + 0 라벨 제거 + 막대 높이↑ + Y라벨 4단계 + X·Y축 경계선 (2026-05-13 23:03 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+13/-4)
- **사용자 보고 4건**:
  1. 표 좌/우 여백 추가
  2. 꺾은선 시작점 0 표시 제거
  3. 막대 높이 ↑ + Y라벨 추가
  4. X·Y축 경계선 (가독성 해치지 않는 수준)
- **수정**:
  1. 표 컨테이너에 `px-3` 추가 — 좌우 여백 12px씩 추가
  2. Y라벨 [0, 0.5, 1] → **[0.25, 0.5, 0.75, 1]** (0 제외) — 시작점 0 텍스트 사라짐
  3. **BH 120 → 150** (+30px), Y라벨 3단계 → **4단계** (25/50/75/100%)
  4. **Y축 좌측 vertical line solid** (x=BPAD.left, opacity 0.22)
     **X축 하단 baseline solid** (y=BPAD.top+BPH, opacity 0.22)
     stroke 0.6px — 가독성 안 해치는 부드러운 경계
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.78s)

### [UI] 적정 여백 회복 + smooth bezier 라인 + area fill (2026-05-13 22:56 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+45/-25)
- **사용자 보고 2건**:
  1. 좌우 여백 너무 없앴어 (가장자리 붙음 — 직전 변경의 음수 마진이 과함)
  2. 꺾은선 그래프 디자인 조악·촌스러움 (점선 dashed 별로)
- **여백 회복**:
  - SVG의 `-mx-4 sm:-mx-5` 음수 마진 + `calc(100% + 2rem)` 제거 → 일반 `w-full`
  - viewBox W 360 → **340** (살짝 축소)
  - BPAD.left 8 → **14** + right 8 → 14 (적정 인셋)
- **누적 라인 우아하게 재정비**:
  - **dasharray "3 3" → smooth cubic bezier path** (`M ... C cpX,p0Y cpX,p1Y p1X,p1Y`로 부드러운 S 곡선)
  - solid 1.5px, opacity 0.7
  - **area fill 추가**: 라인 아래 옅은 그라데이션 (top opacity 0.18 → bottom 0). 정보 양감 ↑
  - **마지막 점만 강조** (r=2.5, opacity 0.85) — 끝값 시각 마커
- **막대**: rx 2 → **2.5** (둥근 모서리 더 부드럽게)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.17s)

### [UI] 장중 차트 디자인 우아하게 재정비 — popup padding 외부 확장 (2026-05-13 22:53 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+30/-23)
- **사용자 보고 (4번째 같은 요청 — "좌우 여백 줄임" 진짜 해결 + 우아한 디자인)**:
  - 그래프 디자인 조잡 → 세련·모던하게
  - 좌우 여백 진짜 줄여 (이전 3번 시도에도 화면상 ~12% 여백 유지)
- **근본 진단**: 화면 ~12% 좌측 여백의 정체 = **popup 컨테이너의 `p-4 (sm:p-5)` padding**. SVG 내부 BPAD만 줄여도 popup padding 밖으로 못 나감.
- **근본 수정**:
  - **SVG에 `-mx-4 sm:-mx-5` 음수 마진** + `style.width = "calc(100% + 2rem)"`: popup padding을 외부로 확장. 차트가 sheet 가장자리까지 확장.
  - **viewBox W 310 → 360** (더 넓은 캔버스)
  - **Y라벨을 그리드 라인 위 inline** (textAnchor start, x=BPAD.left+2, y=line_y-3): 좌측 별도 Y라벨 공간 불필요 → **BPAD.left 18→8** (-10px)
- **우아한 디자인 (frontend-design 가이드)**:
  - **막대**: solid fill → **linearGradient** (위 색상 95% → 아래 55%, 부드러운 그라데이션). rx 1→**2** (둥근 모서리 강화). barW 비율 0.7→0.55 슬림.
  - **누적 라인**: solid → **점선 (dasharray "3 3")**. strokeWidth 3→2, opacity 0.25→**0.55**. 점 마커 제거 (라인만).
  - **그리드**: opacity 0.12→**0.08** 미세. 0% 라인만 solid, 나머지 dashed.
  - **타이포**: axisLabel fontSize 10→11 letterSpacing 0.02em. Y라벨 fontWeight 500. X라벨 letterSpacing 0.04em.
  - **간격**: 두 차트 mb-4→**mb-5**.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.82s)

### [버그픽스/UI] 막대-Y라벨 겹침 근본 수정 + 누적 라인 추가 반투명 (2026-05-13 22:47 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+9/-8)
- **사용자 보고 3건**:
  1. 누적 라인 반투명 부족
  2. **그래프-라벨 겹침 미해결** (이전 보강에도 사용자 화면 그대로)
  3. 좌우 여백 추가 축소
- **겹침 근본 진단 (직접 좌표 계산)**:
  - barW=18, BPAD.left=24 → 첫 막대 좌측 = 24-9 = **15**
  - Y라벨(textAnchor end) 우측 = BPAD.left - 2 = **22**
  - 라벨 우측(22)이 막대 좌측(15)보다 **7px 오른쪽** → 라벨이 막대 영역 위에 그려짐 (CSS·padding 보강만으로 해결 불가)
- **근본 수정**:
  - **막대 cx 산정을 `BPAD` 안쪽으로 inset (barW/2)**: 새 헬퍼 `slotX(i) = innerLeft + (i/(n-1)) * innerW`. innerLeft = BPAD.left + barW/2, innerW = BPW - barW. 첫·마지막 슬롯이 절대 BPAD를 침범하지 않음.
  - 누적 라인·점·X라벨도 동일 `slotX` 사용
  - **좌표 검증**: 첫 막대 좌측=18, Y라벨 우측=16 → **2px 분리 ✅**. 마지막 막대 우측=308, W=310 → 2px 여유 ✅
- **추가**:
  - **BPAD.left 24→18** (-6px 좌측 여백 추가 축소)
  - **누적 라인 opacity 0.5→0.25, 점 0.65→0.35** (더 반투명 — 막대 정보 가독성 ↑)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.06s) · 좌표 수학 검증 PASS

### [UI] 누적 라인 두께·간격·여백 종합 보강 (2026-05-13 22:43 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+20/-15)
- **사용자 보고 4건 (재요청 — 이전 부분 적용)**:
  1. **꺾은선 두께 2배 + 반투명**: strokeWidth 1.5→3, 점 마커 r 1.5→2.5, opacity 0.45→0.5 (반투명 유지하며 강조)
  2. **그래프-라벨 겹침**: BPAD.top 16→**30** 대폭 확장 (axisLabel y=12 vs Y max y=33, 21px 분리). BH 96→116 전체 차트 확대.
  3. **컨텐츠 간격 보강**: 두 차트 사이 mb-2→**mb-4**, "30분/1시간" 토글-차트 mb-2→**mb-3**, 표 mt-2 + 헤더 pb-1.5→**pb-2**, 행 py-1→**py-1.5**. axisLabel fontSize 9→10, dx 4→6. x라벨 fontSize 8→9.
  4. **좌우 여백 추가 축소**: BPAD.left 32→**24**, right 4→**2** (이전 32/4 → 24/2). BPW 274→**290** (+16px 그래프 영역). barW max 16→18.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (5.17s)

### [UI] 누적 라인 오버레이 + 라벨 겹침 재수정 + X축 균등 + 여백 축소 (2026-05-13 22:29 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx` (+30/-15)
- **사용자 보고 4건 수정**:
  1. **누적치 표시**: 막대 위에 반투명 꺾은선(opacity 0.45) + 점 마커(opacity 0.7) 오버레이. 별도 스케일(누적 max 기준 정규화)로 항상 우상향. 누적 총합은 axisLabel에 작은 글씨로 병기 ("거래대금  누적 X.X조")
  2. **Y축 라벨 겹침**: `axisLabel` 위치를 차트 좌측 외부(x=2, y=10)로 분리. Y max 라벨(x=BPAD.left-3, textAnchor end)과 x·y 모두 겹치지 않음
  3. **X축 간격 불일정**: 기존 `i === 0 || i === n - 1 || ":00"` → **`:00`만**으로 변경. 첫(09:30)·마지막(15:30) 강제 표시 제거 → 라벨 균등 간격 (10:00, 11:00, 12:00, 13:00, 14:00, 15:00 6개)
  4. **좌우 여백 축소**: `BPAD.left 40→32`, `BPAD.right 8→4`. 그래프 영역 +12px 확보. barW max 14→16, 비율 0.65→0.7
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.32s)

### [버그픽스/UI] 15:30 trading_value 비정상 폴백 + 라벨 겹침 + 표 정렬 (2026-05-13 22:23 KST)
- **변경 파일**: `modules/intraday_history.py` (+2/-1), `frontend/src/components/TradingChartPopup.tsx` (+4/-4), `frontend/public/data/intraday-history.json` (304 슬롯 후처리)
- **사용자 보고**:
  1. 차트에 15:30 슬롯 거래대금이 64조로 비정상적으로 큼 (SK하이닉스 정상 일 거래대금의 14배)
  2. 시간/Y축 라벨이 차트와 겹침
  3. 표 정렬을 반대로 (09:30 → 15:30)
- **15:30 trading_value 진단**: ratio(trading_value / (close × volume))이 정상 슬롯 0.95~0.99인데 15:30만 14.33. **acml_tr_pbmn이 동시호가/시간외 시간대에 노이즈** (이전에 high/low도 같은 문제로 close 폴백 처리한 슬롯).
- **수정**:
  - **백엔드**: `intraday_history.py`의 15:30 보정 코드에 `trading_value = close × volume` 폴백 추가 (H/L과 동일 패턴)
  - **데이터 즉시 후처리**: 모든 종목의 15:30 슬롯 trading_value 점검 → close×volume의 5배 초과 시 폴백. 30m 152건 + 60m 152건 = 304 슬롯 보정.
  - **UI 라벨 겹침**: BH 80→96, BPAD top 14→18 / bottom 18→26 / left 36→40. x축 라벨 y 위치 BH-4→BH-6. 축 라벨 y 9→11.
  - **표 정렬**: `[...intradaySlots].reverse()` 제거 → 09:30이 맨 위 (PriceHistoryPopup 일관)
- **검증**: 000660 15:30 trading_value 64.1조 → 4.47조 (정상). tsc PASS, vite build PASS (3.63s)
- **누적 vs 슬롯별 명확화 (사용자 오해)**: 본 구현은 **각 30분 슬롯별 거래대금/거래량** (누적 X). 시간대별로 커졌다 작아지는 것은 정상 — 시간대별 거래 강도 변화 추이를 보여주는 게 목적. brainstorming에서 옵션 B(슬롯별)로 결정됨.

### [버그픽스/개선] KIS rate limit 회피 + 100% 수집 성공 + 운영 견고성 (2026-05-13 22:13 KST)
- **변경 파일**: `modules/kis_client.py` (+19/-1), `modules/volume_profile.py` (+13/-3), `collect_intraday_history.py` (+1/-1)
- **배경**: collect_intraday_history.py 로컬 실행 시 KIS "초당 거래건수 초과" 에러로 26/157 → 29/157만 성공. trading_value 신규 필드 검증 못함. 운영 cron은 캐시 활용 + 분산 호출로 평소 안 터지나, 본질적 견고성 부족.
- **진단**:
  - KIS rate limit은 `HTTPError exception` 경로 (`kis_client.py:476` `raise Exception(f"API 요청 실패: ...")`)로 throw. `fetch_minute_candles`의 rt_cd 분기 재시도는 안 들어옴.
  - ThreadPoolExecutor 10 worker × `_rate_lock` 외부에서 request 실행 → 동시 burst 가능 (lock은 카운터만 직렬화).
- **패치**:
  - **`kis_client.py:request()`에 rate limit 검출 + 3회 재시도** (백오프 1~5.5초 + jitter, rate limit 외 에러는 즉시 전파). 모든 collect 스크립트·KIS 호출자 자동 혜택.
  - **`volume_profile.py:fetch_minute_candles` rt_cd 분기 재시도 추가** (rt_cd != "0" + msg "초당" 검출 시 1~2초 재시도). exception 경로와 별도 백업.
  - **페이지 sleep 50ms → 100ms** (한도 여유)
  - **`collect_intraday_history.py` max_workers 10 → 4** (동시성 감소로 burst 방지)
- **재실행 결과**: **157/157 종목 100% 성공** (208.8초). trading_value 필드 정상 채워짐 (조 단위 정확값).
- **운영 영향**: 평소 cron은 캐시 활용으로 fetch 수 적음 → 재시도 거의 발동 안 함 → 무영향. burst 발생 시(예: 캐시 미스, KIS hiccup) 자동 회복. 수집 시간 60s → ~200s지만 30분 cron이라 무리 없음.

### [기능] 거래량 그래프 장중 탭 추가 + 정확한 거래대금 데이터 수집 (2026-05-13 21:33 KST)
- **변경 파일**: `modules/volume_profile.py` (+1), `modules/intraday_history.py` (+10), `frontend/src/types/stock.ts` (+1), `frontend/src/components/TradingChartPopup.tsx` (+232/-78), `frontend/src/components/StockCard.tsx` (+1), spec 문서
- **배경**: 사용자 요청 — InvestorChartPopup(수급)처럼 TradingChartPopup(거래량/거래대금)에도 장중 탭 추가하여 장중 시간대별 변화 추이 확인
- **브레인스토밍 결정**: 옵션 B (슬롯별 막대) + 거래대금·거래량 둘 다 + 30m/1h 토글 + 일자 오늘만. 거래대금은 사용자 결정으로 **근사값 대신 정확값 수집**
- **백엔드 변경 (정확한 거래대금 수집)**:
  - `fetch_minute_candles`: 분봉 응답에 `acml_tr_pbmn`(누적 거래대금) 추가
  - `aggregate_minute_candles`: 시간순 정렬 후 acml 차분으로 분봉별 trading_value 산정 → 30m/60m 그룹 sum → `IntradayInterval.trading_value` 필드 신규
  - 첫 분봉은 acml 자체가 거래대금 (09:00 시작점)
- **프론트엔드 변경**:
  - `IntradayInterval` TypeScript 타입에 `trading_value: number` 추가
  - `TradingChartPopup`: 일별/장중 탭 분기. 장중 탭은 30m/60m 토글, 거래대금·거래량 vertical mini bar chart × 2 (mini chart stack 패턴, 이중 Y축 회피). 현재 시각 이후 슬롯 자동 필터. 0거래량 슬롯 막대 미표시.
  - 기본 탭: 장중 시간대(09:00~15:30 KST)에는 intraday, 그 외 daily
  - 장중 데이터 없으면 탭 비활성 ("(수집 전)" 표시, PriceHistoryPopup 패턴)
  - `StockCard`: `intradayDays` prop 전달
- **데이터 갱신**: 다음 `collect-intraday-history.yml` 워크플로 실행 시 자동 적용. 또는 즉시 로컬 `python collect_intraday_history.py` 실행.
- **검증**: Python AST PASS · `npx tsc --noEmit` PASS · `npm run build` PASS (4.11s)

---

## 2026-05-11

### [진단/개선] kis-proxy 500 오류 진단 + callKisProxy 에러 메시지 노출 패치 (2026-05-11 14:37 KST)
- **변경 파일**: `frontend/src/lib/kis-api.ts` (+15/-2)
- **증상**: 포트폴리오 refresh 버튼 클릭 시 "Edge Function returned a non-2xx status code" 오류
- **진단 과정**:
  1. Supabase logs 확인 — booted/shutdown만 표시, 에러 메시지 안 보임
  2. anon key 확보(`supabase projects api-keys`) 후 curl로 edge function 직접 invoke
  3. 응답: `{"error":"KIS app_key or app_secret missing"}` HTTP 500 — `index.ts:42` throw 확정
  4. `api_credentials` 테이블의 KIS row 점검: access_token만 존재, app_key/app_secret 누락
- **근본 원인**: 사용자가 다른 프로젝트에서 자격증명 키 정리 작업 중 본 프로젝트의 app_key/app_secret까지 실수로 삭제
- **복구**: 사용자가 직접 Supabase에 자격증명 재등록. 다중 종목 invoke로 검증 — 005930/000660/035720 모두 정상 응답 (failed=0)
- **노출되지 않은 이유**: Supabase JS SDK가 non-2xx 응답의 표준 메시지(`"Edge Function returned a non-2xx status code"`)만 노출, 실제 body의 `{ error: "..." }` 버림
- **패치 (재발 방지)**: `callKisProxy`가 `FunctionsHttpError.context.json()`로 응답 body의 `error` 필드 추출. 향후 같은 종류 장애 발생 시 frontend에서 정확한 메시지 즉시 노출.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.69s)
- **푸시**: `28ba0cb` → `cf24c0a..28ba0cb` rebase 후 origin/main 동기화 완료. GitHub Pages 자동 재배포 트리거됨.

## 2026-05-08

### [버그픽스/보안] portfolio_holdings RLS 미적용 보안 취약점 패치 (2026-05-08 14:46 KST)
- **변경 파일**: `docs/sql/portfolio_holdings_rls.sql` (신규)
- **배경**: 사용자 요청 — "포트폴리오 기능 및 내역이 로그인한 계정에 귀속되어 표시·관리되는 구조인지 진단"
- **진단 결과**:
  - **인증·frontend 가드**: 정상 (`useAuth` + 1시간 비활성 자동 로그아웃 + ExpireStorage 8시간 만료)
  - `PortfolioPage` 모든 INSERT는 `user_id: user.id` 명시 ✅
  - `fetchHoldingsFromDB(user.id)`로 `.eq("user_id", userId)` 명시 ✅
  - 그러나 `saveEdit/deleteHolding`은 `.eq("id", id)`만 사용 — RLS에 100% 의존
  - `portfolio_transactions`: RLS 정상 (select/insert/delete `auth.uid() = user_id`)
  - **`portfolio_holdings`: RLS 비활성 상태 발견** ⚠️ — 다른 사용자가 holding.id를 알면 직접 API 호출로 update/delete 가능한 취약점
- **조치**: 사용자가 Supabase SQL Editor에서 직접 실행 — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + 4개 정책(select/insert/update/delete, `auth.uid() = user_id`). "Success. No rows returned" 확인.
- **재현성 보존**: `docs/sql/portfolio_holdings_rls.sql` 신규 작성. 향후 다른 환경 적용 또는 감사 추적용.
- **결론**: 사용자 격리 4개 레이어(인증·frontend·portfolio_transactions·portfolio_holdings) 모두 정상화.

### [진단] 매수 이력 누적 동작 확인 (2026-05-08 14:38 KST)
- **질의**: 사용자 — "물타기 이력도 누적되는거 맞아?"
- **검증 결과**: 누적 정상 동작
  - DB: `portfolio_transactions`는 INSERT only (UPDATE 정책 없음, 불변 audit log). 같은 holding에 N번 반영 시 N행 누적. 삭제는 holding cascade만.
  - 코드: `applyTransactions`가 매번 새 rows insert + holdings 누적 합산 (`holding.avgPrice * holding.quantity + addCost`). 기존 행 삭제 X.
  - State: `setTransactionsByHolding(prev => ...[...newTxRecords, ...(prev[holdingId] ?? [])]...)` — 신규 prepend, 기존 보존.
  - Fetch: `.eq("holding_id", holdingId).order("executed_at", { ascending: false })` — holding의 모든 매수 이력 시간 역순.
- 코드 변경 없음 (분석 답변만). check-task-history hook이 세션 누적 변경을 감지하여 기록 요청 → 본 항목으로 추가.

### [개선] iOS Safari/PWA input focus 시 자동 zoom 방지 — 모바일 16px 적용 (2026-05-08 13:32 KST)
- **변경 파일**: `frontend/src/components/AveragingDownCalc.tsx` (numInput 변수), `frontend/src/components/AveragingDownSheet.tsx` (numInput 변수), `frontend/src/components/PaperTradingPage.tsx` (select)
- **배경**: iOS Safari/PWA가 font-size 16px 미만 input/textarea/select에 focus 시 자동 zoom-in. 사용자 화면 확대 현상 발생.
- **전수 조사** (24개 input/textarea/select 위치):
  - 이미 모바일 16px 적용된 곳 (조치 불필요): `App.tsx` 검색 input(`text-base sm:text-sm`), `PortfolioPage.tsx` 검색 + 4개 numeric input(`text-base`), `ui/input.tsx` shadcn 컴포넌트
  - type="range" (zoom 영향 없음): `TakeProfitSlider.tsx` 2곳
  - **조치 필요**: `numInput` 공유 변수(`text-sm` 14px) 사용 14곳 + `PaperTradingPage.tsx` select(`text-[10px] sm:text-xs`) 1곳
- **변경 내용**:
  - `numInput` 공유 변수 2곳: `text-sm` → `text-base sm:text-sm` (모바일 16px, 데스크탑 14px). 한 변수 변경으로 14곳 일괄 적용.
  - `PaperTradingPage.tsx` select: `text-[10px] sm:text-xs` → `text-base sm:text-xs` (모바일 16px, 데스크탑 12px)
- **패턴**: shadcn/ui `input.tsx`의 `text-base sm:text-sm` 정합. sm breakpoint(640px) 이상에선 기존 디자인 유지.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.87s)

## 2026-05-07

### [기능] PortfolioPage 카드 확장 영역 매수 이력 섹션 UI 추가 (2026-05-07 22:20 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (+32/-1)
- **내용**: lucide-react import에 `History` 추가. AI 분석 신호 DetailRow 직후에 매수 이력 DetailRow 삽입. `transactionsByHolding[h.id]`가 undefined이면 "불러오는 중...", 빈 배열이면 "추가 매수 이력 없음", 레코드 있으면 날짜(2자리)+가격×수량+note 리스트 표시. fetch 트리거는 d3e1db7에서 expand onClick에 연결됨.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.52s, PortfolioPage 56.44 kB)

### [기능] AveragingDownSheet 종목별 반영 버튼 + onApply prop (2026-05-07 22:15 KST)
- **변경 파일**: `frontend/src/components/AveragingDownSheet.tsx` (+38/-0)
- **내용**: import에 NewTransaction 추가. StockEntry에 id 필드 추가(spread로 자동 채워짐). AveragingDownSheetProps에 onApply?(holdingId, txs) 추가. basic/multi 모드 결과에 종목별 반영 버튼 삽입. 시트 단위 일괄 버튼은 YAGNI로 제외.
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.93s, 1688 modules)

### [기능] AveragingDownCalc basic/multi 반영 버튼 + onApply 정상화 (2026-05-07 22:11 KST)
- **변경 파일**: `frontend/src/components/AveragingDownCalc.tsx` (+39/-1)
- **내용**: `_onApply` → `onApply` 정상화. basic 결과 카드 마지막에 "포트폴리오에 반영" 버튼 추가 (note: "basic"). multi 결과 테이블 마지막에 "전체 단계 반영 (N건)" 버튼 추가 (note: "multi step N/M"). target 모드는 반영 버튼 없음 (역산 시뮬 도구 유지).
- **커밋**: `6048e63`
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.80s, 1688 modules)

### [버그픽스] fetch error 시 캐시 미생성으로 재시도 가능하게 (2026-05-07 22:09 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (+3/-3)
- **내용**: code-reviewer 0de9fb7 ❌ REQUEST_CHANGES 대응. `fetchTransactionsForHolding` error 분기에서 `setTransactionsByHolding` 호출 제거 → error 시 캐시 미생성, 다음 expand 시 재fetch 가능. 정상 응답 시 `data ?? []`로 안전 캐시.
- **커밋**: `d3e1db7`
- **검증**: `npx tsc --noEmit` PASS

### [버그픽스] stale closure 수정 + fetchTransactionsForHolding 추가 (2026-05-07 22:07 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx` (+34/-3)
- **내용**: code-reviewer 1cf1a79 ❌ REQUEST_CHANGES 대응. applyTransactions setter 내 `transactionsByHolding[holdingId]` → `prev[holdingId]` 수정(stale closure 방지), useCallback deps에서 `transactionsByHolding` 제거. fetchTransactionsForHolding callback 추가(lazy fetch + 캐시), 카드 expand onClick에 fetch 호출 연결.
- **커밋**: `0de9fb7`
- **검증**: `npx tsc --noEmit` PASS

### [기능] applyTransactions callback + 인라인 calc onApply 연결 (2026-05-07 22:03 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`, `frontend/src/components/AveragingDownCalc.tsx`
- **내용**: Task 3(applyTransactions 정의) + Task 5 Step 1(인라인 AveragingDownCalc에 onApply prop 연결) 한 커밋에 묶음. `noUnusedLocals: true` 제약으로 fetchTransactionsForHolding(미리 작성된 미사용 함수) 삭제. transactionsByHolding을 applyTransactions 내부에서 직접 참조하도록 수정(tsc 통과용).

## 2026-05-06

### [버그픽스] 기존 JSON 데이터 즉시 후처리 — 15:30 H/L 보정 (2026-05-06 23:09 KST)
- **변경 파일**: `frontend/public/data/intraday-history.json`
- **배경**: 직전 23:06 코드 수정은 다음 워크플로 실행 시점부터 적용. 현재 JSON엔 비정상 데이터 그대로 → 사용자 화면에서 여전히 -0.43% 노출
- **즉시 후처리**: 모든 종목의 모든 entry에서 마지막 슬롯(15:30)의 high/low를 close로 통일
- **결과**: 30m 슬롯 4,717건 + 60m 슬롯 4,717건 = **총 9,434 슬롯 수정**
- **검증**: 005930 2026-05-06 15:30 → H=L=close=266,000 (high===low 분기로 H/L 보조줄 자동 숨김)
- **참고**: 다음 워크플로 실행 시 modules/intraday_history.py 코드가 적용되어 영구적으로 정상 데이터 생성됨

### [버그픽스] 15:30 동시호가 슬롯의 비정상 H/L — close로 통일 (2026-05-06 23:06 KST)
- **변경 파일**: `modules/intraday_history.py` (+12)
- **배경**: 사용자 지적 — 삼성전자 15:30 슬롯에 L=231,500(-0.43%) 표시. 종가 +14.41%인데 같은 30분에 -0.43%까지? 명백한 오류
- **진단 (95종목 전수 분석)**:
  - 15:30 슬롯에서 L이 직전 슬롯 대비 5%p+ 갑자기 떨어진 종목: **31/95 (33%)**
  - 공통점: 모두 close가 +14% ~ +30% (상한가 다수), 15:30 L이 전일종가 근처(-0.5% ~ +0.0%)
  - 다른 슬롯(09:30~15:00)은 정상 — 15:30 단독 문제
- **근본 원인**: 한국 증시 15:20~15:30 마감 단일가매매(동시호가) 시간대에 KIS `inquire-time-itemchartprice`(FHKST03010200) 응답의 `stck_lwpr` 필드가 호가창 노이즈 포함(특히 매도 호가 형성 부족한 상한가 종목에서 전일종가 근처 호가가 stck_lwpr로 누적). high·close·volume은 정상.
- **해결**: `collect_stock_intraday`/`collect_stock_intraday_from_cache` 두 함수의 15:30 close 보정 코드 직후에 `high = low = close_price` 통일. 표에서 `high===low` 분기로 H/L 보조줄 자동 숨김.
- **trade-off**: 15:30 슬롯의 진짜 변동 폭 정보 손실 — 그러나 동시호가 단일가매매라 변동 개념이 본래 모호함. 정직한 정보 손실 < 잘못된 정보.
- **검증**: Python AST PASS · 두 함수 모두 수정 확인 (grep count=2)

### [진단/결론] 005930 09:30~11:00 H=261,500 동일 패턴 (2026-05-06 23:06 KST)
- **사용자 의문**: 4개 연속 슬롯 정확히 같은 H 값
- **검증 (5종목 sampling)**: highs 단조 증가 위반 카운트
  - 005930: 위반 2건 (단조 증가에 가까움 — 우연)
  - 047040: 위반 6건 / 000660: 3건 / 373220: 3건 (분봉별 high 정상)
- **결론**: KIS `stck_hgpr`는 분봉별 고가가 맞음 — 누적 일중 최고가 가설 각하. 005930의 4슬롯 동일 H=261,500은 **우연**(또는 그 가격대에 매수 호가가 머물러 매 슬롯의 일부 분봉이 그 가격까지 도달). 코드/데이터 오류 아님.
- **잔여 가능성**: 1분봉 raw 직접 검증으로 확정 가능하나, 시간 지난 분봉 raw 재fetch 어려움(KIS API 당일 한정). 향후 비슷한 패턴 보이면 그날 raw 검증 필요.

### [개선] 장중 차트 Y축 close 변동만으로 산정 — 차트 압축 근본 수정 (2026-05-06 22:59 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx` (+27/-9)
- **배경**: 직전 22:52 변경(자연 비대칭 스케일)이 의도한 만큼 효과 없었음. 사용자 피드백 — "그래프 직관성 개선 안됐는데?". 삼성전자 close +10.75%~+15.38%인데 close 변동이 차트 21%만 차지
- **근본 원인**: `Math.min(...closes, basePrice)`로 basePrice를 강제 포함 → 모두 양수 변동이면 closeMin=basePrice가 되어 Y축이 0%까지 늘어남 → close 변동이 차트 상단 1/5에 압축
- **변경**:
  - **closeMin/Max 산정에서 basePrice 제거**: `Math.min(...closes)`만 사용. close 변동만으로 Y축 결정 → 변동이 차트 ~70% 영역에 펼쳐짐
  - **basePrice 처리 분기**: `baseInChart` 헬퍼로 차트 안/밖 판정
    - 안: 기존처럼 dashed line + 좌측 "0%" + 우측 가격 라벨
    - 밖: 차트 가장자리(상단 또는 하단)에 작은 인디케이터 — `↓ 전일종가 0% (232,500원)` 또는 `↑ ...` 화살표 + 정확한 가격
  - **tooCloseToZero**: `baseInChart`일 때만 적용 (차트 밖이면 0% line 없으니 충돌 없음)
  - **effectiveSpread 최소값**: `basePrice * 0.01` → `0.005` 완화 (너무 큰 padding 방지)
- **시뮬레이션 검증**: 삼성전자 close 변동 영역 21% → **71.4%** (3.4배 개선)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.37s, 1688 modules)

### [버그픽스+개선] stock-history.json 갱신 누락 수정 + 장중 차트 자연 비대칭 스케일 (2026-05-06 22:52 KST)
- **변경 파일**: `collect_investor_data.py` (+10), `frontend/src/components/PriceHistoryPopup.tsx` (+48/-29)
- **버그픽스 1: 보성파워텍 등 9개 종목 "거래 이력 부족" 표시 근본 원인**
  - 진단: `stock-history.json` 006910 changes=0 vs `latest.json/history.006910` changes=60 — 두 파일 분기. 같은 패턴 9개 종목(203650, 079190, 053080, 300120, 475430, 036540, 006340, 006910, 064260) 모두 신규 랭킹 진입 종목
  - 원인: `data_exporter.py:221`에서 `data.pop("history")`로 history를 latest에서 빼서 stock-history.json에 분리 저장. 그러나 `collect_investor_data.py`가 신규 종목 history를 fetch한 후 latest.json에만 저장하고 stock-history.json은 갱신 안 함 → 분리 정책 위배
  - 수정: `collect_investor_data.py:746` 직전에 `latest.pop("history")` + `stock-history.json` 별도 저장 추가 (data_exporter와 동일 정책)
  - 상수 추가: `STOCK_HISTORY_PATH` (라인 30)
- **개선 2: 장중 차트 직관성 — 0% anchor 대칭 → 자연 비대칭 스케일**
  - 진단: 0% anchor 대칭이 close가 한쪽으로 치우친 날(예: 삼성전자 +10.75%~+15.38% 모두 양수)에 차트 절반을 비우고 close 변동을 1/6 영역에 압축 → "+10과 +14 차이가 직관적으로 안 보임"
  - 변경:
    - Y축 산정: `closeMin/closeMax + padding(effectiveSpread*0.2)`. 0% basePrice는 항상 차트 안 (closeMin/Max 산정 시 basePrice 포함하므로 보장)
    - 변동 작은 날도 적정 펼침: `effectiveSpread = max(closeSpread, basePrice*0.01)` (최소 1% 보장)
    - yTicks: 0% anchor 균등 분할 → **자연 균등 5단계 분할**
    - 0% line: yTicks와 별개로 dashed line + 라벨로 강조 (가운데 아닐 수 있음)
    - 충돌 방지: `tooCloseToZero` 헬퍼로 0% line과 1단계 폭 35% 미만 가까운 yTick 라벨 숨김
- **검증**: Python AST PASS · `npx tsc --noEmit` PASS · `npm run build` PASS (3.76s, 1688 modules)
- **참고**: 워크플로 변경 없음 — `collect-investor-data.yml`이 14:38·15:53·18:09 KST 등에 collect_investor_data.py 실행 시 자동으로 stock-history.json도 동기화됨

### [개선] 장중 표 H/L 보조줄에 등락률 병기 + 두 줄 분리 (2026-05-06 22:48 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx` (+22/-5)
- **배경**: 사용자 요청 — H/L 가격만으로는 변동 의미 직관 부족. 등락률 함께 표시
- **디자인 결정**:
  - 한 줄 인라인 (`H 32,000 +0.47% · L 29,450 -8.39%`) 검토 → 모바일 폭 ~180px에서 줄바꿈 위험
  - **두 줄 분리** 채택 (H 줄 / L 줄 각각). 셀 높이 +1줄 늘지만 모든 슬롯이 일관된 높이
- **변경 내용**:
  - close 가격 아래 H 줄, L 줄 각각 분리 — leading-tight + mt-0.5
  - **시각 위계**: H/L 라벨(10px font-semibold rose/blue 80%) > 가격(10px muted/80) > 등락률(9px)
  - **등락률 색상**: 양수 rose-500/70, 음수 blue-500/70, 0 muted-foreground/60 (한국 증시 색상 관습 정확 적용)
  - basePrice는 selectedDay.prev_close 또는 fallback selectedDay.open
  - basePrice가 0인 edge case도 안전하게 처리 (`base ? ... : 0`)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.96s, 1688 modules)
- **미커밋** — 보성파워텍 진단·그래프 직관성 개선 등 후속 작업 묶을 예정

### [리팩토링] 장중 차트에서 wick 제거 — close 흐름 가독성 우선 (2026-05-06 22:30 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx` (+12/-89)
- **배경**: 직전 P0 클리핑 시도(commit fca4c65) 후 사용자 피드백 — "오히려 가독성 떨어짐". 근본 진단: 한국 30분봉의 high/low가 시가 직후 spike로 close보다 4~5배 넓어, **차트에 wick 자체가 부적합**. Y축 좁게(클리핑) → 마커 노이즈 폭증 / 넓게 → close 평탄
- **결정**: 사용자 옵션 A 선택 — 차트는 close 흐름만, 변동폭 정보는 표 H/L 보조 텍스트로
- **변경 내용**:
  - **wick 완전 제거**: SVG line·▲/▼ 화살표·% 라벨·outlier 클리핑 로직 모두 삭제
  - **미사용 변수 정리**: `highs`, `lows`, `yClampTop`, `yClampBot`, `yOfClipped`, `isClippedHigh`, `isClippedLow`, `fmtPct`
  - **범례 제거**: H~L 항목과 종가 항목 모두 제거 (차트가 단순해져 범례 불필요), 시가/전일종가만 헤더에 유지
  - **유지**: close 기반 0% anchor 대칭 Y축 + yTicks 0% anchor 균등 분할 + 0% 라인 강조 (P0/P1 효과 중 wick 무관 부분)
  - **유지**: 표의 H/L 보조 텍스트 (정확한 변동 폭 정보의 주역)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (4.03s, 1688 modules)
- **교훈**: 첫 시도에서 "데이터 보존 = 시각화 보강"으로 잘못 등치. 30분봉의 high/low는 차트보다 표가 적합한 정보. Simplicity First 원칙 재확인

### [개선] 장중 차트 UX 폴리시 — outlier 클리핑·0% anchor·범례·H/L 가독성 (2026-05-06 22:23 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx` (+95/-32)
- **배경**: 직전 변경(high/low wick) 후 frontend-design 검토 결과 P0/P1/P2 이슈 발견
  - P0: 09:30 spike(-8.39%) 한 봉이 Y축을 -8.4%까지 끌어내려 close 라인이 0% 부근에 압축됨 → 일반 흐름 시각화 불가
  - P1: Y축 라벨이 4단계 균등 + 0% dashed 별도라 5번째 라벨처럼 보이는 시각 노이즈 / wick 가시성 부족
  - P2: 범례 부재로 wick 의미 학습 비용 / H/L 텍스트 9px·/70 가독성 / 강조 박스 농도
- **변경 내용**:
  - **P0 outlier 클리핑**: Y축을 close 기반 0% anchor 대칭(`±max(closeMax-base, base-closeMin) + padding`)으로 산정. high/low가 Y축 밖이면 차트 상·하단으로 클리핑 + 위쪽 ▲/아래쪽 ▼ 화살표 + 정확한 % 라벨(예: `-8.39%`) 표시. 데이터 정직성 보존하면서 일반 흐름 가시성 회복
  - **P1 Y축**: yTicks 5단계를 0% anchor 균등 분할(위 2 + 0 + 아래 2)로 변경. 0% 라인은 yTicks 내 isZero 분기로 dashed 처리(별도 라인 제거). zeroY 미사용 변수 정리
  - **P1 wick**: stroke-width 1→1.2, opacity 0.35→0.4, min 2px 길이 클램프(미세 변동 슬롯도 가시화)
  - **P2 범례**: 시가/전일종가 줄 우측에 SVG 미니 라인 + "종가 / H~L" 표기 추가
  - **P2 표 H/L**: 9px→10px, opacity /70→/80, font-semibold + mt-0.5 추가
  - **P2 강조 박스**: bg-muted/40 → bg-muted/30 (옅게)
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.72s, 1688 modules)

### [개선] 장중 30분봉 차트·표에 high/low 변동폭 시각화 (2026-05-06 22:13 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx` (+29/-6)
- **배경**: 사용자가 대우건설(047040) 2026-05-06 장중 차트에서 ① 13:00·14:30 데이터 누락 의심 ② 09:00~09:30 사이 큰 변동(저점 -8.39%)이 30분봉 close 라인에서 보이지 않는다고 지적
- **진단 결과**:
  1. 13:00·14:30은 **수집 정상** — close가 우연히 전일종가(32,150)와 동일해 0.00%로 보였을 뿐 (high·volume 모두 정상)
  2. 09:30 슬롯에 `high=32,000`, `low=29,450`(-8.39%)이 이미 저장되어 있음. `aggregate_minute_candles`가 1분봉 그룹의 max(high)/min(low)를 보존. 차트가 close polyline만 그려서 변동성 손실
- **변경 내용**:
  - **차트(SVG)**: Y축 스케일에 `highs`, `lows` 포함하도록 `allVals` 확장. 각 슬롯 포인트에 close 색상의 high-low 수직선(wick, opacity 0.35) 추가. `yOf()` 헬퍼 추출. `high===low`인 보합 슬롯은 wick 생략
  - **표(테이블)**: 현재가 셀에 close 메인 + 그 아래 `H 32,000 · L 29,450` 보조 텍스트(9px, leading-tight). H는 rose-500/70, L은 blue-500/70 (한국 증시 색상 관습). `high===low`면 보조 줄 자체 숨김
- **검증**: `npx tsc --noEmit` PASS · `npm run build` PASS (3.82s, 1688 modules)
- **데이터/백엔드 변경 없음** — 기존 JSON 구조와 `IntradayInterval` 타입 그대로 활용

## 2026-05-03

### [개선] 하네스 점검 후 4건 보강 — ruff 설치 + context7 MCP + agent model 정확명 + requirements-dev (2026-05-03 14:48 KST)
- **변경 파일**: `.mcp.json`(context7 추가, gitignored), `.claude/agents/{python-backend-impl,code-reviewer,frontend-impl,spec-reviewer,workflow-ops}.md`(model: sonnet → claude-sonnet-4-6), `requirements-dev.txt`(신규: ruff·pytest·pytest-asyncio·freezegun)
- **점검 결과**: 정적 100% PASS, block-destructive 14/14 동적 PASS, brief·check-task-history 정상. **실효성 이슈 2건 발견**:
  1. ruff 미설치 → ruff-after-edit hook silent skip (lint 0% 작동)
  2. context7 MCP 누락 → 라이브러리 문서 조회 불가
- **보강**:
  - `~/.pyenv/versions/3.11.10/bin/pip install ruff==0.7.0` 설치 → hook이 `kis_client.py`에서 F541 2건 즉시 노출 확인 (실효성 회복)
  - `.mcp.json`에 context7 항목 추가 (kis-code-assistant 유지)
  - 신규 5개 agent의 model 단축명 → 정확명(`claude-sonnet-4-6`) 변경. 기존 2개(doc-sync, test-runner-analyzer)는 surgical changes 원칙 유지
  - `requirements-dev.txt` 신규 생성 (개발 의존성 명시화, 다른 환경 재현 가능)
- **검증**: ruff 호출·차단 회귀 14/14 PASS, .mcp.json JSON 유효, agent model 표기 일관

## 2026-04-29

### [설정] theme_analysis 하네스 보강 — 5 agent + 4 hook + 3 skill + 1 command + 도메인 메모리 3 (2026-04-29 17:52 KST)
- **변경 파일**: `.gitignore`, `.claude/settings.json`(신규), `.claude/hooks/{block-destructive,ruff-after-edit,tsc-after-edit,session-start-brief}.sh`(신규 4), `.claude/agents/{python-backend-impl,frontend-impl,workflow-ops,spec-reviewer,code-reviewer}.md`(신규 5), `.claude/skills/{deploy-pages,refresh-stock-master,run-collector-locally}/SKILL.md`(신규 3), `.claude/commands/pr-checklist.md`(신규), `~/.claude/projects/.../memory/{kis_api_quirks,workflow_dependencies,gemini_integration,MEMORY}.md`(자동메모리 3 신규 + 인덱스 갱신)
- **내용**:
  - **gitignore 정책 변경**: `.claude/` 전체 ignore → `settings.local.json` + `agent-memory/` + `CLAUDE.local.md` 만 ignore. agents/hooks/skills/commands/settings.json 은 git 포함 (`*.md` 룰 우회 위해 `!.claude/agents/**/*.md` 등 negative pattern 추가)
  - **P0 위험 차단**: settings.json 신설(deny 룰 — `gh workflow disable/delete`, `gh secret delete`, `git push --force`, `rm -rf`, `Read(.env)` 등) + block-destructive.sh PreToolUse 훅으로 13개 cron · prod secret · git 이력 보호 (6/6 테스트 통과)
  - **P1 효율**: ruff/tsc PostToolUse 훅(async lint), session-start-brief SessionStart 훅(HEAD·status·task_history 5건·workflows 13개), 특화 agent 3개(python-backend-impl/frontend-impl/workflow-ops) — 도메인 지식(KIS tr_id, acml_vol 폴백, 한국 증시 색상, concurrency `pages` 그룹 이슈) 내장
  - **P2 구조화**: spec-reviewer + code-reviewer agent (2-stage review), Skills 3종(deploy-pages·refresh-stock-master·run-collector-locally), 자동 메모리 도메인 토픽 3종(kis_api_quirks·workflow_dependencies·gemini_integration)
  - **참고**: theme_lab 하네스 패턴 적용. MCP 서버는 글로벌 `~/.claude.json`에 이미 등록되어 있어 `.mcp.json` 추가 불필요
- **검증**:
  - block-destructive 6/6 테스트 (rm -rf, gh workflow disable, gh secret delete, 정상 명령 통과, gh workflow run 통과, SERVICE_KEY notice)
  - settings.json JSON 유효
  - 5 hook chmod +x 확인
  - SessionStart brief 출력 정상 (HEAD·branch·behind/ahead·uncommitted·history 5건·workflows 13)
  - 신규 3 Skill (deploy-pages, refresh-stock-master, run-collector-locally) Skill 시스템에 자동 인식

## 2026-04-23

### [기능] 장중 시장 동향 자정 초기화 수정 + 히스토리 조회 UI (2026-04-23 22:10 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`
- **내용**:
  - 자정 초기화: todayKST를 useMemo → useState + 1분 간격 갱신으로 변경 (자정 전 페이지 열어도 정상 동작)
  - 히스토리 UI: 라이브/이력 토글 버튼, 날짜 네비게이션(◀▶), 테마/급변/수급 신호 렌더링
  - 자정 후 자동으로 히스토리 모드 전환 및 최근 스냅샷 표시

## 2026-04-22

### [버그픽스] program_net 히스토리 주입 실패 근본 수정 (2026-04-22 21:34 KST)
- **변경 파일**: `collect_investor_data.py`
- **내용**: is_day_transition 날짜 비교 방식 제거 → history[0]에 program_net 존재 여부로 주입 판단
- **원인**: main.py(09:05)가 investor_updated_at를 당일로 갱신 → 09:31 수집 시 is_day_transition=False → 주입 불발

### [개선] 매물대 1w/1m 정밀도 향상 — 30분봉 데이터 활용 (2026-04-22 00:06 KST)
- **변경 파일**: `modules/volume_profile.py`, `collect_volume_profile.py`
- **내용**: 1w/1m 매물대 계산 시 intraday-history.json의 30분봉 데이터를 우선 사용 (일봉 대비 13배 정밀)
- **원인**: 일봉 기반 매물대는 단일 캔들의 넓은 가격범위를 균등 분배하여 상위 구간이 모두 동일값(2.8%) 표시

## 2026-04-21

### [기능] 거시지표 섹션 재설계 + 글로벌 지수 6종 추가 (2026-04-21 22:28 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`
- **내용**:
  - 백엔드: 다우존스, S&P500, 나스닥종합, 유로스톡스50, 상하이종합, 니케이225 yfinance 수집 추가
  - 프론트엔드: F&G/VIX 게이지바 → 글로벌 지수 → 글로벌 매크로 → 주요 선물 순서 재배치
  - esignal 나스닥 선물(NQ_F) 중복 제거 (yfinance NQ=F 유지)

### [개선] 헤더 타임스탬프를 전체 데이터 소스 최신값으로 표시 (2026-04-21 21:58 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: latest.json 외 macro-indicators.json, volume-profile.json 타임스탬프도 비교하여 가장 최근 값을 헤더에 표시
- **원인**: 장외 시간(18:08~09:05) 동안 거시지표(07:00)가 먼저 갱신되어도 헤더는 전일 18시로 표시

### [버그픽스] bottom sheet가 헤더 뒤에 가려지는 문제 수정 (2026-04-21 18:14 KST)
- **변경 파일**: `frontend/src/components/` 12개 컴포넌트
- **내용**: 모든 bottom sheet z-index를 z-[45] → z-[55]로 변경하여 헤더(z-50) 위에 표시되도록 수정

### [기능] 텔레그램 알림 설정 메뉴 (개별 토글) (2026-04-21 10:30 KST)
- **변경 파일**: `.github/workflows/*.yml` (10개), `supabase/functions/kis-proxy/index.ts`, `frontend/src/lib/kis-api.ts`, `frontend/src/components/Header.tsx`
- **내용**:
  - 3개 독립 토글: 워크플로우 시작/완료, 장 마감 TOP10, 워크플로우 실패
  - GitHub Variables: TELEGRAM_NOTIFY, TELEGRAM_MARKET_CLOSE, TELEGRAM_FAILURE
  - Header 더보기 > 설정 메뉴에 토글 스위치 UI 구현
  - Edge Function: get-notify-settings / set-notify-setting 액션 추가

## 2026-04-20

### [버그픽스] MacroIndicators/VolumeProfilePopup merge conflict 복원 (2026-04-20 11:17 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`, `frontend/src/components/VolumeProfilePopup.tsx`
- **내용**: 4/16 merge conflict 해결 시 --theirs로 잘못 덮어쓴 파일 복원 (867줄→92줄 축소된 것 원복)
- **원인**: git checkout --theirs로 원격의 이전 버전을 선택하여 선물 섹션 등 대부분의 코드 소실

## 2026-04-16

### [기능] 텔레그램 알림 토글 + 실패 전용 알림 (2026-04-16 11:18 KST)
- **변경 파일**: `.github/workflows/*.yml` (10개), `supabase/functions/kis-proxy/index.ts`, `frontend/src/lib/kis-api.ts`, `frontend/src/components/Header.tsx`
- **내용**:
  - 모든 워크플로우 시작/성공 알림에 `vars.TELEGRAM_NOTIFY == 'true'` 조건 추가 (기본 비활성)
  - 실패 알림은 토글 무관하게 항상 전송 (`failure()` 조건)
  - Edge Function에 get-notify/set-notify 액션 추가 (GitHub Variables API 연동)
  - Header 더보기 메뉴에 admin 전용 텔레그램 알림 ON/OFF 토글 추가

## 2026-04-15

### [기능] 장 마감 후 거래대금/거래량 상승·하락 TOP10 텔레그램 알림 (2026-04-15 17:40 KST)
- **변경 파일**: `modules/telegram.py`, `send_market_close_summary.py` (신규), `.github/workflows/collect-paper-trading.yml`
- **내용**:
  - KOSPI/KOSDAQ 각 거래대금 상승/하락 TOP10, 거래량 상승/하락 TOP10을 4개 메시지로 전송
  - 네이버 증권 링크 + 한국식 단위(조/억) + 색상 이모지로 가독성 최적화
  - paper-trading 워크플로우에 전송 step 추가, 최신 latest.json fetch 후 실행

## 2026-04-14

### [버그픽스] iOS input focus 시 화면 자동 확대 방지 (2026-04-14 14:51 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/ui/input.tsx`
- **내용**: 모바일 input font-size를 text-base(16px)로 설정하여 iOS Safari 자동 줌 방지

### [버그픽스] 확정 API 수급 수집도 rate limit 재시도 추가 (2026-04-14 23:37 KST)
- **변경 파일**: `modules/kis_rank.py`
- **내용**: `get_investor_data()` (확정 API, FHKST01010900)에도 실패 종목 1회 순차 재시도 추가
- **원인**: 장후 확정 라운드(18:06)에서 161종목 병렬 호출 시 rate limit로 대우건설 등 30종목(18%) 누락

### [버그픽스] 수급 수집 rate limit 대응 — 실패 종목 재시도 (2026-04-14 14:41 KST)
- **변경 파일**: `modules/kis_rank.py`
- **내용**:
  - 추정 API/가집계 API의 병렬 수집에서 rate limit 실패 종목을 1회 순차 재시도
  - 원인: 가집계 API(FHKST01010700) 전면 장애 시 추정 API fallback에서 10 워커 병렬 호출 → rate limit 초과로 17% 종목 누락 (SK하이닉스 등)

## 2026-04-08

### [버그픽스] intraday-history prev_close=0 수정 (2026-04-08 23:14 KST)
- **변경 파일**: `modules/intraday_history.py`
- **내용**: output[1] 의존 → output[0]의 stck_clpr - prdy_vrss로 prev_close 계산하여 항목 1개만 반환 시에도 정상 동작
- **원인**: get_stock_daily_ohlcv() API가 output 1개만 반환하면 prev_close가 0으로 유지 (6.3% 영향)

### [버그픽스] bottom sheet 열림 시 레이아웃 시프트 수정 (2026-04-08 22:51 KST)
- **변경 파일**: `frontend/src/hooks/useScrollLock.ts`
- **내용**: overflow:hidden → overflow-y:scroll로 변경하여 스크롤바 유지, 레이아웃 시프트 방지
- **원인**: overflow:hidden이 스크롤바를 제거하면서 body 너비가 변동

### [개선] 포트폴리오/정규분포 admin 전용 표시 (2026-04-08 22:24 KST)
- **변경 파일**: `frontend/src/components/Header.tsx`, `frontend/src/components/StockCard.tsx`
- **내용**: 헤더 포트폴리오 메뉴(PC/모바일) + 종목카드 정규분포 버튼을 admin 계정에서만 표시

### [개선] 환율 히스토리 오늘 행 실시간 데이터 오버레이 (2026-04-08 22:21 KST)
- **변경 파일**: `frontend/src/components/ExchangeRate.tsx`
- **내용**: 환율 히스토리 테이블/차트의 "오늘" 항목에 KIS 실시간 데이터 반영

### [기능] 환율 KIS API 실시간 조회 (2026-04-08 22:14 KST)
- **변경 파일**: `supabase/functions/kis-proxy/index.ts`, `frontend/src/lib/kis-api.ts`, `frontend/src/components/ExchangeRate.tsx`
- **내용**:
  - Edge Function에 exchange 액션 추가 (FX@KRW, FX@JPY, FX@EUR, FX@CNY → 교차환산)
  - 프론트엔드에서 페이지 진입 시 KIS API로 실시간 환율 자동 조회
  - 정적 데이터(한국수출입은행)에 실시간 데이터 오버레이, "실시간" 배지 표시

### [개선] 포트폴리오 진입 시 전 종목 KIS 실시간 시세 자동 조회 (2026-04-08 21:55 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 랭킹 미포함 종목만이 아닌 전 종목을 페이지 진입 시 KIS API로 실시간 조회하도록 변경

### [개선] 포트폴리오 체크박스 상태 유지 (2026-04-08 21:54 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 종목 체크/해제 상태를 localStorage에 저장하여 페이지 재진입 시 복원 (사용자별 분리, 신규 종목 자동 체크)

### [개선] 포트폴리오 자동 시세 조회 시 로딩 표시 (2026-04-08 21:51 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 랭킹 미포함 종목 자동 시세 조회 중 "조회 중..." 펄스 애니메이션 표시

### [개선] 포트폴리오 랭킹 미포함 종목 자동 시세 조회 (2026-04-08 21:49 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 포트폴리오 종목 중 latest.json 랭킹에 없는 종목은 페이지 진입 시 KIS API로 자동 시세 조회

### [개선] 가격변동 차트 등락률 점선 추가 + 범례/그리드 수정 (2026-04-08 21:38 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`
- **내용**:
  - 종가 범례 색상을 실제 선 색상과 동기화 (상승=빨간, 하락=파란)
  - 일별 등락률을 앰버 점선으로 추가 (좌측 Y축 % 스케일 공유)
  - 세로 그리드라인 렌더링 수정: 픽셀 정렬 + crispEdges로 누락 해소

### [기능] 프로그램 매매 수급 히스토리 누적 관리 (2026-04-08 15:23 KST)
- **변경 파일**: `collect_investor_data.py`
- **내용**:
  - 일 전환 시 전일 program_net을 history 배열에 자동 주입 (D-1 → D-10 순차 누적)
  - 같은 날 재실행 시 기존 program_net 이력 보존
  - 프론트엔드 타입/렌더링은 이미 history[].program_net 지원 (변경 불필요)

## 2026-04-07

### [개선] 매물대 수집 API 실패 시 기존 데이터 보존 + 재시도 (2026-04-07 21:37 KST)
- **변경 파일**: `collect_volume_profile.py`
- **내용**:
  - full 모드에서도 기존 volume-profile.json 로드하여 API 실패 종목의 데이터 소실 방지
  - 실패 종목 1회 자동 재시도 (max_workers=5, 1초 대기 후)
  - 원인: 04/06 full 수집 시 삼성전자 API 실패 → 04/07 15:44까지 장기 매물대 데이터 미표시

## 2026-04-03

### [개선] 포트폴리오 탭 진입 시 최신 데이터 자동 갱신 (2026-04-03 09:40 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 포트폴리오 페이지 진입 시 `latest.json`, `volume-profile.json`, `theme-forecast.json` 3개 데이터 소스를 동시 refetch

## 2026-04-02

### [기능] 외국인 저가 매집 신호 등급 분리 + 백테스트 (2026-04-02 22:42 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`, `backtest_investor_signal.py` (신규), `docs/research/2026-04-02-foreign-accumulation.md`
- **내용**:
  - KIS API `investor_trade_by_stock_daily`로 140종목 × 510거래일(2년) 투자자 매매동향 수집
  - 외국인 저가 매집 신호 백테스트: 527건 분석, 최적 조건 도출
  - 핵심 결과: 50만주+ & -5%이하 → D+1 승률 67.7%, 초과승률 75.5%
  - 프론트엔드 신호 2등급 분리: "외국인 대량 저가 매집" (강한 신호, amber 강조) vs "외국인 저가 매집" (일반)
  - 수집 스크립트 `backtest_investor_signal.py` (collect/analyze 명령)
  - 리서치 문서 최종 업데이트

## 2026-04-01

### [기능] 포트폴리오 물타기 계산기 추가 (2026-04-01 22:26 KST)
- **변경 파일**: `frontend/src/components/AveragingDownCalc.tsx` (신규), `frontend/src/components/AveragingDownSheet.tsx` (신규), `frontend/src/components/PortfolioPage.tsx`
- **내용**:
  - 인라인 계산기: 개별 종목 카드 확장 영역에서 물타기 빠른 계산
  - Bottom Sheet 종합 시뮬레이션: 체크된 전체 종목 대상 종합 물타기 계산
  - 3가지 모드: 기본 물타기, 목표 평균단가 역산, 다단계 분할매수 시뮬레이션
  - 현재가 자동 입력, 종목별 제외(X 버튼), 총 수익률 변화 표시
  - 세그먼트 컨트롤 탭, 보더/그래디언트 카드 등 폴리시 적용

## 2026-03-30

### [개선] 대장주 분석 성능 향상 — 수급 기반 Priority + 종목 성과 피드백 (2026-03-30 21:52 KST)
- **변경 파일**: `modules/theme_forecast.py`, `forecast_main.py`
- **내용**:
  - (1) `_fix_leader_priorities()`: 기관(+2)/외국인(+1) 수급 점수 기반 대장주 자동 정렬로 교체 (하위호환 유지 — investor_data 없으면 기존 순서 할당)
  - (2) `build_forecast_context()`: paper-trading 최근 5일 2회 이상 선정 종목의 종가/최고가 평균 실적을 프롬프트에 피드백 (안정/보통/부진 태그)
  - (3) `forecast_main.py`: paper-trading 데이터 로드 → stock_performance 파라미터 전달 (실패 시 기존 동작 유지)
- **근거**: 기관 순매수 +4.69%p 차이, 반복 선정 종목 +2.97%p 차이 (10일 111종목 데이터 분석)

## 2026-03-27

### [개선] Bottom Sheet 드래그 핸들 여백 확대 (2026-03-27 15:46 KST)
- **변경 파일**: `DistributionPopup.tsx`, `KosdaqIndexAlert.tsx`
- **내용**: 핸들+닫기 버튼 영역 상하 여백 확대 (`pt-6 pb-4`), 닫기 아이콘 크기 증가, 콘텐츠 상단 여백 추가

### [개선] 정렬 드롭다운 + 카드/섹션 레이아웃 개선 (2026-03-27 15:21 KST)
- **변경 파일**: `StockCard.tsx`, `StockList.tsx`
- **내용**:
  - 정렬 옵션 OS `<select>` → 커스텀 pill 드롭다운으로 교체
  - 섹션 헤더 좌우 분리 (`justify-between`) — 타이틀 줄바꿈 방지
  - 카드 헤더 좌측(순위+이름) `flex-1 min-w-0` + 우측(가격) `shrink-0` 유지
  - 종목명/섹션명 `truncate` 제거 — 전체 텍스트 표시
  - 순위 뱃지 탭 시 커스텀 툴팁 표시 (2초 자동 숨김)

### [개선] 정렬 드롭다운 커스텀 UI 교체 (2026-03-27 14:59 KST)
- **변경 파일**: `frontend/src/components/StockList.tsx`
- **내용**: OS 기본 `<select>` → pill 버튼 + 커스텀 드롭다운 메뉴로 교체, 기본 상태 반투명 흰색으로 헤더 그라디언트와 조화

### [버그픽스] PWA 서비스 워커 캐싱 전략 변경 (2026-03-27 14:54 KST)
- **변경 파일**: `frontend/public/sw.js`
- **내용**: `stale-while-revalidate` → `network-first` 전략 변경, CACHE_NAME v1→v2
- **원인**: iOS PWA에서 서비스 워커가 캐시된 구 데이터를 즉시 반환하여 새로고침해도 최신 데이터 미반영

### [개선] 모멘텀 기본 펼침 + 모바일 sticky 섹션 틈 수정 (2026-03-27 14:41 KST)
- **변경 파일**: `IntradayInsights.tsx`, `Header.tsx`, `App.tsx`
- **내용**:
  - 장중 모멘텀 급변 TOP5 기본값 펼침으로 변경
  - 모바일 2단 탭바 배경 `bg-muted/30` → `bg-card` (투명→불투명, 콘텐츠 비침 방지)
  - 모바일 2단 탭바 하단 `pb-2` 추가 — sticky 섹션 간 여백 확보
  - TabControls sticky에 `border-b shadow-sm` 추가

### [개선] 차트 색상 8색 확장 + 테이블 균등 배분 + 환율 오늘 표시 + USD 레이아웃 (2026-03-27 14:09 KST)
- **변경 파일**: `MacroIndicators.tsx`, `ExchangeRate.tsx`, `index.css`
- **내용**:
  - LINE_COLORS 6색→8색 (teal, orange 추가) — NQ/EWY, K200/KORU 색상 겹침 해결
  - 선물/투자자/거시지표/환율 테이블 `table-fixed` + 날짜 컬럼 `w-20` — 균등 배분
  - 날짜 셀 `whitespace-nowrap` — 오늘 배지 줄바꿈 방지
  - 환율 히스토리 테이블 오늘 배지 추가
  - USD 카드 `col-span-2` 제거 — 4통화 동일 2열 그리드

### [버그픽스] 컴팩트 테이블 투자자 컬럼 헤더 정렬 재수정 (2026-03-27 13:55 KST)
- **변경 파일**: `frontend/src/components/StockList.tsx`
- **내용**: 부가 정보(추정/차수/시각)를 컬럼 헤더에서 분리하여 헤더 상단 별도 라인으로 표시, 컬럼명은 고정 너비로 데이터 행과 정렬 일치
- **원인**: min-w 방식은 헤더만 확장되고 데이터 행은 고정이라 여전히 정렬 불일치

### [개선] 날짜 오늘 표시 + 컴팩트 테이블 컬럼 정렬 수정 (2026-03-27 13:48 KST)
- **변경 파일**: `HistoryModal.tsx`, `PriceHistoryPopup.tsx`, `PredictionHistory.tsx`, `MacroIndicators.tsx`, `StockList.tsx`
- **내용**:
  - 모든 히스토리 bottom sheet 날짜에 오늘 당일 "오늘" 배지 추가 (4개 컴포넌트)
  - 컴팩트 모드 테이블 헤더 `ml-auto` 제거로 컬럼 헤더/값 정렬 일치
  - 투자자 컬럼 헤더(`외국인`, `기관`, `개인`)에 `whitespace-nowrap` 추가로 줄바꿈 방지

### [버그픽스] 헤더 IconButton 스타일 과잉 수정 (2026-03-27 13:21 KST)
- **변경 파일**: `frontend/src/components/IconButton.tsx`
- **내용**: UI 개선 작업에서 추가된 배경 그라디언트, 보더, 그림자, min-w/h 44px, hover 오버레이 등 과도한 스타일 제거 → 심플한 아이콘 버튼으로 복원
- **원인**: 디자인 개선 시 접근성 터치 타겟(44px)과 시각적 크기를 혼동하여 아이콘 버튼이 큰 회색 박스로 표시됨

### [개선] UI/디자인 대규모 개선 — 30개 항목 (2026-03-27 13:08 KST)
- **변경 파일**: `index.css`, `Header.tsx`, `IconButton.tsx`(신규), `useScrollLock.ts`(신규), `StockCard.tsx`, `StockList.tsx`, `TabBar.tsx`, `Sparkline.tsx`, `ExchangeRate.tsx`, `MacroIndicators.tsx`, `DataFreshness.tsx`, `CriteriaLegend.tsx`, `AuthPage.tsx`, `PullToRefreshIndicator.tsx`, `KosdaqIndexAlert.tsx`, `App.tsx`, `AIThemeAnalysis.tsx`, `ThemeForecastPage.tsx` 외 팝업 컴포넌트 다수
- **내용**:
  - **시각 계층**: TOP3 순위 뱃지 금/은/동 강조, KOSPI/KOSDAQ 섹션 배경 틴트, 상위 3카드 그루핑, USD 환율 강조, TabBar 하단 활성 바
  - **색상**: Sparkline 영역 채우기, shimmer oklch+GPU 가속, 차트 색상 CSS 변수화(`--color-chart-*`), IndexAlert 등락률 배경 강도
  - **타이포그래피**: `text-[8px]`/`text-[9px]` → `text-[10px]` 전체 상향, Header 타이틀 로고감 강화
  - **모션**: 카드 hover lift, Bottom Sheet slide-in 애니메이션, Header 스크롤 숨김 트랜지션, 뉴스 grid-rows 트랜지션, Pull-to-refresh 개선
  - **컴포넌트**: DataFreshness 구분점, CriteriaLegend 도트 미리보기, 검색 focus 효과, 스케줄 타임라인 도트 바, 환율 차트 마지막 포인트 강조, Bottom Sheet 핸들바 개선
  - **접근성**: Header 아이콘 버튼 aria-label, AuthPage sr-only label, 터치 타겟 44px, aria-modal
  - **코드 정리**: `IconButton` 공통 컴포넌트 추출, `useScrollLock` 훅 추출(15곳), Header inline style → CSS 이동

### [버그픽스] AI 예측 대장주에 카테고리명 출력 방지 + 모의투자 기본 접힘 (2026-03-27 08:59 KST)
- **변경 파일**: `modules/theme_forecast.py`, `frontend/src/components/PaperTradingPage.tsx`
- **내용**:
  - Phase 2 프롬프트에 종목명/코드 형식 강제 (카테고리명, N/A 금지)
  - 라이프사이클 규칙 표현 완화 ("제외/필수" → "주의/필요")
  - 실패 테마 피드백 표현 완화 ("제외하세요" → "보수적으로 판단하세요")
  - 모의투자 날짜별 카드 기본값 접힘으로 변경
- **원인**: 어제 AI 프롬프트 강화 시 "제외", "필수" 등 강한 표현이 Gemini의 종목 특정을 위축시켜 카테고리명 출력 유발

## 2026-03-26

### [버그픽스] 모의투자 페이지 흰 화면 + 차트 여백 개선 (2026-03-26 23:18 KST)
- **변경 파일**: `PaperTradingPage.tsx`, `PriceHistoryPopup.tsx`
- **내용**: useMemo를 early return 앞으로 이동 (React hooks 규칙 위반 수정), 장중 차트 좌우 여백 축소 (PAD left 36→30, right 40→34)
- **원인**: useMemo 2개가 loading early return 뒤에 위치하여 hooks 수 불일치 에러 발생

### [개선] AI 예측 정확도 향상 — 피드백 루프 + 프롬프트 강화 (2026-03-26 20:41 KST)
- **변경 파일**: `modules/theme_forecast.py`, `modules/backtest.py`
- **내용**:
  - Phase 1 프롬프트에 테마 라이프사이클 행동 규칙 추가 (출현/가속/정점/쇠퇴)
  - criteria_data 확장 주입 (고가돌파, 수급동반, 과열, 골든크로스)
  - 수급 트렌드 요약 (외인/기관 N일 연속 매수/매도)
  - 테마별 적중률 + priority별 적중률 집계 함수 (calculate_theme_accuracy)
  - 실패 테마 피드백 (최근 실패 테마를 컨텍스트에 주입)
  - 동적 신뢰도 보정 (적중률 40% 미만 테마 "높음"→"보통" 다운그레이드)

### [개선] 프론트엔드+백엔드 성능 최적화 (2026-03-26 20:05 KST)
- **변경 파일**: `App.tsx`, `PaperTradingPage.tsx`, `StockCard.tsx`, `PaperTradingStockCard.tsx`, `useAutoPolling.ts`, `kis_client.py`, `kis_rank.py`, `theme_forecast.py`
- **내용**:
  - IIFE 7건 → useMemo/서브컴포넌트 전환 (불필요 re-render 제거)
  - 3개 페이지 React.lazy + Suspense (초기 번들 축소)
  - StockCard, PaperTradingStockCard에 React.memo 적용
  - useAutoPolling 탭 비활성 시 폴링 중단
  - KIS client requests.Session 도입 (TCP 연결 풀링)
  - theme_forecast Gemini API Session 풀링 + URL resolve 병렬화
  - kis_rank ThreadPoolExecutor 4곳 → 클래스 레벨 공유

### [버그픽스] iOS PWA 백그라운드 복귀 시 무한 로딩 방지 (2026-03-26 17:20 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **내용**: `getSession()`에 5초 타임아웃 추가 + localStorage 폴백 — iOS 백그라운드 복귀 시 네트워크 미복구로 세션 갱신이 hang되는 문제 해결
- **원인**: iOS Safari가 백그라운드에서 네트워크를 끊어, `supabase.auth.getSession()`이 타임아웃 없이 무기한 대기

## 2026-03-24

### [기능] 테마 팝업 종목 클릭 시 종목 카드 이동 (2026-03-24 23:25 KST)
- **변경 파일**: `IntradayInsights.tsx`
- **내용**: 테마별 장중 등락률 팝업에서 종목명 클릭 시 해당 종목 카드로 스크롤 이동

### [개선] 로고 클릭 효과 + 환경분석 탭 이동 + 스크롤 최상단 (2026-03-24 23:25 KST)
- **변경 파일**: `Header.tsx`, `App.tsx`, `index.css`
- **내용**: 로고+사이트명 클릭 시 (1) pulse 로딩 애니메이션 2초 주기 (2) 환경분석(home) 탭으로 이동 (3) 스크롤 최상단 이동 (4) active:scale-95 클릭 피드백

### [개선] 종목 리스트 우측 스크롤 fade 개선 (2026-03-24 23:25 KST)
- **변경 파일**: `StockList.tsx`
- **내용**: 수평 스크롤이 끝까지 도달하면 우측 fade 오버레이 숨김 처리

### [개선] 모의투자 TPSL 시뮬레이션 수익률 날짜 선택기 반영 (2026-03-24 22:18 KST)
- **변경 파일**: `PaperTradingDateSelector.tsx`, `PaperTradingPage.tsx`
- **내용**: 익절/손절 슬라이더 조정 시 날짜 선택기의 수익률도 TPSL 시뮬레이션 반영값으로 실시간 업데이트. 전체 해제 버튼 클릭 시 스크롤 위치 유지(scrollIntoView)

### [개선] 주요 선물 바텀시트 닫기 버튼 개선 (2026-03-24 22:18 KST)
- **변경 파일**: `MacroIndicators.tsx`
- **내용**: 바텀시트 헤더(스와이프 핸들+제목+X 닫기)를 sticky로 고정하여 작은 화면에서도 항상 닫기 가능. 주요 선물에서 NQ 중복 제거

### [개선] 스케줄 표시 실제 cron 시각 동기화 (2026-03-24 22:18 KST)
- **변경 파일**: `App.tsx`, `investor-schedule.ts`
- **내용**: 프론트엔드 데이터 수집 스케줄을 실제 cron-job.org 등록 시각에 맞춰 수정. 테마 재예측 7회 전체 표시

### [기능] 수급 특이 신호 설명 팝업 (2026-03-24 22:18 KST)
- **변경 파일**: `IntradayInsights.tsx`
- **내용**: '수급 특이 신호' 헤더 클릭 시 3가지 신호 종류(외국인 저가 매집, 외국인 차익 실현, 기관 저가 매집)와 판정 기준 설명 팝업

## 2026-03-23

### [기능] 장중 최저가 수집 + 손절 시뮬레이션 정확도 개선 (2026-03-23 21:33 KST)
- **변경 파일**: `collect_paper_trading.py`, `frontend/src/types/stock.ts`, `TakeProfitSlider.tsx`, `PaperTradingPage.tsx`, `PaperTradingStockCard.tsx`
- **내용**: (1) KIS API에서 이미 반환하던 `stck_lwpr`(저가) 추출 추가 — 추가 API 호출 없음 (2) 분봉 탐색에서 고가+저가 동시 탐색 (3) `applyTPSL`에 `lowProfitRate` 파라미터 추가 — 손절 판정을 종가→최저가 기준으로 개선 (4) 카드 상세 정보에 저가 행 추가

### [기능] 모의투자 익절 시뮬레이션 슬라이더 (2026-03-23 16:02 KST)
- **변경 파일**: `frontend/src/components/TakeProfitSlider.tsx`(신규), `PaperTradingPage.tsx`, `PaperTradingStockCard.tsx`
- **내용**: 3단계 익절 라인 시뮬레이션 — 글로벌(전체 기간), 날짜별, 종목별 슬라이더. 0.5~30% 범위. 최고가 수익률이 익절 라인 이상이면 해당 %에서 매도한 것으로 계산, 미도달 시 실제 수익률 유지. 우선순위: 종목별 > 날짜별 > 글로벌

### [버그픽스] 강제 새로고침 시 세션 유지 — localStorage 직접 복원 (2026-03-23 14:13 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: SDK `_initialize()`가 `navigator.locks`에 걸려 `INITIAL_SESSION` 미발생 → 2초 fallback으로 로그인 페이지 표시
- **수정**: 마운트 시 `ExpireStorage.getItem()`으로 localStorage에서 세션 직접 읽어 즉시 복원 (SDK 초기화 대기 없음). `onAuthStateChange`는 이후 이벤트(로그인/로그아웃/토큰 갱신)만 처리

### [버그픽스] 로그인/로그아웃 401 오류 완전 해결 — PostgREST 호출 전면 제거 (2026-03-23 14:07 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`, `frontend/src/App.tsx`, `frontend/src/components/PaperTradingPage.tsx`
- **원인**: Supabase JS SDK가 publishable key 사용 시 PostgREST Authorization 헤더에 유저 JWT 대신 publishable key를 설정 → user_history/user_activity_log INSERT 시 항상 401 → SDK 내부 세션 오염 → SIGNED_OUT 유발
- **수정**: auth 흐름에서 PostgREST 호출(recordUserHistory, insertActivityLog, logActivity) 전면 제거. onAuthStateChange 콜백은 순수 React 상태 관리만 수행. auth 로직에 Supabase DB 호출이 단 하나도 없음

### [버그픽스] 로그인 실패 근본 수정 — onAuthStateChange에서 DB 호출 완전 분리 (2026-03-23 12:15 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: SIGNED_IN 콜백 안에서 즉시 PostgREST 호출 시, SDK 내부 Authorization 헤더가 아직 publishable key → user JWT로 갱신되지 않아 401 발생. 이 401이 SDK 내부 상태를 오염시켜 SIGNED_OUT 유발
- **수정**: onAuthStateChange 콜백은 순수 상태 관리만 수행. DB 로깅(recordUserHistory, insertActivityLog)은 user 상태 확정 후 별도 useEffect에서 1초 지연 실행

### [버그픽스] 로그인 상태 해제 방지 — setUser(null) 전수 검사 및 방어 강화 (2026-03-23 11:56 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: (1) INITIAL_SESSION(null) 지연 도착 (2) 탭 복귀 시 getSession() 1초 race가 유효 세션도 null 반환 (3) USER_UPDATED 등 예상치 못한 이벤트가 null session 전달
- **수정**: setUser(null) 호출 경로를 SIGNED_OUT/명시적 로그아웃만으로 제한. onAuthStateChange에서 authed 상태이면 null session 이벤트 일괄 무시. 탭 복귀는 ExpireStorage 직접 체크로 변경(네트워크/hang 의존 제거). 9개 시나리오 전수 검증 완료

### [버그픽스] 로그인 후 즉시 로그아웃되는 근본 원인 수정 (2026-03-23 11:54 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: Supabase 클라이언트 `_initialize()`가 지연되어 `INITIAL_SESSION(null)` 이벤트가 `SIGNED_IN` 이후에 도착 → `setUser(null)` 호출로 로그인 상태 즉시 해제. `getSession()` 1초 race timeout도 동일 문제 유발
- **내용**: (1) `authed` ref로 SIGNED_IN 이후 도착하는 INITIAL_SESSION(null) 무시 (2) `getSession()` race 제거 — `onAuthStateChange`만 사용 (3) SIGNED_IN 후 DB 호출 500ms 지연으로 세션 전파 대기 (4) 2초 fallback timeout

### [개선] 로고 클릭 새로고침 피드백 — pulse 효과 + 성공/실패 토스트 (2026-03-23 11:43 KST)
- **변경 파일**: `frontend/src/components/Header.tsx`, `frontend/src/App.tsx`, `frontend/src/hooks/useStockData.ts`
- **내용**: (1) 로고+사이트명 클릭 시 데이터 로딩 중 animate-pulse 효과 (2) 새로고침 성공/실패 토스트 팝업(2.5초 자동 소멸) (3) refreshFromAPI가 boolean 반환하도록 변경하여 실패 감지 가능

### [개선] signOut 세션 잔류 방지 및 auth hang 전면 보강 (2026-03-23 11:31 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **내용**: (1) signOut 시 localStorage 세션 키 직접 삭제 — SDK hang 시에도 새로고침 후 재로그인 방지 (2) 비활성 자동 로그아웃(1시간)에도 동일 즉시 정리 로직 적용 (3) 탭 복귀 시 getSession()에 1초 timeout race 적용 — hang 방지
- **진단 결과**: Python 백엔드/GitHub Actions는 Service Role Key로 별도 접근, user_history는 system_name으로 행 분리 → 프로그램 간 간섭 없음 확인

### [버그픽스] 로그아웃 버튼 미동작 수정 (2026-03-23 11:09 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: `supabase.auth.signOut()`이 내부 lock으로 hang되어 `await`에서 무한 대기, UI 차단
- **내용**: 로컬 상태(session/user) 즉시 초기화 후 서버 측 signOut은 비동기(non-blocking) 처리

### [개선] 초기 로딩 지연 해소 및 헤더 클릭 로그인 화면 전환 오류 수정 (2026-03-23 11:05 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`, `frontend/src/components/Header.tsx`
- **원인**: (1) Supabase 클라이언트 초기화 지연으로 INITIAL_SESSION 이벤트가 3~5초 후에 발생 (2) 홈에서 사이트명 클릭 시 `window.location.reload()`로 전체 페이지 리로드 → auth 재초기화 → 로딩 화면 노출
- **내용**: (1) `getSession()` + 1초 timeout race 방식으로 변경, `.catch()`/`.finally()` 추가로 hang 방지 (2) `window.location.reload()` → `onRefresh?.()` 데이터만 새로고침

### [버그픽스] 강제 새로고침 시 무한 로딩 및 로그아웃 미동작 수정 (2026-03-23 10:23 KST)
- **변경 파일**: `frontend/src/hooks/useAuth.tsx`
- **원인**: `getSession()`이 내부 lock으로 hang되면 `setLoading(false)`가 호출되지 않아 무한 로딩. `.catch()` 미설정으로 에러 시에도 동일 증상
- **내용**: deprecated `getSession()` 제거 → `onAuthStateChange`의 `INITIAL_SESSION` 이벤트로 대체. 5초 fallback 타이머 추가

### [버그픽스] KIS 프록시 Edge Function 호출 401 오류 수정 (2026-03-23 09:59 KST)
- **변경 파일**: `frontend/src/lib/kis-api.ts`, `supabase/functions/kis-proxy/index.ts`
- **원인**: publishable key(JWT 아님)를 `Authorization: Bearer` 헤더에 넣어 Supabase API 게이트웨이가 401 반환. 포트폴리오 리프레시 버튼 및 종목 검색 실패의 직접 원인
- **내용**: raw fetch → `supabase.functions.invoke()` 전환 (SDK가 apikey/Authorization 헤더를 올바르게 설정). Edge Function 인증 체크도 apikey 헤더 허용하도록 완화

## 2026-03-22

### [버그픽스] 수급 바텀시트 범례 버튼 클릭 오류 수정 및 전체 선택/해제 버튼 추가 (2026-03-22 21:19 KST)
- **변경 파일**: `frontend/src/components/InvestorChartPopup.tsx`
- **원인**: `onClick`+`onDoubleClick` 핸들러 충돌로 한 번 클릭 시 여러 버튼이 동시에 토글됨. "모두 꺼지면 전체 켜기" 강제 로직도 예측 불가능한 동작 유발
- **내용**: `onDoubleClick` 제거, 강제 전체 켜기 로직 제거, "전체" 선택/해제 토글 버튼 신규 추가

## 2026-03-21

### [개선] 투자자 수급 동향 테이블 날짜 오름차순 정렬 (2026-03-22 00:02 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 투자자 수급 동향 바텀시트 테이블 정렬을 날짜 내림차순→오름차순으로 변경 (오래된 날짜가 상단)

### [버그픽스] 배포 사이트 "Legacy API keys are disabled" 로그인 오류 수정 (2026-03-21 23:58 KST)
- **변경 파일**: `frontend/src/lib/supabase.ts`, `frontend/src/lib/kis-api.ts`, `.github/workflows/deploy-pages.yml`
- **원인**: 레거시 JWT anon key(`VITE_SUPABASE_ANON_KEY`)가 Supabase 프로젝트에서 비활성화됨. 배포 빌드에 포함되어 "Legacy API keys are disabled" 401 오류 발생
- **내용**: 레거시 ANON_KEY 참조 전면 제거. supabase.ts, kis-api.ts 모두 PUBLISHABLE_KEY만 사용. deploy-pages.yml에서 ANON_KEY 환경변수 제거

### [개선] 매크로 지표 바텀시트 높이 확대 및 투자자 동향 10일로 축소 (2026-03-21 23:42 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 3개 바텀시트 max-h 70vh→95vh로 확대(스크롤 없이 데이터 한눈에 보이도록). 투자자 동향 표시 기간 20일→10일 축소(닫기 버튼 접근 가능하도록)

### [개선] 포트폴리오 체크박스 UI 개선 및 왼쪽 보더 제거 (2026-03-21 23:42 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 체크박스 16px 라운드 사각형으로 변경, 미선택 카드 opacity-40+grayscale 처리. 전체 선택/해제를 텍스트 링크 스타일로 변경. 선택 카드 왼쪽 보더 효과 제거

### [기능] 포트폴리오 종목별 체크박스 — 합산 포함/제외 (2026-03-21 23:27 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 종목 왼편 체크박스로 총 투자금/평가금 합산에 포함/제외. 전체 선택/해제 토글 추가. 종목 추가/삭제 시 자동 반영

### [버그픽스] 등락률 bottom sheet 주말·공휴일 기본 탭 수정 (2026-03-21 23:21 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`
- **내용**: 장중 시간대라도 주말·공휴일이면 일별 탭을 기본으로 표시. 한국 양력 공휴일 8개 + 2026년 음력 연휴 추가

### [개선] KIS 시세 조회 실패 시 에러 표시 개선 (2026-03-21 23:18 KST)
- **변경 파일**: `supabase/functions/kis-proxy/index.ts`, `frontend/src/lib/kis-api.ts`, `frontend/src/components/PortfolioPage.tsx`
- **내용**: 토큰 만료 등으로 전체 조회 실패 시 HTTP 502 + KIS 에러 메시지 반환. 부분 실패 시 failed 카운트 포함. 프론트엔드에서 실패를 정확히 사용자에게 알림
- **원인**: 기존에는 전체 실패 시에도 HTTP 200 + 빈 결과 반환 → 정상 완료로 오인

### [버그픽스] 포트폴리오 실시간 시세 조회 401 오류 수정 (2026-03-21 23:04 KST)
- **변경 파일**: `frontend/src/lib/kis-api.ts`, `frontend/.env.local`
- **원인**: Supabase 새 키 형식(`sb_publishable_*`)이 Edge Functions 게이트웨이에서 401 반환. JWT anon key만 허용
- **내용**: `.env.local`에 `VITE_SUPABASE_ANON_KEY`(JWT) 추가, `kis-api.ts`에서 JWT anon key 우선 사용하도록 순서 변경

### [기능] 매물대 차트에 포트폴리오 평단가 표시 (2026-03-21 22:58 KST)
- **변경 파일**: `frontend/src/components/VolumeProfilePopup.tsx`, `StockCard.tsx`, `StockList.tsx`
- **내용**: 매물대 bottom sheet 열 때 포트폴리오 보유 종목이면 Supabase에서 평단가 조회, 빨간색 점선 수평선으로 표시. 범례에 평단가 항목 추가

### [기능] 예측 이력 적중 기준 안내 팝업 추가 (2026-03-21 22:48 KST)
- **변경 파일**: `frontend/src/components/PredictionHistory.tsx`
- **내용**: 예측 이력 헤더에 ? 아이콘 추가, 클릭 시 적중 기준(대장주 과반수 +2% 이상, 당일/단기 7영업일/장기 30영업일) 팝업 표시

### [개선] 워크플로우 스케줄 최적화 — 경합 해소 (2026-03-21 22:26 KST)
- **변경 파일**: `.github/workflows/theme-forecast-intraday.yml`, cron-job.org 스케줄 7건 수정 + 1건 비활성화 + 5건 신규
- **내용**:
  1. **Refresh Stock Data 11:30→12:30 이동**: 11:30 구간 4개 워크플로우 동시 실행 → 1개로 격리 (핵심 변경)
  2. **Collect Investor 시간 조정**: 11:31→12:00, 13:21→13:25, 14:31→14:35, 15:41→15:50 (경합 간격 확보)
  3. **Intraday History 12:15→12:20, 12:45 비활성화**: Refresh 내부 중복 수집 제거
  4. **Theme Forecast Intraday GitHub schedule 주석 처리 → cron-job 7건 통합**: 이중 트리거(5+2=7회) 해소, cron-job으로 일원화
- **효과**: intraday-history/volume-profile/macro-indicators 동시 쓰기 3개→1개, git push 실패 확률 대폭 감소

### [진단] GCP e2-micro 하이브리드 및 WebSocket 알림 데몬 연구 (2026-03-21 21:36 KST)
- **변경 파일**: `docs/research/2026-03-21-websocket-alert.md`(신규), `docs/research/2026-03-20-gcp-migration.md`(보완)
- **내용**: GCP e2-micro 하이브리드 방식 분석 → 경합 악화로 비권장 판단. WebSocket 알림 데몬(B안) 설계 → stock_toolkit과 24종 알림 중복 확인 → theme_analysis 단독 데몬 비권장, stock_toolkit에 위임 결정. GCP 무료 리전 asia-east1(대만) 오류 정정 (US 3곳만 무료)

### [진단] 워크플로우 스케줄 최적화 연구 (2026-03-21 22:07 KST)
- **변경 파일**: `docs/research/2026-03-21-workflow-optimization.md`(신규)
- **내용**: 12개 워크플로우 경합 분석, 파일별 동시 쓰기 위험도 매핑, Refresh 11:30→12:30 이동 중심 최적화안 도출

## 2026-03-20

### [진단] GitHub Actions → GCP 이관 연구 (2026-03-20 23:31 KST)
- **변경 파일**: `docs/research/2026-03-20-gcp-migration.md`(신규)
- **내용**: 현재 12개 워크플로우(66회/일) 아키텍처의 한계(git push 경합, 30분 갱신 한계, 콜드스타트 반복) 분석 및 GCP 이관 시 이점 연구. 3가지 옵션 비교(e2-micro 무료, e2-small $9/월, e2-small 24/7 $21/월). KIS WebSocket 실시간 체결/호가 수신 가능성 조사. 권장: e2-small + Instance Schedule(월 $9)

### [기능] KIS API 활용 개선 3건 (2026-03-20 23:21 KST)
- **변경 파일**: `modules/sector_performance.py`(신규), `modules/paper_trading_analytics.py`(신규), `main.py`, `modules/gemini_analyzer.py`, `modules/data_exporter.py`, `collect_paper_trading.py`, `.github/workflows/collect-paper-trading.yml`, `.mcp.json`(신규), `.gitignore`
- **내용**:
  1. **업종별 시세 API 추가**: KOSPI 17개 + KOSDAQ 2개 업종 당일 등락률 수집, Gemini 프롬프트에 섹터 컨텍스트 추가, 프론트엔드 데이터 내보내기 연동
  2. **KIS Code Assistant MCP 개발 도구 도입**: `.mcp.json` 설정으로 Claude Code에서 334개 KIS API 자연어 검색 가능
  3. **모의투자 누적 성과 분석 강화**: 누적 수익률(복리), 승률, 손익비, MDD, 샤프비율, 변동성, 테마별/시장별 성과 분석 → `paper-trading-analytics.json` 자동 생성
- **연구 문서**: `docs/research/2026-03-20-kis-enhancement.md`, `docs/research/2026-03-20-gcp-cost.md`

### [개선] 텔레그램 메시지 [THEME_ANALYSIS] 말머리 제거 (2026-03-20 22:32 KST)
- **변경 파일**: `.github/workflows/` 내 10개 워크플로우 파일
- **내용**: 모든 텔레그램 알림 메시지에서 `[THEME_ANALYSIS]` 접두사 29건 일괄 제거

### [개선] 수급/거래원/히스토리 수집 병렬화 및 워커 수 증가 (2026-03-20 14:47 KST)
- **변경 파일**: `modules/kis_rank.py`, `modules/stock_history.py`, `collect_volume_profile.py`, `collect_intraday_history.py`
- **내용**: ①수급 3종 API(확정/추정/가집계) 직렬 루프 → ThreadPoolExecutor(10) 병렬화 ②거래원 데이터 직렬 루프 → 병렬화 ③stock_history/volume_profile/intraday_history max_workers 5→10 증가. rate limiter(초당 20건)가 과부하 방지하므로 안전
- **효과**: main.py Step8 ~12분→~6분, Step9 ~5분→~2분, 거래원 ~2분→~1분

### [개선] Refresh Stock Data 워크플로우 실행 시간 최적화 (2026-03-20 13:02 KST)
- **변경 파일**: `collect_volume_profile.py`, `collect_intraday_history.py`, `modules/intraday_history.py`, `modules/volume_profile.py`, `.github/workflows/refresh-data.yml`, `.gitignore`
- **내용**: ①분봉 캐시 공유 — volume_profile에서 수집한 raw 분봉을 `.candle_cache.json`에 저장, intraday_history에서 재사용하여 중복 API 호출 제거(~13분 → ~2분) ②`fetch_minute_candles()` sleep 0.1s→0.05s 단축(rate limiter가 이미 0.05s 보장) ③워크플로우 timeout 45→60분 확대

### [개선] Deploy Pages 스킵 시 실패 알림 대신 스킵 알림 전송 (2026-03-20 12:41 KST)
- **변경 파일**: `.github/workflows/deploy-pages.yml`
- **내용**: 트리거 워크플로우 실패로 build/deploy가 스킵된 경우 "실패" 대신 "스킵" 알림을 텔레그램으로 전송하도록 notify 조건 분기 추가
- **원인**: Refresh Stock Data 타임아웃 → deploy-pages workflow_run 트리거 → build 조건 불충족 스킵 → notify가 deploy 결과만 확인하여 "실패"로 오보

### [버그픽스] stock-history.json 워크플로우 커밋 누락 수정 (2026-03-20 10:03 KST)
- **변경 파일**: `.github/workflows/daily-theme-analysis.yml`, `.github/workflows/refresh-data.yml`
- **내용**: `data_exporter.py`가 `latest.json`에서 분리 생성하는 `stock-history.json`이 GitHub Actions 워크플로우의 backup/restore/git-add 단계에 포함되지 않아 커밋되지 않던 문제 수정. 두 워크플로우 모두에 `stock-history.json` 처리 추가
- **원인**: `data_exporter.py`가 history 데이터를 별도 파일로 분리하는 변경 이후 워크플로우 업데이트 누락

### [개선] 포트폴리오 입력창 iOS 자동 줌인 방지 (2026-03-20 09:54 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 모든 input 폰트 사이즈를 text-sm/text-xs → text-base(16px)로 변경. iOS Safari에서 16px 미만 input 포커스 시 자동 줌인 방지

### [버그픽스] 로그인 페이지 다크모드 autofill 배경색 수정 (2026-03-20 09:50 KST)
- **변경 파일**: `frontend/src/index.css`
- **내용**: 브라우저 자동완성(autofill) 시 입력 필드가 밝은 배경으로 표시되는 문제 수정. `-webkit-box-shadow` inset 트릭으로 다크모드 배경/텍스트 색상 강제 적용
- **원인**: Chrome/Safari autofill 스타일이 CSS 변수 기반 다크모드 배경색을 덮어씀

### [버그픽스] 검색/AI분석에서 종목 이동이 동작하지 않는 버그 수정 (2026-03-20 00:15 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/StockList.tsx`
- **내용**: ①환경분석 탭에서 DOM 검색 생략 후 바로 탭 전환 ②StockList에 expandForCode prop 추가하여 initialLimit(20) 밖 종목 자동 확장 ③triedTabsRef 초기화 누락 수정 ④검색 패널 sticky 위치 모바일 헤더 높이에 맞춤 ⑤검색 패널 currentPage 조건 제거(모든 페이지에서 동작)
- **원인**: activeTab="home"일 때 종목 카드 미렌더링, initialLimit로 20위 밖 종목 DOM 미존재, triedTabsRef 잔여값

### [버그픽스] 타 페이지에서 '종목으로 이동' 시 잘못된 종목으로 스크롤되는 버그 수정 (2026-03-20 00:01 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: AI분석 등 홈 외 페이지에서 종목 이동 시 현재 탭에 없는 종목이면 탭 전환 없이 포기하던 문제 수정. pendingScrollTarget useEffect에서 stockTabMap 조회 후 자동 탭 전환+재시도 로직 추가, triedTabsRef로 무한 루프 방지
- **원인**: scrollToStock이 currentPage !== "home"일 때 pendingScrollTarget만 설정하고 탭 전환 로직을 거치지 않음

---

## 2026-03-19

### [개선] 네비게이션 구조 개편 및 bottom sheet X 버튼 위치 통일 (2026-03-19 23:55 KST)
- **변경 파일**: `App.tsx`, `Header.tsx`, `TabBar.tsx`, `ExchangeRate.tsx`, 8개 Popup 컴포넌트
- **내용**: ①AI 테마 분석을 별도 페이지(ai-analysis)로 분리, 모바일 메뉴에 AI분석 추가 ②예측 메뉴를 가장 우측으로 이동 ③홈 버튼 추가, 로고 클릭 시 홈 이동(다른 페이지) or 새로고침(홈) ④홈 탭 → "환경분석" 텍스트 변경 ⑤모든 bottom sheet X 버튼을 drag handle bar 우측으로 통일 ⑥환율 히스토리 최신 날짜 상단 정렬 ⑦종목 이동 기능 페이지 전환 대응 ⑧Footer 제거

### [기능] 테마/종목 클릭 팝업 및 위치 기반 표시 (2026-03-19 23:23 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`
- **내용**: ①테마명 클릭 시 포함 종목+등락률 팝업 표시 ②모든 팝업을 클릭 위치 기반으로 표시(화면 중앙→클릭 옆)

### [개선] 장중 모멘텀/수급 신호 UI 추가 개선 (2026-03-19 23:16 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`
- **내용**: ①외/기/프 값 0일 때 회색 처리 ②외/기/프 열 고정 너비로 세로정렬 ③모멘텀 급변 종목명 클릭 시 액션 팝업(네이버 보기/종목 이동) 추가 ④팝업 위치 flex 센터링으로 수정(transform 부모 영향 제거)

### [개선] 수급 특이 신호 UI 개선 및 갱신 배지 수정 (2026-03-19 23:03 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx`, `frontend/src/components/DataFreshness.tsx`, `frontend/src/App.tsx`, `frontend/src/components/PortfolioPage.tsx`
- **내용**: ①수급 특이 신호 2줄 레이아웃(종목명 잘림 해소) ②프로그램 수급(외/기/프) 추가 ③매수/매도 색상 구분(빨강/파랑) ④종목 클릭 시 컴팩트 팝업(네이버 보기/종목 이동) ⑤갱신 배지 수급 시간에 장마감 확정 데이터 반영 ⑥포트폴리오 LIVE 위치 refresh 버튼 좌측으로 이동

### [버그픽스] KIS API 호출을 직접 fetch로 전환 (2026-03-19 22:34 KST)
- **변경 파일**: `frontend/src/lib/kis-api.ts`
- **내용**: `supabase.functions.invoke()` → 직접 `fetch` + anon key로 전환. SDK 내부 세션 처리 우회하여 세션 만료 시에도 Edge Function 호출 가능
- **원인**: Supabase SDK가 만료된 JWT를 자동 포함하여 Edge Function 호출 실패

### [버그픽스] KIS proxy Edge Function JWT 인증 실패 수정 (2026-03-19 22:32 KST)
- **변경 파일**: `supabase/functions/kis-proxy/index.ts`, `frontend/src/lib/kis-api.ts`
- **내용**: Edge Function의 `auth.getUser()` JWT 검증이 브라우저 세션 만료 시 실패 → 인증 헤더 존재만 확인하도록 완화. kis-api.ts에 에러 로깅 및 Edge Function 응답 에러 처리 추가
- **원인**: ExpireStorage로 인한 세션 JWT 만료 시 Edge Function에서 "Invalid token" 반환

### [개선] 종목 검색 커버리지 확장 (2026-03-19 22:24 KST)
- **변경 파일**: `frontend/public/data/stock-master.json`, `frontend/src/components/PortfolioPage.tsx`
- **내용**: stock-master.json을 KRX 전종목(2,618종목)으로 확장 (기존 113종목). 검색 결과 없을 때 "6자리 코드로 KIS API 조회" 안내 메시지 추가

### [기능] 포트폴리오 Supabase 동기화 (2026-03-19 22:16 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`
- **내용**: 포트폴리오 저장소를 localStorage → Supabase `portfolio_holdings` 테이블로 전환. RLS 정책(사용자 본인 데이터만 접근), UNIQUE(user_id, code) 중복 방지, DB 로딩 스피너 추가. 모든 기기에서 동일 포트폴리오 확인 가능

### [개선] 헤더 레이아웃 정리 및 다크 모드 UI 개선 (2026-03-19 22:09 KST)
- **변경 파일**: `frontend/src/components/Header.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- **내용**: ①모바일 2단 툴바 줄바꿈 해소 — 검색·테마·보기모드·로그아웃을 헤더 1단으로 이동, 2단은 페이지 네비게이션만 유지 ②리프레시+로그아웃을 "..." 드롭다운 메뉴로 통합 ③페이지 리로드 버튼 제거 → 로고 클릭으로 대체 ④다크 테마 배경색 밝기 4%p 상향 ⑤플로팅 버튼 다크 모드 가독성 개선

### [개선] 다크 테마 배경색 밝기 상향 (2026-03-19 21:57 KST)
- **변경 파일**: `frontend/src/index.css`
- **내용**: 다크 모드 배경색 lightness를 약 4%p씩 상향 (background 13→17%, card 19→23%, secondary/muted 23→27%, accent 25→29%, popover 17→21%, border 30→34%, 매크로 카드 배경 동일 비율 상향)

### [설정] cron-job.org 장중 수집 스케줄 30분 간격 재등록 (2026-03-19 14:48 KST)
- **변경 파일**: 없음 (cron-job.org API 작업)
- **내용**: 기존 7개 cron-job(0930~1500, 1시간 간격) 전체 삭제 → 13개 신규 등록(09:15~15:15, 30분 간격). 대상 워크플로우: `collect-intraday-history.yml`, 평일(월~금) KST 기준

### [기능] 포트폴리오 KIS API 실시간 시세 + 종목 검색 확장 (2026-03-19 14:33 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`, `frontend/src/lib/kis-api.ts`(신규), `supabase/functions/kis-proxy/index.ts`(신규), `supabase/functions/_shared/cors.ts`(신규), `supabase/config.toml`(신규), `scripts/generate_stock_master.py`(신규), `frontend/public/data/stock-master.json`(신규)
- **내용**: ①Supabase Edge Function(kis-proxy) 구현 및 배포 — KIS API 프록시(CORS+키은닉, JWT 인증) ②포트폴리오 "실시간" 리프레시 버튼 — 보유 종목 전체 KIS API 실시간 시세 조회 및 재계산 ③종목 검색 확장 — stock-master.json(113종목) 로드 + 6자리 코드 미존재 시 KIS API 자동 fallback 조회

### [진단] KIS API 사용 가이드 문서 작성 (2026-03-19 14:05 KST)
- **변경 파일**: `docs/research/2026-03-19-kis-api-guide.md`(신규)
- **내용**: 타 시스템 공유용 KIS Open API 사용 가이드. API 키 설정, OAuth 토큰 관리(1일 1회 제한, Supabase 이중 캐시), Supabase 테이블 스키마/SQL/SDK 예시, 16개 API 목록(tr_id/용도), Rate Limiting, 트러블슈팅

### [설정] 장중 히스토리 cron-job 30분 간격 전환 대응 (2026-03-19 13:40 KST)
- **변경 파일**: `.github/workflows/collect-intraday-history.yml`, `.github/workflows/deploy-pages.yml`, `frontend/src/App.tsx`
- **내용**: cron-job 스케줄 7회(1시간)→13회(30분) 전환에 따른 소스 영향도 분석 및 조치. ①concurrency cancel-in-progress false로 변경(실행 취소 방지) ②deploy-pages에서 Intraday History 트리거 제거(배포 폭증 방지) ③스케줄 표시 텍스트 갱신

### [버그픽스] 장중 탭 등락률·현재가 MTS 불일치 수정 (2026-03-19 13:29 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`, `frontend/src/types/stock.ts`, `modules/volume_profile.py`
- **내용**: ①차트 Y축 등락률이 시가 기준으로 재계산되던 버그 → 전일종가(prev_close) 기준으로 통일. ②KIS 1분봉 API가 미래 시간대 플레이스홀더 캔들 반환 → cutoff_time 필터 추가하여 현재 시각 이후 캔들 제거
- **원인**: ①PriceHistoryPopup에서 openPrice 기준 재계산 ②fetch_minute_candles에서 미래 캔들 미필터링

### [기능] 포트폴리오 관리 페이지 신규 구현 (2026-03-19 10:53 KST)
- **변경 파일**: `frontend/src/components/PortfolioPage.tsx`(신규), `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`
- **내용**: 보유 종목 CRUD(localStorage) + 7가지 분석 기능 실시간 계산. ①실시간 수익률 ②포트폴리오 총 손익 ③손절/익절 알림(-5/-10/+10/+20%) ④매물대 대비 위치(POC) ⑤52주 대비 매수 위치 ⑥외국인/기관 수급 ⑦AI 분석 신호 매칭. 헤더 데스크톱+모바일에 포트폴리오 버튼 추가

### [개선] DataFreshness-IntradayInsights 여백 추가 + 수급 신호 종목 클릭→네이버 증권 이동 (2026-03-19 10:25 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/IntradayInsights.tsx`
- **내용**: DataFreshness 뱃지와 장중 시장 동향 카드 사이 여백(mb-3/4) 추가. 수급 특이 신호 종목을 `<a>` 태그로 변경하여 클릭 시 네이버 증권 새 탭 이동 (기존 패턴 재활용)

### [버그픽스] 데이터 수집 후 웹 미반영 — deploy-pages workflow_run 트리거 추가 (2026-03-19 10:14 KST)
- **변경 파일**: `.github/workflows/deploy-pages.yml`
- **내용**: GITHUB_TOKEN으로 수행된 push는 다른 워크플로우를 트리거하지 않는 GitHub Actions 제한사항. T2-13에서 빌드/배포를 분리하면서 발생. `workflow_run` 트리거 추가하여 9개 데이터 워크플로우 완료 시 자동 배포
- **원인**: GitHub Actions 설계 — GITHUB_TOKEN push는 workflow trigger 비활성

### [버그픽스] 투자자 수급 카드 "억" 강제 줄바꿈 수정 (2026-03-19 00:11 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 투자자 수급 금액 텍스트에 `whitespace-nowrap` 추가, 카드 padding 축소(`px-2.5` → `px-2`)로 공간 확보
- **원인**: 3열 그리드 내 "-386.9억" 같은 긴 텍스트가 좁은 셀에서 "억"만 줄바꿈됨

## 2026-03-18

### [개선] 다크테마 전반 색상 개선 (2026-03-18 23:59 KST)
- **변경 파일**: `frontend/src/index.css`, `frontend/src/components/ThemeForecastPage.tsx`, `frontend/src/components/PredictionHistory.tsx`, `frontend/src/components/MacroIndicators.tsx`, `frontend/src/components/TabBar.tsx`, `frontend/src/App.tsx`
- **내용**: CSS 변수 다크모드 전면 보정(배경/카드 대비 강화, 보더 밝기 30%, muted 텍스트 72%, 매크로 카드 배경 보정), 컴포넌트 인라인 dark: 색상 추가(신뢰도 뱃지, 상태 뱃지, 선물 그리드, 퀵네비)

### [개선] 연구결과 25개 항목 일괄 구현 (2026-03-18 23:23 KST)
- **변경 파일**: 36개 수정 + 7개 신규 (총 41개 파일)
- **내용**: 8차 심화 연구에서 도출된 25개 개선 항목 전체 구현
  - P0: except:pass→에러 로깅, VITE_GITHUB_PAT 보안 제거, datetime.now()→KST 통일
  - T1: latest.json history 분리, cache:no-store 제거, 1분 자동 폴링, 데이터 신선도 배지, 수급-가격 괴리 신호
  - T2: Gemini 장중 데이터 프롬프트, 장중 재예측 5회 확대, history 5일 보존, 빌드/배포 분리, 거래대금 순위 변동
  - T3: criteria_data 부분 재계산, 이벤트 드리븐, 종목 정렬/필터, 모의투자 손익, 백테스트 적중률
  - T4: Supabase Realtime, Service Worker, KIS 호가/체결 API, DART 전자공시, 테스트+CI
- **검증**: TypeScript 빌드 통과, pytest 26건 전부 통과

### [기능] T3-16~T4-25 일괄 구현 (2026-03-18 23:13 KST)
- **변경 파일**: `collect_investor_data.py`, `modules/stock_criteria.py`(참조), `modules/theme_forecast.py`, `modules/kis_client.py`, `modules/dart_client.py`(신규), `modules/supabase_client.py`(참조), `frontend/src/components/StockList.tsx`, `frontend/src/components/PaperTradingPage.tsx`, `frontend/public/sw.js`(신규), `frontend/index.html`, `docs/sql/intraday_snapshots.sql`(신규), `tests/test_utils.py`(신규), `tests/test_data_exporter.py`(신규), `.github/workflows/ci.yml`(신규)
- **내용**: 10개 작업 순차 구현:
  - T3-16: criteria_data 수급(investor_net)+거래대금(top30) 2개 기준 부분 재계산
  - T3-17: 외국인 순매수 전환 감지(부호반전+10만주) → theme-forecast-intraday workflow_dispatch 트리거
  - T3-18: StockList 정렬 옵션(외국인순/기관순/등락률순) 드롭다운 추가
  - T3-19: PaperTradingPage 장중 실시간 손익 표시(useInvestorIntraday의 cp 기반)
  - T3-20: build_forecast_context에 Supabase theme_predictions 적중률 조회→프롬프트 주입
  - T4-21: intraday_snapshots Supabase INSERT(upsert) + 테이블 생성 SQL
  - T4-22: Service Worker(stale-while-revalidate) + data/*.json 오프라인 캐싱
  - T4-23: KIS 호가(FHKST01010200)/체결(FHKST01010300) API 메서드 추가
  - T4-24: DART OpenAPI 클라이언트(최근 공시+종목 매핑)
  - T4-25: pytest 유닛테스트 26건(safe_int/float, cleanup_old_history) + CI 워크플로우

### [진단] 시장 추세 지연 8차 심화 연구 (2026-03-18 22:40 KST)
- **변경 파일**: `docs/research/2026-03-18-realtime-lag-phase8.md` (신규)
- **내용**: 이전 7차와 중복 없는 5개 신규 영역 분석. 1) Python 에러 핸들링(bare except+pass 40건 이상, intraday_history.py prev_close 실패 시 등락률 오류 Critical 발견). 2) 프론트엔드 상태 관리(17개 훅 중 6개 에러/로딩 상태 미관리, React Query 도입 효과 분석). 3) 보안(VITE_GITHUB_PAT이 프론트엔드 번들에 노출, Supabase RLS 확인 필요). 4) 테스트(자동화 테스트 0건, CI 테스트 스텝 0건). 5) 장중 데이터 정확성(prev_close fallback 오류, datetime UTC/KST 혼용, 15:30 동시호가 보정 실패 가능). 위험도 평가 10건 + Phase 0~3 권장 조치 순서(총 42시간).

### [진단] 시장 추세 지연 7차 심화 연구 (2026-03-18 22:30 KST)
- **변경 파일**: `docs/research/2026-03-18-realtime-lag-phase7.md` (신규)
- **내용**: 5개 완전 신규 영역 분석 + 1~7차 전체 종합 로드맵. 1) Gemini API 비용 분석(일 12~14회, 월 ~$5 또는 Free tier 무료, Self-Consistency 일 $0.01 비용효율적, 재예측 5회/일 확대 가능). 2) 데이터 신선도 대시보드(8개 소스 중 2개만 갱신 시각 표시, 인라인 배지+종합 대시보드 설계). 3) 이벤트 드리븐 아키텍처(cron+이상감지 하이브리드, 급등/수급급변/테마교체 트리거). 4) 히스토리 아카이빙(813MB→5일 보존 163MB, R2 아카이빙). 5) 종합 로드맵(30개 개선안 ROI 평가, 즉시 8h/단기 24h/중기 32h/장기 48h 4단계).

### [진단] 시장 추세 지연 6차 심화 연구 (2026-03-18 22:08 KST)
- **변경 파일**: `docs/research/2026-03-18-realtime-lag-phase6.md` (신규)
- **내용**: 5개 완전 신규 영역 심층 분석. 1) 텔레그램 봇 전수 조사(일 41~45메시지, 단방향 전용, 모의투자 미발송, 양방향 봇 설계안). 2) 종목 발굴 타임라인 역추적(테마 09:28 확정 후 6시간 미갱신, 시나리오별 최선 30분~최악 20시간 지연). 3) 경쟁 서비스 대비(실시간성 열위, AI 테마 발굴/모의투자 자동 추적이 강점). 4) 캐시/CDN 전략(GitHub Pages max-age=600, cache:no-store로 19MB 매번 다운, Service Worker stale-while-revalidate 제안). 5) 모의투자 20일 분석(평균 -0.70%, 승률 40%, KOSDAQ alpha 미측정, 분봉 데이터 미저장).

### [진단] 시장 추세 지연 5차 심화 연구 (2026-03-18 18:58 KST)
- **변경 파일**: `docs/research/2026-03-18-realtime-lag-phase5.md` (신규)
- **내용**: 5개 신규 영역 심층 분석. 1) 프론트엔드 초기 로딩 23.4MB(history 63%=12MB가 불필요), 코드 스플리팅/캐시 전략 부재. 2) AI 예측 피드백 루프 단절(백테스트 결과가 프롬프트에 미반영), 적중 기준 관대함(시장 alpha 미측정). 3) KIS API 11개 활용 중 호가/체결 등 미사용, 가격대별 분할 조회 비효율(하루 105회). 4) merge_workflow_data.py에서 criteria/member/ranking 필드 병합 누락, 섹션별 시점 불일치. 5) 종목 리스트 도달까지 스크롤 4~5회, 데이터 신선도 표시 부족.

### [진단] 시장 추세 지연 4차 심화 연구 (2026-03-18 18:44 KST)
- **변경 파일**: `docs/research/2026-03-18-realtime-lag-phase4.md` (신규)
- **내용**: GitHub Actions 워크플로우 최적화(빌드 중복 17회/일 발견), 테마 분류 실시간성, 외부 데이터 소스 활용도, 알림/푸시 시스템 가능성, 데이터 압축/최적화(latest.json 19MB, history/ 813MB 무한 증가 문제) 5개 영역 심층 분석

### [기능] 장중 시장 동향 섹션 추가 (2026-03-18 09:05 KST)
- **변경 파일**: `frontend/src/components/IntradayInsights.tsx` (신규), `frontend/src/App.tsx`
- **내용**: 홈 탭에 "장중 시장 동향" 카드 추가. 1) AI 장중 재분석 배너(theme-forecast.json 최신 여부 표시). 2) 테마별 장중 등락률(대장주 평균). 3) 장중 모멘텀 급변 TOP5(최근 30분 변동폭). 시장 추세 1일 지연 문제 개선.

## 2026-03-17

### [버그픽스] refresh-data 워크플로우 뉴스 수집 누락 수정 (2026-03-17 23:44 KST)
- **변경 파일**: `.github/workflows/refresh-data.yml`
- **내용**: Collect stock data 스텝에 NAVER_CLIENT_ID/SECRET 환경변수 추가. 장중 갱신(KST 11:30) 시 네이버 API 자격증명 누락으로 뉴스가 빈 배열로 덮어씌워지던 문제 해결.
- **원인**: daily-theme-analysis.yml에는 환경변수가 있었으나 refresh-data.yml에는 누락

### [개선] 15:30 캔들 종가 보정 및 가격 변동 차트 개선 (2026-03-17 23:31 KST)
- **변경 파일**: `modules/intraday_history.py`, `collect_intraday_history.py`, `frontend/src/components/PriceHistoryPopup.tsx`
- **내용**: 1) 장중 히스토리 15:30 캔들 종가를 inquire-daily-price API 확정 종가로 보정 (전 종목 대상). 2) paper-trading 기반 보정 로직 제거 (9종목 한정→불필요). 3) 가격 변동 차트 거래량 막대 Y축 라벨 겹침 해결 (bar inset). 4) 등락률 표시 toFixed(1)→toFixed(2). 5) 종가/거래량 범례 추가.

### [개선] 가격 변동 차트 거래량 막대 추가 및 UI 개선 (2026-03-17 22:53 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`, `frontend/src/components/InvestorChartPopup.tsx`, `frontend/src/components/StockCard.tsx`
- **내용**: 1) 일별 변동 차트에 거래량 막대 그래프 추가(색상=등락 방향). 2) 수급 차트 Y축 패딩 30→42로 확대(우측 라벨 잘림 해결). 3) 거래원 매수/매도 TOP5 좌우 위치 교체.

### [개선] 수급 차트 범례 전체 on/off 기능 추가 (2026-03-17 22:35 KST)
- **변경 파일**: `frontend/src/components/InvestorChartPopup.tsx`
- **내용**: 외국인/기관/개인/프로그램 토글 버튼에 더블클릭 기능 추가. 전체 ON 시 더블클릭 → 해당 항목만 ON. 일부 ON 시 더블클릭 → 전체 ON. 모두 OFF 시 자동 전체 ON.

### [버그픽스] 거래 추이 풀차트 데이터 기간 오류 수정 (2026-03-17 22:09 KST)
- **변경 파일**: `frontend/src/components/TradingChartPopup.tsx`
- **내용**: `.reverse().slice(0, 11)` → `.slice(0, 11).reverse()`로 변경. 최근 11일이 아닌 가장 오래된 11일(3개월 전)이 표시되던 버그 수정.
- **원인**: 전체 배열을 뒤집은 뒤 앞 11개를 자르면 가장 오래된 데이터가 선택됨

## 2026-03-16

### [버그픽스] 헤더 자동 숨김 스크롤 버그 수정 (2026-03-16 22:49 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 스크롤을 살짝 내렸다 올릴 때 헤더+탭 컨트롤이 다시 나타나지 않는 버그 수정. scrollY ≤ 100이면 무조건 헤더 표시, 숨김 임계값 80→200 상향, headerHiddenRef로 passive 핸들러 내 상태 동기 참조.
- **원인**: 숨김 임계값이 너무 낮아(80px) 살짝만 스크롤해도 헤더가 숨겨지고, 상단 복귀 시 레이아웃 시프트로 스크롤 이벤트가 재발생하지 않음

### [버그픽스] 모의투자 종가/고가 수집 API 변경 (2026-03-16 22:43 KST)
- **변경 파일**: `collect_paper_trading.py`, `frontend/public/data/paper-trading/2026-03-16.json`
- **내용**: `inquire-price`(stck_prpr, 시간외 포함 현재가) → `inquire-daily-price`(stck_clpr, 정규장 종가) API로 변경. 03/16 데이터 고가 수정(네오펙트 1050→1105, 오르비텍 10490→10650).
- **원인**: stck_prpr은 시간외 거래 가격이 혼입되어 정규장 종가와 불일치. stck_hgpr도 inquire-price보다 inquire-daily-price가 더 정확.

### [개선] 투자자 수급 차트 범례를 토글 버튼으로 변경 (2026-03-16 22:23 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 외국인/기관/개인 범례를 코스피/코스닥 탭과 같은 줄 우측으로 이동. 범례를 토글 버튼으로 변경하여 활성화된 항목만 차트에 표시. Y축 스케일도 보이는 라인 기준으로 재계산.

### [버그픽스] 투자자 수급 히스토리 같은 날짜 덮어쓰기 미적용 수정 (2026-03-16 22:15 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/public/data/indicator-history.json`
- **내용**: 투자자 수급 히스토리에서 같은 날짜 데이터가 덮어쓰이지 않아 장 초반 0값이 유지되던 버그 수정. 선물 히스토리와 동일한 덮어쓰기 방식 적용. 03/16 데이터 수동 교정.
- **원인**: `update_indicator_history`에서 `existing_dates` 체크로 이미 존재하는 날짜를 건너뛰어 확정 데이터로 갱신 불가

### [개선] 투자자 수급 히스토리 코스피/코스닥 탭 전환 (2026-03-16 18:53 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 투자자 수급 동향 바텀시트에서 코스피/코스닥을 세로 나열 → 탭 전환 방식으로 변경. 차트와 테이블이 선택된 시장만 표시.

### [개선] 투자자 수급 섹션 UX 개선 (2026-03-16 15:08 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 1) formatAmount 줄바꿈 수정 — 1억 미만 값을 "백만" 대신 소수점 억 단위로 표시. 2) 상세보기 버튼 제거(히스토리 버튼과 중복). 3) 코스피/코스닥 영역 클릭 시 bottom sheet 표시 제거(히스토리 버튼과 중복). 4) 주요 선물 셀 높이를 거시지표와 통일(py-1).

### [버그픽스] 퀵 네비 스크롤 위치 오프셋 수정 (2026-03-16 13:48 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 모바일 헤더 오프셋이 56px로 잘못 설정되어 퀵 네비 클릭 시 콘텐츠가 가려지는 문제 수정. sticky bar의 실제 top 값(5.75rem=92px)에 맞게 수정. 모든 탭(종합/거래대금/거래량/등락률) 동시 적용.
- **원인**: headerH 계산에서 모바일 값이 실제 sticky bar top 위치(92px)와 불일치(56px)

### [기능] 주요 선물·투자자 수급 히스토리에 라인 차트 추가 (2026-03-16 13:45 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 주요 선물 히스토리에 MacroChart 재활용하여 라인 차트+범례 토글 추가. 투자자 수급 동향에 InvestorChart(외국인/기관/개인 3개 라인) 코스피·코스닥 각각 추가.

---

## 2026-03-15

### [개선] 투자자 수급 카드 여백·줄간격 축소 (2026-03-15 22:28 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 투자자 수급 카드의 패딩·간격을 전반적으로 축소하여 컴팩트하게 개선.

### [개선] 주요 선물 셀 높이를 거시지표와 통일 (2026-03-15 22:25 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 주요 선물 접힌 상태 셀의 세로 패딩(py-1→py-1.5)과 간격(gap-0.5) 추가하여 거시지표 셀과 동일한 높이로 통일. 헤더-그리드 간격도 거시지표와 동일하게 조정.

### [개선] 홈 섹션 헤더 폰트 크기·효과 통일 (2026-03-15 22:15 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`, `frontend/src/components/KosdaqIndexAlert.tsx`
- **내용**: 투자자 수급 섹션(font-bold→font-semibold, 아이콘·텍스트 색상 통일), 코스피/코스닥 지수 카드(font-medium→font-semibold, 아이콘 크기·색상 통일)를 거시지표/주요선물/환율 기준으로 맞춤.

### [기능] 주요 선물·투자자 수급 섹션에 날짜/시간 표시 및 히스토리 기능 추가 (2026-03-15 22:10 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`, `frontend/src/hooks/useIndicatorHistory.ts`
- **내용**: 주요 선물 섹션에 날짜·시간 표시 + 히스토리 바텀시트 팝업 추가. 투자자 수급 섹션에 시간 표시 + 히스토리 버튼 추가(최대 20일 표시). 백엔드에 선물/투자자 수급 30일 롤링 히스토리 축적 기능 추가.

### [개선] 홈 전용 콘텐츠를 다른 탭에서 제거 (2026-03-15 22:03 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: MacroIndicators, ExchangeRate, IndexAlertSection, AIThemeAnalysis를 홈 탭 전용으로 분리. 다른 탭(종합/거래대금/거래량/등락률)에서는 종목 리스트만 표시. 퀵네비에서 거시지표/AI테마 버튼 제거.

### [버그픽스] 홈 탭 스크롤 불가 및 하단 메뉴바 사라짐 근본 원인 수정 (2026-03-15 21:53 KST)
- **변경 파일**: `frontend/src/hooks/useSwipeToDismiss.ts`, `frontend/src/components/MacroIndicators.tsx`, `frontend/src/components/ExchangeRate.tsx`
- **내용**: useSwipeToDismiss 훅이 마운트 시 무조건 popup-open 클래스를 body에 추가하는 것이 근본 원인. isOpen 파라미터 추가하여 팝업이 실제로 열렸을 때만 적용하도록 수정. MacroIndicators(InvestorTrendBar, 거시지표 히스토리), ExchangeRate 3곳에 적용.
- **원인**: 항상 마운트되는 컴포넌트에서 useSwipeToDismiss를 무조건 호출 → popup-open 클래스 상시 적용 → overflow:hidden + 탭바 display:none

### [버그픽스] 홈 탭 스크롤 불가 및 하단 메뉴바 사라짐 수정 (2026-03-15 21:39 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 홈 탭에서 sticky 컨테이너(TabControls+퀵네비) 전체를 렌더링하지 않도록 변경. headerHidden에 의한 display:none 부작용 제거.

### [기능] 홈 화면 분리 및 하단 메뉴바에 홈 탭 추가 (2026-03-15 21:27 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/TabBar.tsx`, `frontend/src/types/stock.ts`
- **내용**: TabType에 "home" 추가, 하단 메뉴바 5탭(홈/종합/거래대금/거래량/등락률) 구성. 홈 탭에서는 거시지표~AI 테마 분석까지만 표시, 종목 리스트는 나머지 탭에서만 표시.

### [버그픽스] 바텀시트 팝업 시 배경 스크롤 잠금 (2026-03-15 21:17 KST)
- **변경 파일**: `frontend/src/index.css`
- **내용**: `body.popup-open { overflow: hidden; }` 추가하여 팝업 열림 시 배경 스크롤 차단.

### [버그픽스] 바텀시트 팝업 시 하단 탭바 숨김 처리 (2026-03-15 21:12 KST)
- **변경 파일**: `frontend/src/hooks/useSwipeToDismiss.ts`, `frontend/src/components/TabBar.tsx`, `frontend/src/index.css`
- **내용**: 바텀시트 팝업이 하단 탭바를 가리는 문제 해결. useSwipeToDismiss에서 mount/unmount 시 body에 popup-open 클래스 토글, CSS로 탭바 숨김.

### [개선] 4개 탭을 하단 고정 메뉴바로 이동 (2026-03-15 17:47 KST)
- **변경 파일**: `frontend/src/components/TabBar.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- **내용**: 종합/거래대금/거래량/등락률 탭을 화면 하단 고정 메뉴바로 이동. 하위 컨트롤(구성 방식, 등락률 소스)은 TabControls로 분리하여 인라인 배치. safe-area-bottom 지원, 스크롤탑 버튼 위치 조정.

### [개선] 정규분포 기간탭·매매지침·버튼위치 전면 개편 (2026-03-15 15:54 KST)
- **변경 파일**: `frontend/src/components/DistributionPopup.tsx`, `StockCard.tsx`
- **내용**: 기간 탭을 1일~5일+한달로 변경(기본 5일). 매매 지침을 중립 표현으로 변경(적극 매수→극단적 저위치 등). 데이터 10개 미만 시 신뢰도 경고 표시. 버튼을 가격 좌측으로 이동, 명칭 '분포'→'정규분포'로 변경.

### [개선] 매물대 지지/저항 라벨 구분 (S/R → S, R 분리) (2026-03-15 15:44 KST)
- **변경 파일**: `frontend/src/components/DistributionPopup.tsx`
- **내용**: 현재가 기준으로 지지(S, 녹색)와 저항(R, 빨간색)을 구분 표시. 범례도 S/R 통합에서 개별 설명으로 변경.

### [버그픽스] 분포 분석 팝업 배경 스크롤 전파 방지 (2026-03-15 15:41 KST)
- **변경 파일**: `frontend/src/components/DistributionPopup.tsx`
- **내용**: 방법론 팝업 및 분포 분석 Bottom Sheet에 `overscroll-contain` 적용하여 내부 스크롤 끝 도달 시 배경 페이지 스크롤 전파 차단.

### [기능] 분포 분석 방법론 설명 팝업 및 1주 기간 추가 (2026-03-15 15:38 KST)
- **변경 파일**: `frontend/src/components/DistributionPopup.tsx`
- **내용**: 헤더에 Info 아이콘 버튼 추가 → 클릭 시 데이터 기반·계산 방법·σ 구간 해석·매매 지침·유의사항 설명 팝업. 기간 선택에 "1주"(5거래일) 옵션 추가.

### [개선] 장중 차트 X/Y축 라벨 가독성 및 정렬 개선 (2026-03-15 15:33 KST)
- **변경 파일**: `frontend/src/components/KosdaqIndexAlert.tsx`
- **내용**: MiniLineChart X/Y축 라벨 fontSize 7→9, opacity 0.5→0.8로 가독성 향상. X축 데이터 순서 수정(최신 날짜가 오른쪽). 우측 라벨 겹침 방지. PAD 여유 확보.

### [개선] 지수 이동평균선 팝업에서 MA 그리드 카드 제거 (2026-03-15 15:27 KST)
- **변경 파일**: `frontend/src/components/KosdaqIndexAlert.tsx`
- **내용**: 이동평균선 탭에서 현재가 헤더+MA 그리드 카드 제거. 하단 테이블과 중복되므로 차트+테이블만 유지.

### [개선] 투자자 수급 영역 가독성 개선 (2026-03-15 15:25 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 상세보기 버튼 가시성 향상(primary 색상+화살표), 코스피/코스닥 카드 배경·테두리 추가, 텍스트 크기·굵기 전반 강화.

### [개선] 코스피/코스닥 지수 섹션 통합 및 상세 팝업 추가 (2026-03-15 15:21 KST)
- **변경 파일**: `frontend/src/components/KosdaqIndexAlert.tsx`, `MacroIndicators.tsx`, `App.tsx`
- **내용**: 투자자수급 영역의 지수 등락률을 지수 섹션으로 이동. 섹션명 "코스피 지수"/"코스닥 지수"로 변경, 우측에 등락률 배지. 클릭 시 2탭(등락률/이동평균선) Bottom Sheet 팝업 — 각 탭에 꺾은선 그래프+히스토리 테이블.

### [개선] 정규분포 차트에 매매 지침 및 매물대 오버레이 추가 (2026-03-15 15:10 KST)
- **변경 파일**: `frontend/src/components/DistributionPopup.tsx`, `StockCard.tsx`
- **내용**: σ 구간별 매매 지침 표시(적극 매수/분할 매수/관망/분할 매도/적극 매도). 매물대 POC(기본 ON) 및 지지/저항 상위 3구간(기본 OFF) 토글 오버레이. PER 차트에도 가격÷EPS 변환 적용.

### [기능] 종목별 가격/PER 정규분포 분석 차트 추가 (2026-03-15 15:00 KST)
- **변경 파일**: `modules/data_exporter.py`, `main.py`, `frontend/src/components/DistributionPopup.tsx`(신규), `StockCard.tsx`, `StockList.tsx`, `App.tsx`, `types/stock.ts`
- **내용**: 종목 카드에 "분포" 버튼 추가. 클릭 시 가격 분포(일별 종가 기반)와 PER 분포(종가÷EPS) 정규분포 차트를 1M/3M/6M/1Y 기간별로 표시. Z-Score 및 σ 밴드로 현재 가격/PER 위치 시각화. fundamental_data를 latest.json에 export 추가.

### [설정] cron-job API 키 등록 및 워크플로우 주석 업데이트 (2026-03-15 14:50 KST)
- **변경 파일**: `.env`, `.env.example`, `.github/workflows/collect-macro-futures.yml`
- **내용**: 외부 cron-job 서비스 API 키를 .env에 등록. 워크플로우 주석/텔레그램 알림을 KOSPI200 지수 기준으로 수정.

### [개선] 거시지표 KOSPI200F(선물) → KOSPI200(지수)로 변경 (2026-03-15 14:37 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`
- **내용**: KIS 선물 API 기반 KOSPI200F 수집을 yfinance 기반 KOSPI200 지수(^KS200) 수집으로 교체. 프론트엔드 심볼/약칭/설명 업데이트.

### [개선] 거시지표에서 K200(KOSPI200F) 항목 제거 (2026-03-15 14:31 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`
- **내용**: esignal 선물 섹션으로 대체되므로 거시지표에서 KOSPI200F 수집 및 표시 제거. SUMMARY_SYMBOLS, SHORT_NAMES, INDICATOR_DESC 정리.

### [기능] esignal.co.kr 주요 선물 데이터 수집 및 표시 추가 (2026-03-15 14:18 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`, `frontend/src/hooks/useMacroIndicators.ts`
- **내용**: esignal.co.kr에서 6개 선물 데이터 수집(코스피200 주간/야간, S&P500, 나스닥, 원유, 금). 거시지표 아래에 선물 요약 바 + 펼침 상세 카드 표시.

### [버그픽스] 장중 탭 컬럼명 수정: 종가→현재가 (2026-03-15 14:08 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`
- **내용**: 장중 탭 테이블 헤더의 "종가"를 "현재가"로 수정. 시간대별 데이터에 적합한 용어로 변경.

### [기능] 거시지표에 코스피/코스닥 투자자 수급 데이터 추가 (2026-03-15 08:26 KST)
- **변경 파일**: `collect_macro_indicators.py`, `frontend/src/components/MacroIndicators.tsx`, `frontend/src/hooks/useMacroIndicators.ts`
- **내용**: KIS API(FHPTJ04040000) 시장별 투자자매매동향(일별) 20일분 수집. 거시지표 하단에 코스피/코스닥 외국인/기관/개인 순매수 요약 표시. 클릭 시 5일간 상세 Bottom Sheet.

### [버그픽스] 코스닥 지수 API 코드 수정: 2001→1001 (2026-03-15 00:42 KST)
- **변경 파일**: `main.py`, `modules/kis_client.py`
- **내용**: 코스닥 종합지수 조회 시 잘못된 코드(2001, 812.93)를 올바른 코드(1001, 1152.96)로 수정. MTS 확인값과 일치.

## 2026-03-14

### [개선] TabBar UI 개선: full-width + 높이 축소 + 모던 디자인 (2026-03-14 22:57 KST)
- **변경 파일**: `frontend/src/components/TabBar.tsx`
- **내용**: 4개 탭이 전체 너비 균등 분배(inline-grid→grid). 높이 축소(padding 감소). 배경 투명감·hover 간결화.

### [버그픽스] 장중 데이터 동시호가(15:20~15:30) 미수집 수정 (2026-03-14 22:57 KST)
- **변경 파일**: `modules/volume_profile.py`, `modules/intraday_history.py`
- **내용**: fetch_minute_candles 커서 150000→153000으로 변경하여 동시호가 1분봉 수집. aggregate_minute_candles 경계에 153000 추가하여 동시호가 구간 집계.

### [개선] 스케줄 패널 내용 명확화: 유망 테마 예측 화면 명시 (2026-03-14 22:57 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 07:30 테마 예측/10:00·13:00 장중 재예측이 'AI 유망 테마 예측' 화면 대상임을 명시.

### [개선] 스케줄 내용 보강: 매물대 분석 항목 분리 + AI분석 명칭 추가 (2026-03-14 22:29 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: 매물대(Volume Profile) 분석을 별도 카테고리로 분리(3항목). 장중 데이터 수집 카테고리에 '당일 테마 및 대장주 AI분석' 텍스트 추가.

### [개선] 스케줄 패널 bottom sheet 전환 + 스케줄 버튼 상단 헤더 이동 (2026-03-14 22:25 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`
- **내용**: 스케줄 패널을 sticky 패널에서 bottom sheet(createPortal + useSwipeToDismiss)로 변경. 스케줄 버튼을 모바일 2단 툴바에서 상단 헤더 1단으로 이동(모바일에서도 아이콘 직접 접근).

### [기능] 헤더 수집 스케줄 조회 기능 추가 (2026-03-14 21:51 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`
- **내용**: 헤더에 CalendarClock 아이콘 스케줄 버튼 추가(데스크톱+모바일). 전체 데이터 수집 스케줄 6개 카테고리 19개 항목 표시. 현재 KST 시각 기준 완료/다음 상태 표시. 검색↔스케줄 패널 상호 배타적 열림.

### [기능] 헤더 종목 검색 기능 추가 (2026-03-14 21:41 KST)
- **변경 파일**: `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`
- **내용**: 헤더에 돋보기 아이콘 검색 버튼 추가(데스크톱+모바일). 클릭 시 검색 패널 슬라이드 다운. 전체 탭 종목 통합 검색(이름/코드). 결과 클릭 시 해당 탭 전환 + 카드 스크롤.

## 2026-03-13

### [개선] 장중 시간 테이블 오름차순 정렬 (2026-03-13 20:02 KST)
- **변경 파일**: `frontend/src/components/PriceHistoryPopup.tsx`
- **내용**: 장중 탭 시간 테이블을 내림차순(15:00→09:30)에서 오름차순(09:30→15:00)으로 변경. `.reverse()` 제거.

### [버그픽스] 장중 등락률 기준을 시가→전일종가로 변경 (2026-03-13 19:50 KST)
- **변경 파일**: `modules/intraday_history.py`, `frontend/src/components/PriceHistoryPopup.tsx`, `frontend/src/types/stock.ts`
- **내용**: 장중 등락률이 시가 기준으로 계산되어 일봉과 불일치하던 문제 수정. KIS 현재가 API로 전일 종가를 조회하여 base_price로 사용. 전일종가 fallback 시 시가 사용. 프론트엔드에 전일종가 표시 추가.

### [개선] 히스토리 버튼 가독성 향상 (2026-03-13 17:03 KST)
- **변경 파일**: `MacroIndicators.tsx`, `ExchangeRate.tsx`
- **내용**: 거시지표/환율 히스토리 아이콘을 "히스토리" 텍스트 라벨+배경 있는 버튼 스타일로 변경.

### [개선] 히스토리 팝업 행 간격·차트 라벨·스크롤 개선 (2026-03-13 16:46 KST)
- **변경 파일**: `MacroIndicators.tsx`, `ExchangeRate.tsx`
- **내용**: 차트-테이블 간격 확대(my-1.5→my-3), 테이블 행 패딩 확대(py-1→py-2), SVG 라벨 fill="#666" fontWeight=600, 가로 스크롤 제거 + % 기호 생략으로 전체 컬럼 표시, 줄무늬 행 유지.

### [개선] 히스토리 팝업 근본적 가독성 개선 (2026-03-13 16:36 KST)
- **변경 파일**: `MacroIndicators.tsx`, `ExchangeRate.tsx`
- **내용**: SVG 텍스트를 Tailwind fill 클래스에서 `fill="currentColor" opacity={0.6}`으로 변경 (oklch 호환), 폰트 크기 7→9, 테이블 폰트 10→11px, 가로 스크롤 + 날짜 열 sticky, 줄무늬 행 배경 추가.

### [개선] 거시지표 히스토리 텍스트 가독성 개선 (2026-03-13 16:23 KST)
- **변경 파일**: `frontend/src/components/MacroIndicators.tsx`
- **내용**: 차트 Y/X축 라벨, 테이블 헤더·날짜 텍스트 불투명도 상향으로 가독성 개선.

### [개선] 환율 히스토리 차트 여백 축소 및 텍스트 가독성 개선 (2026-03-13 16:17 KST)
- **변경 파일**: `frontend/src/components/ExchangeRate.tsx`
- **내용**: 차트 좌우 패딩 축소(PX 32→8), Y축 라벨 그래프 안쪽 배치, 차트/테이블 텍스트 불투명도 상향으로 가독성 개선.

### [개선] 환율 히스토리 테이블 가독성 개선 (2026-03-13 16:12 KST)
- **변경 파일**: `frontend/src/components/ExchangeRate.tsx`
- **내용**: 히스토리 테이블 셀에서 환율값과 변동폭을 2줄로 분리, 행 패딩 증가, 환율값 불투명도 향상으로 가독성 개선.

### [개선] 종합 탭 정렬 가중치 조정 (2026-03-13 16:10 KST)
- **변경 파일**: `frontend/src/App.tsx`
- **내용**: trading_fluc 모드 가중치를 tv:1.5/fluc:1.5(동등)에서 tv:5/fluc:1로 변경. 거래대금 순서가 지배적으로 유지되고 상승률은 최대 ±5위 미세 조정만 반영.

### [개선] 거래 이력 부족 시 안내 문구 표시 (2026-03-13 15:15 KST)
- **변경 파일**: `StockCard.tsx`
- **내용**: 스파크라인 데이터 2건 미만 시 "거래 이력 부족" 안내 텍스트 표시.

### [버그픽스] 신규 상장 종목 히스토리 데이터 누락 수정 (2026-03-13 15:14 KST)
- **변경 파일**: `modules/stock_history.py`
- **내용**: `get_recent_changes`에서 요청 일수(60일)보다 거래일이 적은 종목이 빈 배열을 반환하던 문제 수정. 가용 데이터만큼만 반환하도록 변경하여 신규 상장 종목도 스파크라인 표시 가능.

### [버그픽스] 컴팩트 모드 종목 행 정렬 수정 (2026-03-13 15:02 KST)
- **변경 파일**: `StockList.tsx`
- **내용**: 데이터 컬럼의 ml-auto 제거 및 VP 버튼 플레이스홀더 추가. 조건부 렌더링 컬럼 유무에 따라 가격/거래대금/거래량 정렬이 틀어지던 문제 해결.

### [개선] 일별 차트 X/Y축 라벨 상세화 (2026-03-13 14:34 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`
- **내용**: Y축 3개→5개 균등 분할, X축 3개→전체 라벨 표시로 일별 차트 가독성 개선.

### [설정] Refresh Stock Data 워크플로우 타임아웃 증가 (2026-03-13 14:29 KST)
- **변경 파일**: `.github/workflows/refresh-data.yml`
- **내용**: timeout-minutes 30→45로 증가. 데이터 수집 완료 후 빌드/배포 단계에서 타임아웃 발생하던 문제 해결.

### [개선] 거래원/매물대 데이터 없을 때 기본 접힘 처리 (2026-03-13 14:25 KST)
- **변경 파일**: `StockCard.tsx`
- **내용**: 거래원/매물대 섹션에 수집 데이터 없으면 기본 collapsed 상태로 변경. 헤더 행 중앙에 "데이터 수집 전" 안내 텍스트 표시, 내부 메시지 제거.

### [버그픽스] 장중 분봉 수집 시 미래 시간대 가짜 데이터 방지 (2026-03-13 10:29 KST)
- **변경 파일**: `modules/volume_profile.py`
- **내용**: `fetch_minute_candles` 시작 커서를 "150000" 고정에서 현재 KST 시각으로 변경. KIS API가 미래 시간대에 현재가를 채워 반환하여 30분 봉 등락률이 동일하게 나오던 문제 해결.

### [버그픽스] 스크롤 복귀 시 탭 영역 잘림 수정 (2026-03-13 10:24 KST)
- **변경 파일**: `App.tsx`, `Header.tsx`
- **내용**: 스크롤 후 헤더/탭 영역 재표시 시 TabBar가 모바일 2단 헤더 뒤에 가려지던 문제 수정. sticky bar top 값을 모바일 헤더 전체 높이(92px)에 맞추고, collapsible 영역을 즉시 전환(display none/block)으로 변경.

### [버그픽스] 장중 탭 미래 시각 봉 필터링 (2026-03-13 10:05 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`
- **내용**: 오늘 날짜의 장중 데이터에서 현재 시각 이후의 봉이 표시되던 문제 수정. KIS API가 미래 시간대 캔들도 반환하여 동일 가격이 반복 표시되던 현상 해결.

### [개선] 장중 차트 축 라벨 상세화 (2026-03-13 09:56 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`
- **내용**: Y축 3개→5개 균등 분할, X축 3개→정시(:00) 라벨 전체 표시로 차트 가독성 개선.

### [버그픽스] 장중 탭 초기 날짜를 오늘로 변경 (2026-03-13 09:54 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`
- **내용**: 장중 탭 초기 selectedDayIdx가 0(가장 오래된 날짜)이던 것을 오늘 날짜(KST) 기준으로 변경. 오늘 데이터 미수집 시 "데이터 없음" 표시, 좌우 화살표로 수집된 날짜 탐색 가능.

### [버그픽스] MemberChartPopup TS 빌드 에러 수정 (2026-03-13 09:20 KST)
- **변경 파일**: `MemberChartPopup.tsx`
- **내용**: useSwipeToDismiss 반환값 이름 수정(swipeRef→sheetRef, overlayRef→handleRef), 미사용 변수(formatQty, chartW) 제거. deploy-pages 빌드 실패 해소.

---

## 2026-03-12

### [기능] 거래원 바 차트 팝업 추가 (2026-03-12 23:44 KST)
- **변경 파일**: `MemberChartPopup.tsx`(신규), `StockCard.tsx`, `stock.ts`, `kis_rank.py`
- **내용**: 거래원 TOP5 영역 클릭 시 바 차트+상세 테이블 팝업 표시. 매도(파란)/매수(빨간) 바 차트, 수량 비율 막대바 포함 테이블. 백엔드에 total_sell_qty/total_buy_qty/acml_vol 필드 추가.

### [개선] 퀵네비 Pill 디자인 + 거시지표 최상단 이동 (2026-03-12 23:18 KST)
- **변경 파일**: `App.tsx`
- **내용**: 퀵네비를 Pill/Chip 스타일로 변경(rounded-full, shadow, border). 상승(↑) 초록, 하락(↓) 빨강, 일반 흰색 색상 코딩. 거시지표 버튼 클릭 시 최상단 스크롤 이동.

### [개선] TabBar 숨김 애니메이션 매끄럽게 개선 (2026-03-12 22:57 KST)
- **변경 파일**: `App.tsx`
- **내용**: max-height 방식에서 margin-top + ResizeObserver 방식으로 전환. 실제 콘텐츠 높이를 측정하여 margin-top 음수값으로 적용, 숨김 시 빈 공간 제거(height:0). extra `</div>` 태그 수정.

### [개선] TabBar 스크롤 시 숨김 + 퀵네비 sticky 유지 (2026-03-12 22:25 KST)
- **변경 파일**: `App.tsx`
- **내용**: 스크롤 다운 시 TabBar(탭+구성+등락률소스) 영역을 overflow-hidden + max-height:0으로 숨기고, 퀵네비만 sticky 유지. 스크롤 deadzone(8px) + 쿨다운(350ms)으로 떨림/피드백루프 방지.

### [버그픽스] 거시지표 다크모드 라벨 안 보임 수정 (2026-03-12 21:39 KST)
- **변경 파일**: `MacroIndicators.tsx`
- **내용**: 접힌 상태 거시지표 카드 배경색에 dark 변형 추가. bg-rose-100→dark:bg-rose-950 등. 다크모드에서 라벨(NQ, K200F 등)이 보이지 않던 문제 해소.

### [개선] 등락률 팝업 차트 Y축 이중 라벨 — 왼쪽 등락률/오른쪽 가격 (2026-03-12 21:32 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`
- **내용**: 일별/장중 차트 왼쪽 Y축에 등락률(%), 오른쪽 Y축에 가격(원) 표시. PAD.right 8→40 확장.

### [설정] Stop hook — task_history.md 업데이트 체크 자동화 (2026-03-12 21:21 KST)
- **변경 파일**: `.claude/hooks/check-task-history.sh`, `.claude/settings.local.json`
- **내용**: Stop hook 추가. 코드 파일 수정 후 task_history.md 미업데이트 시 exit 2로 차단하여 기록 강제. 감지 대상: frontend/src, modules, .github 하위 코드 파일.

### [버그픽스] 로그인 input iOS 자동 zoom-in 방지 (2026-03-12 20:55 KST)
- **변경 파일**: `AuthPage.tsx`
- **내용**: 이메일/비밀번호/가입코드 input에 `text-base`(16px) 적용. iOS Safari/WKWebView에서 font-size < 16px input focus 시 자동 zoom-in되는 현상 해소.

### [진단] 장중 데이터(intraday-history) 수집 안 됨 원인 확인 (2026-03-12 12:18 KST)
- **원인**: `collect-intraday-history.yml` timeout 10분 → 오늘 4회(09:30~12:00 KST) 모두 ~10m20s에 cancelled
- **상태**: da770be 커밋에서 20분으로 확장 완료. 12:00 실행은 구 버전 사용. 13:00 KST 실행부터 신 버전 적용 예정.

### [개선] 데이터 없는 섹션도 항상 표시 + "수집 전" 안내 문구 (2026-03-12 12:09 KST)
- **변경 파일**: `StockCard.tsx`, `PriceHistoryPopup.tsx`
- **내용**: 거래원/매물대/골든크로스/뉴스 섹션 — 데이터 없어도 섹션 표시 + "수집 전"/"뉴스 없음" 안내. 등락률 팝업 장중 탭 항상 표시 + 데이터 없으면 "(수집 전)" + 비활성.

### [개선] 등락률 팝업 그래프 확장 + 장중 탭 자동선택 + intraday 타임아웃 확장 (2026-03-12 12:04 KST)
- **변경 파일**: `PriceHistoryPopup.tsx`, `collect-intraday-history.yml`
- **내용**: 그래프 viewBox 300→360 확장. 장 시간(09:00~15:30)에 장중 탭 자동선택. Collect Intraday History timeout 10분→20분(매번 cancelled 해결).

### [개선] 플로팅 버튼 반투명 인라인 스타일 적용 (2026-03-12 11:53 KST)
- **변경 파일**: `App.tsx`
- **내용**: Tailwind 클래스 → 인라인 style로 변경. rgba(120,120,140,0.35) 배경 + backdropFilter/WebkitBackdropFilter 직접 지정. CSS purge 및 iOS Safari 호환 보장.

### [개선] 플로팅 버튼 반투명 효과 재수정 — slate-400/40 색상 틴트 적용 (2026-03-12 11:08 KST)
- **변경 파일**: `App.tsx`
- **내용**: bg-foreground/15(흰 배경에서 투명 안보임) → bg-slate-400/40으로 변경. 흰 배경 위에서도 확실히 반투명 회색으로 보이도록.

### [개선] 플로팅 버튼 반투명 효과 수정 (2026-03-12 11:05 KST)
- **커밋**: `f8dd7ec`
- **변경 파일**: `App.tsx`
- **내용**: bg-background/40(라이트모드에서 투명 안보임) → bg-foreground/15 + backdrop-blur-xl로 변경하여 반투명 글래스 효과 확실히 적용.

### [버그픽스] Collect Investor Data 타임아웃 15분→30분 확장 (2026-03-12 09:50 KST)
- **커밋**: `58e4cd3`
- **변경 파일**: `collect-investor-data.yml`
- **내용**: 데이터 수집 ~15분 소요로 빌드/배포 단계 도달 전 타임아웃. 30분으로 확장.

---

## 2026-03-11

### [개선] 헤더 2단 구조 — 모바일 ... 메뉴 제거, 모든 버튼 직접 노출 (2026-03-11 23:16 KST)
- **변경 파일**: `Header.tsx`
- **내용**: 모바일 2단 툴바 추가(1단: 로고+타임스탬프+새로고침, 2단: 예측/모의투자/히스토리+다크모드/컴팩트/로그아웃). MoreVertical 메뉴 완전 제거.

### [개선] 퀵네비 배경색 밝게 조정 + 컴팩트 모드 sticky 불투명 배경 (2026-03-11 23:11 KST)
- **커밋**: `9f43b2e`
- **변경 파일**: `App.tsx`, `StockList.tsx`
- **내용**: 퀵네비 slate-800→slate-500/90으로 밝게. 컴팩트 모드 sticky 종목명 영역 반투명→불투명 배경으로 가로 스크롤 시 겹침 수정.

### [버그픽스] 퀵네비 sticky 스크롤 시 콘텐츠 겹침 수정 (2026-03-11 23:07 KST)
- **커밋**: `ecd5612`
- **변경 파일**: `App.tsx`
- **내용**: sticky 컨테이너에 bg-background 추가하여 스크롤 시 뒤 콘텐츠 비침 방지.

### [개선] 퀵네비 어두운 배경으로 섹션 구분 강화 (2026-03-11 23:05 KST)
- **커밋**: `03922ed`
- **변경 파일**: `App.tsx`
- **내용**: bg-slate-800 어두운 배경 + slate-300 텍스트로 주변 섹션과 명확 구분.

### [개선] 퀵네비 flex-1 균등 분할 + 세로 구분선 (2026-03-11 23:02 KST)
- **커밋**: `04ef194`
- **변경 파일**: `App.tsx`
- **내용**: 버튼 flex-1 균등 분할로 가로 스크롤 완전 제거. border-r 세로 구분선으로 버튼 간 구분. 모바일 text-[11px].

### [개선] 퀵네비 한 줄 레이아웃 수정 (2026-03-11 22:58 KST)
- **커밋**: `1c53296`
- **변경 파일**: `App.tsx`
- **내용**: whitespace-nowrap + shrink-0으로 줄바꿈 완전 방지. overflow-x-auto 가로 스크롤 대비. 구분자 |→· 변경.

### [개선] 퀵네비 가독성 개선 및 섹션 구분 강화 (2026-03-11 22:51 KST)
- **커밋**: `840d4f6`
- **변경 파일**: `App.tsx`
- **내용**: 퀵네비 폰트 확대(11px→12px, font-medium), 배경 음영(bg-muted/60) + 상하 border + shadow-sm으로 주변 섹션과 명확 구분. 중앙 정렬.

### [개선] 모의투자 최고가 종가 대체 시 "(종가)" 라벨 표시 (2026-03-11 22:43 KST)
- **변경 파일**: `PaperTradingStockCard.tsx`
- **내용**: 최고가 시각이 없는 경우(종가 대체) "최고가(종가)" 형식으로 표시. 상세 확장 영역 고가 행에도 동일 적용.

### [버그픽스] 모의투자 최고가 매수 이전 시각 표시 수정 (2026-03-11 22:21 KST)
- **변경 파일**: `usePaperTradingData.ts`
- **내용**: 최고가 시각이 매수 시각 이전이면 종가로 대체하여 수익률 계산. leader_stocks 있는 경우 + 하위호환 경로 모두 적용.

### [개선] 예측이력 스냅샷 기반 뷰로 전환 (2026-03-11 22:02 KST)
- **변경 파일**: `useForecastSnapshots.ts`, `PredictionHistory.tsx`
- **내용**: 예측이력 DateGroup 펼침 시 최신 스냅샷 자동 선택하여 시점별 대장주만 표시. 시뮬레이션 뱃지 제거. 스냅샷 토글 해제 방지.

### [개선] 퀵네비 텍스트 링크화 및 거시지표 카드 설명 팝업 추가 (2026-03-11 17:49 KST)
- **변경 파일**: `App.tsx`, `MacroIndicators.tsx`
- **내용**: 퀵네비 칩→구분자(|) 기반 텍스트 링크로 변경하여 한 줄 표시. 거시지표 펼친 상태 카드 클릭 시 지표 설명 모달 팝업 추가(8개 지표).

### [개선] 거시지표 세로 2단 배치 및 퀵네비 칩 KOSPI/KOSDAQ 전체명 표시 (2026-03-11 17:42 KST)
- **커밋**: `b1db2a2`
- **변경 파일**: `MacroIndicators.tsx`, `App.tsx`
- **내용**: 거시지표 접힌 상태를 가로→세로 2단(이름/값) 배치로 변경하여 종목명 truncate 해소. 퀵네비 칩 라벨을 ↑KP→↑KOSPI 등 전체명으로 변경.

### [개선] 거시지표 한 줄 표시 및 퀵네비 칩 모바일 최적화 (2026-03-11 17:35 KST)
- **커밋**: `bc03f85`
- **변경 파일**: `MacroIndicators.tsx`, `App.tsx`
- **내용**: 거시지표 접힌 상태 grid-cols-4→flex 한 줄 배치. 퀵네비 칩 라벨 축약(↑KP/↓KQ 등), flex-wrap 적용, 가로스크롤 제거.

### [개선] 탭별 퀵네비 칩 동적 구성 및 탭 전환 시 스크롤 최상단 이동 (2026-03-11 17:30 KST)
- **커밋**: `e26e32c`
- **변경 파일**: `App.tsx`
- **내용**: 탭별로 퀵네비 칩을 동적 구성(composite/fluctuation: 상승/하락+KOSPI/KOSDAQ, trading_value/volume: KOSPI/KOSDAQ). 탭 전환 시 scrollTo top 추가. 각 탭 StockList에 sectionId 부여.

### [개선] 퀵네비 스크롤 타겟을 섹션별 KOSPI/KOSDAQ 단위로 세분화 (2026-03-11 17:20 KST)
- **커밋**: `aaa2927`
- **변경 파일**: `App.tsx`, `StockList.tsx`
- **내용**: StockList에 sectionId prop 추가. 퀵네비 칩을 거시지표/AI테마/상승KOSPI/상승KOSDAQ/하락KOSPI/하락KOSDAQ 6개로 변경.

### [개선] 섹션 퀵네비 스크롤 오프셋 동적 계산 및 MA상태 라벨 변경 (2026-03-11 17:10 KST)
- **커밋**: `ff91d36`
- **변경 파일**: `App.tsx`
- **내용**: sticky 영역 높이를 ref로 동적 측정하여 정확한 스크롤 위치 계산. "지수" 라벨 → "MA상태" 변경.

### [버그픽스] 로고/사이트명 클릭 시 데이터 재수집→페이지 새로고침으로 변경 (2026-03-11 17:03 KST)
- **커밋**: `e11575b`
- **변경 파일**: `Header.tsx`
- **내용**: 홈 페이지에서 로고 클릭 시 `onRefresh()`(API 재수집) 대신 `window.location.reload()` 호출하도록 수정.

### [버그픽스] Collect Paper Trading 타임아웃 10분→20분 확장 (2026-03-11 16:59 KST)
- **커밋**: `d16789e`
- **변경 파일**: `collect-paper-trading.yml`
- **원인**: 매물대 수집(`collect_volume_profile.py`) 포함 시 10분 초과로 cancelled 발생
- **내용**: timeout-minutes 10→20 확장

### [기능] 홈화면 섹션 퀵네비게이션 칩 바 추가 (2026-03-11 16:51 KST)
- **커밋**: `a8ba987`
- **변경 파일**: `App.tsx`
- **내용**: TabBar 하단에 거시지표/환율/지수/테마분석/종목 칩 버튼 추가. 클릭 시 해당 섹션으로 smooth scroll. 조건부 표시 + 모바일 가로 스크롤 대응.

### [설정] task_history 확인 규칙 보완 — 오늘자 이력 없을 시 직전 작업일 확인 (2026-03-11 16:38 KST)
- **변경 파일**: `CLAUDE.md`, 메모리
- **내용**: 오늘자 이력이 없으면 직전 작업일 이력을 확인하고 날짜+건수 표시하도록 규칙 추가.

### [개선] 거시지표 히스토리 범례 전체선택/해제 버튼 추가 (2026-03-11 16:33 KST)
- **커밋**: `c4ae71e`
- **변경 파일**: `MacroIndicators.tsx`
- **내용**: 히스토리 차트 범례에 "전체선택/전체해제" 토글 버튼 추가.

### [개선] 거시지표 히스토리 차트 가독성 개선 (2026-03-11 16:32 KST)
- **커밋**: `011bc25`
- **변경 파일**: `MacroIndicators.tsx`
- **내용**: 차트 영역 확장(W280→320, H120→140), 우측 여백 축소, Y축 소수점 2자리+중간값 라벨 추가, X축 세로 그리드선 추가, 데이터 영역 상하 5% 여백.

### [기능] 거시지표에 VIX, Fear & Greed Index 추가 (2026-03-11 16:29 KST)
- **커밋**: `b8a9f67`
- **변경 파일**: `collect_macro_indicators.py`, `MacroIndicators.tsx`
- **내용**: VIX(yfinance ^VIX), Fear & Greed(CNN graphdata API) 수집 추가. 프론트엔드 접힌 상태에서 VIX는 현재값, F&G는 점수(0~100) 표시. 특수 색상 처리.

### [개선] 거시지표 코스피200 선물/지수 라벨 구분 표시 (2026-03-11 15:51 KST)
- **커밋**: `53efecf`
- **변경 파일**: `MacroIndicators.tsx`
- **내용**: 선물 데이터일 때 "K200F", 지수 fallback일 때 "K200"으로 구분 표시. 접힌 상태 및 히스토리 테이블 모두 적용.

### [개선] Collect Investor Data에 환율 수집 추가 (2026-03-11 14:00 KST)
- **커밋**: `c7d20e6`
- **변경 파일**: `collect_investor_data.py`
- **내용**: ExchangeRateAPI 호출 추가. Refresh Stock Data 타임아웃 시에도 환율이 갱신되도록 이중화. 3일간 환율 미갱신 문제 해결.

### [개선] 컴팩트 모드 InvestorChartPopup props 누락 수정 (2026-03-11 13:55 KST)
- **커밋**: `832142c`
- **변경 파일**: `StockList.tsx`
- **내용**: CompactStockRow에 `investorEstimated`, `investorUpdatedAt` 전달 추가. InvestorChartPopup 팝업에서 D(당일) 수집 시점 표시가 컴팩트 모드에서도 정상 동작하도록 수정.

### [설정] task_history 확인 표시 규칙 추가 (2026-03-11 13:55 KST)
- **변경 파일**: `CLAUDE.md`, 메모리
- **내용**: context compacting/신규 세션 시 task_history 확인 후 "[task_history 확인 완료] 오늘자 N건 확인" 메시지를 반드시 사용자에게 표시하도록 규칙 추가.

### [버그픽스] 수집 스크립트 updated_at UTC→KST 보정 및 Refresh Data 타임아웃 30분 확장 (2026-03-11 13:50 KST)
- **커밋**: `10fa1bf`
- **변경 파일**: `collect_volume_profile.py`, `collect_intraday_history.py`, `refresh-data.yml`
- **내용**: datetime.now() → datetime.now(KST) 변경으로 GitHub Actions에서 KST 시각 기록. Refresh Data 워크플로우 타임아웃 20분→30분 확장 (매물대 수집 포함 시 초과 문제 해결).

### [기능] 수급 일봉 탭 D(당일) 수집 시점 표시 (2026-03-11 13:35 KST)
- **커밋**: `2b81f2f`
- **변경 파일**: `InvestorChartPopup.tsx`, `StockCard.tsx`
- **내용**: 일봉 차트 X축 및 테이블 D 라벨 우측에 수집 라운드(1차~5차/확정) 표시. investorUpdatedAt prop 전달 추가.

### [설정] 세션/컴팩팅 시 task_history 확인 규칙 추가 (2026-03-11 13:35 KST)
- **변경 파일**: `CLAUDE.md`, 메모리
- **내용**: 새 세션 또는 context compacting 발생 시 `docs/task_history.md` 오늘자 이력을 반드시 확인하도록 규칙 설정. 작업 연속성 최대화 목적.

### [설정] docs/research 폴더 생성 및 연구문서 관리 규칙 설정 (2026-03-11 12:30 KST)
- **변경 파일**: `CLAUDE.md`, `docs/research/`
- **내용**: `docs/research/` 폴더 신규 생성. 진단 보고서 이동 (`diagnostic-2026-03-11.md` → `2026-03-11-project-diagnostic.md`). 파일명 규칙: `YYYY-MM-DD-<단어1>-<단어2>.md`.

### [설정] task_history 포맷 변경 및 역순 정렬 적용 (2026-03-11 12:00 KST)
- **변경 파일**: `CLAUDE.md`, `docs/task_history.md`
- **내용**: 이력 항목 포맷을 `(YYYY-MM-DD HH:MM KST)`으로 변경. 최신 항목이 상단에 오도록 역순 정렬 적용.

### [설정] task_history 시각 기준 UTC → KST 변경 (2026-03-11 12:00 KST)
- **변경 파일**: `CLAUDE.md`, `docs/task_history.md`
- **내용**: 이력 시각 기준을 KST로 통일.

### [버그픽스] Theme Forecast Intraday 타임아웃 20분으로 재조정 (2026-03-11 11:29 KST)
- **커밋**: `be9c8a6`
- **변경 파일**: `theme-forecast-intraday.yml`
- **내용**: 로컬 테스트 결과 매물대 수집만 ~7.5분 소요 (150종목). Gemini forecast 합산 시 15분 초과 가능 → 20분으로 여유 확보.

### [원상복구] intraday 매물대 종목 제한 로직 제거 (2026-03-11 11:13 KST)
- **커밋**: `985ccf4`
- **변경 파일**: `collect_volume_profile.py`
- **내용**: criteria 점수 상위 80종목 제한 로직 제거. 전체 종목 수집으로 복원.

### [버그픽스] Theme Forecast Intraday 워크플로우 타임아웃 (2026-03-11 10:25 KST)
- **커밋**: `2d8d0d3`
- **변경 파일**: `theme-forecast-intraday.yml`, `collect_volume_profile.py`
- **수정 내용**: 워크플로우 타임아웃 10분 → 15분 증가, intraday criteria 80종목 제한 추가 (이후 원상복구됨)

### [설정] task_history.md 생성 및 CLAUDE.md 자동 기록 설정 (2026-03-11 10:25 KST)
- **파일**: `docs/task_history.md`, `CLAUDE.md`
- **내용**: 작업 이력 자동 기록 체계 수립.

### [진단] 프로젝트 전체 진단 보고서 작성 (2026-03-11 10:00 KST)
- **파일**: `docs/diagnostic-2026-03-11.md`
- **내용**: 백엔드/프론트엔드/인프라 3개 영역 병렬 진단. Critical 4건, High 10건, Medium 9건, Low 5건 도출.

### [기능] 매물대/골든크로스 섹션 수집시각 표시 (2026-03-11 09:30 KST)
- **커밋**: `468621a`
- **변경 파일**: `App.tsx`, `StockCard.tsx`, `StockList.tsx`
- **내용**: 매물대 섹션에 `volume-profile.json`의 `updated_at`, 골든크로스 섹션에 `latest.json`의 `timestamp`를 HH:MM 형식으로 표시.
