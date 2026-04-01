import { useState, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss"
import { X, Plus, Trash2, Calculator, Target, Layers, TrendingDown, ArrowRight } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import type { HoldingInput } from "./AveragingDownCalc"

type Mode = "basic" | "target" | "multi"

interface StockEntry {
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

interface AveragingDownSheetProps {
  holdings: HoldingInput[]
  onClose: () => void
}

function calcBasic(entry: StockEntry) {
  const p = parseInt(entry.addPrice.replace(/,/g, ""))
  const q = parseInt(entry.addQty.replace(/,/g, ""))
  if (!p || !q || p <= 0 || q <= 0) return null
  const totalCost = entry.avgPrice * entry.quantity + p * q
  const totalQty = entry.quantity + q
  const newAvg = Math.round(totalCost / totalQty)
  const avgChange = ((newAvg - entry.avgPrice) / entry.avgPrice) * 100
  return { newAvg, totalCost, totalQty, avgChange, addCost: p * q }
}

function calcMulti(entry: StockEntry) {
  const rows: { step: number; avg: number; cumQty: number; cumCost: number }[] = []
  let cumQty = entry.quantity
  let cumCost = entry.avgPrice * entry.quantity
  for (let i = 0; i < entry.steps.length; i++) {
    const p = parseInt(entry.steps[i].price.replace(/,/g, ""))
    const q = parseInt(entry.steps[i].quantity.replace(/,/g, ""))
    if (!p || !q || p <= 0 || q <= 0) continue
    cumCost += p * q
    cumQty += q
    rows.push({ step: i + 1, avg: Math.round(cumCost / cumQty), cumQty, cumCost })
  }
  return rows
}

function PctText({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("font-bold tabular-nums", value >= 0 ? "text-red-500" : "text-blue-500", className)}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  )
}

export function AveragingDownSheet({ holdings, onClose }: AveragingDownSheetProps) {
  const [mode, setMode] = useState<Mode>("basic")
  const { sheetRef, handleRef } = useSwipeToDismiss(onClose)

  const [entries, setEntries] = useState<StockEntry[]>(() =>
    holdings.map(h => ({
      ...h,
      addPrice: h.currentPrice?.toString() ?? "",
      addQty: "",
      targetAvg: "",
      targetPrice: h.currentPrice?.toString() ?? "",
      targetQty: "",
      targetField: "price" as const,
      steps: [{ price: h.currentPrice?.toString() ?? "", quantity: "" }],
    }))
  )
  const [excludedCodes, setExcludedCodes] = useState<Set<string>>(new Set())

  const visibleEntries = entries.filter(e => !excludedCodes.has(e.code))

  const updateEntry = useCallback((idx: number, patch: Partial<StockEntry>) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }, [])

  const updateStep = useCallback((entryIdx: number, stepIdx: number, field: "price" | "quantity", value: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      const steps = e.steps.map((s, j) => j === stepIdx ? { ...s, [field]: value.replace(/[^0-9]/g, "") } : s)
      return { ...e, steps }
    }))
  }, [])

  const addStep = useCallback((entryIdx: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, steps: [...e.steps, { price: e.currentPrice?.toString() ?? "", quantity: "" }] }
    }))
  }, [])

  const removeStep = useCallback((entryIdx: number, stepIdx: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, steps: e.steps.filter((_, j) => j !== stepIdx) }
    }))
  }, [])

  // 종합 요약
  const summary = useMemo(() => {
    let totalEval = 0
    let evalAvailable = true
    for (const e of visibleEntries) {
      if (e.currentPrice == null) { evalAvailable = false; break }
      totalEval += e.currentPrice * e.quantity
    }

    if (mode === "basic") {
      let origCost = 0, newCost = 0
      let addedCost = 0, newEval = 0
      for (const e of visibleEntries) {
        origCost += e.avgPrice * e.quantity
        const r = calcBasic(e)
        if (r) {
          newCost += r.totalCost
          addedCost += r.addCost
          if (e.currentPrice != null) newEval += e.currentPrice * r.totalQty
        } else {
          newCost += e.avgPrice * e.quantity
          if (e.currentPrice != null) newEval += e.currentPrice * e.quantity
        }
      }
      const origProfitRate = evalAvailable && origCost > 0 ? ((totalEval - origCost) / origCost) * 100 : null
      const newProfitRate = evalAvailable && newCost > 0 ? ((newEval - newCost) / newCost) * 100 : null
      return { origCost, newCost, addedCost, origProfitRate, newProfitRate }
    }
    if (mode === "multi") {
      let origCost = 0, finalCost = 0, addedCost = 0, newEval = 0
      for (const e of visibleEntries) {
        origCost += e.avgPrice * e.quantity
        const rows = calcMulti(e)
        if (rows.length > 0) {
          const last = rows[rows.length - 1]
          finalCost += last.cumCost
          addedCost += last.cumCost - e.avgPrice * e.quantity
          if (e.currentPrice != null) newEval += e.currentPrice * last.cumQty
        } else {
          finalCost += e.avgPrice * e.quantity
          if (e.currentPrice != null) newEval += e.currentPrice * e.quantity
        }
      }
      const origProfitRate = evalAvailable && origCost > 0 ? ((totalEval - origCost) / origCost) * 100 : null
      const newProfitRate = evalAvailable && finalCost > 0 ? ((newEval - finalCost) / finalCost) * 100 : null
      return { origCost, newCost: finalCost, addedCost, origProfitRate, newProfitRate }
    }
    return null
  }, [mode, visibleEntries])

  const modes: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "기본", icon: <Calculator className="w-3.5 h-3.5" /> },
    { key: "target", label: "목표 역산", icon: <Target className="w-3.5 h-3.5" /> },
    { key: "multi", label: "다단계", icon: <Layers className="w-3.5 h-3.5" /> },
  ]

  const numInput = "w-full px-3 py-2 rounded-xl border border-border/60 bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 tabular-nums transition-shadow placeholder:text-muted-foreground/40"

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain"
      >
        {/* Handle */}
        <div ref={handleRef} className="flex items-center justify-center pt-5 pb-3 cursor-grab relative sticky top-0 bg-background/95 backdrop-blur-sm z-10 rounded-t-3xl">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/20" />
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground/60 hover:text-foreground p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="닫기">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 pb-8 pt-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4.5 h-4.5 text-primary" />
            <h3 className="text-base font-bold tracking-tight">물타기 시뮬레이션</h3>
          </div>
          <p className="text-[11px] text-muted-foreground/70 mb-4">{visibleEntries.length}종목 종합 계산</p>

          {/* Mode tabs */}
          <div className="flex gap-1.5 mb-5 bg-muted/50 p-1 rounded-xl">
            {modes.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex items-center gap-1.5 flex-1 py-2 text-[11px] rounded-[10px] font-semibold transition-all text-center justify-center",
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

          {/* 종합 요약 */}
          {summary && (
            <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent p-4 mb-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/70">현재 총 투자금</span>
                  <span className="text-sm font-semibold tabular-nums">{formatPrice(summary.origCost)}원</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/70">추가 투자금</span>
                  <span className={cn("text-sm font-bold tabular-nums", summary.addedCost > 0 ? "text-primary" : "text-muted-foreground")}>
                    {summary.addedCost > 0 ? "+" : ""}{formatPrice(summary.addedCost)}원
                  </span>
                </div>

                <div className="border-t border-border/30 my-1" />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground/70">물타기 후 총 투자금</span>
                  <span className="text-base font-bold tabular-nums">{formatPrice(summary.newCost)}원</span>
                </div>

                {summary.origProfitRate != null && summary.newProfitRate != null && (
                  <>
                    <div className="border-t border-border/30 my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-foreground/70">총 수익률</span>
                      <div className="flex items-center gap-1.5">
                        <PctText value={summary.origProfitRate} className="text-xs" />
                        <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                        <span className={cn(
                          "text-sm font-bold tabular-nums px-2 py-0.5 rounded-md",
                          summary.newProfitRate >= 0 ? "text-red-600 bg-red-500/8" : "text-blue-600 bg-blue-500/8"
                        )}>
                          {summary.newProfitRate >= 0 ? "+" : ""}{summary.newProfitRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 종목별 입력 */}
          <div className="space-y-3">
            {visibleEntries.map((entry) => {
              const idx = entries.findIndex(e => e.code === entry.code)
              const basicR = mode === "basic" ? calcBasic(entry) : null
              const multiR = mode === "multi" ? calcMulti(entry) : null

              return (
                <div key={entry.code} className="rounded-2xl border border-border/50 p-4 transition-colors hover:border-border/80">
                  {/* 종목 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold truncate">{entry.name}</span>
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{entry.code}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {formatPrice(entry.avgPrice)}원 · {entry.quantity}주
                      </span>
                      <button
                        onClick={() => setExcludedCodes(prev => new Set([...prev, entry.code]))}
                        className="p-1 rounded-full hover:bg-muted text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                        title="시뮬레이션에서 제외"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 기본 모드 */}
                  {mode === "basic" && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">추가 매수가</label>
                          <input
                            type="text" inputMode="numeric" value={entry.addPrice}
                            onChange={e => updateEntry(idx, { addPrice: e.target.value.replace(/[^0-9]/g, "") })}
                            placeholder="매수가" className={numInput}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">추가 수량</label>
                          <input
                            type="text" inputMode="numeric" value={entry.addQty}
                            onChange={e => updateEntry(idx, { addQty: e.target.value.replace(/[^0-9]/g, "") })}
                            placeholder="수량" className={numInput}
                          />
                        </div>
                      </div>
                      {basicR && (
                        <div className="flex items-center gap-2.5 mt-3 text-[11px] flex-wrap">
                          <span>새 평균 <span className="font-bold tabular-nums">{formatPrice(basicR.newAvg)}원</span></span>
                          <PctText value={basicR.avgChange} className="text-[11px]" />
                          <span className="text-muted-foreground/60 tabular-nums">총 {formatPrice(basicR.totalCost)}원 · {basicR.totalQty}주</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* 목표 역산 모드 */}
                  {mode === "target" && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">목표 평균단가</label>
                          <input
                            type="text" inputMode="numeric" value={entry.targetAvg}
                            onChange={e => updateEntry(idx, { targetAvg: e.target.value.replace(/[^0-9]/g, "") })}
                            placeholder="목표 평균단가" className={numInput}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">
                            {entry.targetField === "price" ? "매수 예정가" : "추가 수량"}
                          </label>
                          {entry.targetField === "price" ? (
                            <input
                              type="text" inputMode="numeric" value={entry.targetPrice}
                              onChange={e => updateEntry(idx, { targetPrice: e.target.value.replace(/[^0-9]/g, "") })}
                              placeholder="매수가" className={numInput}
                            />
                          ) : (
                            <input
                              type="text" inputMode="numeric" value={entry.targetQty}
                              onChange={e => updateEntry(idx, { targetQty: e.target.value.replace(/[^0-9]/g, "") })}
                              placeholder="수량" className={numInput}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateEntry(idx, { targetField: "price" })}
                          className={cn("flex-1 py-1.5 text-[10px] rounded-lg font-medium transition-colors", entry.targetField === "price" ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground")}
                        >
                          매수가 → 수량
                        </button>
                        <button
                          onClick={() => updateEntry(idx, { targetField: "qty" })}
                          className={cn("flex-1 py-1.5 text-[10px] rounded-lg font-medium transition-colors", entry.targetField === "qty" ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground")}
                        >
                          수량 → 매수가
                        </button>
                      </div>
                      <TargetResultRow entry={entry} />
                    </div>
                  )}

                  {/* 다단계 모드 */}
                  {mode === "multi" && (
                    <div className="space-y-2.5">
                      {entry.steps.map((s, si) => (
                        <div key={si} className="flex items-end gap-2">
                          <span className="text-[10px] text-muted-foreground/50 font-bold pb-2.5 w-4 text-center shrink-0">{si + 1}</span>
                          <div className="flex-1">
                            {si === 0 && <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">매수가</label>}
                            <input
                              type="text" inputMode="numeric" value={s.price}
                              onChange={e => updateStep(idx, si, "price", e.target.value)}
                              placeholder="매수가" className={numInput}
                            />
                          </div>
                          <div className="flex-1">
                            {si === 0 && <label className="text-[10px] text-muted-foreground/70 font-medium mb-1 block">수량</label>}
                            <input
                              type="text" inputMode="numeric" value={s.quantity}
                              onChange={e => updateStep(idx, si, "quantity", e.target.value)}
                              placeholder="수량" className={numInput}
                            />
                          </div>
                          <button
                            onClick={() => removeStep(idx, si)}
                            disabled={entry.steps.length <= 1}
                            className="p-1.5 mb-0.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-15 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive/60" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addStep(idx)} className="flex items-center gap-1 text-[11px] text-primary font-medium hover:text-primary/80 transition-colors">
                        <Plus className="w-3.5 h-3.5" />단계 추가
                      </button>
                      {multiR && multiR.length > 0 && (
                        <div className="text-[11px] flex items-center gap-3 mt-1 flex-wrap">
                          {multiR.map(r => {
                            const ch = ((r.avg - entry.avgPrice) / entry.avgPrice) * 100
                            return (
                              <span key={r.step} className="inline-flex items-center gap-1">
                                <span className="text-muted-foreground/60">{r.step}차</span>
                                <span className="font-bold tabular-nums">{formatPrice(r.avg)}</span>
                                <PctText value={ch} className="text-[10px]" />
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function TargetResultRow({ entry }: { entry: StockEntry }) {
  const tAvg = parseInt(entry.targetAvg.replace(/,/g, ""))
  if (!tAvg || tAvg <= 0) return null

  if (entry.targetField === "price") {
    const p = parseInt(entry.targetPrice.replace(/,/g, ""))
    if (!p || p <= 0) return null
    const denom = tAvg - p
    if (denom === 0) return <span className="text-[11px] text-destructive">목표 평균단가와 매수가가 같습니다</span>
    const x = (entry.avgPrice * entry.quantity - tAvg * entry.quantity) / denom
    if (x <= 0) return <span className="text-[11px] text-destructive">해당 조건으로는 목표 달성 불가</span>
    const neededQty = Math.ceil(x)
    return (
      <div className="text-[11px] bg-muted/40 rounded-xl px-3 py-2">
        필요 <span className="font-bold">{neededQty}주</span>
        <span className="text-muted-foreground/60 ml-1.5">(추가 {formatPrice(p * neededQty)}원)</span>
      </div>
    )
  } else {
    const q = parseInt(entry.targetQty.replace(/,/g, ""))
    if (!q || q <= 0) return null
    const neededPrice = Math.round((tAvg * (entry.quantity + q) - entry.avgPrice * entry.quantity) / q)
    if (neededPrice <= 0) return <span className="text-[11px] text-destructive">해당 조건으로는 목표 달성 불가</span>
    return (
      <div className="text-[11px] bg-muted/40 rounded-xl px-3 py-2">
        필요 매수가 <span className="font-bold tabular-nums">{formatPrice(neededPrice)}원</span>
        <span className="text-muted-foreground/60 ml-1.5">(추가 {formatPrice(neededPrice * q)}원)</span>
      </div>
    )
  }
}
