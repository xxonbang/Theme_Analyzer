import { useState, useMemo, useCallback } from "react"
import { Plus, Trash2, Calculator, Target, Layers } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"

// --- Types ---

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

type Mode = "basic" | "target" | "multi"

interface Step {
  price: string
  quantity: string
}

function PctText({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-bold tabular-nums", value >= 0 ? "text-red-500" : "text-blue-500", className)}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  )
}

// --- Component ---

export function AveragingDownCalc({ holding, onApply }: {
  holding: HoldingInput
  onApply?: (txs: NewTransaction[]) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>("basic")

  const [addPrice, setAddPrice] = useState(holding.currentPrice?.toString() ?? "")
  const [addQty, setAddQty] = useState("")

  const [targetAvg, setTargetAvg] = useState("")
  const [targetField, setTargetField] = useState<"price" | "qty">("price")
  const [targetPrice, setTargetPrice] = useState(holding.currentPrice?.toString() ?? "")
  const [targetQty, setTargetQty] = useState("")

  const [steps, setSteps] = useState<Step[]>([
    { price: holding.currentPrice?.toString() ?? "", quantity: "" },
  ])

  const modes: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "기본", icon: <Calculator className="w-3 h-3" /> },
    { key: "target", label: "목표 역산", icon: <Target className="w-3 h-3" /> },
    { key: "multi", label: "다단계", icon: <Layers className="w-3 h-3" /> },
  ]

  const basicResult = useMemo(() => {
    const p = parseInt(addPrice.replace(/,/g, ""))
    const q = parseInt(addQty.replace(/,/g, ""))
    if (!p || !q || p <= 0 || q <= 0) return null

    const totalCost = holding.avgPrice * holding.quantity + p * q
    const totalQty = holding.quantity + q
    const newAvg = Math.round(totalCost / totalQty)
    const avgChange = ((newAvg - holding.avgPrice) / holding.avgPrice) * 100

    return { newAvg, totalCost, totalQty, avgChange }
  }, [addPrice, addQty, holding.avgPrice, holding.quantity])

  const targetResult = useMemo(() => {
    const tAvg = parseInt(targetAvg.replace(/,/g, ""))
    if (!tAvg || tAvg <= 0) return null

    if (targetField === "price") {
      const p = parseInt(targetPrice.replace(/,/g, ""))
      if (!p || p <= 0) return null
      const denom = tAvg - p
      if (denom === 0) return { type: "price" as const, error: "목표 평균단가와 매수가가 같습니다" }
      const x = (holding.avgPrice * holding.quantity - tAvg * holding.quantity) / denom
      if (x <= 0) return { type: "price" as const, error: "해당 조건으로는 목표 달성 불가" }
      const neededQty = Math.ceil(x)
      const totalCost = holding.avgPrice * holding.quantity + p * neededQty
      return { type: "price" as const, neededQty, totalCost, buyPrice: p }
    } else {
      const q = parseInt(targetQty.replace(/,/g, ""))
      if (!q || q <= 0) return null
      const neededPrice = Math.round((tAvg * (holding.quantity + q) - holding.avgPrice * holding.quantity) / q)
      if (neededPrice <= 0) return { type: "qty" as const, error: "해당 조건으로는 목표 달성 불가" }
      const totalCost = holding.avgPrice * holding.quantity + neededPrice * q
      return { type: "qty" as const, neededPrice, totalCost, addQty: q }
    }
  }, [targetAvg, targetField, targetPrice, targetQty, holding.avgPrice, holding.quantity])

  const multiResult = useMemo(() => {
    const rows: { step: number; price: number; qty: number; cumQty: number; cumCost: number; avg: number }[] = []
    let cumQty = holding.quantity
    let cumCost = holding.avgPrice * holding.quantity

    for (let i = 0; i < steps.length; i++) {
      const p = parseInt(steps[i].price.replace(/,/g, ""))
      const q = parseInt(steps[i].quantity.replace(/,/g, ""))
      if (!p || !q || p <= 0 || q <= 0) continue

      cumCost += p * q
      cumQty += q
      const avg = Math.round(cumCost / cumQty)
      rows.push({ step: i + 1, price: p, qty: q, cumQty, cumCost, avg })
    }

    return rows
  }, [steps, holding.avgPrice, holding.quantity])

  const addStep = useCallback(() => {
    setSteps(prev => [...prev, { price: holding.currentPrice?.toString() ?? "", quantity: "" }])
  }, [holding.currentPrice])

  const removeStep = useCallback((idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateStep = useCallback((idx: number, field: "price" | "quantity", value: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value.replace(/[^0-9]/g, "") } : s))
  }, [])

  const numInput = "w-full px-3 py-2 rounded-xl border border-border/60 bg-background text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 tabular-nums transition-shadow placeholder:text-muted-foreground/40"

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-3 bg-muted/40 p-0.5 rounded-lg">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "flex items-center gap-1 flex-1 py-1.5 text-[11px] rounded-md font-semibold transition-all text-center justify-center",
              mode === m.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* 현재 보유 정보 */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mb-3 px-0.5">
        <span className="tabular-nums">평균 {formatPrice(holding.avgPrice)}원</span>
        <span className="text-muted-foreground/20">|</span>
        <span>{holding.quantity}주</span>
        <span className="text-muted-foreground/20">|</span>
        <span className="tabular-nums">투자금 {formatPrice(holding.avgPrice * holding.quantity)}원</span>
      </div>

      {/* 기본 물타기 */}
      {mode === "basic" && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">추가 매수가 (원)</label>
              <input
                type="text" inputMode="numeric" value={addPrice}
                onChange={e => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="매수가" className={numInput}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">추가 수량 (주)</label>
              <input
                type="text" inputMode="numeric" value={addQty}
                onChange={e => setAddQty(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="수량" className={numInput}
              />
            </div>
          </div>

          {basicResult && (
            <div className="rounded-xl bg-muted/30 border border-border/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/70">새 평균단가</span>
                <span className="text-sm font-bold tabular-nums">{formatPrice(basicResult.newAvg)}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/70">평균단가 변동</span>
                <PctText value={basicResult.avgChange} className="text-xs" />
              </div>
              {holding.currentPrice && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/70">변경 후 수익률</span>
                  {(() => {
                    const pct = ((holding.currentPrice - basicResult.newAvg) / basicResult.newAvg) * 100
                    return <PctText value={pct} className="text-xs" />
                  })()}
                </div>
              )}
              <div className="border-t border-border/20 pt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/70">총 투자금</span>
                <span className="text-xs font-semibold tabular-nums">{formatPrice(basicResult.totalCost)}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/70">총 수량</span>
                <span className="text-xs font-semibold tabular-nums">{basicResult.totalQty}주</span>
              </div>
              {onApply && (
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
            </div>
          )}
        </div>
      )}

      {/* 목표가 역산 */}
      {mode === "target" && (
        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">목표 평균단가 (원)</label>
            <input
              type="text" inputMode="numeric" value={targetAvg}
              onChange={e => setTargetAvg(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="원하는 평균단가" className={numInput}
            />
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setTargetField("price")}
              className={cn(
                "flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors",
                targetField === "price" ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
              )}
            >
              매수가 입력 → 수량
            </button>
            <button
              onClick={() => setTargetField("qty")}
              className={cn(
                "flex-1 py-1.5 text-[11px] rounded-lg font-medium transition-colors",
                targetField === "qty" ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
              )}
            >
              수량 입력 → 매수가
            </button>
          </div>

          {targetField === "price" ? (
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">매수 예정가 (원)</label>
              <input
                type="text" inputMode="numeric" value={targetPrice}
                onChange={e => setTargetPrice(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="매수 예정가" className={numInput}
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">추가 수량 (주)</label>
              <input
                type="text" inputMode="numeric" value={targetQty}
                onChange={e => setTargetQty(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="추가 수량" className={numInput}
              />
            </div>
          )}

          {targetResult && (
            <div className="rounded-xl bg-muted/30 border border-border/30 p-3 space-y-2">
              {"error" in targetResult ? (
                <span className="text-xs text-destructive">{targetResult.error}</span>
              ) : targetResult.type === "price" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">필요 수량</span>
                    <span className="text-sm font-bold tabular-nums">{targetResult.neededQty}주</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">추가 투자금</span>
                    <span className="text-xs font-semibold tabular-nums">{formatPrice(targetResult.buyPrice * targetResult.neededQty)}원</span>
                  </div>
                  <div className="border-t border-border/20 pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">총 투자금</span>
                    <span className="text-xs font-semibold tabular-nums">{formatPrice(targetResult.totalCost)}원</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">필요 매수가</span>
                    <span className="text-sm font-bold tabular-nums">{formatPrice(targetResult.neededPrice)}원</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">추가 투자금</span>
                    <span className="text-xs font-semibold tabular-nums">{formatPrice(targetResult.neededPrice * targetResult.addQty)}원</span>
                  </div>
                  <div className="border-t border-border/20 pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">총 투자금</span>
                    <span className="text-xs font-semibold tabular-nums">{formatPrice(targetResult.totalCost)}원</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 다단계 시뮬레이션 */}
      {mode === "multi" && (
        <div className="space-y-2.5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-end gap-1.5">
              <span className="text-[10px] text-muted-foreground/40 font-bold pb-2.5 shrink-0 w-4 text-center">{i + 1}</span>
              <div className="flex-1">
                {i === 0 && <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">매수가</label>}
                <input
                  type="text" inputMode="numeric" value={s.price}
                  onChange={e => updateStep(i, "price", e.target.value)}
                  placeholder="매수가" className={numInput}
                />
              </div>
              <div className="flex-1">
                {i === 0 && <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">수량</label>}
                <input
                  type="text" inputMode="numeric" value={s.quantity}
                  onChange={e => updateStep(i, "quantity", e.target.value)}
                  placeholder="수량" className={numInput}
                />
              </div>
              <button
                onClick={() => removeStep(i)}
                disabled={steps.length <= 1}
                className="p-1.5 mb-0.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-15 shrink-0"
              >
                <Trash2 className="w-3 h-3 text-destructive/60" />
              </button>
            </div>
          ))}

          <button
            onClick={addStep}
            className="flex items-center gap-1 text-[11px] text-primary font-medium hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            단계 추가
          </button>

          {multiResult.length > 0 && (
            <div className="rounded-xl bg-muted/30 border border-border/30 p-3">
              <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground/60 font-medium mb-2 px-0.5">
                <span>단계</span>
                <span className="text-right">평균단가</span>
                <span className="text-right">누적수량</span>
                <span className="text-right">누적투자금</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] px-0.5 py-1.5 border-b border-border/20">
                <span className="text-muted-foreground/50">현재</span>
                <span className="text-right font-semibold tabular-nums">{formatPrice(holding.avgPrice)}</span>
                <span className="text-right tabular-nums">{holding.quantity}주</span>
                <span className="text-right tabular-nums">{formatPrice(holding.avgPrice * holding.quantity)}</span>
              </div>
              {multiResult.map(r => {
                const avgChange = ((r.avg - holding.avgPrice) / holding.avgPrice) * 100
                return (
                  <div key={r.step} className="grid grid-cols-4 gap-1 text-[10px] px-0.5 py-1.5 border-b border-border/15 last:border-0">
                    <span className="text-muted-foreground/50">{r.step}차</span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums">{formatPrice(r.avg)}</span>
                      <PctText value={avgChange} className="text-[9px] ml-1" />
                    </span>
                    <span className="text-right tabular-nums">{r.cumQty}주</span>
                    <span className="text-right tabular-nums">{formatPrice(r.cumCost)}</span>
                  </div>
                )
              })}
              {onApply && (() => {
                const validSteps = steps
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
                      await onApply(txs)
                    }}
                    className="mt-2 w-full px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    전체 단계 반영 ({total}건)
                  </button>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
