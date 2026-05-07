# 물타기 결과 → 포트폴리오 반영 (Design)

작성일: 2026-05-07
저자: Claude (brainstorming skill)
관련 컴포넌트: `AveragingDownCalc.tsx`, `AveragingDownSheet.tsx`, `PortfolioPage.tsx`

## 배경

현재 물타기 계산기(`AveragingDownCalc`, `AveragingDownSheet`)는 시뮬레이션만 제공한다. 사용자가 실제로 매수한 결과를 포트폴리오(`portfolio_holdings`)에 반영하려면 카드 편집(`saveEdit`)으로 평단·수량을 수동 재계산하여 입력해야 한다. 마찰이 크고 매수 이력도 남지 않는다.

이 설계는 물타기 시뮬 결과를 한 클릭으로 포트폴리오에 반영하고, 매수 이력을 영구 보존하며, 카드 확장 시 이력을 조회하는 기능을 추가한다.

## 결정 사항 요약 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 반영 트리거 위치 | 단일 계산기(`AveragingDownCalc`) + 일괄 시트(`AveragingDownSheet`) 모두 |
| 반영 모드 | basic + multi (target 제외 — 역산 시뮬은 매수 액션과 매핑 모호) |
| 확인 절차 | `window.confirm()` 다이얼로그 1회 |
| 이력 보존 | 새 테이블 `portfolio_transactions` (audit log) |
| 동기화 정책 | transactions = 이력, holdings = 현재 상태 (둘 다 갱신) |
| 이력 조회 UI | holding 카드 확장 시 "매수 이력" 섹션 표시 |

## 1. 데이터 모델

### 1.1 신규 테이블: `portfolio_transactions`

```sql
CREATE TABLE portfolio_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  holding_id  uuid NOT NULL REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  price       integer NOT NULL CHECK (price > 0),    -- 매수가 (원)
  quantity    integer NOT NULL CHECK (quantity > 0), -- 매수 수량 (주)
  executed_at timestamptz NOT NULL DEFAULT now(),    -- 매수 시점 (현재는 반영 시점 = now)
  note        text,                                  -- 모드 표기 ("basic", "multi step 1/3" 등)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_transactions_holding
  ON portfolio_transactions(holding_id, executed_at DESC);

-- RLS (portfolio_holdings 패턴 동일)
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user own transactions select"
  ON portfolio_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user own transactions insert"
  ON portfolio_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user own transactions delete"
  ON portfolio_transactions FOR DELETE
  USING (auth.uid() = user_id);
```

**ON DELETE CASCADE**: holding 삭제 시 이력도 함께 삭제. 종목 자체를 지웠다면 이력도 무의미.

**UPDATE 정책 없음**: 이력은 불변 (audit log 성격). 잘못 입력 시 DELETE 후 재입력.

### 1.2 TypeScript 타입 (`frontend/src/types/portfolio.ts` 또는 inline)

```ts
export interface Transaction {
  id: string
  holdingId: string
  code: string
  name: string
  price: number
  quantity: number
  executedAt: string  // ISO timestamp
  note: string | null
}

// 반영 직전 형태 (id 없음, holding_id는 반영 시점에 결정)
export interface NewTransaction {
  price: number
  quantity: number
  note: string  // "basic" | "multi step N/M"
}
```

### 1.3 `HoldingInput`에 holding id 필드 추가

기존 `HoldingInput` (in `AveragingDownCalc.tsx`)에 `id` 필드 추가:

```ts
export interface HoldingInput {
  id: string         // 신규 — Supabase portfolio_holdings.id (반영 시 holding_id로 사용)
  code: string
  name: string
  avgPrice: number
  quantity: number
  currentPrice: number | null
}
```

`HoldingInput`은 `AveragingDownCalc.tsx`와 `AveragingDownSheet.tsx`에서만 import. 외부 사용처는 PortfolioPage 1곳. 기존 호출부에서 `id: h.id` 추가하면 호환.

## 2. 데이터 흐름

```
[사용자 클릭 "포트폴리오에 반영"]
  ↓
[window.confirm("평단 X→Y, 수량 A→B 변경. 계속?")]
  ↓ OK
[applyTransactions(holdingId, newTxs[])]
  ↓
[1. supabase.transactions.insert(newTxs with holding_id, user_id)]
  ↓ 성공
[2. supabase.holdings.update({ avg_price, quantity })]
  ↓ 성공
[3. setHoldings(prev => map with new avg/qty)]
[4. setTransactions(holdingId, [...new, ...prev])]
[5. AveragingDownCalc/Sheet 닫기 또는 입력 초기화]
```

### 2.1 실패 시 롤백

| 단계 | 실패 시 |
|---|---|
| 1 (transactions insert) | alert("이력 기록 실패"). holdings 변경 안 함. 종료. |
| 2 (holdings update) | 1번 transactions DELETE (best-effort) + alert("포트폴리오 갱신 실패"). 사용자에 재시도 안내. |

Supabase의 RPC로 한 번에 처리하면 atomic 보장 가능하지만, 본 작업은 단순화를 위해 클라이언트 측 try/catch + best-effort rollback 채택. 두 작업은 RLS 통과한다면 거의 항상 성공함.

### 2.2 holdings 갱신 값 산정

- **basic 모드**: 단일 매수 (price, quantity) 1건
  - 새 totalCost = old.avgPrice × old.quantity + price × quantity
  - 새 totalQty = old.quantity + quantity
  - 새 avgPrice = round(totalCost / totalQty)
- **multi 모드**: 단계별 (price_i, quantity_i) N건
  - 누적 totalCost = old.avgPrice × old.quantity + Σ(price_i × quantity_i)
  - 누적 totalQty = old.quantity + Σ(quantity_i)
  - 새 avgPrice = round(totalCost / totalQty)

기존 `calcBasic` / `calcMulti` 로직과 동일. 재사용.

## 3. UI 변경

### 3.1 `AveragingDownCalc.tsx` (단일 종목 인라인)

**위치**: PortfolioPage 카드 확장 영역 안 (현재 `calcOpenId` 토글로 표시)

**추가**:
- basic 모드 결과 카드 우측 또는 하단에 "포트폴리오에 반영" 버튼
- multi 모드 결과 테이블 하단에 "전체 단계 반영" 버튼
- target 모드: 변경 없음 (반영 버튼 없음)

**Props 확장**:
```ts
interface AveragingDownCalcProps {
  holding: HoldingInput
  onApply?: (txs: NewTransaction[]) => Promise<void>  // 신규
}
```

`onApply` 미제공 시 반영 버튼 비표시 (예: 다른 컨텍스트에서 사용 시 호환).

### 3.2 `AveragingDownSheet.tsx` (일괄 시트)

**위치**: 모달 시트로 표시 (현재 `showAvgSheet` 토글)

**추가**:
- 각 종목 카드의 결과 영역에 "반영" 버튼 (단일과 동일 동작)
- 시트 단위 일괄 반영은 **본 작업 범위 외** (각 종목 개별 반영으로 단순화. 사용자가 한꺼번에 반영하려면 종목별 클릭. YAGNI)

**Props 확장**:
```ts
interface AveragingDownSheetProps {
  holdings: HoldingInput[]
  onClose: () => void
  onApply?: (holdingId: string, txs: NewTransaction[]) => Promise<void>  // 신규
}
```

`StockEntry`에 `holdingId` 필드 추가 (현재 code만 있어 holding_id 매핑 필요).

### 3.3 `PortfolioPage.tsx`

**추가 state**:
```ts
const [transactionsByHolding, setTransactionsByHolding] = useState<Record<string, Transaction[]>>({})
const [txLoadingHoldingId, setTxLoadingHoldingId] = useState<string | null>(null)
```

**추가 callback**:
```ts
const applyTransactions = useCallback(async (holdingId: string, newTxs: NewTransaction[]) => {
  // 1. confirm 다이얼로그
  // 2. supabase insert + update
  // 3. state 갱신 (holdings + transactionsByHolding)
}, [...])

const fetchTransactionsForHolding = useCallback(async (holdingId: string) => {
  // expand 시 lazy fetch
}, [...])
```

**props 전달**:
- `<AveragingDownCalc onApply={txs => applyTransactions(h.id, txs)} ... />`
- `<AveragingDownSheet onApply={applyTransactions} ... />`

**카드 확장 영역 추가** (현재 `isExpanded && (...)` 안):
```tsx
<DetailRow label="매수 이력" icon={<ListIcon />}>
  {(transactionsByHolding[h.id] ?? []).length === 0 ? (
    <span className="text-muted-foreground text-xs">추가 매수 이력 없음</span>
  ) : (
    <ul className="space-y-1 text-xs">
      {transactionsByHolding[h.id].map(tx => (
        <li key={tx.id} className="flex justify-between">
          <span>{formatDate(tx.executedAt)}</span>
          <span className="tabular-nums">
            {formatPrice(tx.price)}원 × {tx.quantity}주
            <span className="text-muted-foreground/70 ml-1">({tx.note})</span>
          </span>
        </li>
      ))}
    </ul>
  )}
</DetailRow>
```

**Lazy load 트리거**: `setExpandedId(id)` 시 `fetchTransactionsForHolding(id)` 호출. 이미 fetch한 종목은 재fetch 안 함 (캐시 비교).

## 4. 확인 다이얼로그

`window.confirm()` 사용. 메시지 형식:

```
평균단가 X원 → Y원
수량 A주 → B주

매수 이력에 추가하고 포트폴리오를 갱신합니다. 계속할까요?
```

승인 시 진행, 취소 시 변경 없음.

## 5. 에러 처리

- transactions insert 실패: `alert(\`이력 기록 실패: ${error.message}\`)`. holdings 변경 안 함.
- holdings update 실패: transactions delete (best-effort) + `alert(\`포트폴리오 갱신 실패: ${error.message}\`)`.
- 네트워크 timeout: Supabase SDK 기본 timeout 사용. 별도 처리 없음.
- transactions fetch 실패 (이력 조회): 에러 표시 대신 "이력을 불러오지 못했습니다" 텍스트.

## 6. 테스트 / 검증

### 6.1 단위 테스트
- 본 작업은 모두 frontend (TypeScript). 자동 단위 테스트 추가 안 함 (기존 프로젝트 패턴).

### 6.2 정적 검증
- `npx tsc --noEmit` PASS
- `npm run build` PASS

### 6.3 수동 검증 (dev 서버)
1. **basic 단일 반영**: AveragingDownCalc(basic) → 가격·수량 입력 → 반영 → confirm 승인 → holdings 평단·수량 갱신 + 카드 확장 시 이력 1건
2. **basic 단일 취소**: confirm 취소 → 변경 없음
3. **multi 단일 반영**: AveragingDownCalc(multi) → 3단계 입력 → 반영 → 이력 3건 (각 step note)
4. **시트에서 종목별 반영**: AveragingDownSheet → 종목 A에 입력 → 반영 → A만 갱신
5. **이력 표시**: 카드 확장 → 이력 시간 역순 표시
6. **이력 lazy load**: 미확장 카드는 fetch 안 함 (네트워크 탭 검증)
7. **종목 삭제 시 cascade**: 종목 삭제 후 직접 SQL로 transactions 0건 확인
8. **에러 케이스**: 네트워크 끊김 상태에서 반영 시도 → alert + state 변경 없음

### 6.4 Supabase 마이그레이션
- `docs/sql/portfolio_transactions.sql` 추가 (또는 직접 Supabase SQL Editor 실행)
- 운영 적용 시 사용자가 직접 실행

## 7. 작업 범위 명시

**포함**:
- DB 테이블 신규 생성 (SQL 파일 + 직접 실행 안내)
- TypeScript 타입 추가
- AveragingDownCalc / AveragingDownSheet props 확장
- PortfolioPage state·callback·UI 확장
- 카드 확장 영역에 이력 섹션 추가

**제외 (YAGNI)**:
- 시트 단위 일괄 반영 (각 종목 개별 반영으로 충분)
- target 모드 반영 (역산 시뮬은 매수 액션과 매핑 모호)
- 이력 항목 수정 / 삭제 UI (필요 시 SQL 직접 또는 후속 작업)
- 매수 시점 사용자 입력 (`executed_at` 자동 = now)
- 매수 메모 사용자 입력 (`note`는 모드 표기로 자동 채움)
- 일괄 반영 시 race condition 처리 (각 반영은 동기 순차 처리)

## 8. 영향 평가

- **DB**: 1 테이블 신설. 기존 데이터 영향 없음.
- **기존 코드**:
  - `AveragingDownCalc`: prop 추가 (optional). 기존 호출 호환.
  - `AveragingDownSheet`: prop 추가 (optional) + StockEntry에 holdingId 필드. 기존 호출 호환 가능 여부 확인 필요 (PortfolioPage에서만 호출되므로 안전).
  - `PortfolioPage`: state/callback 추가, expand 영역 한 섹션 추가. 기존 동작 무영향.
- **워크플로**: 영향 없음.
- **GitHub Pages 배포**: 코드 변경 후 push 시 자동 트리거.

## 9. 마이그레이션 / 출시 순서

1. `docs/sql/portfolio_transactions.sql` 작성 + 사용자가 Supabase SQL Editor에서 실행
2. 코드 변경 (TypeScript) + 빌드·타입 체크
3. 로컬 dev 서버에서 수동 검증 (위 6.3 시나리오)
4. 커밋 + push → GitHub Pages 자동 배포

---

## 부록 A — note 필드 형식 명시

| 모드 | note |
|---|---|
| basic 단일 매수 | `"basic"` |
| multi 1단계 (총 N단계) | `"multi step 1/N"` |
| multi 2단계 | `"multi step 2/N"` |
| ... | ... |

향후 manual_adjust, sell 같은 type 추가 시 별도 컬럼 신설 또는 note prefix 활용 가능.
