# 주가 계산기 (Paper Calculator) Design

작성일: 2026-05-15
관련 파일: `frontend/src/components/PortfolioPage.tsx`, 신규 `PaperCalcTab.tsx`

## 배경

사용자가 "이 가격에 사면 어떨까?"라는 가상 시뮬레이션을 빠르게 실험할 수 있는 기능. 실제 보유 데이터(Supabase `portfolio_holdings`)와는 분리된 일시적 계산 영역.

## 결정 사항 (브레인스토밍)

| 항목 | 결정 |
|---|---|
| 위치 | PortfolioPage 내 **별도 탭** ("내 보유" / "가상 계산기") |
| 저장 | `localStorage`로 누적 리스트 영속 (세션·새로고침 복구) |
| 종목 검색 | KIS API + 종목 마스터 (PortfolioPage 동일 패턴) |
| 현재가 | 종목 선택 시 1회 fetch + 수동 새로고침 버튼 |
| 종합 수익률 | 가중평균 (총 평가 ÷ 총 매수) |
| 1회성 지원 | "추가" 버튼 클릭 전까지 입력은 로컬 state만, 다른 종목 검색 시 자동 reset |

## 1. 데이터 모델 (TypeScript)

```ts
interface PaperCalcItem {
  id: string           // crypto.randomUUID()
  code: string
  name: string
  assumedPrice: number  // 가정 매수가
  quantity: number
  addedAt: string       // ISO timestamp
}
```

저장 위치: `localStorage.getItem(\`paper-calc-${user?.id ?? "anon"}\`)` JSON 배열.

## 2. 컴포넌트 구조

### 신규: `PaperCalcTab.tsx`
- props: 없음 (자체 state)
- state:
  - `items: PaperCalcItem[]` (localStorage 동기)
  - `livePrices: Record<string, KisStockPrice>` (현재가)
  - 입력 폼 state: `selectedStock`, `searchQuery`, `assumedPrice`, `quantity`
- 영역:
  - 입력 폼 (검색·자동완성·가격·수량·미리보기·추가)
  - 종합 수익률 카드 (items 있을 때)
  - 누적 리스트 (각 행 + 삭제 버튼)
  - "전체 지우기" 버튼

### 수정: `PortfolioPage.tsx`
- 탭 state 추가: `activeTab: "holdings" | "calc"`
- 탭 UI (헤더 영역에 토글)
- "holdings" 탭: 기존 보유 카드 영역
- "calc" 탭: `<PaperCalcTab />`

## 3. 입력 폼 동작

1. 종목 검색 input에 입력 → 마스터(`stock-master.json`) 매칭 자동완성
2. 결과 클릭 → `selectedStock` 설정 + `searchKisStock(code)`으로 현재가 fetch → `livePrices[code]`에 저장 + 기본 `assumedPrice` = 현재가
3. 사용자가 `assumedPrice`/`quantity` 수정 가능
4. 입력 동안 실시간 미리보기:
   ```
   매수: assumedPrice × quantity
   평가: currentPrice × quantity
   손익: (currentPrice - assumedPrice) × quantity
   수익률: (currentPrice / assumedPrice - 1) × 100
   ```
5. "추가" 클릭 → items에 push + localStorage 동기 + 입력 폼 reset
6. 다른 종목 검색 시작 시 입력 폼 자동 reset (= 1회성)

## 4. 종합 수익률 카드

```
N 종목 · 매수 X원 · 평가 Y원 · 손익 +Z원 · +A%
```

- 총 매수 = Σ(assumedPrice × quantity)
- 총 평가 = Σ(livePrice × quantity)
- 손익 = 총 평가 - 총 매수
- 수익률 = (손익 / 총 매수) × 100 (가중평균)
- livePrice 없는 종목은 평가에서 제외 (refresh 안내)

## 5. 누적 리스트 행

각 행:
- 종목명 + 코드
- 매수가 × 수량 = 매수금액
- 현재가 (작게)
- 수익률 (한국 색상 관습: 양수=red, 음수=blue)
- ✕ 삭제 버튼

## 6. 새로고침

헤더에 "새로고침" 버튼 (PortfolioPage 동일 패턴):
- 모든 items의 code → `fetchKisPrices(codes)` → `livePrices` 갱신
- 로딩 spinner 표시 중 disabled

## 7. UI/UX 세부

- 색상: 한국 증시 관습 (양수 red, 음수 blue)
- 폰트: Pretendard (프로젝트 기본)
- 입력: iOS zoom 방지 — input은 `text-base sm:text-sm` 패턴
- 모바일: PortfolioPage와 동일한 반응형 패턴
- 빈 상태: "종목을 추가하면 여기에 표시됩니다" 안내

## 8. 작업 범위

**포함**:
- PaperCalcTab 컴포넌트 신규
- PortfolioPage 탭 분기
- localStorage 저장/복구
- KIS 검색 + 현재가 fetch + 수동 새로고침
- 종합 수익률 + 누적 리스트 + 행별 삭제 + 전체 지우기

**제외 (YAGNI)**:
- Supabase 영구 저장 (의도적 — 일시 시뮬)
- 자동 갱신 (수동만)
- 정렬·필터 옵션
- 수익률 차트
- 추가/삭제 history undo
- 종목별 시나리오 그룹화

## 9. 검증

- `npx tsc --noEmit` PASS
- `npm run build` PASS
- 수동 시나리오:
  1. 빈 상태 → 안내 메시지
  2. 종목 검색 → 자동완성 → 선택 → 현재가 표시 → 매수가/수량 입력 → 미리보기 즉시 갱신
  3. "추가" → 누적 리스트 + 종합 카드 갱신
  4. 다른 종목 검색 시작 → 이전 입력 사라짐 (1회성)
  5. 새로고침 → 현재가 갱신 → 수익률 재계산
  6. 행 X 삭제 → 종합 갱신
  7. 전체 지우기 → 누적 리스트 비움
  8. 페이지 새로고침 → localStorage 복구 → 누적 리스트 유지
  9. "내 보유" 탭으로 전환 → 기존 포트폴리오 정상 표시
