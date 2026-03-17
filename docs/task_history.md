# Task History

작업 이력을 시간순(최신 상단)으로 기록합니다. (KST 기준)

---

## 2026-03-17

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
