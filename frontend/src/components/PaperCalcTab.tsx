import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { X, RefreshCw, Search } from "lucide-react"
import { cn, formatPrice, getChangeBgColor } from "@/lib/utils"
import { fetchKisPrices, searchKisStock, type KisStockPrice } from "@/lib/kis-api"

interface PaperCalcItem {
  id: string
  code: string
  name: string
  assumedPrice: number
  quantity: number
  addedAt: string
}

interface PaperCalcTabProps {
  masterStocks: { code: string; name: string; market: string }[]
}

const STORAGE_KEY = "paper-calc-items"

export function PaperCalcTab({ masterStocks }: PaperCalcTabProps) {
  // 디바이스 단위 영속 (로그인 상태와 무관 — 가상 계산은 사용자 시뮬이라 본인 디바이스에 묶임).
  // 직접 삭제(✕ 또는 '전체 지우기') 전까지 보존.
  const [items, setItems] = useState<PaperCalcItem[]>(() => {
    if (typeof window === "undefined") return []
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    try { return JSON.parse(saved) as PaperCalcItem[] } catch { return [] }
  })
  const [livePrices, setLivePrices] = useState<Record<string, KisStockPrice>>({})
  const [refreshing, setRefreshing] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null)
  const [assumedPrice, setAssumedPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [kisSearching, setKisSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (items.length === 0) return
    const codes = items.map(it => it.code).filter(c => !livePrices[c])
    if (codes.length === 0) return
    fetchKisPrices(codes).then(({ prices }) => {
      setLivePrices(prev => ({ ...prev, ...prices }))
    }).catch(() => {})
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || selectedStock) return []
    return masterStocks
      .filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q))
      .slice(0, 8)
  }, [searchQuery, selectedStock, masterStocks])

  const selectStock = useCallback(async (code: string, name: string) => {
    setSelectedStock({ code, name })
    setSearchQuery("")
    setKisSearching(true)
    try {
      const result = await searchKisStock(code)
      if (result) {
        setLivePrices(prev => ({ ...prev, [code]: result }))
        setAssumedPrice(String(result.current_price))
      }
    } catch {
      // 실패해도 입력은 가능
    } finally {
      setKisSearching(false)
    }
  }, [])

  const resetForm = useCallback(() => {
    setSelectedStock(null)
    setAssumedPrice("")
    setQuantity("")
    setSearchQuery("")
    searchInputRef.current?.focus()
  }, [])

  const preview = useMemo(() => {
    if (!selectedStock) return null
    const p = parseInt(assumedPrice.replace(/,/g, ""))
    const q = parseInt(quantity.replace(/,/g, ""))
    if (!p || !q || p <= 0 || q <= 0) return null
    const cur = livePrices[selectedStock.code]?.current_price ?? p
    const invest = p * q
    const evalAmt = cur * q
    const profit = evalAmt - invest
    const rate = ((cur - p) / p) * 100
    return { p, q, cur, invest, evalAmt, profit, rate }
  }, [selectedStock, assumedPrice, quantity, livePrices])

  const addItem = useCallback(() => {
    if (!selectedStock || !preview) return
    const newItem: PaperCalcItem = {
      id: crypto.randomUUID(),
      code: selectedStock.code,
      name: selectedStock.name,
      assumedPrice: preview.p,
      quantity: preview.q,
      addedAt: new Date().toISOString(),
    }
    setItems(prev => [newItem, ...prev])
    resetForm()
  }, [selectedStock, preview, resetForm])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    if (items.length === 0) return
    if (!window.confirm(`${items.length}개 항목을 모두 지웁니다. 계속할까요?`)) return
    setItems([])
  }, [items.length])

  const refresh = useCallback(async () => {
    if (refreshing || items.length === 0) return
    setRefreshing(true)
    try {
      const codes = items.map(it => it.code)
      const { prices } = await fetchKisPrices(codes)
      setLivePrices(prev => ({ ...prev, ...prices }))
    } finally {
      setRefreshing(false)
    }
  }, [refreshing, items])

  const summary = useMemo(() => {
    if (items.length === 0) return null
    let totalInvest = 0
    let totalEval = 0
    let evalAvailable = true
    for (const it of items) {
      const cur = livePrices[it.code]?.current_price
      const invest = it.assumedPrice * it.quantity
      totalInvest += invest
      if (cur != null) {
        totalEval += cur * it.quantity
      } else {
        evalAvailable = false
        totalEval += invest
      }
    }
    const profit = totalEval - totalInvest
    const rate = totalInvest > 0 ? (profit / totalInvest) * 100 : 0
    return { totalInvest, totalEval, profit, rate, evalAvailable, count: items.length }
  }, [items, livePrices])

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-lg border border-border p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">종목 추가</div>

        {!selectedStock ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="종목명 또는 코드 검색"
                className="w-full px-3 py-2 rounded-lg border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                {searchResults.map(s => (
                  <button
                    key={s.code}
                    onClick={() => selectStock(s.code, s.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 bg-muted/40 rounded-md">
            <div>
              <span className="font-medium text-sm">{selectedStock.name}</span>
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">{selectedStock.code}</span>
              {kisSearching ? (
                <span className="ml-2 text-xs text-muted-foreground">현재가 조회 중...</span>
              ) : livePrices[selectedStock.code] ? (
                <span className="ml-2 text-xs">
                  현재가 <span className="font-semibold text-foreground">{formatPrice(livePrices[selectedStock.code].current_price)}</span>원
                </span>
              ) : null}
            </div>
            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1" aria-label="다른 종목 선택">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedStock && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground font-medium block">가정 매수가 (원)</label>
              <input
                type="text"
                inputMode="numeric"
                value={assumedPrice}
                onChange={e => setAssumedPrice(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={livePrices[selectedStock.code] ? formatPrice(livePrices[selectedStock.code].current_price) : "매수가"}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground font-medium block">수량 (주)</label>
              <input
                type="text"
                inputMode="numeric"
                value={quantity}
                onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="수량"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-base sm:text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-shadow"
              />
            </div>
          </div>
        )}

        {preview && (
          <div className="mt-3 p-3.5 bg-muted/40 rounded-lg space-y-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <span className="text-muted-foreground/80">매수금액</span>
              <span className="text-right font-medium tabular-nums text-foreground/90">{formatPrice(preview.invest)}원</span>
              <span className="text-muted-foreground/80">평가금액</span>
              <span className="text-right font-medium tabular-nums text-foreground/90">{formatPrice(preview.evalAmt)}원</span>
              <span className="text-muted-foreground/80">손익</span>
              <span className={cn("text-right font-semibold tabular-nums", preview.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {preview.profit >= 0 ? "+" : ""}{formatPrice(preview.profit)}원
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-[13px] text-muted-foreground/80">수익률</span>
              <span className={cn("font-bold tabular-nums px-2.5 py-1 rounded-md text-sm", getChangeBgColor(preview.rate))}>
                {preview.rate >= 0 ? "+" : ""}{preview.rate.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {preview && (
          <button
            onClick={addItem}
            className="w-full mt-3 px-3 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            누적 리스트에 추가
          </button>
        )}
      </div>

      {summary && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">종합 · {summary.count}종목</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-50 transition-colors"
              aria-label="현재가 새로고침"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
          {/* 메인 KPI: 수익률 + 손익 */}
          <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-border/40">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">수익률</div>
              <div className={cn("text-2xl font-bold tabular-nums leading-none", summary.rate >= 0 ? "text-red-500" : "text-blue-500")}>
                {summary.rate >= 0 ? "+" : ""}{summary.rate.toFixed(2)}<span className="text-base ml-0.5">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground mb-1">손익</div>
              <div className={cn("text-base font-semibold tabular-nums", summary.profit >= 0 ? "text-red-500" : "text-blue-500")}>
                {summary.profit >= 0 ? "+" : ""}{formatPrice(summary.profit)}원
              </div>
            </div>
          </div>
          {/* 보조: 매수·평가 */}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="space-y-0.5">
              <div className="text-muted-foreground">매수</div>
              <div className="font-medium tabular-nums text-foreground/85">{formatPrice(summary.totalInvest)}원</div>
            </div>
            <div className="space-y-0.5 text-right">
              <div className="text-muted-foreground">평가</div>
              <div className="font-medium tabular-nums text-foreground/85">{formatPrice(summary.totalEval)}원</div>
            </div>
          </div>
          {!summary.evalAvailable && (
            <div className="mt-3 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-amber-500" />
              일부 종목 현재가 미수집 — 새로고침
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">누적 리스트</span>
            <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
              전체 지우기
            </button>
          </div>
          <ul className="divide-y divide-border/40">
            {items.map(it => {
              const cur = livePrices[it.code]?.current_price
              const invest = it.assumedPrice * it.quantity
              const evalAmt = cur != null ? cur * it.quantity : invest
              const profit = evalAmt - invest
              const rate = cur != null ? ((cur - it.assumedPrice) / it.assumedPrice) * 100 : 0
              return (
                <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm truncate text-foreground">{it.name}</span>
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">{it.code}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      <span className="font-medium text-foreground/70">{formatPrice(it.assumedPrice)}</span>원 × {it.quantity.toLocaleString()}주
                      {cur != null && (
                        <span className="ml-2 text-muted-foreground/60">현재 {formatPrice(cur)}원</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className={cn("text-[13px] font-bold tabular-nums leading-tight", profit >= 0 ? "text-red-500" : "text-blue-500")}>
                      {profit >= 0 ? "+" : ""}{formatPrice(profit)}원
                    </div>
                    <div className={cn("inline-block text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded leading-tight", getChangeBgColor(rate))}>
                      {rate >= 0 ? "+" : ""}{rate.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0 transition-colors"
                    aria-label="삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {items.length === 0 && !preview && (
        <div className="text-center text-xs text-muted-foreground py-8 bg-muted/20 rounded-lg">
          종목을 검색하여 가정 매수가와 수량을 입력하면<br />수익률을 시뮬레이션할 수 있습니다.
        </div>
      )}
    </div>
  )
}
