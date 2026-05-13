# 거래량 그래프에 장중 탭 추가 (Design)

작성일: 2026-05-13
관련 컴포넌트: `TradingChartPopup.tsx`, `StockCard.tsx`

## 배경

`InvestorChartPopup`(수급 그래프)에는 장중 탭이 있어 30분 스냅샷 누적 추이를 볼 수 있다. 반면 `TradingChartPopup`(거래량/거래대금 그래프)은 일별 D-10~D 라인 차트만 있어 **장중 시간대별 거래 강도**를 확인할 수 없다.

본 작업은 `TradingChartPopup`에 장중 탭을 추가하여 오늘자 30분/1시간 슬롯별 거래량·거래대금 추이를 표시한다.

## 결정 사항 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 표시 방식 | **슬롯별 막대** (옵션 B) — 누적 라인보다 시간대별 강도 식별 우수 |
| 표시 데이터 | **거래대금 + 거래량 둘 다** (일별 탭과 일관) |
| 그래뉼 토글 | **30분 / 1시간** (PriceHistoryPopup 패턴) |
| 일자 네비게이션 | **오늘만** (수급 탭과 동일 정책. 다른 일자 보기는 일별 탭 활용) |
| 기본 탭 선택 | KST 09:00~15:30 (장중)에는 장중 탭, 그 외에는 일별 탭 (InvestorChartPopup과 동일 로직) |
| 장중 데이터 없을 때 | 장중 탭 비활성화 (회색 + cursor-not-allowed). PriceHistoryPopup 패턴 |

## 1. 데이터 소스

`frontend/public/data/intraday-history.json`의 `IntradayDay`:
```ts
interface IntradayDay {
  date: string
  open: number
  prev_close: number
  intervals_30m: IntradayInterval[]
  intervals_60m: IntradayInterval[]
}
interface IntradayInterval {
  time: string
  close: number
  high: number
  low: number
  change_rate: number
  volume: number
}
```

**문제**: `IntradayInterval`에는 `volume`만 있고 `trading_value`(거래대금)는 없다.

**채택 (사용자 요청 — 정확값)**: 백엔드 데이터 모델 확장.

KIS `inquire-time-itemchartprice`(FHKST03010200) output2에 **`acml_tr_pbmn`(누적 거래대금)** 필드 존재. **분봉별 거래대금 = 현재 분봉의 acml_tr_pbmn - 직전 분봉의 acml_tr_pbmn** 차분으로 정확값 계산.

구현:
- `volume_profile.py:fetch_minute_candles`: 각 candle에 `acml_tr_pbmn` 필드 추가
- `intraday_history.py:aggregate_minute_candles`: 시간순 정렬 후 차분으로 분봉별 trading_value 산정, 30분 그룹 sum
- 첫 분봉 (acml=N이지만 이전 분봉이 없는 케이스): acml 자체를 분봉 거래대금으로 사용 (장 시작 0부터의 누적)
- `IntradayInterval`에 `trading_value` 필드 추가
- 재수집 필요: 워크플로(`collect-intraday-history.yml`) 다음 실행 시 자동 적용. 또는 로컬 `python collect_intraday_history.py` 즉시 실행.

## 2. UI 변경

### `TradingChartPopup.tsx`

**Props 확장**:
```tsx
interface TradingChartPopupProps {
  stockName: string
  currentTradingValue?: number
  currentVolume: number
  changes: HistoryChange[]
  intradayDays?: IntradayDay[]   // 신규
  onClose: () => void
}
```

**State 추가**:
```tsx
const [activeTab, setActiveTab] = useState<"daily" | "intraday">(/* 시간 기반 */)
const [interval, setInterval] = useState<"30m" | "60m">("30m")
```

**탭 UI** (PriceHistoryPopup 패턴):
- "일별" / "장중" 토글 버튼 (장중 데이터 없으면 비활성)
- 장중 탭 안: 30분/1시간 토글

**장중 차트** (옵션 B — 슬롯별 막대):
- X축: 시간 라벨 (09:30, 10:00, ..., 15:30)
- 막대 2종 (slot당 2개 또는 stacked):
  - 거래대금 (color: amber, 일별 탭의 sparkline 색상 따름)
  - 거래량 (color: indigo, 동일)
- 동일 X 슬롯에 두 막대 (slot별 좌우 배치 또는 sub-pixel offset)
- Y축은 거래대금·거래량 각각 다른 스케일 → **이중 Y축** 또는 **두 미니 차트 stacked**

**시각화 패턴 결정 (구현 시 세부)**:
- (i) 한 SVG, 이중 Y축 (좌: 거래대금, 우: 거래량) — 정보 밀도 ↑, 시각 복잡
- (ii) 두 개의 mini 차트 vertical stack — 단순, 각자 비교 명확

→ **(ii) 두 mini 차트 stack** 채택. 일별 탭의 두 라인(라인·점)과 일관성 ↓이나 정보 명료성 ↑.

### `StockCard.tsx`

```tsx
<TradingChartPopup
  ...
  intradayDays={intradayDays}      // 신규: 이미 component prop으로 보유
  onClose={...}
/>
```

## 3. 일별 탭은 그대로

본 작업은 장중 탭 신규 추가만. 일별 탭의 기존 구조(D-10~D 라인 + 점)는 변경하지 않음.

## 4. 시각·디자인 가이드

- 막대 색상:
  - 거래대금: `bg-amber-500` (일별 탭 sparkline 색상 일관)
  - 거래량: `bg-indigo-500` (동일)
- 막대 폭: 슬롯 폭의 60~70% (그리드 라인 사이 여백 확보)
- 막대 max 높이: 차트 영역의 90%
- X축 라벨: 정시("09:00", "10:00", ...)만 표시 (PriceHistoryPopup 패턴)
- Y축: 우측에 max 값 표시 (formatTradingValue / formatVolume)
- 빈 슬롯(현재 시각 이후): 막대 미표시
- 0거래량 슬롯: 막대 미표시 (장 마감 후 시간외 슬롯 등)

## 5. 빈 데이터 / Edge Case

- 오늘 장중 데이터 없음 → 장중 탭 비활성 표시 ("(수집 전)")
- 종목별 IntradayDay에 오늘 entry 없음 → 동일 처리
- intervals_30m 비어있음 → "데이터 없음" 표시 (안전망)
- 모든 슬롯의 volume = 0 → "거래 없음" 표시

## 6. 작업 범위 (YAGNI)

**포함**:
- TradingChartPopup props 확장 + 장중 탭 UI + 막대 차트
- 30m/1h 토글
- StockCard에 intradayDays prop 전달
- 기본 탭 선택 로직 (장중 시간대 → intraday)

**제외**:
- 거래대금 정확값 (백엔드 데이터 모델 확장)
- 일자 네비게이션 (오늘만)
- 일별 탭 구조 변경
- 이중 Y축 (mini chart stack으로 대체)

## 7. 검증

- `npx tsc --noEmit` PASS
- `npm run build` PASS
- 수동 시나리오:
  1. 장중 시간대(09:00~15:30) StockCard의 sparkline 클릭 → 장중 탭 기본 표시
  2. 막대 차트 표시 (거래대금 + 거래량)
  3. 30m / 1h 토글 전환
  4. 장 마감 후 → 일별 탭 기본
  5. 장중 데이터 없는 종목 → 장중 탭 비활성

## 8. 영향 평가

- `TradingChartPopup.tsx`: ~100~120줄 추가
- `StockCard.tsx`: 1~2줄 추가 (prop 전달)
- 데이터 / 백엔드 / 워크플로 영향 없음
- 기존 일별 탭·다른 컴포넌트 영향 없음
