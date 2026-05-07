# Portfolio Averaging Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 물타기 계산 결과를 한 클릭으로 포트폴리오에 반영하고 매수 이력을 보존·조회하는 기능을 추가한다.

**Architecture:** Supabase에 `portfolio_transactions` 테이블 신설(audit log). `AveragingDownCalc`/`AveragingDownSheet`에 `onApply` prop을 추가하여 반영 버튼을 노출하고, `PortfolioPage`가 confirm 다이얼로그 → transactions insert → holdings update → state 갱신을 책임진다. holding 카드 확장 시 transactions를 lazy fetch하여 이력 리스트를 표시한다.

**Tech Stack:** React 18 + TypeScript, Tailwind, Vite 6, Supabase (PostgREST), shadcn/ui, lucide-react.

---

## Spec Reference

`docs/superpowers/specs/2026-05-07-portfolio-averaging-apply-design.md`

## File Structure

| 분류 | 경로 | 책임 |
|---|---|---|
| Create | `docs/sql/portfolio_transactions.sql` | DB 마이그레이션 (사용자가 Supabase에서 실행) |
| Modify | `frontend/src/components/AveragingDownCalc.tsx` | `HoldingInput.id` 추가, `Transaction`/`NewTransaction` export, `onApply` prop, basic·multi 반영 버튼 |
| Modify | `frontend/src/components/AveragingDownSheet.tsx` | `onApply` prop, 종목별 반영 버튼 |
| Modify | `frontend/src/components/PortfolioPage.tsx` | `transactionsByHolding` state, `applyTransactions`/`fetchTransactionsForHolding` callbacks, `onApply` 전달, holding `id` 전달, 카드 확장 영역에 매수 이력 섹션 |

테스트 인프라: 본 프로젝트 frontend에는 vitest/jest 미설치. 자동 단위 테스트 추가 안 함 (기존 패턴 유지). 검증은 **`npx tsc --noEmit`** + **`npm run build`** + **dev 서버 수동 시나리오**.

---

## Task 1: DB 마이그레이션 SQL 작성

**Files:**
- Create: `docs/sql/portfolio_transactions.sql`

- [ ] **Step 1: SQL 파일 작성**

```sql
-- portfolio_transactions: 매수 이력 audit log
-- 2026-05-07 — 물타기 결과 포트폴리오 반영 기능 도입
-- holding 삭제 시 cascade. UPDATE 정책 없음(이력 불변).

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  holding_id  uuid NOT NULL REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  price       integer NOT NULL CHECK (price > 0),
  quantity    integer NOT NULL CHECK (quantity > 0),
  executed_at timestamptz NOT NULL DEFAULT now(),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_holding
  ON portfolio_transactions(holding_id, executed_at DESC);

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

- [ ] **Step 2: 사용자에게 SQL 실행 안내**

다음 메시지를 사용자에게 전달:
> Supabase Dashboard → SQL Editor에서 `docs/sql/portfolio_transactions.sql`의 내용을 복사·실행해 주세요. 실행 후 다음 단계 진행 가능합니다.

사용자 확인 후 다음 단계.

- [ ] **Step 3: 커밋**

```bash
git add -f docs/sql/portfolio_transactions.sql
git commit -m "feat(db): portfolio_transactions 테이블 마이그레이션 SQL"
```

---

## Task 2: TypeScript 타입 확장

**Files:**
- Modify: `frontend/src/components/AveragingDownCalc.tsx` (라인 7-13: `HoldingInput`)

- [ ] **Step 1: `HoldingInput`에 `id` 필드 추가 + Transaction/NewTransaction 타입 export**

`frontend/src/components/AveragingDownCalc.tsx`의 `HoldingInput` interface 교체:

```ts
export interface HoldingInput {
  id: string
  code: string
  name: string
  avgPrice: number
  quantity: number
  currentPrice: number | null
}

export interface Transaction {
  id: string
  holdingId: string
  code: string
  name: string
  price: number
  quantity: number
  executedAt: string
  note: string | null
}

export interface NewTransaction {
  price: number
  quantity: number
  note: string
}
```

- [ ] **Step 2: PortfolioPage 호출부에 `id` 추가**

`frontend/src/components/PortfolioPage.tsx` 라인 970-978 변경:

```tsx
{calcOpenId === h.id && (
  <AveragingDownCalc
    holding={{
      id: h.id,
      code: h.code,
      name: h.name,
      avgPrice: h.avgPrice,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
    }}
  />
)}
```

라인 988-998 변경:

```tsx
{showAvgSheet && (
  <AveragingDownSheet
    holdings={enrichedHoldings.filter(h => checkedIds.has(h.id)).map(h => ({
      id: h.id,
      code: h.code,
      name: h.name,
      avgPrice: h.avgPrice,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
    }))}
    onClose={() => setShowAvgSheet(false)}
  />
)}
```

- [ ] **Step 3: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (출력 없음)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/AveragingDownCalc.tsx frontend/src/components/PortfolioPage.tsx
git commit -m "feat(portfolio): HoldingInput.id + Transaction 타입 추가"
```

---

## Task 3: PortfolioPage Supabase 호출 함수 추가

**Files:**
- Modify: `frontend/src/components/PortfolioPage.tsx`

- [ ] **Step 1: import에 `Transaction`/`NewTransaction` 추가**

기존 line 16:
```tsx
import { AveragingDownCalc } from "./AveragingDownCalc"
```

다음으로 변경:
```tsx
import { AveragingDownCalc, type NewTransaction, type Transaction } from "./AveragingDownCalc"
```

- [ ] **Step 2: state 추가**

`useState<Set<string>>(new Set())` 직후(라인 116 부근) 다음 추가:

```tsx
const [transactionsByHolding, setTransactionsByHolding] = useState<Record<string, Transaction[]>>({})
```

- [ ] **Step 3: `applyTransactions` callback 추가**

`saveEdit` callback 직후(라인 363 부근) 다음 추가:

```tsx
const applyTransactions = useCallback(async (holdingId: string, newTxs: NewTransaction[]) => {
  if (!user) return
  const holding = holdings.find(h => h.id === holdingId)
  if (!holding) return
  if (newTxs.length === 0) return

  // 새 평단·수량 계산
  const addCost = newTxs.reduce((sum, t) => sum + t.price * t.quantity, 0)
  const addQty = newTxs.reduce((sum, t) => sum + t.quantity, 0)
  const totalCost = holding.avgPrice * holding.quantity + addCost
  const totalQty = holding.quantity + addQty
  const newAvg = Math.round(totalCost / totalQty)

  const ok = window.confirm(
    `평균단가 ${formatPrice(holding.avgPrice)}원 → ${formatPrice(newAvg)}원\n` +
    `수량 ${holding.quantity.toLocaleString()}주 → ${totalQty.toLocaleString()}주\n\n` +
    `매수 이력에 추가하고 포트폴리오를 갱신합니다. 계속할까요?`
  )
  if (!ok) return

  // 1. transactions insert
  const rows = newTxs.map(t => ({
    user_id: user.id,
    holding_id: holdingId,
    code: holding.code,
    name: holding.name,
    price: t.price,
    quantity: t.quantity,
    note: t.note,
  }))
  const { data: inserted, error: insertErr } = await supabase
    .from("portfolio_transactions")
    .insert(rows)
    .select()
  if (insertErr || !inserted) {
    alert(`이력 기록 실패: ${insertErr?.message ?? "unknown"}`)
    return
  }

  // 2. holdings update
  const { error: updateErr } = await supabase
    .from("portfolio_holdings")
    .update({ avg_price: newAvg, quantity: totalQty, updated_at: new Date().toISOString() })
    .eq("id", holdingId)

  if (updateErr) {
    // best-effort rollback
    const ids = inserted.map((r: { id: string }) => r.id)
    await supabase.from("portfolio_transactions").delete().in("id", ids)
    alert(`포트폴리오 갱신 실패: ${updateErr.message}`)
    return
  }

  // 3. state 갱신
  setHoldings(prev => prev.map(h =>
    h.id === holdingId ? { ...h, avgPrice: newAvg, quantity: totalQty } : h
  ))
  const newTxRecords: Transaction[] = inserted.map((r: {
    id: string; holding_id: string; code: string; name: string;
    price: number; quantity: number; executed_at: string; note: string | null
  }) => ({
    id: r.id,
    holdingId: r.holding_id,
    code: r.code,
    name: r.name,
    price: r.price,
    quantity: r.quantity,
    executedAt: r.executed_at,
    note: r.note,
  }))
  setTransactionsByHolding(prev => ({
    ...prev,
    [holdingId]: [...newTxRecords, ...(prev[holdingId] ?? [])].sort((a, b) =>
      b.executedAt.localeCompare(a.executedAt)
    ),
  }))
}, [user, holdings])
```

- [ ] **Step 4: `fetchTransactionsForHolding` callback 추가**

`applyTransactions` 직후 다음 추가:

```tsx
const fetchTransactionsForHolding = useCallback(async (holdingId: string) => {
  if (!user) return
  if (transactionsByHolding[holdingId] !== undefined) return  // 이미 fetch한 종목 스킵

  const { data, error } = await supabase
    .from("portfolio_transactions")
    .select("*")
    .eq("holding_id", holdingId)
    .order("executed_at", { ascending: false })

  if (error || !data) {
    setTransactionsByHolding(prev => ({ ...prev, [holdingId]: [] }))
    return
  }
  const records: Transaction[] = data.map(r => ({
    id: r.id,
    holdingId: r.holding_id,
    code: r.code,
    name: r.name,
    price: r.price,
    quantity: r.quantity,
    executedAt: r.executed_at,
    note: r.note,
  }))
  setTransactionsByHolding(prev => ({ ...prev, [holdingId]: records }))
}, [user, transactionsByHolding])
```

- [ ] **Step 5: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/PortfolioPage.tsx
git commit -m "feat(portfolio): applyTransactions/fetchTransactionsForHolding callback"
```

---

## Task 4: AveragingDownCalc — 반영 버튼 (basic + multi)

**Files:**
- Modify: `frontend/src/components/AveragingDownCalc.tsx`

- [ ] **Step 1: 컴포넌트 시그니처 변경 (onApply prop 추가)**

기존 line 32:
```tsx
export function AveragingDownCalc({ holding }: { holding: HoldingInput }) {
```

다음으로 변경:
```tsx
export function AveragingDownCalc({ holding, onApply }: {
  holding: HoldingInput
  onApply?: (txs: NewTransaction[]) => Promise<void>
}) {
```

- [ ] **Step 2: basic 모드 결과 카드에 "포트폴리오에 반영" 버튼 추가**

`basicResult`가 표시되는 결과 카드 영역(코드 검색: `basicResult` 표시 JSX 부분, 결과를 보여주는 div 마지막에)에 다음 추가:

```tsx
{basicResult && onApply && (
  <button
    onClick={async () => {
      const p = parseInt(addPrice.replace(/,/g, ""))
      const q = parseInt(addQty.replace(/,/g, ""))
      if (!p || !q || p <= 0 || q <= 0) return
      await onApply([{ price: p, quantity: q, note: "basic" }])
    }}
    className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
  >
    포트폴리오에 반영
  </button>
)}
```

위치 가이드: `basicResult`의 `newAvg`/`totalQty`가 표시된 결과 박스 마지막에. 라인 번호는 코드 변경 후 변동 가능. `basicResult && (` 블록 안 마지막 자식.

- [ ] **Step 3: multi 모드 결과 영역에 "전체 단계 반영" 버튼 추가**

`multiResult`가 테이블로 표시되는 영역 마지막(테이블 닫힘 직후)에 다음 추가:

```tsx
{multiResult.length > 0 && onApply && (
  <button
    onClick={async () => {
      const validSteps = steps
        .map(s => ({
          price: parseInt(s.price.replace(/,/g, "")),
          quantity: parseInt(s.quantity.replace(/,/g, "")),
        }))
        .filter(s => s.price > 0 && s.quantity > 0)
      if (validSteps.length === 0) return
      const total = validSteps.length
      const txs: NewTransaction[] = validSteps.map((s, i) => ({
        price: s.price,
        quantity: s.quantity,
        note: `multi step ${i + 1}/${total}`,
      }))
      await onApply(txs)
    }}
    className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
  >
    전체 단계 반영 ({steps.filter(s => parseInt(s.price.replace(/,/g, "")) > 0 && parseInt(s.quantity.replace(/,/g, "")) > 0).length}건)
  </button>
)}
```

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc PASS, build PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/AveragingDownCalc.tsx
git commit -m "feat(averaging-calc): basic/multi 모드 반영 버튼 + onApply prop"
```

---

## Task 5: PortfolioPage — AveragingDownCalc onApply 연결 + 단일 검증

**Files:**
- Modify: `frontend/src/components/PortfolioPage.tsx`

- [ ] **Step 1: 인라인 calc에 onApply prop 전달**

기존 (Task 2에서 변경한 라인 970-979 영역):
```tsx
<AveragingDownCalc
  holding={{
    id: h.id,
    code: h.code,
    name: h.name,
    avgPrice: h.avgPrice,
    quantity: h.quantity,
    currentPrice: h.currentPrice,
  }}
/>
```

다음으로 변경:
```tsx
<AveragingDownCalc
  holding={{
    id: h.id,
    code: h.code,
    name: h.name,
    avgPrice: h.avgPrice,
    quantity: h.quantity,
    currentPrice: h.currentPrice,
  }}
  onApply={(txs) => applyTransactions(h.id, txs)}
/>
```

- [ ] **Step 2: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: dev 서버 수동 검증**

Run: `cd frontend && npm run dev`

다음 시나리오 확인 (사용자 직접):
1. 포트폴리오 페이지 → 종목 카드 확장 → 물타기 계산기 열기
2. **basic 모드**: 추가 매수가·수량 입력 → "포트폴리오에 반영" 클릭 → confirm 다이얼로그 표시 확인 → OK → 평단·수량 갱신 확인
3. **multi 모드**: 2~3 단계 입력 → "전체 단계 반영" 클릭 → confirm → OK → 평단·수량 갱신 확인
4. **취소**: confirm 취소 → 변경 없음 확인

검증 결과를 사용자에게 보고. 이슈 있으면 수정 후 재검증.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/PortfolioPage.tsx
git commit -m "feat(portfolio): AveragingDownCalc onApply 연결"
```

---

## Task 6: AveragingDownSheet — 반영 버튼 + onApply prop

**Files:**
- Modify: `frontend/src/components/AveragingDownSheet.tsx`

- [ ] **Step 1: import 확장**

기존 line 6:
```tsx
import type { HoldingInput } from "./AveragingDownCalc"
```

다음으로 변경:
```tsx
import type { HoldingInput, NewTransaction } from "./AveragingDownCalc"
```

- [ ] **Step 2: Props 확장**

기존 라인 25-28:
```tsx
interface AveragingDownSheetProps {
  holdings: HoldingInput[]
  onClose: () => void
}
```

다음으로 변경:
```tsx
interface AveragingDownSheetProps {
  holdings: HoldingInput[]
  onClose: () => void
  onApply?: (holdingId: string, txs: NewTransaction[]) => Promise<void>
}
```

- [ ] **Step 3: StockEntry에 holdingId 필드 추가 + 시그니처에 onApply 추가**

기존 라인 10-23 (`interface StockEntry`):
```tsx
interface StockEntry {
  code: string
  name: string
  avgPrice: number
  quantity: number
  currentPrice: number | null
  addPrice: string
  ...
}
```

다음으로 변경 (id 추가):
```tsx
interface StockEntry {
  id: string
  code: string
  name: string
  avgPrice: number
  quantity: number
  currentPrice: number | null
  addPrice: string
  addQty: string
  targetAvg: string
  targetPrice: string
  targetQty: string
  targetField: "price" | "qty"
  steps: { price: string; quantity: string }[]
}
```

기존 라인 64:
```tsx
export function AveragingDownSheet({ holdings, onClose }: AveragingDownSheetProps) {
```

다음으로 변경:
```tsx
export function AveragingDownSheet({ holdings, onClose, onApply }: AveragingDownSheetProps) {
```

`holdings.map(h => ({ ...h, ... }))` 부분(라인 69)은 spread로 자동 id 포함됨 — 추가 변경 없음.

- [ ] **Step 4: 종목 카드에 반영 버튼 추가**

각 종목 entry를 렌더링하는 영역(검색: `visibleEntries.map((entry, idx) =>`) 안의 결과 영역 마지막에 다음 추가 (mode === "basic" / "multi" 분기):

```tsx
{onApply && mode === "basic" && (() => {
  const r = calcBasic(entry)
  if (!r) return null
  return (
    <button
      onClick={async () => {
        const p = parseInt(entry.addPrice.replace(/,/g, ""))
        const q = parseInt(entry.addQty.replace(/,/g, ""))
        if (!p || !q || p <= 0 || q <= 0) return
        await onApply(entry.id, [{ price: p, quantity: q, note: "basic" }])
      }}
      className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      반영
    </button>
  )
})()}

{onApply && mode === "multi" && (() => {
  const validSteps = entry.steps
    .map(s => ({
      price: parseInt(s.price.replace(/,/g, "")),
      quantity: parseInt(s.quantity.replace(/,/g, "")),
    }))
    .filter(s => s.price > 0 && s.quantity > 0)
  if (validSteps.length === 0) return null
  const total = validSteps.length
  return (
    <button
      onClick={async () => {
        const txs: NewTransaction[] = validSteps.map((s, i) => ({
          price: s.price,
          quantity: s.quantity,
          note: `multi step ${i + 1}/${total}`,
        }))
        await onApply(entry.id, txs)
      }}
      className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      반영 ({total}건)
    </button>
  )
})()}
```

위치 가이드: 각 entry의 결과 박스(예: `calcBasic`/`calcMulti` 결과 표시 div) 마지막에. 정확한 위치는 기존 코드 구조 따라 결정.

- [ ] **Step 5: 타입 체크 + 빌드**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc PASS, build PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/AveragingDownSheet.tsx
git commit -m "feat(averaging-sheet): 종목별 반영 버튼 + onApply prop"
```

---

## Task 7: PortfolioPage — AveragingDownSheet onApply 연결 + 다중 검증

**Files:**
- Modify: `frontend/src/components/PortfolioPage.tsx`

- [ ] **Step 1: AveragingDownSheet에 onApply prop 전달**

기존 (Task 2에서 변경한 라인 988-999 영역):
```tsx
{showAvgSheet && (
  <AveragingDownSheet
    holdings={enrichedHoldings.filter(h => checkedIds.has(h.id)).map(h => ({
      id: h.id,
      code: h.code,
      name: h.name,
      avgPrice: h.avgPrice,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
    }))}
    onClose={() => setShowAvgSheet(false)}
  />
)}
```

다음으로 변경:
```tsx
{showAvgSheet && (
  <AveragingDownSheet
    holdings={enrichedHoldings.filter(h => checkedIds.has(h.id)).map(h => ({
      id: h.id,
      code: h.code,
      name: h.name,
      avgPrice: h.avgPrice,
      quantity: h.quantity,
      currentPrice: h.currentPrice,
    }))}
    onClose={() => setShowAvgSheet(false)}
    onApply={applyTransactions}
  />
)}
```

- [ ] **Step 2: 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: dev 서버 수동 검증**

다음 시나리오 (사용자 직접):
1. 포트폴리오 → 여러 종목 체크 → "물타기 시뮬" 시트 열기
2. **시트에서 종목 A에 basic 입력 → "반영" 클릭** → confirm → OK → 시트 안에서 갱신 확인
3. **종목 B에 multi 입력 → "반영" 클릭** → confirm → OK → 갱신 확인
4. 시트 닫기 → 포트폴리오 카드에서 평단·수량 갱신 확인

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/PortfolioPage.tsx
git commit -m "feat(portfolio): AveragingDownSheet onApply 연결"
```

---

## Task 8: PortfolioPage — 매수 이력 섹션 (lazy load + 표시)

**Files:**
- Modify: `frontend/src/components/PortfolioPage.tsx`

- [ ] **Step 1: expand 시 fetch 트리거 추가**

`isExpanded = expandedId === h.id` 라인(라인 734 부근) 검색. expand 토글이 일어나는 위치(`onClick={() => setExpandedId(isExpanded ? null : h.id)}`)에 lazy fetch 호출 추가:

기존 라인 768 부근:
```tsx
onClick={() => setExpandedId(isExpanded ? null : h.id)}
```

다음으로 변경:
```tsx
onClick={() => {
  const newExpanded = isExpanded ? null : h.id
  setExpandedId(newExpanded)
  if (newExpanded) fetchTransactionsForHolding(newExpanded)
}}
```

- [ ] **Step 2: 카드 확장 영역에 매수 이력 섹션 추가**

`isExpanded && (...)` 블록 안 마지막(다른 DetailRow 끝, `</div>` 직전)에 다음 추가:

```tsx
{/* 매수 이력 */}
<DetailRow label="매수 이력" icon={<Plus className="w-3 h-3" />}>
  {(() => {
    const txs = transactionsByHolding[h.id]
    if (txs === undefined) return <span className="text-muted-foreground text-xs">불러오는 중...</span>
    if (txs.length === 0) return <span className="text-muted-foreground text-xs">추가 매수 이력 없음</span>
    return (
      <ul className="space-y-1 text-xs w-full">
        {txs.map(tx => (
          <li key={tx.id} className="flex justify-between items-baseline">
            <span className="text-muted-foreground tabular-nums">
              {new Date(tx.executedAt).toLocaleDateString("ko-KR", {
                year: "2-digit", month: "2-digit", day: "2-digit"
              })}
            </span>
            <span className="tabular-nums text-right">
              <span className="font-medium">{formatPrice(tx.price)}</span>원 ×{" "}
              <span className="font-medium">{tx.quantity.toLocaleString()}</span>주
              {tx.note && (
                <span className="text-muted-foreground/60 ml-1.5 text-[10px]">{tx.note}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    )
  })()}
</DetailRow>
```

`Plus` 아이콘이 이미 import 되어 있는지 확인. 없다면 라인 3 부근의 `lucide-react` import에 추가.

- [ ] **Step 3: 타입 체크 + 빌드**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc PASS, build PASS

- [ ] **Step 4: dev 서버 수동 검증**

다음 시나리오:
1. 포트폴리오 → 종목 카드 확장 → "매수 이력" 섹션 표시 확인 (이력 없는 종목: "추가 매수 이력 없음")
2. Task 5 또는 7에서 반영한 종목 → 카드 확장 → 이력 표시 (시간 역순) 확인
3. 다시 같은 카드 접었다 펼치기 → 추가 fetch 안 일어남 확인 (브라우저 네트워크 탭)
4. 다른 종목 확장 → 새 fetch 발생 확인

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/PortfolioPage.tsx
git commit -m "feat(portfolio): 카드 확장 시 매수 이력 섹션 lazy load"
```

---

## Task 9: 통합 검증 + cascade 검증 + push

**Files:** (없음 — 검증만)

- [ ] **Step 1: 최종 빌드**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc PASS, build PASS

- [ ] **Step 2: 통합 수동 시나리오 (사용자 직접)**

dev 서버에서 다음 전체 흐름 검증:

1. **basic 단일 반영**: 카드 확장 → 물타기 → basic → 반영 → 평단·수량 갱신 + 이력 1건
2. **multi 단일 반영**: 같은 종목 → multi 3단계 → 반영 → 이력 3건 추가 (총 4건)
3. **시트 다중 반영**: 2 종목 체크 → 시트 열기 → 종목 A·B 각각 basic 반영 → 닫고 카드 확장 → 각 이력 표시
4. **확인 취소**: 반영 시 confirm 취소 → 변경 없음
5. **이력 lazy load**: 새 종목 확장 → fetch 트리거 → 이력 표시
6. **반복 확장**: 같은 종목 접었다 펼치기 → 재fetch 안 함

- [ ] **Step 3: cascade 동작 검증 (선택)**

Supabase SQL Editor에서 실행:
```sql
-- 테스트용 holding 1개 삭제 후 transactions가 cascade로 삭제됐는지 확인
SELECT count(*) FROM portfolio_transactions WHERE holding_id = '<deleted-holding-id>';
-- 기대: 0
```

- [ ] **Step 4: push (사용자 승인 시)**

```bash
git push origin main
```

GitHub Pages가 자동 재배포되어 운영 환경 반영.

---

## Verification Summary

각 Task 완료 후 검증 방법:

| 검증 종류 | 명령 |
|---|---|
| TypeScript 타입 | `cd frontend && npx tsc --noEmit` |
| Vite 빌드 | `cd frontend && npm run build` |
| 수동 시나리오 | `cd frontend && npm run dev` → 브라우저 |
| Supabase 스키마 | SQL Editor에서 schema 확인 |

**주의 사항**:
- Task 1 SQL 실행은 **사용자 책임** — 실행 안 하면 후속 task의 Supabase 호출 실패
- 모든 Supabase 호출은 RLS로 보호됨 — 로그인 필요
- frontend 단위 테스트 인프라 없음 (vitest/jest) — 정적·수동 검증만 가능
- Task 1의 `git add -f` 외에는 일반 `git add` (docs/는 .gitignore이지만 task_history.md처럼 tracked 파일은 자동 처리)
